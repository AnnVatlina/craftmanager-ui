<template>
  <div>
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-secondary btn-sm" @click="$router.back()">← Назад</button>
        <h1 class="page-title">{{ product?.name || '...' }}</h1>
      </div>
      <button class="btn btn-primary btn-sm" @click="showEdit = true">Редактировать</button>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <template v-else-if="product">
      <div class="card" style="margin-bottom:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-weight:600">Фотография</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span v-if="uploading" style="font-size:12px;color:var(--text-muted)">Загрузка...</span>
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0">
              {{ product.photo ? 'Заменить' : '+ Загрузить' }}
              <input type="file" accept="image/*" style="display:none" @change="uploadPhoto" :disabled="uploading">
            </label>
            <button v-if="product.photo" class="btn btn-danger btn-sm" @click="removePhoto">Удалить</button>
          </div>
        </div>
        <div v-if="product.photo" style="text-align:center">
          <img :src="'data:image/jpeg;base64,' + product.photo" style="max-width:100%;max-height:360px;border-radius:6px;object-fit:contain">
        </div>
        <div v-else class="empty" style="padding:20px 0;font-size:13px">Нет фотографии</div>
      </div>

      <div class="cards-grid" style="margin-bottom:24px">
        <div class="card"><div class="kpi-label">Цена продажи</div><div class="kpi-value">{{ product.sale_price }} {{ cur }}</div></div>
        <div class="card"><div class="kpi-label">Себестоимость</div><div class="kpi-value">{{ product.cost_price ? product.cost_price + ' ' + cur : '—' }}</div></div>
        <div class="card">
          <div class="kpi-label">Маржа</div>
          <div class="kpi-value" :class="margin >= 0 ? 'success' : 'danger'">{{ margin }}%</div>
        </div>
        <div class="card"><div class="kpi-label">На складе</div><div class="kpi-value">{{ product.stock_qty }} шт</div></div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-weight:600">Состав (материалы)</div>
          <button class="btn btn-secondary btn-sm" @click="showAddMaterial = true">+ Добавить</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Материал</th><th>Кол-во</th><th>Ед.</th><th>Цена/ед.</th><th>Стоимость</th><th></th></tr></thead>
            <tbody>
              <tr v-for="m in product.materials" :key="m.id">
                <td>{{ m.material_name }}</td>
                <td>{{ m.quantity }}</td>
                <td>{{ m.material_unit }}</td>
                <td>{{ m.material_price }} {{ cur }}</td>
                <td>{{ (m.quantity * m.material_price).toFixed(2) }} {{ cur }}</td>
                <td><button class="btn-icon" @click="removeMaterial(m)">🗑</button></td>
              </tr>
              <tr v-if="!product.materials?.length">
                <td colspan="6" class="empty">Материалы не добавлены</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <BaseModal v-if="showEdit" title="Редактировать изделие" @close="showEdit = false">
      <div class="form-group"><label>Название</label><input v-model="editForm.name" /></div>
      <div class="form-row">
        <div class="form-group">
          <label>Категория</label>
          <select v-model="editForm.category">
            <option value="">—</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="form-group"><label>Цена</label><input v-model="editForm.sale_price" type="number" step="0.01" /></div>
      </div>
      <div class="form-group"><label>Остаток</label><input v-model="editForm.stock_qty" type="number" /></div>
      <div class="form-group"><label>Описание</label><textarea v-model="editForm.description"></textarea></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showEdit = false">Отмена</button>
        <button class="btn btn-primary" @click="saveEdit">Сохранить</button>
      </template>
    </BaseModal>

    <BaseModal v-if="showAddMaterial" title="Добавить материал в состав" @close="showAddMaterial = false">
      <div v-if="matError" class="alert alert-error">{{ matError }}</div>
      <div class="form-group">
        <label>Материал</label>
        <select v-model="matForm.material_id">
          <option value="">— Выберите —</option>
          <option v-for="m in allMaterials" :key="m.id" :value="m.id">{{ m.name }} ({{ m.unit }})</option>
        </select>
      </div>
      <div class="form-group"><label>Количество</label><input v-model="matForm.quantity" type="number" step="0.001" /></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showAddMaterial = false">Отмена</button>
        <button class="btn btn-primary" @click="addMaterial">Добавить</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BaseModal from '../components/BaseModal.vue'
import { productsApi } from '../api/products.js'
import { materialsApi } from '../api/materials.js'
import { settingsStore } from '../stores/settings.js'

const route = useRoute()
const product = ref(null)
const loading = ref(true)
const uploading = ref(false)
const showEdit = ref(false)
const showAddMaterial = ref(false)
const allMaterials = ref([])
const matError = ref('')
const editForm = reactive({})
const matForm = reactive({ material_id: '', quantity: '' })

const cur = computed(() => settingsStore.currency)
const categories = computed(() => settingsStore.categories)
const margin = computed(() => {
  if (!product.value?.cost_price) return 0
  return Math.round((product.value.sale_price - product.value.cost_price) / product.value.sale_price * 100)
})

async function load() {
  loading.value = true
  try {
    const [p, m] = await Promise.all([productsApi.get(route.params.id), materialsApi.list()])
    product.value = p.data
    allMaterials.value = m.data
    Object.assign(editForm, { name: p.data.name, category: p.data.category || '', sale_price: p.data.sale_price, stock_qty: p.data.stock_qty, description: p.data.description || '' })
  } finally { loading.value = false }
}

async function saveEdit() {
  await productsApi.update(route.params.id, editForm)
  showEdit.value = false
  await load()
}

async function addMaterial() {
  matError.value = ''
  if (!matForm.material_id || !matForm.quantity) { matError.value = 'Заполните все поля'; return }
  try {
    await productsApi.addMaterial(route.params.id, { material_id: matForm.material_id, quantity: matForm.quantity })
    showAddMaterial.value = false
    matForm.material_id = ''
    matForm.quantity = ''
    await load()
  } catch (e) { matError.value = e.message }
}

async function removeMaterial(m) {
  if (!confirm(`Убрать ${m.material_name} из состава?`)) return
  await productsApi.removeMaterial(route.params.id, m.material_id)
  await load()
}

async function uploadPhoto(event) {
  const file = event.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    await productsApi.uploadPhoto(route.params.id, fd)
    await load()
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

async function removePhoto() {
  if (!confirm('Удалить фотографию?')) return
  await productsApi.deletePhoto(route.params.id)
  product.value.photo = null
}

onMounted(load)
</script>
