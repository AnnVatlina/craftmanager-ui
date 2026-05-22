import { api } from './client.js'

export const productsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/v1/products${q ? '?' + q : ''}`)
  },
  get: (id) => api.get(`/api/v1/products/${id}`),
  create: (data) => api.post('/api/v1/products', data),
  update: (id, data) => api.put(`/api/v1/products/${id}`, data),
  delete: (id) => api.delete(`/api/v1/products/${id}`),
  getMaterials: (id) => api.get(`/api/v1/products/${id}/materials`),
  addMaterial: (id, data) => api.post(`/api/v1/products/${id}/materials`, data),
  removeMaterial: (productId, materialId) =>
    api.delete(`/api/v1/products/${productId}/materials/${materialId}`),
}
