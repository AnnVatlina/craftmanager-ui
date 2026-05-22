<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Расходы</h1>
      <button class="btn btn-primary" @click="openCreate">+ Добавить</button>
    </div>

    <div class="filters">
      <div class="form-group">
        <label>Категория</label>
        <select v-model="filterCat" @change="load">
          <option value="">Все</option>
          <option v-for="c in expCats" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="form-group"><label>С</label><input v-model="dateFrom" type="date" @change="load" /></div>
      <div class="form-group"><label>По</label><input v-model="dateTo" type="date" @change="load" /></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div v-for="cat in catSummary" :key="cat.name" style="text-align:center">
          <div class="kpi-label">{{ cat.name }}</div>
          <div style="font-weight:600">{{ cat.total.toFixed(2) }} {{ cur }}</div>
        </div>
        <div style="text-align:center">
          <div class="kpi-label">Итого</div>
          <div style="font-weight:700;color:var(--danger)">{{ grandTotal.toFixed(2) }} {{ cur }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">Загрузка...</div>
      <div v-else-if="!expenses.length" class="empty"><div class="icon">📋</div>Расходов пока нет</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Дата</th><th>Категория</th><th>Сумма</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="e in expenses" :key="e.id">
              <td>{{ fmtDate(e.expense_date) }}</td>
              <td><span class="badge badge-neutral">{{ e.category }}</span></td>
              <td><strong>{{ e.amount }} {{ cur }}</strong></td>
              <td style="color:var(--text-muted)">{{ e.description || '—' }}</td>
              <td>
                <button class="btn-icon" @click="editExp(e)">✏️</button>
                <button class="btn-icon" @click="deleteExp(e.id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <BaseModal v-if="showModal" :title="editing ? 'Редактировать расход' : 'Новый расход'" @close="showModal = false">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-row">
        <div class="form-group">
          <label>Категория *</label>
          <select v-model="form.category">
            <option v-for="c in expCats" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="form-group"><label>Сумма *</label><input v-model="form.amount" type="number" step="0.01" /></div>
      </div>
      <div class="form-group"><label>Дата *</label><input v-model="form.expense_date" type="date" /></div>
      <div class="form-group"><label>Описание</label><input v-model="form.description" /></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { expensesApi } from '../api/expenses.js'
import { settingsStore } from '../stores/settings.js'

const expenses = ref([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const editing = ref(null)
const error = ref('')
const filterCat = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const form = reactive({ category: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), description: '' })

const cur = computed(() => settingsStore.currency)
const expCats = computed(() => settingsStore.expense_categories)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'
const grandTotal = computed(() => expenses.value.reduce((s, e) => s + parseFloat(e.amount || 0), 0))
const catSummary = computed(() => {
  const map = {}
  expenses.value.forEach(e => { map[e.category] = (map[e.category] || 0) + parseFloat(e.amount || 0) })
  return Object.entries(map).map(([name, total]) => ({ name, total }))
})

async function load() {
  loading.value = true
  try {
    const params = {}
    if (filterCat.value) params.category = filterCat.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    const res = await expensesApi.list(params)
    expenses.value = res.data
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { category: expCats.value[0] || '', amount: '', expense_date: new Date().toISOString().slice(0, 10), description: '' })
  error.value = ''
  showModal.value = true
}

function editExp(e) {
  editing.value = e.id
  Object.assign(form, { category: e.category, amount: e.amount, expense_date: e.expense_date, description: e.description || '' })
  error.value = ''
  showModal.value = true
}

async function save() {
  if (!form.amount || !form.expense_date) { error.value = 'Заполните обязательные поля'; return }
  saving.value = true
  try {
    if (editing.value) await expensesApi.update(editing.value, form)
    else await expensesApi.create(form)
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function deleteExp(id) {
  if (!confirm('Удалить расход?')) return
  await expensesApi.delete(id)
  await load()
}

onMounted(load)
</script>
