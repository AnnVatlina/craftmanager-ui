<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Настройки</h1>
    </div>

    <div class="card" style="max-width:520px">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="saved" class="alert alert-success">Сохранено</div>

      <div style="font-weight:600;margin-bottom:16px">Валюта и отображение</div>
      <div class="form-group">
        <label>Символ валюты</label>
        <input v-model="form.currency" placeholder="Br" style="max-width:120px" />
      </div>
      <div class="form-group">
        <label>Порог низкого остатка (шт)</label>
        <input v-model.number="form.low_stock_threshold" type="number" min="1" style="max-width:120px" />
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

      <div style="font-weight:600;margin-bottom:12px">Категории изделий</div>
      <div v-for="(cat, i) in form.categories" :key="i" style="display:flex;gap:8px;margin-bottom:8px">
        <input v-model="form.categories[i]" style="flex:1" />
        <button class="btn-icon" @click="form.categories.splice(i,1)" style="color:var(--danger)">✕</button>
      </div>
      <button class="btn btn-secondary btn-sm" @click="form.categories.push('')" style="margin-bottom:20px">+ Добавить категорию</button>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
        <button class="btn btn-danger" @click="logout">Выйти</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { settingsApi } from '../api/settings.js'
import { settingsStore } from '../stores/settings.js'
import { authStore } from '../stores/auth.js'

const saving = ref(false)
const saved = ref(false)
const error = ref('')
const form = reactive({ currency: 'Br', categories: [], low_stock_threshold: 5 })

async function load() {
  await settingsStore.load()
  form.currency = settingsStore.currency
  form.categories = [...settingsStore.categories]
  form.low_stock_threshold = settingsStore.low_stock_threshold
}

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    await settingsApi.update({
      currency: form.currency,
      categories: form.categories.filter(c => c.trim()),
      low_stock_threshold: form.low_stock_threshold,
    })
    await settingsStore.load()
    saved.value = true
    setTimeout(() => saved.value = false, 3000)
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

const logout = () => authStore.logout()
onMounted(load)
</script>
