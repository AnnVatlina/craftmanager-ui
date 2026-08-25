import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useProductPicker, SEARCH_MIN_LENGTH, DEBOUNCE_MS, PAGE_SIZE } from '../../src/composables/useProductPicker.js'

function makeProducts(names) {
  return names.map((name, i) => ({ id: String(i), name }))
}

describe('useProductPicker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('loads the 30 most recently added products on init, with no search param', async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ data: makeProducts(['Duck', 'Bunny']) })
    const { results, loading } = useProductPicker(fetchProducts)

    expect(loading.value).toBe(true)
    await flushPromises()

    expect(fetchProducts).toHaveBeenCalledWith({ per_page: PAGE_SIZE })
    expect(fetchProducts).not.toHaveBeenCalledWith(expect.objectContaining({ search: expect.anything() }))
    expect(results.value.map((p) => p.name)).toEqual(['Duck', 'Bunny'])
    expect(loading.value).toBe(false)
  })

  it('does not search below SEARCH_MIN_LENGTH characters', async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ data: makeProducts(['Duck']) })
    const { query } = useProductPicker(fetchProducts)
    await flushPromises()
    fetchProducts.mockClear()

    query.value = 'a'.repeat(SEARCH_MIN_LENGTH - 1)
    await nextTick()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50)

    expect(fetchProducts).not.toHaveBeenCalled()
  })

  it('searches once the query reaches SEARCH_MIN_LENGTH, after the debounce', async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ data: makeProducts(['Duck']) })
    const { query, results } = useProductPicker(fetchProducts)
    await flushPromises()
    fetchProducts.mockClear()

    query.value = 'duc'
    await nextTick()
    expect(fetchProducts).not.toHaveBeenCalled() // not yet — still debouncing

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50)

    expect(fetchProducts).toHaveBeenCalledWith({ search: 'duc', per_page: PAGE_SIZE })
    expect(results.value.map((p) => p.name)).toEqual(['Duck'])
  })

  it('debounces rapid keystrokes into a single request for the final query', async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ data: [] })
    const { query } = useProductPicker(fetchProducts)
    await flushPromises()
    fetchProducts.mockClear()

    for (const partial of ['d', 'du', 'duc', 'duck']) {
      query.value = partial
      await nextTick()
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 50) // never lets the debounce fire
    }
    await vi.advanceTimersByTimeAsync(100)

    expect(fetchProducts).toHaveBeenCalledTimes(1)
    expect(fetchProducts).toHaveBeenCalledWith({ search: 'duck', per_page: PAGE_SIZE })
  })

  it('reverts to the cached recent-30 list when the query drops back below the threshold', async () => {
    const fetchProducts = vi.fn().mockResolvedValue({ data: makeProducts(['Duck', 'Bunny']) })
    const { query, results } = useProductPicker(fetchProducts)
    await flushPromises()

    query.value = 'duck'
    await nextTick()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50)
    fetchProducts.mockClear()

    query.value = 'du'
    await nextTick()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50)

    expect(fetchProducts).not.toHaveBeenCalled() // no new request — served from cache
    expect(results.value.map((p) => p.name)).toEqual(['Duck', 'Bunny'])
  })

  it('ignores a slow earlier response that resolves after a later one', async () => {
    let resolveFirst
    const fetchProducts = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve })) // initial recent-30 load
      .mockResolvedValueOnce({ data: makeProducts(['Correct Result']) })

    const { query, results } = useProductPicker(fetchProducts)
    // initial load is still pending

    query.value = 'duck'
    await nextTick()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50) // second call resolves first

    resolveFirst({ data: makeProducts(['Stale Recent']) }) // now the stale first call resolves
    await flushPromises()

    expect(results.value.map((p) => p.name)).toEqual(['Correct Result'])
  })
})

// Fake timers are active in these tests, so a real setTimeout(…, 0) would
// never fire on its own — drain the microtask queue directly instead.
// Measured: a single `await` on a vi.fn().mockResolvedValue() takes 3 ticks
// to fully settle (mock call + promise wrapping + the await itself). 5 gives
// headroom without guessing — extra ticks are free, nothing else is queued.
async function flushPromises() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}
