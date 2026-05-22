import { api } from './client.js'

export const authApi = {
  register: (email, password) => api.post('/api/v1/auth/register', { email, password }),
  login: (email, password) => api.post('/api/v1/auth/login', { email, password }),
}
