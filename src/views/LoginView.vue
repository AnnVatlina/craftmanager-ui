<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-title">✦ CraftManager</div>
      <div class="login-subtitle">Учёт handmade бизнеса</div>

      <div class="tab-btns">
        <button class="tab-btn" :class="{ active: tab === 'login' }" @click="tab = 'login'">Войти</button>
        <button class="tab-btn" :class="{ active: tab === 'register' }" @click="tab = 'register'">Регистрация</button>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <form @submit.prevent="submit">
        <div class="form-group">
          <label>Email</label>
          <input v-model="form.email" type="email" placeholder="you@example.com" required />
        </div>
        <div class="form-group">
          <label>Пароль</label>
          <input v-model="form.password" type="password" placeholder="••••••••" required />
        </div>
        <button class="btn btn-primary" style="width:100%" :disabled="loading">
          {{ loading ? 'Загрузка...' : tab === 'login' ? 'Войти' : 'Зарегистрироваться' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../api/auth.js'

const router = useRouter()
const tab = ref('login')
const loading = ref(false)
const error = ref('')
const form = reactive({ email: '', password: '' })

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (tab.value === 'login') {
      const res = await authApi.login(form.email, form.password)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
    } else {
      await authApi.register(form.email, form.password)
      const res = await authApi.login(form.email, form.password)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
    }
    router.push('/')
  } catch (e) {
    error.value = e.message || 'Ошибка авторизации'
  } finally {
    loading.value = false
  }
}
</script>
