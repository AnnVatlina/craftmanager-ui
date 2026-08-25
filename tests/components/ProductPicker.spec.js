import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
    const wrapper = mount(ProductPicker)
    await flush()

    await wrapper.find('input').trigger('focus')
    await wrapper.vm.$nextTick()

    const items = wrapper.findAll('.picker-item')
    expect(items.map((i) => i.text())).toEqual(
      expect.arrayContaining([expect.stringContaining('Duck'), expect.stringContaining('Bunny')])
    )

    await items[0].trigger('mousedown')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0][0].name).toBe('Duck')
  })

  it('excludes products listed in excludeIds', async () => {
    const wrapper = mount(ProductPicker, { props: { excludeIds: ['1'] } })
    await flush()
    await wrapper.find('input').trigger('focus')
    await wrapper.vm.$nextTick()

    const text = wrapper.findAll('.picker-item').map((i) => i.text()).join(' ')
    expect(text).not.toContain('Duck')
    expect(text).toContain('Bunny')
  })

  it('clears the input and closes the list after selecting a product', async () => {
    const wrapper = mount(ProductPicker)
    await flush()
    await wrapper.find('input').trigger('focus')
    await wrapper.vm.$nextTick()

    await wrapper.findAll('.picker-item')[0].trigger('mousedown')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('input').element.value).toBe('')
    expect(wrapper.find('.picker-list').exists()).toBe(false)
  })

  it('shows a hint instead of results while below the search threshold', async () => {
    const wrapper = mount(ProductPicker)
    await flush()
    await wrapper.find('input').trigger('focus')
    await wrapper.find('input').setValue('du')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.picker-hint').exists()).toBe(true)
    expect(wrapper.find('.picker-item').exists()).toBe(false)
  })
})
