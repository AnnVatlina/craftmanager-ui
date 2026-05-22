<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Изделия</h1>
      <button class="btn btn-primary" @click="openCreate">+ Добавить</button>
    </div>

    <div class="filters">
      <div class="form-group">
        <label>Категория</label>
        <select v-model="filterCategory" @change="load">
          <option value="">Все</option>
          <option>Вязаные игрушки плюш</option>
          <option>Вязаные игрушки акрил</option>
          <option>Лотерейные игрушки</option>
          <option>Брелоки</option>
        </select>
      </div>
      <div class="form-group">
        <label>Наличие</label>
        <select v-model="filterInStock" @change="load">
          <option value="">Все</option>
          <option value="true">В наличии</option>
          <option value="false">Нет в наличии</option>
        </select>
      </div>
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
              <td>{{ p.sale_price }} Br</td>
              <td>{{ p.cost_price ? p.cost_price + ' Br' : '—' }}</td>
              <td>
                <span v-if="p.cost_price" :class="margin(p) >= 0 ? 'badge-success' : 'badge-danger'" class="badge">
                  {{ margin(p) }}%
                </span>
              </td>
              <td><span :class="p.stock_qty > 0 ? 'badge-success' : 'badge-danger'" class="badge">{{ p.stock_qty }}</span></td>
              <td @click.stop>
                <button class="btn-icon" @click="editProduct(p)">✏️</button>
                <button class="btn-icon" @click="deleteProduct(p.id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
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
            <option>Вязаные игрушки плюш</option>
            <option>Вязаные игрушки акрил</option>
            <option>Лотерейные игрушки</option>
            <option>Брелоки</option>
          </select>
        </div>
        <div class="form-group"><label>Цена продажи *</label><input v-model="form.sale_price" type="number" step="0.01" /></div>
      </div>
      <div class="form-group"><label>Остаток</label><input v-model="form.stock_qty" type="number" /></div>
      <div class="form-group"><label>Описание</label><textarea v-model="form.description"></textarea></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { productsApi } from '../api/products.js'

const products = ref([])
const loading = ref(true)
const showModal = ref(false)
const saving = ref(false)
const editing = ref(null)
const error = ref('')
const filterCategory = ref('')
const filterInStock = ref('')
const form = reactive({ name: '', category: '', sale_price: '', stock_qty: 0, description: '' })

const margin = (p) => p.cost_price ? Math.round((p.sale_price - p.cost_price) / p.sale_price * 100) : 0

async function load() {
  loading.value = true
  try {
    const params = {}
    if (filterCategory.value) params.category = filterCategory.value
    if (filterInStock.value !== '') params.in_stock = filterInStock.value
    const res = await productsApi.list(params)
    products.value = res.data
  } finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', category: '', sale_price: '', stock_qty: 0, description: '' })
  error.value = ''
  showModal.value = true
}

function editProduct(p) {
  editing.value = p.id
  Object.assign(form, { name: p.name, category: p.category || '', sale_price: p.sale_price, stock_qty: p.stock_qty, description: p.description || '' })
  error.value = ''
  showModal.value = true
}

async function save() {
  if (!form.name || !form.sale_price) { error.value = 'Заполните обязательные поля'; return }
  saving.value = true
  try {
    if (editing.value) {
      await productsApi.update(editing.value, form)
    } else {
      await productsApi.create(form)
    }
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function deleteProduct(id) {
  if (!confirm('Удалить изделие?')) return
  await productsApi.delete(id)
  await load()
}

onMounted(load)
</script>
