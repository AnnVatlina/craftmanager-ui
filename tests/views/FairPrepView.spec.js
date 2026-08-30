import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FairPrepView from '../../src/views/FairPrepView.vue'
import { fairPrepApi } from '../../src/api/fairPrep.js'
import { salesApi } from '../../src/api/sales.js'

vi.mock('../../src/api/fairPrep.js', () => ({
  fairPrepApi: { listChannels: vi.fn(), getPrep: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() },
}))
vi.mock('../../src/api/sales.js', () => ({ salesApi: { create: vi.fn() } }))
vi.mock('../../src/api/products.js', () => ({ productsApi: { list: vi.fn().mockResolvedValue({ data: [] }) } }))

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

describe('FairPrepView — quick "Продать"', () => {
  beforeEach(() => {
    fairPrepApi.listChannels.mockReset().mockResolvedValue({ data: [CHANNEL] })
    fairPrepApi.getPrep.mockReset().mockResolvedValue({ data: prepWith('2024-06-15') })
    salesApi.create.mockReset()
  })

  it('prefills quantity 1 and the product\'s current sale price', async () => {
    const wrapper = mount(FairPrepView)
    await flush()
    await selectChannel(wrapper)

    const inputs = wrapper.find('.sell-group').findAll('input')
    expect(inputs[0].element.value).toBe('1')
    expect(inputs[1].element.value).toBe('25.00')

    wrapper.unmount()
  })

  it('creates a one-item sale dated on the fair\'s event_date, then reloads the list', async () => {
    salesApi.create.mockResolvedValue({ data: {} })
    const wrapper = mount(FairPrepView)
    await flush()
    await selectChannel(wrapper)

    await wrapper.find('.sell-group button').trigger('click')
    await flush()

    expect(salesApi.create).toHaveBeenCalledWith({
      channel_id: 'c1',
      sale_date: '2024-06-15',
      items: [{ product_id: 'p1', quantity: 1, price: '25.00' }],
    })
    expect(fairPrepApi.getPrep).toHaveBeenCalledTimes(2) // initial load + reload after sale

    wrapper.unmount()
  })

  it('falls back to today when the fair channel has no event_date', async () => {
    fairPrepApi.getPrep.mockResolvedValue({ data: prepWith(null) })
    salesApi.create.mockResolvedValue({ data: {} })
    const wrapper = mount(FairPrepView)
    await flush()
    await selectChannel(wrapper)

    await wrapper.find('.sell-group button').trigger('click')
    await flush()

    const today = new Date().toISOString().slice(0, 10)
    expect(salesApi.create).toHaveBeenCalledWith(expect.objectContaining({ sale_date: today }))

    wrapper.unmount()
  })

  it('sends an edited quantity and price instead of the defaults', async () => {
    salesApi.create.mockResolvedValue({ data: {} })
    const wrapper = mount(FairPrepView)
    await flush()
    await selectChannel(wrapper)

    const inputs = wrapper.find('.sell-group').findAll('input')
    await inputs[0].setValue(3)
    await inputs[1].setValue('20.00')
    await wrapper.find('.sell-group button').trigger('click')
    await flush()

    // type="number" inputs auto-cast v-model to a JS Number once the user
    // types into them, even without a .number modifier on the binding.
    expect(salesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ product_id: 'p1', quantity: 3, price: 20 }],
    }))

    wrapper.unmount()
  })

  it('shows an error and keeps the row editable when the sale fails', async () => {
    salesApi.create.mockRejectedValue(new Error('Изделие не найдено'))
    const wrapper = mount(FairPrepView)
    await flush()
    await selectChannel(wrapper)

    await wrapper.find('.sell-group button').trigger('click')
    await flush()

    expect(wrapper.find('.alert-error').text()).toContain('Изделие не найдено')
    expect(fairPrepApi.getPrep).toHaveBeenCalledTimes(1) // no reload on failure
    expect(wrapper.find('.sell-group').exists()).toBe(true) // row still has its inputs

    wrapper.unmount()
  })
})
