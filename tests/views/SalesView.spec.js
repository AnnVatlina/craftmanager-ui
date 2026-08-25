import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import SalesView from '../../src/views/SalesView.vue'
import { salesApi } from '../../src/api/sales.js'
import { channelsApi } from '../../src/api/channels.js'
import { productsApi } from '../../src/api/products.js'

vi.mock('../../src/api/sales.js', () => ({ salesApi: { list: vi.fn(), create: vi.fn() } }))
vi.mock('../../src/api/channels.js', () => ({ channelsApi: { list: vi.fn() } }))
vi.mock('../../src/api/products.js', () => ({ productsApi: { list: vi.fn() } }))

// ProductPicker's dropdown is <Teleport to="body">, and BaseModal itself
// teleports there too — both escape the mounted wrapper's own DOM tree.
function body() {
  return new DOMWrapper(document.body)
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('SalesView — ProductPicker integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    salesApi.list.mockReset().mockResolvedValue({ data: [] })
    channelsApi.list.mockReset().mockResolvedValue({ data: [{ id: 'c1', name: 'Инстаграм' }] })
    productsApi.list.mockReset().mockResolvedValue({
      data: [{ id: 'p1', name: 'Плюшевый мишка', category: 'Игрушки', sale_price: '25.00' }],
    })
  })
  afterEach(() => vi.useRealTimers())

  it('picking a product fills product_id and price, and shows it instead of the picker', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    await body().find('button.btn-primary').trigger('click') // "+ Новая продажа"
    await wrapper.vm.$nextTick()

    const pickerInput = body().find('.product-picker input')
    expect(pickerInput.exists()).toBe(true)
    await pickerInput.trigger('focus')
    await flush()

    const item = body().find('.picker-item')
    expect(item.text()).toContain('Плюшевый мишка')
    await item.trigger('mousedown')
    await wrapper.vm.$nextTick()

    // Picker is replaced by the chosen-product chip; price is prefilled from sale_price.
    expect(body().find('.product-picker').exists()).toBe(false)
    expect(body().find('.item-product-chosen').text()).toContain('Плюшевый мишка')
    const priceInput = body().findAll('.item-row input[type=number]')[1]
    expect(priceInput.element.value).toBe('25.00')

    wrapper.unmount()
  })

  it('clicking the edit button brings the picker back for that row', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await body().find('button.btn-primary').trigger('click')
    await wrapper.vm.$nextTick()

    await body().find('.product-picker input').trigger('focus')
    await flush()
    await body().find('.picker-item').trigger('mousedown')
    await wrapper.vm.$nextTick()

    await body().find('.item-product-chosen button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(body().find('.product-picker').exists()).toBe(true)
    expect(body().find('.item-product-chosen').exists()).toBe(false)

    wrapper.unmount()
  })

  it('does not touch the products endpoint just from viewing the sales list', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    // Regression guard for the original bug: SalesView used to eagerly load()
    // the whole product catalog on mount, even before the create-sale modal
    // was ever opened. Now nothing calls /products until a picker exists.
    expect(productsApi.list).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
