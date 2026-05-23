<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Продажи</h1>
      <button class="btn btn-primary" @click="openCreate">+ Новая продажа</button>
    </div>

    <div class="filters">
      <div class="form-group"><label>С</label><input v-model="dateFrom" type="date" @change="load" /></div>
      <div class="form-group"><label>По</label><input v-model="dateTo" type="date" @change="load" /></div>
      <div class="form-group">
        <label>Канал</label>
        <select v-model="channelFilter" @change="load">
          <option value="">Все</option>
          <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">Загрузка...</div>
      <div v-else-if="!sales.length" class="empty"><div class="icon">💰</div>Продаж пока нет</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Дата</th><th>Канал</th><th>Сумма</th><th>Заметки</th><th></th></tr></thead>
          <tbody>
            <tr v-for="s in sales" :key="s.id">
              <td>{{ fmtDate(s.sale_date) }}</td>
              <td>{{ channelName(s.channel_id) || '—' }}</td>
              <td><strong>{{ s.total_amount }} {{ cur }}</strong></td>
              <td style="color:var(--text-muted)">{{ s.notes || '—' }}</td>
              <td><button class="btn-icon" @click="deleteSale(s.id)">🗑</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <BaseModal v-if="showModal" title="Новая продажа" @close="showModal = false">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-row">
        <div class="form-group"><label>Дата *</label><input v-model="form.sale_date" type="date" /></div>
        <div class="form-group">
          <label>Канал продаж</label>
          <select v-model="form.channel_id">
            <option value="">—</option>
            <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Заметки</label><input v-model="form.notes" /></div>

      <div style="font-weight:600;margin:12px 0 8px">Позиции</div>
      <div class="items-list">
        <div class="item-row" v-for="(item, i) in form.items" :key="i">
          <select v-model="item.product_id" @change="fillPrice(item)">
            <option value="">— Изделие —</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <input v-model.number="item.quantity" type="number" min="1" placeholder="Кол-во" />
          <input v-model="item.price" type="number" step="0.01" placeholder="Цена {{ cur }}" />
          <button class="btn-icon" @click="form.items.splice(i, 1)" style="color:var(--danger)">✕</button>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" @click="form.items.push({ product_id: '', quantity: 1, price: '' })">+ Позиция</button>
      <div class="sale-total" style="margin-top:8px">Итого: {{ saleTotal }} {{ cur }}</div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Создать' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { salesApi } from '../api/sales.js'
import { channelsApi } from '../api/channels.js'
import { productsApi } from '../api/products.js'
import { settingsStore } from '../stores/settings.js'

const sales = ref([])
const channels = ref([])
const products = ref([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const error = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const channelFilter = ref('')
const form = reactive({ sale_date: new Date().toISOString().slice(0, 10), channel_id: '', notes: '', items: [] })

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'
const channelName = (id) => channels.value.find(c => c.id === id)?.name
const cur = computed(() => settingsStore.currency)
const saleTotal = computed(() => form.items.reduce((s, i) => s + (i.quantity * (i.price || 0)), 0).toFixed(2))

function fillPrice(item) {
  const p = products.value.find(p => p.id === item.product_id)
  if (p) item.price = p.sale_price
}

async function load() {
  loading.value = true
  try {
    const params = {}
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    if (channelFilter.value) params.channel_id = channelFilter.value
    const [s, ch, p] = await Promise.all([salesApi.list(params), channelsApi.list(), productsApi.list()])
    sales.value = s.data
    channels.value = ch.data
    products.value = p.data
  } finally { loading.value = false }
}

function openCreate() {
  Object.assign(form, { sale_date: new Date().toISOString().slice(0, 10), channel_id: '', notes: '', items: [{ product_id: '', quantity: 1, price: '' }] })
  error.value = ''
  showModal.value = true
}

async function save() {
  if (!form.sale_date || !form.items.length) { error.value = 'Укажите дату и хотя бы одну позицию'; return }
  if (form.items.some(i => !i.price)) { error.value = 'Укажите цену для всех позиций'; return }
  saving.value = true
  try {
    await salesApi.create({ ...form, channel_id: form.channel_id || null, items: form.items.map(i => ({ ...i, product_id: i.product_id || null })) })
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function deleteSale(id) {
  if (!confirm('Удалить продажу? Остатки товаров будут восстановлены.')) return
  await salesApi.delete(id)
  await load()
}

onMounted(load)
</script>
