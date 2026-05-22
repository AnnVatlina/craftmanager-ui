import { api } from './client.js'

export const salesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/v1/sales${q ? '?' + q : ''}`)
  },
  get: (id) => api.get(`/api/v1/sales/${id}`),
  create: (data) => api.post('/api/v1/sales', data),
  update: (id, data) => api.put(`/api/v1/sales/${id}`, data),
  delete: (id) => api.delete(`/api/v1/sales/${id}`),
}
