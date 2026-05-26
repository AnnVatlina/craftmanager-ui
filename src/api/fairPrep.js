import { api } from './client.js'

export const fairPrepApi = {
  listChannels: () => api.get('/api/v1/fair-prep/channels'),
  getPrep: (channelId) => api.get(`/api/v1/fair-prep/${channelId}`),
  addItem: (channelId, data) => api.post(`/api/v1/fair-prep/${channelId}/items`, data),
  updateItem: (channelId, itemId, data) => api.put(`/api/v1/fair-prep/${channelId}/items/${itemId}`, data),
  removeItem: (channelId, itemId) => api.delete(`/api/v1/fair-prep/${channelId}/items/${itemId}`),
}
