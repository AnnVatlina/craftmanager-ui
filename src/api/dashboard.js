import { api } from './client.js'

export const dashboardApi = {
  summary: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/v1/dashboard/summary${q ? '?' + q : ''}`)
  },
}
