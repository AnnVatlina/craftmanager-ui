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
          <thead><tr><th>Название</th><th>Ед.</th><th>Цена/ед.</th><th>Остаток</th><th>Стоимость</th><th></th></tr></thead>
          <tbody>
            <tr v-for="m in materials" :key="m.id">
              <td>{{ m.name }}</td>
              <td>{{ m.unit }}</td>
              <td>{{ fmt(m.price_per_unit) }} {{ cur }}</td>
              <td>
                <span :class="m.stock_qty > 10 ? 'badge-success' : m.stock_qty > 0 ? 'badge-warning' : 'badge-danger'" class="badge">
                  {{ fmt(m.stock_qty) }} {{ m.unit }}
                </span>
              </td>
              <td style="color:var(--text-muted)">{{ fmt(m.stock_qty * m.price_per_unit) }} {{ cur }}</td>
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

      <!-- CREATE mode -->
      <template v-if="!editing">
        <div class="form-row">
          <div class="form-group">
            <label>Единица *</label>
            <select v-model="form.unit">
              <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Начальный остаток</label>
            <input v-model.number="form.stock_qty" type="number" step="0.001" min="0" />
          </div>
        </div>
        <div v-if="form.stock_qty > 0" class="form-group">
          <label>Стоимость партии * <span style="font-weight:400;color:var(--text-muted)">(сколько заплатили за {{ form.stock_qty }} {{ form.unit }})</span></label>
          <input v-model="form.total_cost" type="number" step="0.01" min="0" placeholder="Например: 150" />
          <div v-if="computedPricePerUnit" style="margin-top:4px;font-size:12px;color:var(--text-muted)">
            Цена/ед.: {{ computedPricePerUnit }} {{ cur }}/{{ form.unit }}
          </div>
        </div>
        <div v-else class="form-group">
          <label>Цена/ед. * <span style="font-weight:400;color:var(--text-muted)">(за 1 {{ form.unit }})</span></label>
          <input v-model="form.price_per_unit" type="number" step="0.0001" min="0" />
        </div>
      </template>

      <!-- EDIT mode -->
      <template v-else>
        <div class="form-row">
          <div class="form-group">
            <label>Единица *</label>
            <select v-model="form.unit">
              <option v-for="u in units" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Цена/ед. * <span style="font-weight:400;color:var(--text-muted)">(за 1 {{ form.unit }})</span></label>
            <input v-model="form.price_per_unit" type="number" step="0.0001" min="0" />
          </div>
        </div>
      </template>

      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>

    <!-- Restock -->
    <BaseModal v-if="showRestock" :title="`Пополнить: ${restocking?.name}`" @close="showRestock = false">
      <div v-if="restockError" class="alert alert-error">{{ restockError }}</div>
      <div class="form-row">
        <div class="form-group">
          <label>Количество * <span style="font-weight:400;color:var(--text-muted)">({{ restocking?.unit }})</span></label>
          <input v-model.number="restockForm.qty" type="number" step="0.001" min="0.001" />
        </div>
        <div class="form-group"><label>Дата покупки</label><input v-model="restockForm.purchased_at" type="date" /></div>
      </div>
      <div class="form-group">
        <label>Стоимость партии <span style="font-weight:400;color:var(--text-muted)">(сколько заплатили за {{ restockForm.qty || '...' }} {{ restocking?.unit }})</span></label>
        <input v-model="restockForm.total_cost" type="number" step="0.01" min="0" placeholder="Необязательно" />
        <div v-if="restockPricePerUnit" style="margin-top:4px;font-size:12px;color:var(--text-muted)">
          Цена/ед.: {{ restockPricePerUnit }} {{ cur }}/{{ restocking?.unit }}
        </div>
        <div v-else style="margin-top:4px;font-size:12px;color:var(--text-muted)">
          Если не указать, останется текущая: {{ fmt(restocking?.price_per_unit) }} {{ cur }}/{{ restocking?.unit }}
        </div>
      </div>
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
const restockError = ref('')
const form = reactive({ name: '', unit: '', price_per_unit: '', total_cost: '', stock_qty: 0 })
const restockForm = reactive({ qty: '', total_cost: '', purchased_at: '' })
const cur = computed(() => settingsStore.currency)
const units = computed(() => settingsStore.material_units)
const fmt = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const computedPricePerUnit = computed(() => {
  const cost = parseFloat(form.total_cost)
  const qty = parseFloat(form.stock_qty)
  if (cost > 0 && qty > 0) return (cost / qty).toFixed(4)
  return null
})

const restockPricePerUnit = computed(() => {
  const cost = parseFloat(restockForm.total_cost)
  const qty = parseFloat(restockForm.qty)
  if (cost > 0 && qty > 0) return (cost / qty).toFixed(4)
  return null
})

async function load() {
  loading.value = true
  try { const res = await materialsApi.list(); materials.value = res.data }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', unit: units.value[0] || 'г', price_per_unit: '', total_cost: '', stock_qty: 0 })
  error.value = ''
  showModal.value = true
}

function editMat(m) {
  editing.value = m.id
  Object.assign(form, { name: m.name, unit: m.unit, price_per_unit: m.price_per_unit, total_cost: '', stock_qty: m.stock_qty })
  error.value = ''
  showModal.value = true
}

function openRestock(m) {
  restocking.value = m
  restockForm.qty = ''
  restockForm.total_cost = ''
  restockForm.purchased_at = new Date().toISOString().slice(0, 10)
  restockError.value = ''
  showRestock.value = true
}

async function save() {
  if (!form.name) { error.value = 'Укажите название'; return }

  let price_per_unit
  if (!editing.value && form.stock_qty > 0) {
    if (!form.total_cost) { error.value = 'Укажите стоимость партии'; return }
    price_per_unit = (parseFloat(form.total_cost) / parseFloat(form.stock_qty)).toFixed(4)
  } else {
    if (!form.price_per_unit) { error.value = 'Укажите цену за единицу'; return }
    price_per_unit = form.price_per_unit
  }

  saving.value = true
  try {
    const payload = { name: form.name, unit: form.unit, price_per_unit, stock_qty: form.stock_qty }
    if (editing.value) await materialsApi.update(editing.value, payload)
    else await materialsApi.create(payload)
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function restock() {
  if (!restockForm.qty || parseFloat(restockForm.qty) <= 0) {
    restockError.value = 'Укажите количество'
    return
  }
  restockError.value = ''
  const data = { qty: restockForm.qty }
  if (restockForm.total_cost && parseFloat(restockForm.total_cost) > 0) {
    data.price_per_unit = (parseFloat(restockForm.total_cost) / parseFloat(restockForm.qty)).toFixed(4)
  }
  if (restockForm.purchased_at) data.purchased_at = restockForm.purchased_at
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
