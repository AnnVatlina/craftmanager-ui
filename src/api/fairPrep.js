import { api } from './client.js'

function qs(params) {
  const q = new URLSearchParams(params).toString()
  return q ? '?' + q : ''
}

export const fairPrepApi = {
  listChannels: () => api.get('/api/v1/fair-prep/channels'),
  getPrep: (channelId, filters = {}) =>
    api.get(`/api/v1/fair-prep/${channelId}${qs(filters)}`),
  addItem: (channelId, data, filters = {}) =>
    api.post(`/api/v1/fair-prep/${channelId}/items${qs(filters)}`, data),
  updateItem: (channelId, itemId, data, filters = {}) =>
    api.put(`/api/v1/fair-prep/${channelId}/items/${itemId}${qs(filters)}`, data),
  removeItem: (channelId, itemId, filters = {}) =>
    api.delete(`/api/v1/fair-prep/${channelId}/items/${itemId}${qs(filters)}`),
}
