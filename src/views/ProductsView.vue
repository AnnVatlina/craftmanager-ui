<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Изделия</h1>
      <button class="btn btn-primary" @click="openCreate">+ Добавить</button>
    </div>

    <div class="filters">
      <div class="form-group">
        <label>Категория</label>
        <select v-model="filterCategory" @change="changePage(1)">
          <option value="">Все</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <div class="form-group">
        <label>Наличие</label>
        <select v-model="filterInStock" @change="changePage(1)">
          <option value="">Все</option>
          <option value="true">В наличии</option>
          <option value="false">Нет в наличии</option>
        </select>
      </div>
      <div class="form-group">
        <label>Поиск</label>
        <input
          v-model="filterSearch"
          type="search"
          placeholder="Название игрушки..."
          @input="onSearchInput"
        />
      </div>
    </div>

    <div v-if="!loading && meta.total > 0" class="summary-bar">
      <span>Всего: <strong>{{ meta.total }}</strong> изд.</span>
      <span>Стоимость склада: <strong>{{ fmt(meta.total_stock_value) }} {{ cur }}</strong></span>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">Загрузка...</div>
      <div v-else-if="!products.length" class="empty"><div class="icon">🧸</div>Изделий пока нет</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr><th>Название</th><th>Категория</th><th>Цена</th><th>Себест.</th><th>Маржа</th><th>Склад</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id" class="clickable" @click="$router.push(`/products/${p.id}`)">
              <td>{{ p.name }}</td>
              <td><span class="badge badge-neutral">{{ p.category || '—' }}</span></td>
              <td>{{ p.sale_price }} {{ cur }}</td>
              <td>{{ p.cost_price ? p.cost_price + ' ' + cur : '—' }}</td>
              <td>
                <span v-if="p.cost_price" :class="margin(p) >= 0 ? 'badge-success' : 'badge-danger'" class="badge">
                  {{ margin(p) }}%
                </span>
              </td>
              <td><span :class="p.stock_qty > 0 ? 'badge-success' : 'badge-danger'" class="badge">{{ p.stock_qty }}</span></td>
              <td @click.stop>
                <button class="btn btn-secondary btn-sm" @click="openRestock(p)">Пополнить</button>
                <button class="btn-icon" @click="editProduct(p)">✏️</button>
                <button class="btn-icon" @click="deleteProduct(p.id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta.pages > 1" class="pagination">
        <button class="btn btn-secondary btn-sm" :disabled="meta.page <= 1" @click="changePage(meta.page - 1)">← Назад</button>
        <span class="pagination-info">{{ meta.page }} / {{ meta.pages }}</span>
        <button class="btn btn-secondary btn-sm" :disabled="meta.page >= meta.pages" @click="changePage(meta.page + 1)">Вперёд →</button>
      </div>
    </div>

    <BaseModal v-if="showModal" :title="editing ? 'Редактировать изделие' : 'Новое изделие'" @close="showModal = false">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-group"><label>Название *</label><input v-model="form.name" /></div>
      <div class="form-row">
        <div class="form-group">
          <label>Категория</label>
          <select v-model="form.category">
            <option value="">—</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="form-group"><label>Цена продажи *</label><input v-model="form.sale_price" type="number" step="0.01" /></div>
      </div>
      <div v-if="!editing" class="form-group">
        <label>Начальный остаток</label>
        <input v-model.number="form.stock_qty" type="number" min="0" />
      </div>
      <div v-if="!editing && form.stock_qty > 0" class="form-group">
        <label>Дата производства</label>
        <input v-model="form.produced_at" type="date" />
      </div>
      <div class="form-group"><label>Описание</label><textarea v-model="form.description"></textarea></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>

    <BaseModal v-if="showRestock" :title="`Пополнить: ${restocking?.name}`" @close="showRestock = false">
      <div v-if="restockError" class="alert alert-error">{{ restockError }}</div>
      <div class="form-row">
        <div class="form-group"><label>Количество *</label><input v-model.number="restockForm.qty" type="number" min="1" step="1" /></div>
        <div class="form-group"><label>Дата производства</label><input v-model="restockForm.produced_at" type="date" /></div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showRestock = false">Отмена</button>
        <button class="btn btn-primary" @click="restock" :disabled="restockingSaving">{{ restockingSaving ? '...' : 'Пополнить' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { productsApi } from '../api/products.js'
import { settingsStore } from '../stores/settings.js'

const products = ref([])
const loading = ref(true)
const showModal = ref(false)
const showRestock = ref(false)
const saving = ref(false)
const restockingSaving = ref(false)
const editing = ref(null)
const restocking = ref(null)
const error = ref('')
const restockError = ref('')
const filterCategory = ref('')
const filterInStock = ref('')
const filterSearch = ref('')
let searchTimer
const meta = ref({ total: 0, page: 1, pages: 1, per_page: 20, total_stock_value: 0 })
const form = reactive({ name: '', category: '', sale_price: '', stock_qty: 0, produced_at: '', description: '' })
const restockForm = reactive({ qty: '', produced_at: '' })

const cur = computed(() => settingsStore.currency)
const categories = computed(() => settingsStore.categories)
const margin = (p) => p.cost_price ? Math.round((p.sale_price - p.cost_price) / p.sale_price * 100) : 0
const fmt = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

async function load() {
  loading.value = true
  try {
    const params = { page: meta.value.page, per_page: meta.value.per_page }
    if (filterCategory.value) params.category = filterCategory.value
    if (filterInStock.value !== '') params.in_stock = filterInStock.value
    if (filterSearch.value.trim()) params.search = filterSearch.value.trim()
    const res = await productsApi.list(params)
    products.value = res.data
    meta.value = { ...meta.value, ...res.meta }
  } finally { loading.value = false }
}

function changePage(page) {
  meta.value.page = page
  load()
}

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => changePage(1), 250)
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', category: '', sale_price: '', stock_qty: 0, produced_at: today(), description: '' })
  error.value = ''
  showModal.value = true
}

function editProduct(p) {
  editing.value = p.id
  Object.assign(form, { name: p.name, category: p.category || '', sale_price: p.sale_price, stock_qty: p.stock_qty, produced_at: '', description: p.description || '' })
  error.value = ''
  showModal.value = true
}

function openRestock(p) {
  restocking.value = p
  Object.assign(restockForm, { qty: '', produced_at: today() })
  restockError.value = ''
  showRestock.value = true
}

async function save() {
  if (!form.name || !form.sale_price) { error.value = 'Заполните обязательные поля'; return }
  saving.value = true
  try {
    if (editing.value) {
      const { name, category, sale_price, description } = form
      await productsApi.update(editing.value, { name, category, sale_price, description })
    } else await productsApi.create(form)
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function restock() {
  if (!restockForm.qty || restockForm.qty < 1) {
    restockError.value = 'Укажите количество'
    return
  }
  restockingSaving.value = true
  restockError.value = ''
  try {
    await productsApi.restock(restocking.value.id, restockForm)
    showRestock.value = false
    await load()
  } catch (e) { restockError.value = e.message }
  finally { restockingSaving.value = false }
}

async function deleteProduct(id) {
  if (!confirm('Если у изделия есть продажи, оно будет архивировано. Удалить изделие?')) return
  await productsApi.delete(id)
  await load()
}

onMounted(load)
</script>
