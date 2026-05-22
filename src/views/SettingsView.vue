<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Настройки</h1>
    </div>
    <div class="card" style="max-width:480px">
      <div style="font-weight:600;margin-bottom:16px">API</div>
      <div class="form-group">
        <label>URL бэкенда</label>
        <input :value="apiUrl" disabled style="color:var(--text-muted)" />
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />
      <div style="font-weight:600;margin-bottom:16px">Аккаунт</div>
      <button class="btn btn-danger" @click="logout">Выйти из системы</button>
    </div>
  </div>
</template>

<script setup>
import { authStore } from '../stores/auth.js'
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const logout = () => authStore.logout()
</script>
