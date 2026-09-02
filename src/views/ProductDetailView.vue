<template>
  <div>
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-secondary btn-sm" @click="$router.back()">← Назад</button>
        <h1 class="page-title">{{ product?.name || '...' }}</h1>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" @click="showRestock = true">Пополнить</button>
        <button class="btn btn-primary btn-sm" @click="showEdit = true">Редактировать</button>
      </div>
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

      <div class="detail-grid">
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

        <div class="card">
          <div class="section-title">История пополнений</div>
          <div v-if="!productions.length" class="empty" style="padding:20px 0;font-size:13px">Пополнений пока нет</div>
          <div v-else class="table-wrap">
            <table>
              <thead><tr><th>Дата</th><th>Количество</th><th>Источник</th><th></th></tr></thead>
              <tbody>
                <tr v-for="production in productions" :key="production.id">
                  <td>{{ fmtDate(production.produced_at) }}</td>
                  <td>{{ production.quantity }} шт</td>
                  <td>{{ productionSource(production.source) }}</td>
                  <td style="white-space:nowrap">
                    <button class="btn-icon" title="Редактировать" @click="openEditProduction(production)">✏️</button>
                    <button class="btn-icon" title="Удалить" @click="removeProduction(production)">🗑</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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

    <BaseModal v-if="showRestock" title="Пополнить остаток" @close="showRestock = false">
      <div v-if="restockError" class="alert alert-error">{{ restockError }}</div>
      <div class="form-row">
        <div class="form-group"><label>Количество *</label><input v-model.number="restockForm.qty" type="number" min="1" step="1" /></div>
        <div class="form-group"><label>Дата производства</label><input v-model="restockForm.produced_at" type="date" /></div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showRestock = false">Отмена</button>
        <button class="btn btn-primary" @click="restock" :disabled="restocking">{{ restocking ? 'Сохранение...' : 'Пополнить' }}</button>
      </template>
    </BaseModal>

    <BaseModal v-if="showEditProduction" title="Исправить запись пополнения" @close="showEditProduction = false">
      <div v-if="productionEditError" class="alert alert-error">{{ productionEditError }}</div>
      <div class="form-row">
        <div class="form-group"><label>Количество *</label><input v-model.number="productionEditForm.quantity" type="number" min="1" step="1" /></div>
        <div class="form-group"><label>Дата производства</label><input v-model="productionEditForm.produced_at" type="date" /></div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showEditProduction = false">Отмена</button>
        <button class="btn btn-primary" @click="saveEditProduction" :disabled="savingProduction">{{ savingProduction ? 'Сохранение...' : 'Сохранить' }}</button>
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
const showRestock = ref(false)
const restocking = ref(false)
const allMaterials = ref([])
const matError = ref('')
const restockError = ref('')
const editForm = reactive({})
const matForm = reactive({ material_id: '', quantity: '' })
const restockForm = reactive({ qty: '', produced_at: '' })
const productions = ref([])
const showEditProduction = ref(false)
const savingProduction = ref(false)
const productionEditError = ref('')
const editingProduction = ref(null)
const productionEditForm = reactive({ quantity: '', produced_at: '' })

const cur = computed(() => settingsStore.currency)
const categories = computed(() => settingsStore.categories)
const margin = computed(() => {
  if (!product.value?.cost_price) return 0
  return Math.round((product.value.sale_price - product.value.cost_price) / product.value.sale_price * 100)
})
const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('ru-RU') : '—'
const productionSource = (source) => source === 'backfill' ? 'Восстановленная запись' : source === 'correction' ? 'Корректировка' : 'Производство'

async function load() {
  loading.value = true
  try {
    const [p, m, history] = await Promise.all([
      productsApi.get(route.params.id),
      materialsApi.list(),
      productsApi.productions(route.params.id),
    ])
    product.value = p.data
    allMaterials.value = m.data
    productions.value = history.data
    Object.assign(editForm, { name: p.data.name, category: p.data.category || '', sale_price: p.data.sale_price, stock_qty: p.data.stock_qty, description: p.data.description || '' })
    Object.assign(restockForm, { qty: '', produced_at: today() })
  } finally { loading.value = false }
}

async function saveEdit() {
  await productsApi.update(route.params.id, editForm)
  showEdit.value = false
  await load()
}

async function restock() {
  if (!restockForm.qty || restockForm.qty < 1) {
    restockError.value = 'Укажите количество'
    return
  }
  restocking.value = true
  restockError.value = ''
  try {
    await productsApi.restock(route.params.id, restockForm)
    showRestock.value = false
    await load()
  } catch (e) { restockError.value = e.message }
  finally { restocking.value = false }
}

function openEditProduction(production) {
  editingProduction.value = production
  productionEditError.value = ''
  Object.assign(productionEditForm, { quantity: production.quantity, produced_at: production.produced_at })
  showEditProduction.value = true
}

async function saveEditProduction() {
  if (!productionEditForm.quantity || productionEditForm.quantity < 1) {
    productionEditError.value = 'Укажите количество'
    return
  }
  savingProduction.value = true
  productionEditError.value = ''
  try {
    await productsApi.updateProduction(route.params.id, editingProduction.value.id, productionEditForm)
    showEditProduction.value = false
    await load()
  } catch (e) { productionEditError.value = e.message }
  finally { savingProduction.value = false }
}

async function removeProduction(production) {
  if (!confirm(`Удалить запись пополнения на ${production.quantity} шт от ${fmtDate(production.produced_at)}?`)) return
  await productsApi.deleteProduction(route.params.id, production.id)
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

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 24px;
  align-items: start;
}

.section-title { font-weight: 600; margin-bottom: 12px; }
.restock-current { color: var(--text-muted); margin-bottom: 20px; }
.restock-current strong { color: var(--text); }
.restock-card .btn { width: 100%; }

@media (max-width: 900px) {
  .detail-grid { grid-template-columns: 1fr; }
}
</style>
