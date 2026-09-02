import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsView from '../../src/views/ProductsView.vue'
import { productsApi } from '../../src/api/products.js'

vi.mock('../../src/api/products.js', () => ({
  productsApi: { list: vi.fn() },
}))

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

function page(overrides = {}) {
  return {
    data: [],
    meta: { total: 0, page: 1, pages: 1, per_page: 20, total_stock_value: 0, in_stock_count: 0, in_stock_value: 0, ...overrides },
  }
}

describe('ProductsView — сводка "в наличии"', () => {
  beforeEach(() => {
    productsApi.list.mockReset()
  })

  it('shows the always-on in-stock summary row', async () => {
    productsApi.list.mockResolvedValue(page({ total: 2, total_stock_value: 30, in_stock_count: 1, in_stock_value: 50 }))
    const wrapper = mount(ProductsView)
    await flush()

    const summary = wrapper.find('.summary-bar')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('В наличии')
    expect(summary.text()).toContain('1')
    expect(summary.text()).toContain('Стоимость в наличии')
    expect(summary.text()).toContain('50')

    wrapper.unmount()
  })

  it('keeps showing the in-stock summary even when the "Наличие" filter is switched to "Нет в наличии"', async () => {
    // Server always returns in_stock_count/in_stock_value independently of the
    // requested `in_stock` filter — the summary row must reflect that, not the
    // filtered `total`/`total_stock_value`.
    productsApi.list.mockResolvedValue(page({ total: 1, total_stock_value: 0, in_stock_count: 3, in_stock_value: 120 }))
    const wrapper = mount(ProductsView)
    await flush()

    const select = wrapper.findAll('select')[1]
    await select.setValue('false')
    await flush()

    expect(productsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ in_stock: 'false' }))
    const summary = wrapper.find('.summary-bar')
    expect(summary.exists()).toBe(true)
    expect(summary.text()).toContain('3')
    expect(summary.text()).toContain('120')

    wrapper.unmount()
  })
})
