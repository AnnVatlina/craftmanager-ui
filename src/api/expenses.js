import { api } from './client.js'

export const expensesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/v1/expenses${q ? '?' + q : ''}`)
  },
  get: (id) => api.get(`/api/v1/expenses/${id}`),
  create: (data) => api.post('/api/v1/expenses', data),
  update: (id, data) => api.put(`/api/v1/expenses/${id}`, data),
  delete: (id) => api.delete(`/api/v1/expenses/${id}`),
}
