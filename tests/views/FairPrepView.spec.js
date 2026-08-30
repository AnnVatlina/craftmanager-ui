import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import FairPrepView from '../../src/views/FairPrepView.vue'
import { fairPrepApi } from '../../src/api/fairPrep.js'
import { salesApi } from '../../src/api/sales.js'

vi.mock('../../src/api/fairPrep.js', () => ({
  fairPrepApi: { listChannels: vi.fn(), getPrep: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() },
}))
vi.mock('../../src/api/sales.js', () => ({ salesApi: { create: vi.fn(), list: vi.fn() } }))
vi.mock('../../src/api/products.js', () => ({ productsApi: { list: vi.fn().mockResolvedValue({ data: [] }) } }))

// BaseModal teleports to <body>, escaping the mounted wrapper's own DOM tree.
function body() {
  return new DOMWrapper(document.body)
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const CHANNEL = { id: 'c1', name: 'Летняя ярмарка', event_date: '2024-06-15', location: null }

function prepWith(eventDate) {
  return {
    channel: { ...CHANNEL, event_date: eventDate },
    items: [
      { id: 'fi1', product_id: 'p1', product_name: 'Мишка', category: 'Игрушки', sale_price: '25.00', planned_qty: 5, stock_qty: 5, need_to_make: 0 },
    ],
    summary: { total_positions: 1, total_planned: 5, total_need_to_make: 0 },
  }
}

async function selectChannel(wrapper) {
  await wrapper.find('select').setValue('c1')
  await flush()
}

async function openSellPopup(wrapper) {
  await wrapper.find('td button.sell-btn').trigger('click')
  await flush()
}

describe('FairPrepView — quick "Продать" popup', () => {
  beforeEach(() => {
    fairPrepApi.listChannels.mockReset().mockResolvedValue({ data: [CHANNEL] })
    fairPrepApi.getPrep.mockReset().mockResolvedValue({ data: prepWith('2024-06-15') })
    salesApi.create.mockReset()
    salesApi.list.mockReset().mockResolvedValue({ data: [], meta: { total: 0, page: 1, per_page: 100, pages: 1 } })
  })

  it('opens prefilled with quantity 1, the current sale price, and the fair\'s date', async () => {
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)
    await openSellPopup(wrapper)

    const modal = body().find('.modal')
    expect(modal.text()).toContain('Мишка')
    expect(modal.text()).toContain('Летняя ярмарка')
    const inputs = modal.findAll('input')
    expect(inputs[0].element.value).toBe('1')
    expect(inputs[1].element.value).toBe('25.00')

    wrapper.unmount()
  })

  it('creates a one-item sale dated on the fair\'s event_date, then reloads and closes', async () => {
    salesApi.create.mockResolvedValue({ data: {} })
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)
    await openSellPopup(wrapper)

    await body().find('.modal .btn-primary').trigger('click')
    await flush()

    expect(salesApi.create).toHaveBeenCalledWith({
      channel_id: 'c1',
      sale_date: '2024-06-15',
      items: [{ product_id: 'p1', quantity: 1, price: '25.00' }],
    })
    expect(fairPrepApi.getPrep).toHaveBeenCalledTimes(2) // initial load + reload after sale
    expect(body().find('.modal').exists()).toBe(false)

    wrapper.unmount()
  })

  it('falls back to today when the fair channel has no event_date', async () => {
    fairPrepApi.getPrep.mockResolvedValue({ data: prepWith(null) })
    salesApi.create.mockResolvedValue({ data: {} })
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)
    await openSellPopup(wrapper)

    await body().find('.modal .btn-primary').trigger('click')
    await flush()

    const today = new Date().toISOString().slice(0, 10)
    expect(salesApi.create).toHaveBeenCalledWith(expect.objectContaining({ sale_date: today }))

    wrapper.unmount()
  })

  it('sends an edited quantity and price instead of the defaults', async () => {
    salesApi.create.mockResolvedValue({ data: {} })
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)
    await openSellPopup(wrapper)

    const inputs = body().find('.modal').findAll('input')
    await inputs[0].setValue(3)
    await inputs[1].setValue('20.00')
    await body().find('.modal .btn-primary').trigger('click')
    await flush()

    expect(salesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ product_id: 'p1', quantity: 3, price: 20 }],
    }))

    wrapper.unmount()
  })

  it('shows an error inside the popup and keeps it open when the sale fails', async () => {
    salesApi.create.mockRejectedValue(new Error('Изделие не найдено'))
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)
    await openSellPopup(wrapper)

    await body().find('.modal .btn-primary').trigger('click')
    await flush()

    expect(body().find('.alert-error').text()).toContain('Изделие не найдено')
    expect(fairPrepApi.getPrep).toHaveBeenCalledTimes(1) // no reload on failure
    expect(body().find('.modal').exists()).toBe(true) // popup stays open to retry

    wrapper.unmount()
  })

  it('shows "Продано" instead of the "Продать" button when a sale for this product already exists on the channel', async () => {
    salesApi.list.mockResolvedValue({
      data: [{
        id: 's1', channel_id: 'c1', sale_date: '2024-06-15', notes: '',
        items: [{ id: 'i1', product_id: 'p1', product_name: 'Мишка', quantity: 1, price: '25.00' }],
      }],
      meta: { total: 1, page: 1, per_page: 100, pages: 1 },
    })
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)

    expect(salesApi.list).toHaveBeenCalledWith(expect.objectContaining({ channel_id: 'c1' }))
    expect(wrapper.find('td button.sell-btn').exists()).toBe(false)
    expect(wrapper.text()).toContain('Продано')

    wrapper.unmount()
  })

  it('switches the row to "Продано" right after a successful quick sale', async () => {
    salesApi.create.mockResolvedValue({ data: {} })
    // First reload (on channel select): nothing sold yet. Second reload
    // (triggered by confirmSell()): the just-created sale now shows up.
    salesApi.list
      .mockResolvedValueOnce({ data: [], meta: { total: 0, page: 1, per_page: 100, pages: 1 } })
      .mockResolvedValueOnce({
        data: [{
          id: 's1', channel_id: 'c1', sale_date: '2024-06-15', notes: '',
          items: [{ id: 'i1', product_id: 'p1', product_name: 'Мишка', quantity: 1, price: '25.00' }],
        }],
        meta: { total: 1, page: 1, per_page: 100, pages: 1 },
      })
    const wrapper = mount(FairPrepView, { attachTo: document.body })
    await flush()
    await selectChannel(wrapper)
    expect(wrapper.find('td button.sell-btn').exists()).toBe(true)

    await openSellPopup(wrapper)
    await body().find('.modal .btn-primary').trigger('click')
    await flush()

    expect(wrapper.find('td button.sell-btn').exists()).toBe(false)
    expect(wrapper.text()).toContain('Продано')

    wrapper.unmount()
  })
})
