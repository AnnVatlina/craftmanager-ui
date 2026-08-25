import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import ProductPicker from '../../src/components/ProductPicker.vue'
import { productsApi } from '../../src/api/products.js'

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
})
