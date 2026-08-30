<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Продажи</h1>
      <button class="btn btn-primary" @click="openCreate">+ Новая продажа</button>
    </div>

    <div class="filters">
      <div class="form-group"><label>С</label><input v-model="dateFrom" type="date" @change="changePage(1)" /></div>
      <div class="form-group"><label>По</label><input v-model="dateTo" type="date" @change="changePage(1)" /></div>
      <div class="form-group">
        <label>Канал</label>
        <select v-model="channelFilter" @change="changePage(1)">
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
          <thead><tr><th>Дата</th><th>Изделие</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Заметки</th><th>Канал</th></tr></thead>
          <tbody>
            <template v-for="s in sales" :key="s.id">
              <tr
                v-for="(item, idx) in s.items"
                :key="item.id"
                class="sale-row"
                :class="{ 'sale-group-end': idx === s.items.length - 1 }"
                @click="viewSale(s.id)"
              >
                <td>{{ fmtDate(s.sale_date) }}</td>
                <td>{{ item.product_name || '—' }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.price }} {{ cur }}</td>
                <td><strong>{{ (item.quantity * item.price).toFixed(2) }} {{ cur }}</strong></td>
                <td style="color:var(--text-muted)">{{ s.notes || '—' }}</td>
                <td>{{ channelName(s.channel_id) || '—' }}</td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="2">{{ totalsLabel }}</td>
              <td>{{ pageTotals.qty }}</td>
              <td></td>
              <td>{{ pageTotals.sum }} {{ cur }}</td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div v-if="meta.pages > 1 && !channelFilter" class="pagination">
        <button class="btn btn-secondary btn-sm" :disabled="meta.page <= 1" @click="changePage(meta.page - 1)">← Назад</button>
        <span class="pagination-info">{{ meta.page }} / {{ meta.pages }}</span>
        <button class="btn btn-secondary btn-sm" :disabled="meta.page >= meta.pages" @click="changePage(meta.page + 1)">Вперёд →</button>
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

    <BaseModal v-if="showDetail" title="Продажа" @close="showDetail = false">
      <div v-if="detailLoading" class="loading">Загрузка...</div>
      <div v-else-if="detail">
        <div class="form-row">
          <div><strong>Дата:</strong> {{ fmtDate(detail.sale_date) }}</div>
          <div><strong>Канал:</strong> {{ detail.channel_name || '—' }}</div>
        </div>
        <div v-if="detail.notes" style="margin-top:8px"><strong>Заметки:</strong> {{ detail.notes }}</div>

        <div style="font-weight:600;margin:12px 0 8px">Позиции</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Изделие</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
            <tbody>
              <tr v-for="item in detail.items" :key="item.id">
                <td>{{ item.product_name || '—' }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.price }} {{ cur }}</td>
                <td>{{ (item.quantity * item.price).toFixed(2) }} {{ cur }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="sale-total" style="margin-top:8px">Итого: {{ detail.total_amount }} {{ cur }}</div>
      </div>
      <template #footer>
        <button v-if="detail" class="btn-icon" style="color:var(--danger)" @click="deleteSale(detail.id)" title="Удалить продажу">🗑 Удалить</button>
        <button class="btn btn-secondary" @click="showDetail = false">Закрыть</button>
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
const showDetail = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const meta = ref({ total: 0, page: 1, pages: 1, per_page: 20 })
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
const totalsLabel = computed(() => meta.value.pages > 1 ? 'Итого на странице' : 'Итого')
const pageTotals = computed(() => {
  let qty = 0
  let sum = 0
  for (const s of sales.value) {
    for (const item of s.items) {
      qty += item.quantity
      sum += item.quantity * item.price
    }
  }
  return { qty, sum: sum.toFixed(2) }
})

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

// A specific channel's sales are shown in full, unpaginated — a single
// channel realistically never has anywhere near this many sales, so it's
// effectively "no limit" without needing backend support for one. Using
// fixed constants here (rather than meta.value.per_page) avoids the size
// used for one mode leaking into the other once meta is overwritten by
// the server's echoed-back per_page.
const DEFAULT_PER_PAGE = 20
const NO_PAGINATION_PER_PAGE = 1000

async function load() {
  loading.value = true
  try {
    const params = {
      page: channelFilter.value ? 1 : meta.value.page,
      per_page: channelFilter.value ? NO_PAGINATION_PER_PAGE : DEFAULT_PER_PAGE,
    }
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    if (channelFilter.value) params.channel_id = channelFilter.value
    const [s, ch] = await Promise.all([salesApi.list(params), channelsApi.list()])
    sales.value = s.data
    meta.value = { ...meta.value, ...s.meta }
    channels.value = ch.data
  } finally { loading.value = false }
}

function changePage(page) {
  meta.value.page = page
  load()
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

async function viewSale(id) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await salesApi.get(id)
    detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

async function deleteSale(id) {
  if (!confirm('Удалить продажу? Остатки товаров будут восстановлены.')) return
  await salesApi.delete(id)
  showDetail.value = false
  await load()
}

onMounted(load)
</script>

<style scoped>
.sale-row { cursor: pointer; }
.sale-group-end td { border-bottom: 2px solid var(--border); }
.totals-row td { border-top: 2px solid var(--border); border-bottom: none; font-weight: 600; color: var(--primary); }
.item-product-chosen {
  display: flex; align-items: center; gap: 6px; min-width: 0;
  padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px;
}
.item-product-chosen span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-product-chosen .btn-icon { flex-shrink: 0; padding: 0; }
</style>
