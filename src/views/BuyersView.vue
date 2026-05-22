<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Покупатели</h1>
      <button class="btn btn-primary" @click="openCreate">+ Добавить</button>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">Загрузка...</div>
      <div v-else-if="!buyers.length" class="empty"><div class="icon">👥</div>Покупателей пока нет</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Имя</th><th>Контакт</th><th>Заметки</th><th></th></tr></thead>
          <tbody>
            <tr v-for="b in buyers" :key="b.id" class="clickable" @click="openDetail(b)">
              <td><strong>{{ b.name }}</strong></td>
              <td>{{ b.contact || '—' }}</td>
              <td style="color:var(--text-muted)">{{ b.notes || '—' }}</td>
              <td @click.stop>
                <button class="btn-icon" @click="editBuyer(b)">✏️</button>
                <button class="btn-icon" @click="deleteBuyer(b.id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit -->
    <BaseModal v-if="showModal" :title="editing ? 'Редактировать покупателя' : 'Новый покупатель'" @close="showModal = false">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-group"><label>Имя *</label><input v-model="form.name" /></div>
      <div class="form-group"><label>Контакт</label><input v-model="form.contact" placeholder="Телефон, Instagram..." /></div>
      <div class="form-group"><label>Заметки</label><textarea v-model="form.notes"></textarea></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>

    <!-- Detail / History -->
    <BaseModal v-if="showDetail" :title="detail?.name" @close="showDetail = false">
      <div style="margin-bottom:16px">
        <div v-if="detail?.contact"><span style="color:var(--text-muted)">Контакт:</span> {{ detail.contact }}</div>
        <div v-if="detail?.notes"><span style="color:var(--text-muted)">Заметки:</span> {{ detail.notes }}</div>
      </div>
      <div style="font-weight:600;margin-bottom:8px">История покупок ({{ detail?.sales_count || 0 }})</div>
      <div v-if="!detail?.sales?.length" class="empty" style="padding:12px 0">Покупок нет</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Дата</th><th>Сумма</th><th>Заметки</th></tr></thead>
          <tbody>
            <tr v-for="s in detail.sales" :key="s.id">
              <td>{{ fmtDate(s.sale_date) }}</td>
              <td>{{ s.total_amount }} ₽</td>
              <td style="color:var(--text-muted)">{{ s.notes || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { buyersApi } from '../api/buyers.js'

const buyers = ref([])
const loading = ref(true)
const showModal = ref(false)
const showDetail = ref(false)
const saving = ref(false)
const editing = ref(null)
const detail = ref(null)
const error = ref('')
const form = reactive({ name: '', contact: '', notes: '' })

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'

async function load() {
  loading.value = true
  try { const res = await buyersApi.list(); buyers.value = res.data }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', contact: '', notes: '' })
  error.value = ''
  showModal.value = true
}

function editBuyer(b) {
  editing.value = b.id
  Object.assign(form, { name: b.name, contact: b.contact || '', notes: b.notes || '' })
  error.value = ''
  showModal.value = true
}

async function openDetail(b) {
  const res = await buyersApi.get(b.id)
  detail.value = res.data
  showDetail.value = true
}

async function save() {
  if (!form.name) { error.value = 'Введите имя'; return }
  saving.value = true
  try {
    if (editing.value) await buyersApi.update(editing.value, form)
    else await buyersApi.create(form)
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function deleteBuyer(id) {
  if (!confirm('Удалить покупателя?')) return
  await buyersApi.delete(id)
  await load()
}

onMounted(load)
</script>
