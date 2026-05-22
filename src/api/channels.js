import { api } from './client.js'

export const channelsApi = {
  list: () => api.get('/api/v1/channels'),
  get: (id) => api.get(`/api/v1/channels/${id}`),
  create: (data) => api.post('/api/v1/channels', data),
  update: (id, data) => api.put(`/api/v1/channels/${id}`, data),
  delete: (id) => api.delete(`/api/v1/channels/${id}`),
}
