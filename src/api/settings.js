import { api } from './client.js'

export const settingsApi = {
  get: () => api.get('/api/v1/settings'),
  update: (data) => api.put('/api/v1/settings', data),
}
