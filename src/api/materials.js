import { api } from './client.js'

export const materialsApi = {
  list: () => api.get('/api/v1/materials'),
  get: (id) => api.get(`/api/v1/materials/${id}`),
  create: (data) => api.post('/api/v1/materials', data),
  update: (id, data) => api.put(`/api/v1/materials/${id}`, data),
  delete: (id) => api.delete(`/api/v1/materials/${id}`),
  restock: (id, data) => api.post(`/api/v1/materials/${id}/restock`, data),
}
