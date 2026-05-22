import { api } from './client.js'

export const buyersApi = {
  list: () => api.get('/api/v1/buyers'),
  get: (id) => api.get(`/api/v1/buyers/${id}`),
  create: (data) => api.post('/api/v1/buyers', data),
  update: (id, data) => api.put(`/api/v1/buyers/${id}`, data),
  delete: (id) => api.delete(`/api/v1/buyers/${id}`),
}
