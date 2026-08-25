import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import ProductPicker from '../../src/components/ProductPicker.vue'
import { productsApi } from '../../src/api/products.js'
import { DEBOUNCE_MS } from '../../src/composables/useProductPicker.js'

vi.mock('../../src/api/products.js', () => ({
  productsApi: { list: vi.fn() },
}))

// See useProductPicker.spec.js flushPromises() for why this loops rather
// than awaiting once: a mocked async call needs a few microtask ticks to
// settle, and extra ticks here are free since nothing else is queued.
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

// The dropdown is <Teleport to="body">, so it lands outside the mounted
// wrapper's own DOM tree — wrapper.find() only searches inside that tree
// and will never see it. Query document.body directly instead.
function body() {
  return new DOMWrapper(document.body)
}

describe('ProductPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    productsApi.list.mockReset()
    productsApi.list.mockResolvedValue({
      data: [
        { id: '1', name: 'Duck', category: 'Toys' },
        { id: '2', name: 'Bunny', category: 'Toys' },
      ],
    })
  })
  afterEach(() => vi.useRealTimers())

  it('shows the recent list on focus and emits select on click', async () => {
    const wrapper = mount(ProductPicker, { attachTo: document.body })
    await flush()

    await wrapper.find('input').trigger('focus')
    await wrapper.vm.$nextTick()

    const items = body().findAll('.picker-item')
    expect(items.map((i) => i.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('Duck'), expect.stringContaining('Bunny')])
    )

    await items[0].trigger('mousedown')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0][0].name).toBe('Duck')

    wrapper.unmount()
  })

  it('excludes products listed in excludeIds', async () => {
    const wrapper = mount(ProductPicker, { attachTo: document.body, props: { excludeIds: ['1'] } })
    await flush()
    await wrapper.find('input').trigger('focus')
    await wrapper.vm.$nextTick()

    const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
    expect(text).not.toContain('Duck')
    expect(text).toContain('Bunny')

    wrapper.unmount()
  })

  it('clears the input and closes the list after selecting a product', async () => {
    const wrapper = mount(ProductPicker, { attachTo: document.body })
    await flush()
    await wrapper.find('input').trigger('focus')
    await wrapper.vm.$nextTick()

    await body().findAll('.picker-item')[0].trigger('mousedown')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('input').element.value).toBe('')
    expect(body().find('.picker-list').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows a hint instead of results while below the search threshold', async () => {
    const wrapper = mount(ProductPicker, { attachTo: document.body })
    await flush()
    await wrapper.find('input').trigger('focus')
    await wrapper.find('input').setValue('du')
    await wrapper.vm.$nextTick()

    expect(body().find('.picker-hint').exists()).toBe(true)
    expect(body().find('.picker-item').exists()).toBe(false)

    wrapper.unmount()
  })

  describe('local mode (products prop)', () => {
    const localProducts = [
      { id: 'a', name: 'Морская свинка', category: 'Плюш' },
      { id: 'b', name: 'Зайка', category: 'Плюш' },
    ]

    it('shows every item on focus with no query, ignoring SEARCH_MIN_LENGTH', async () => {
      // Note: a background recent-30 server fetch still fires even in local
      // mode (see useProductPicker's docstring for why) — its results are
      // just never displayed. Asserted separately below.
      const wrapper = mount(ProductPicker, { attachTo: document.body, props: { products: localProducts } })
      await flush()
      await wrapper.find('input').trigger('focus')
      await wrapper.vm.$nextTick()

      const items = body().findAll('.picker-item')
      expect(items.map((i) => i.text())).toEqual(
        expect.arrayContaining([expect.stringContaining('Морская свинка'), expect.stringContaining('Зайка')])
      )
      expect(body().find('.picker-hint').exists()).toBe(false)

      wrapper.unmount()
    })

    it('filters the given list by name as the user types, even below 3 characters', async () => {
      const wrapper = mount(ProductPicker, { attachTo: document.body, props: { products: localProducts } })
      await flush()
      await wrapper.find('input').trigger('focus')
      await wrapper.find('input').setValue('за')
      await wrapper.vm.$nextTick()

      const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
      expect(text).toContain('Зайка')
      expect(text).not.toContain('Морская свинка')

      wrapper.unmount()
    })

    it('falls back to server-wide search when the local list has no match at 3+ characters', async () => {
      const wrapper = mount(ProductPicker, { attachTo: document.body, props: { products: localProducts } })
      await flush()
      await wrapper.find('input').trigger('focus')

      await wrapper.find('input').setValue('xyz') // matches neither local product
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50) // let the fallback's debounced search resolve
      await flush()

      // productsApi.list is mocked (top-level beforeEach) to return Duck/Bunny regardless of the search term.
      const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
      expect(text).toContain('Duck')
      expect(text).toContain('Bunny')
      expect(text).not.toContain('Морская свинка')

      wrapper.unmount()
    })

    it('returns to the local list once the query no longer needs a fallback', async () => {
      const wrapper = mount(ProductPicker, { attachTo: document.body, props: { products: localProducts } })
      await flush()
      await wrapper.find('input').trigger('focus')
      await wrapper.find('input').setValue('xyz')
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50)
      await flush()
      expect(body().findAll('.picker-item').map((i) => i.text()).join(' ')).toContain('Duck')

      await wrapper.find('input').setValue('за') // back to a query the local list actually matches
      await wrapper.vm.$nextTick()

      const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
      expect(text).toContain('Зайка')
      expect(text).not.toContain('Duck')

      wrapper.unmount()
    })

    it('switches from server search to the local list reactively if products changes after mount', async () => {
      // Mirrors the real flow: a row's picker mounts before any channel is
      // selected (server mode), then a channel with a fair-prep list gets
      // picked while this picker is still open and unused.
      const wrapper = mount(ProductPicker, { attachTo: document.body, props: { products: null } })
      await flush()
      await wrapper.find('input').trigger('focus')
      await wrapper.vm.$nextTick()
      expect(body().findAll('.picker-item').map((i) => i.text())).toEqual(
        expect.arrayContaining([expect.stringContaining('Duck')])
      )

      await wrapper.setProps({ products: localProducts })
      await wrapper.vm.$nextTick()

      const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
      expect(text).toContain('Морская свинка')
      expect(text).not.toContain('Duck')

      wrapper.unmount()
    })
  })
})
