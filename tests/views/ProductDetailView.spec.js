import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import ProductDetailView from '../../src/views/ProductDetailView.vue'
import { productsApi } from '../../src/api/products.js'
import { materialsApi } from '../../src/api/materials.js'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'p1' } }) }))
vi.mock('../../src/api/products.js', () => ({
  productsApi: {
    get: vi.fn(),
    productions: vi.fn(),
    updateProduction: vi.fn(),
    deleteProduction: vi.fn(),
    restock: vi.fn(),
  },
}))
vi.mock('../../src/api/materials.js', () => ({ materialsApi: { list: vi.fn() } }))

// BaseModal teleports its content to <body>, escaping the mounted wrapper's own DOM tree.
function body() {
  return new DOMWrapper(document.body)
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const PRODUCT = { id: 'p1', name: 'Мишка', sale_price: '50.00', stock_qty: 13, cost_price: null, materials: [] }
const BATCH = { id: 'prod1', quantity: 3, produced_at: '2026-08-01', source: 'production', created_at: '2026-08-01T00:00:00' }

describe('ProductDetailView — редактирование/удаление пополнения', () => {
  beforeEach(() => {
    productsApi.get.mockReset().mockResolvedValue({ data: PRODUCT })
    productsApi.productions.mockReset().mockResolvedValue({ data: [BATCH] })
    productsApi.updateProduction.mockReset().mockResolvedValue({ data: { ...BATCH, quantity: 5 } })
    productsApi.deleteProduction.mockReset().mockResolvedValue(null)
    productsApi.restock.mockReset().mockResolvedValue({ data: { ...PRODUCT, stock_qty: 16 } })
    materialsApi.list.mockReset().mockResolvedValue({ data: [] })
  })

  it('opens the restock modal from the "Пополнить" button and submits it', async () => {
    // restockForm is a reactive object passed to productsApi.restock by reference,
    // and load() mutates it right after (resetting qty) — so the mock must snapshot
    // the payload at call time rather than reading it back from .mock.calls later.
    let submittedPayload = null
    productsApi.restock.mockImplementation((id, data) => {
      submittedPayload = { ...data }
      return Promise.resolve({ data: { ...PRODUCT, stock_qty: 16 } })
    })

    const wrapper = mount(ProductDetailView)
    await flush()

    const restockBtn = wrapper.findAll('button').find((b) => b.text() === 'Пополнить')
    expect(restockBtn).toBeTruthy()
    await restockBtn.trigger('click')
    await flush()

    expect(body().text()).toContain('Пополнить остаток')
    const qtyInput = body().find('input[type="number"][min="1"]')
    await qtyInput.setValue(3)
    await flush()
    const submitButtons = body().findAll('button').filter((b) => b.text() === 'Пополнить')
    await submitButtons[0].trigger('click')
    await flush()

    expect(productsApi.restock).toHaveBeenCalledWith('p1', expect.anything())
    expect(submittedPayload).toEqual(expect.objectContaining({ qty: 3 }))
    expect(body().text()).not.toContain('Пополнить остаток') // modal closes on success

    wrapper.unmount()
  })

  it('opens the edit modal prefilled with the batch, and saves the correction', async () => {
    const wrapper = mount(ProductDetailView)
    await flush()

    await wrapper.find('button[title="Редактировать"]').trigger('click')
    await flush()

    const qtyInput = body().find('input[type="number"][min="1"]')
    expect(qtyInput.element.value).toBe('3')

    await qtyInput.setValue(5)
    const saveButtons = body().findAll('button').filter((b) => b.text() === 'Сохранить')
    await saveButtons[0].trigger('click')
    await flush()

    expect(productsApi.updateProduction).toHaveBeenCalledWith('p1', 'prod1', expect.objectContaining({ quantity: 5 }))
    expect(productsApi.productions).toHaveBeenCalledTimes(2) // initial load + reload after save

    wrapper.unmount()
  })

  it('deletes a batch after confirmation and reloads', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(ProductDetailView)
    await flush()

    await wrapper.find('button[title="Удалить"]').trigger('click')
    await flush()

    expect(productsApi.deleteProduction).toHaveBeenCalledWith('p1', 'prod1')
    expect(productsApi.productions).toHaveBeenCalledTimes(2)

    confirmSpy.mockRestore()
    wrapper.unmount()
  })

  it('does not delete when the confirmation is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(ProductDetailView)
    await flush()

    await wrapper.find('button[title="Удалить"]').trigger('click')
    await flush()

    expect(productsApi.deleteProduction).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
    wrapper.unmount()
  })
})
