import { reactive } from 'vue'
import router from '../router/index.js'

export const authStore = reactive({
  get isAuthenticated() {
    return !!localStorage.getItem('access_token')
  },
  logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    router.push('/login')
  },
})
