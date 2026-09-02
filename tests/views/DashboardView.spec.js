import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardView from '../../src/views/DashboardView.vue'
import { dashboardApi } from '../../src/api/dashboard.js'

vi.mock('../../src/api/dashboard.js', () => ({
  dashboardApi: { summary: vi.fn(), fairChannels: vi.fn() },
}))

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

const SUMMARY = { total_revenue: '0', total_expenses: '0', manual_expenses: '0', material_expenses: '0', profit: '0' }

describe('DashboardView — результаты по ярмаркам', () => {
  beforeEach(() => {
    dashboardApi.summary.mockReset().mockResolvedValue({ data: SUMMARY })
    dashboardApi.fairChannels.mockReset().mockResolvedValue({ data: [] })
  })

  it('loads fair results independently of the summary date filter and without params', async () => {
    const wrapper = mount(DashboardView)
    await flush()

    expect(dashboardApi.fairChannels).toHaveBeenCalledWith()

    wrapper.unmount()
  })

  it('shows an empty state when there are no fairs', async () => {
    const wrapper = mount(DashboardView)
    await flush()

    expect(wrapper.text()).toContain('Ярмарок пока нет')

    wrapper.unmount()
  })

  it('renders planned quantity, sold quantity, revenue, and date for each fair', async () => {
    dashboardApi.fairChannels.mockResolvedValue({
      data: [
        {
          channel_id: 'c1', channel_name: 'Весенняя ярмарка', event_date: '2024-05-01',
          total_planned: 20, total_sold: 14, total_revenue: '280.00',
        },
      ],
    })
    const wrapper = mount(DashboardView)
    await flush()

    const row = wrapper.find('tbody tr')
    expect(row.text()).toContain('Весенняя ярмарка')
    expect(row.text()).toContain('01.05.2024')
    expect(row.text()).toContain('20')
    expect(row.text()).toContain('14')
    expect(row.text()).toContain('280,00') // ru-RU locale formatting (comma decimal)

    wrapper.unmount()
  })

  it('renders a row even for a fair with nothing planned or sold yet', async () => {
    dashboardApi.fairChannels.mockResolvedValue({
      data: [{ channel_id: 'c2', channel_name: 'Будущая ярмарка', event_date: null, total_planned: 0, total_sold: 0, total_revenue: '0' }],
    })
    const wrapper = mount(DashboardView)
    await flush()

    const row = wrapper.find('tbody tr')
    expect(row.text()).toContain('Будущая ярмарка')
    expect(row.text()).toContain('—') // no event_date

    wrapper.unmount()
  })
})
