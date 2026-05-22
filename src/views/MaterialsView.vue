<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Материалы</h1>
      <button class="btn btn-primary" @click="openCreate">+ Добавить</button>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">Загрузка...</div>
      <div v-else-if="!materials.length" class="empty"><div class="icon">🧵</div>Материалов пока нет</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Название</th><th>Ед.</th><th>Цена/ед.</th><th>Остаток</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in materials" :key="m.id">
              <td>{{ m.name }}</td>
              <td>{{ m.unit }}</td>
              <td>{{ m.price_per_unit }} {{ cur }}</td>
              <td>
                <span :class="m.stock_qty > 10 ? 'badge-success' : m.stock_qty > 0 ? 'badge-warning' : 'badge-danger'" class="badge">
                  {{ m.stock_qty }} {{ m.unit }}
                </span>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" @click="openRestock(m)">Пополнить</button>
                <button class="btn-icon" @click="editMat(m)">✏️</button>
                <button class="btn-icon" @click="deleteMat(m.id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit -->
    <BaseModal v-if="showModal" :title="editing ? 'Редактировать материал' : 'Новый материал'" @close="showModal = false">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-group"><label>Название *</label><input v-model="form.name" /></div>
      <div class="form-row">
        <div class="form-group">
          <label>Единица *</label>
          <select v-model="form.unit">
            <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <div class="form-group"><label>Цена/ед. *</label><input v-model="form.price_per_unit" type="number" step="0.0001" /></div>
      </div>
      <div class="form-group"><label>Начальный остаток</label><input v-model="form.stock_qty" type="number" step="0.001" /></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>

    <!-- Restock -->
    <BaseModal v-if="showRestock" :title="`Пополнить: ${restocking?.name}`" @close="showRestock = false">
      <div class="form-group"><label>Количество</label><input v-model="restockForm.qty" type="number" step="0.001" /></div>
      <div class="form-group"><label>Новая цена/ед. (необязательно)</label><input v-model="restockForm.price_per_unit" type="number" step="0.0001" /></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showRestock = false">Отмена</button>
        <button class="btn btn-primary" @click="restock">Пополнить</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { materialsApi } from '../api/materials.js'
import { settingsStore } from '../stores/settings.js'

const materials = ref([])
const loading = ref(true)
const showModal = ref(false)
const showRestock = ref(false)
const saving = ref(false)
const editing = ref(null)
const restocking = ref(null)
const error = ref('')
const form = reactive({ name: '', unit: '', price_per_unit: '', stock_qty: 0 })
const restockForm = reactive({ qty: '', price_per_unit: '' })
const cur = computed(() => settingsStore.currency)
const units = computed(() => settingsStore.material_units)

async function load() {
  loading.value = true
  try { const res = await materialsApi.list(); materials.value = res.data }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', unit: 'г', price_per_unit: '', stock_qty: 0 })
  error.value = ''
  showModal.value = true
}

function editMat(m) {
  editing.value = m.id
  Object.assign(form, { name: m.name, unit: m.unit, price_per_unit: m.price_per_unit, stock_qty: m.stock_qty })
  error.value = ''
  showModal.value = true
}

function openRestock(m) {
  restocking.value = m
  restockForm.qty = ''
  restockForm.price_per_unit = ''
  showRestock.value = true
}

async function save() {
  if (!form.name || !form.price_per_unit) { error.value = 'Заполните обязательные поля'; return }
  saving.value = true
  try {
    if (editing.value) await materialsApi.update(editing.value, form)
    else await materialsApi.create(form)
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function restock() {
  const data = { qty: restockForm.qty }
  if (restockForm.price_per_unit) data.price_per_unit = restockForm.price_per_unit
  await materialsApi.restock(restocking.value.id, data)
  showRestock.value = false
  await load()
}

async function deleteMat(id) {
  if (!confirm('Удалить материал?')) return
  await materialsApi.delete(id)
  await load()
}

onMounted(load)
</script>
