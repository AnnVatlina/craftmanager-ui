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
          <select v-model="form.channel_id" @change="onChannelChange">
            <option value="">—</option>
            <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Заметки</label><input v-model="form.notes" /></div>

      <div style="font-weight:600;margin:12px 0 8px">Позиции</div>
      <div class="items-list">
        <div class="item-row" v-for="(item, i) in form.items" :key="i">
          <div v-if="item.product_id" class="item-product-chosen">
            <span>{{ item.product_name }}</span>
            <button class="btn-icon" @click="clearProduct(item)" title="Изменить изделие">✎</button>
          </div>
          <ProductPicker v-else placeholder="Изделие..." :products="channelProducts" @select="(p) => pickProduct(item, p)" />
          <input v-model.number="item.quantity" type="number" min="1" placeholder="Кол-во" />
          <input v-model="item.price" type="number" step="0.01" :placeholder="`Цена, ${cur}`" />
          <button class="btn-icon" @click="form.items.splice(i, 1)" style="color:var(--danger)">✕</button>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" @click="form.items.push({ product_id: '', product_name: '', quantity: 1, price: '' })">+ Позиция</button>
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
import ProductPicker from '../components/ProductPicker.vue'
import { salesApi } from '../api/sales.js'
import { channelsApi } from '../api/channels.js'
import { fairPrepApi } from '../api/fairPrep.js'
import { settingsStore } from '../stores/settings.js'

const sales = ref([])
const channels = ref([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const error = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const channelFilter = ref('')
const form = reactive({ sale_date: new Date().toISOString().slice(0, 10), channel_id: '', notes: '', items: [] })

// Products the picker offers when a channel with a fair-prep list is
// selected — null means "no scoping, search the whole catalog".
const channelProducts = ref(null)
// product_id -> channel_id, built once per "New Sale" open, so picking a
// product that was added to some fair's prep list can auto-fill the channel
// even if it wasn't chosen yet (see pickProduct()).
let productChannelMap = {}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'
const channelName = (id) => channels.value.find(c => c.id === id)?.name
const cur = computed(() => settingsStore.currency)
const saleTotal = computed(() => form.items.reduce((s, i) => s + (i.quantity * (i.price || 0)), 0).toFixed(2))

async function onChannelChange() {
  channelProducts.value = null
  if (!form.channel_id) return
  try {
    const res = await fairPrepApi.getPrep(form.channel_id)
    if (res.data.items.length) {
      channelProducts.value = res.data.items.map((i) => ({
        id: i.product_id, name: i.product_name, category: i.category, sale_price: i.sale_price,
      }))
    }
  } catch {
    channelProducts.value = null
  }
}

async function buildProductChannelMap() {
  productChannelMap = {}
  try {
    const chRes = await fairPrepApi.listChannels()
    const preps = await Promise.all(chRes.data.map((c) => fairPrepApi.getPrep(c.id).catch(() => null)))
    const map = {}
    preps.forEach((prepRes, idx) => {
      if (!prepRes) return
      for (const item of prepRes.data.items) {
        if (!(item.product_id in map)) map[item.product_id] = chRes.data[idx].id
      }
    })
    productChannelMap = map
  } catch {
    productChannelMap = {}
  }
}

function pickProduct(item, product) {
  item.product_id = product.id
  item.product_name = product.name
  item.price = product.sale_price

  if (!form.channel_id && productChannelMap[product.id]) {
    form.channel_id = productChannelMap[product.id]
    onChannelChange()
  }
}

function clearProduct(item) {
  item.product_id = ''
  item.product_name = ''
}

async function load() {
  loading.value = true
  try {
    const params = {}
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    if (channelFilter.value) params.channel_id = channelFilter.value
    const [s, ch] = await Promise.all([salesApi.list(params), channelsApi.list()])
    sales.value = s.data
    channels.value = ch.data
  } finally { loading.value = false }
}

function openCreate() {
  Object.assign(form, { sale_date: new Date().toISOString().slice(0, 10), channel_id: '', notes: '', items: [{ product_id: '', product_name: '', quantity: 1, price: '' }] })
  channelProducts.value = null
  error.value = ''
  showModal.value = true
  buildProductChannelMap()
}

async function save() {
  if (!form.sale_date || !form.items.length) { error.value = 'Укажите дату и хотя бы одну позицию'; return }
  if (form.items.some(i => !i.price)) { error.value = 'Укажите цену для всех позиций'; return }
  saving.value = true
  try {
    await salesApi.create({
      ...form,
      channel_id: form.channel_id || null,
      items: form.items.map((i) => ({ product_id: i.product_id || null, quantity: i.quantity, price: i.price })),
    })
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

<style scoped>
.item-product-chosen {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
}
.item-product-chosen span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-product-chosen .btn-icon { flex-shrink: 0; padding: 0; }
</style>
