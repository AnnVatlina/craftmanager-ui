import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import SalesView from '../../src/views/SalesView.vue'
import { salesApi } from '../../src/api/sales.js'
import { channelsApi } from '../../src/api/channels.js'
import { productsApi } from '../../src/api/products.js'
import { fairPrepApi } from '../../src/api/fairPrep.js'

vi.mock('../../src/api/sales.js', () => ({ salesApi: { list: vi.fn(), create: vi.fn(), get: vi.fn(), delete: vi.fn() } }))
vi.mock('../../src/api/channels.js', () => ({ channelsApi: { list: vi.fn() } }))
vi.mock('../../src/api/products.js', () => ({ productsApi: { list: vi.fn() } }))
vi.mock('../../src/api/fairPrep.js', () => ({
  fairPrepApi: { listChannels: vi.fn(), getPrep: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() },
}))

// ProductPicker's dropdown is <Teleport to="body">, and BaseModal itself
// teleports there too — both escape the mounted wrapper's own DOM tree.
function body() {
  return new DOMWrapper(document.body)
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const BEAR = { id: 'p1', name: 'Плюшевый мишка', category: 'Игрушки', sale_price: '25.00' }
const OTHER = { id: 'p2', name: 'Другая игрушка', category: 'Игрушки', sale_price: '10.00' }

function fairItem(product) {
  return {
    id: 'fi-' + product.id, product_id: product.id, product_name: product.name,
    category: product.category, sale_price: product.sale_price, planned_qty: 1, stock_qty: 5, need_to_make: 0,
  }
}

describe('SalesView — ProductPicker integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    salesApi.list.mockReset().mockResolvedValue({ data: [] })
    channelsApi.list.mockReset().mockResolvedValue({
      data: [{ id: 'c1', name: 'Инстаграм' }, { id: 'c2', name: 'Ярмарка Х' }],
    })
    // c2 has BEAR in its fair-prep list; c1 (a лс channel) has none.
    fairPrepApi.listChannels.mockReset().mockResolvedValue({
      data: [{ id: 'c2', name: 'Ярмарка Х', event_date: null, location: null }],
    })
    fairPrepApi.getPrep.mockReset().mockImplementation((channelId) => Promise.resolve({
      data: {
        channel: { id: channelId, name: '', event_date: null, location: null },
        items: channelId === 'c2' ? [fairItem(BEAR)] : [],
        summary: { total_positions: 0, total_planned: 0, total_need_to_make: 0 },
      },
    }))
    // General catalog search returns a DIFFERENT product than the fair list,
    // so tests can tell which source the picker is actually drawing from.
    productsApi.list.mockReset().mockResolvedValue({ data: [OTHER] })
  })
  afterEach(() => vi.useRealTimers())

  async function openModal(wrapper) {
    await body().find('button.btn-primary').trigger('click') // "+ Новая продажа"
    await wrapper.vm.$nextTick()
    await flush() // let buildProductChannelMap()'s requests settle
  }

  it('picking a product fills product_id and price, and shows it instead of the picker', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await openModal(wrapper)

    const pickerInput = body().find('.product-picker input')
    expect(pickerInput.exists()).toBe(true)
    await pickerInput.trigger('focus')
    await flush()

    const item = body().find('.picker-item')
    expect(item.text()).toContain('Другая игрушка')
    await item.trigger('mousedown')
    await wrapper.vm.$nextTick()

    // Picker is replaced by the chosen-product chip; price is prefilled from sale_price.
    expect(body().find('.product-picker').exists()).toBe(false)
    expect(body().find('.item-product-chosen').text()).toContain('Другая игрушка')
    const priceInput = body().findAll('.item-row input[type=number]')[1]
    expect(priceInput.element.value).toBe('10.00')

    wrapper.unmount()
  })

  it('clicking the edit button brings the picker back for that row', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await openModal(wrapper)

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

  it('selecting a channel with a fair-prep list scopes the picker to just those products', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await openModal(wrapper)

    await body().find('.modal select').setValue('c2') // "Канал продаж" select
    await flush()

    await body().find('.product-picker input').trigger('focus')
    await wrapper.vm.$nextTick()

    const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
    expect(text).toContain('Плюшевый мишка') // from c2's fair-prep list
    expect(text).not.toContain('Другая игрушка') // the general-catalog product must not leak in

    wrapper.unmount()
  })

  it('selecting a channel with no fair-prep list keeps full-catalog search', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await openModal(wrapper)

    await body().find('.modal select').setValue('c1')
    await flush()

    await body().find('.product-picker input').trigger('focus')
    await wrapper.vm.$nextTick()

    const text = body().findAll('.picker-item').map((i) => i.text()).join(' ')
    expect(text).toContain('Другая игрушка') // falls back to the general catalog search

    wrapper.unmount()
  })

  it('auto-fills the channel when a picked product belongs to its fair-prep list and no channel was chosen yet', async () => {
    productsApi.list.mockResolvedValue({ data: [BEAR] }) // general search happens to surface the fair product too
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await openModal(wrapper)

    await body().find('.product-picker input').trigger('focus')
    await flush()
    const item = body().findAll('.picker-item').find((i) => i.text().includes('Плюшевый мишка'))
    await item.trigger('mousedown')
    await flush()

    expect(body().find('.modal select').element.value).toBe('c2')

    wrapper.unmount()
  })

  it('does not override an already-selected channel', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await openModal(wrapper)

    await body().find('.modal select').setValue('c1') // pick a channel that does NOT own BEAR
    await flush()

    // c1 has no fair-prep list, so the picker falls back to the general
    // catalog search — which, for this test, happens to return BEAR (who
    // "belongs" to c2 per the fair-prep map).
    productsApi.list.mockResolvedValue({ data: [BEAR] })
    await body().find('.product-picker input').trigger('focus')
    await flush()
    await body().find('.picker-item').trigger('mousedown')
    await flush()

    expect(body().find('.modal select').element.value).toBe('c1')

    wrapper.unmount()
  })
})

describe('SalesView — per-item rows and sale detail view', () => {
  const SALE = {
    id: 's1', channel_id: 'c1', sale_date: '2024-01-15', total_amount: '100.00', notes: 'Заметка',
    items: [
      { id: 'i1', product_id: 'p1', product_name: 'Плюшевый мишка', quantity: 2, price: '50.00' },
    ],
  }
  const DETAIL = { ...SALE, channel_name: 'Инстаграм' }

  beforeEach(() => {
    salesApi.list.mockReset().mockResolvedValue({ data: [SALE] })
    salesApi.get.mockReset().mockResolvedValue({ data: DETAIL })
    salesApi.delete.mockReset().mockResolvedValue({})
    channelsApi.list.mockReset().mockResolvedValue({ data: [{ id: 'c1', name: 'Инстаграм' }] })
  })

  async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  it('clicking a sale row fetches and shows its details', async () => {
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    await wrapper.find('.sale-row').trigger('click')
    await flush()

    expect(salesApi.get).toHaveBeenCalledWith('s1')
    const modalText = body().find('.modal').text()
    expect(modalText).toContain('Плюшевый мишка')
    expect(modalText).toContain('Инстаграм')
    expect(modalText).toContain('Заметка')

    wrapper.unmount()
  })

  it('renders one row per item, repeating date/channel/notes, without a per-row delete button', async () => {
    const multiSale = {
      id: 's2', channel_id: 'c1', sale_date: '2024-02-01', total_amount: '70.00', notes: 'Ярмарка',
      items: [
        { id: 'i1', product_id: 'p1', product_name: 'Мишка', quantity: 1, price: '30.00' },
        { id: 'i2', product_id: 'p2', product_name: 'Зайка', quantity: 2, price: '20.00' },
      ],
    }
    salesApi.list.mockResolvedValue({ data: [multiSale] })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    const rows = wrapper.findAll('.sale-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Мишка')
    expect(rows[0].text()).toContain('30.00')
    expect(rows[1].text()).toContain('Зайка')
    expect(rows[1].text()).toContain('40.00') // quantity(2) * price(20.00), not the sale total

    // Дата/Канал/Заметки repeat on every item row of the same sale.
    rows.forEach((r) => {
      expect(r.text()).toContain('Ярмарка')
      expect(r.text()).toContain('Инстаграм')
    })

    // The whole-sale total must not leak into the per-item rows themselves
    // (the totals-row footer legitimately shows the same figure as a sum).
    expect(wrapper.find('tbody').text()).not.toContain('70.00')
    // Deleting a sale is only available from the detail modal now.
    expect(wrapper.find('.sale-row button').exists()).toBe(false)

    wrapper.unmount()
  })

  it('deleting from the detail modal closes it and reloads the list', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    await wrapper.find('.sale-row').trigger('click')
    await flush()

    await body().find('.modal button.btn-icon').trigger('click')
    await flush()

    expect(salesApi.delete).toHaveBeenCalledWith('s1')
    expect(body().find('.modal').exists()).toBe(false)

    confirmSpy.mockRestore()
    wrapper.unmount()
  })

  it('declining the delete confirmation keeps the detail modal open', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    await wrapper.find('.sale-row').trigger('click')
    await flush()

    await body().find('.modal button.btn-icon').trigger('click')
    await flush()

    expect(salesApi.delete).not.toHaveBeenCalled()
    expect(body().find('.modal').exists()).toBe(true)

    confirmSpy.mockRestore()
    wrapper.unmount()
  })
})

describe('SalesView — pagination', () => {
  const saleOn = (day) => ({
    id: 's-' + day, channel_id: null, sale_date: day, total_amount: '10.00', notes: '',
    items: [{ id: 'i-' + day, product_id: 'p1', product_name: 'Мишка', quantity: 1, price: '10.00' }],
  })

  async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  beforeEach(() => {
    channelsApi.list.mockReset().mockResolvedValue({ data: [] })
  })

  it('hides pagination controls when there is only one page', async () => {
    salesApi.list.mockReset().mockResolvedValue({
      data: [saleOn('2024-01-01')],
      meta: { total: 1, page: 1, per_page: 20, pages: 1 },
    })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    expect(wrapper.find('.pagination').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows pagination controls and requests the next page on click', async () => {
    salesApi.list.mockReset().mockImplementation((params) => Promise.resolve({
      data: [saleOn('2024-01-02')],
      meta: { total: 21, page: params.page, per_page: 20, pages: 2 },
    }))
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    expect(wrapper.find('.pagination').exists()).toBe(true)
    expect(wrapper.find('.pagination-info').text()).toBe('1 / 2')
    expect(wrapper.find('.pagination button').attributes('disabled')).toBeDefined() // "← Назад" on page 1

    await wrapper.findAll('.pagination button')[1].trigger('click') // "Вперёд →"
    await flush()

    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, per_page: 20 }))
    expect(wrapper.find('.pagination-info').text()).toBe('2 / 2')

    wrapper.unmount()
  })

  it('resets to page 1 when a filter changes', async () => {
    salesApi.list.mockReset().mockImplementation((params) => Promise.resolve({
      data: [saleOn('2024-01-03')],
      meta: { total: 21, page: params.page, per_page: 20, pages: 2 },
    }))
    channelsApi.list.mockResolvedValue({ data: [{ id: 'c1', name: 'Инстаграм' }] })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    await wrapper.findAll('.pagination button')[1].trigger('click') // go to page 2
    await flush()
    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))

    await wrapper.find('.filters select').setValue('c1')
    await flush()

    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, channel_id: 'c1' }))

    wrapper.unmount()
  })

  it('requests all sales unpaginated and hides pagination controls when a channel is selected', async () => {
    salesApi.list.mockReset().mockImplementation((params) => Promise.resolve({
      data: [saleOn('2024-01-04')],
      meta: { total: 21, page: params.page, per_page: params.per_page, pages: params.per_page >= 21 ? 1 : 2 },
    }))
    channelsApi.list.mockResolvedValue({ data: [{ id: 'c1', name: 'Инстаграм' }] })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()
    expect(wrapper.find('.pagination').exists()).toBe(true) // "Все" still paginates

    await wrapper.find('.filters select').setValue('c1')
    await flush()

    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, per_page: 1000, channel_id: 'c1' }))
    expect(wrapper.find('.pagination').exists()).toBe(false)

    wrapper.unmount()
  })

  it('restores normal per_page after switching back to "Все" from a selected channel', async () => {
    salesApi.list.mockReset().mockImplementation((params) => Promise.resolve({
      data: [saleOn('2024-01-05')],
      meta: { total: 21, page: params.page, per_page: params.per_page, pages: params.per_page >= 21 ? 1 : 2 },
    }))
    channelsApi.list.mockResolvedValue({ data: [{ id: 'c1', name: 'Инстаграм' }] })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    await wrapper.find('.filters select').setValue('c1')
    await flush()
    await wrapper.find('.filters select').setValue('')
    await flush()

    expect(salesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, per_page: 20 }))
    expect(wrapper.find('.pagination').exists()).toBe(true)

    wrapper.unmount()
  })
})

describe('SalesView — totals row', () => {
  async function flush() {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  beforeEach(() => {
    channelsApi.list.mockReset().mockResolvedValue({ data: [] })
  })

  it('sums quantity and per-item amounts across all rows, labelled "Итого" on a single page', async () => {
    salesApi.list.mockReset().mockResolvedValue({
      data: [
        {
          id: 's1', channel_id: null, sale_date: '2024-01-01', notes: '',
          items: [
            { id: 'i1', product_id: 'p1', product_name: 'Мишка', quantity: 2, price: '30.00' },
            { id: 'i2', product_id: 'p2', product_name: 'Зайка', quantity: 1, price: '20.00' },
          ],
        },
        {
          id: 's2', channel_id: null, sale_date: '2024-01-02', notes: '',
          items: [{ id: 'i3', product_id: 'p3', product_name: 'Лиса', quantity: 3, price: '10.00' }],
        },
      ],
      meta: { total: 2, page: 1, per_page: 20, pages: 1 },
    })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    const footer = wrapper.find('.totals-row')
    expect(footer.text()).toContain('Итого')
    expect(footer.text()).not.toContain('на странице')
    // qty: 2 + 1 + 3 = 6; sum: 60.00 + 20.00 + 30.00 = 110.00
    const cells = footer.findAll('td')
    expect(cells[1].text()).toBe('6')
    expect(cells[3].text()).toContain('110.00')

    wrapper.unmount()
  })

  it('labels the totals row "Итого на странице" when there is more than one page', async () => {
    salesApi.list.mockReset().mockResolvedValue({
      data: [{
        id: 's1', channel_id: null, sale_date: '2024-01-01', notes: '',
        items: [{ id: 'i1', product_id: 'p1', product_name: 'Мишка', quantity: 1, price: '10.00' }],
      }],
      meta: { total: 21, page: 1, per_page: 20, pages: 2 },
    })
    const wrapper = mount(SalesView, { attachTo: document.body })
    await flush()

    expect(wrapper.find('.totals-row').text()).toContain('Итого на странице')

    wrapper.unmount()
  })
})
