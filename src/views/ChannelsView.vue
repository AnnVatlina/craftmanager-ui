<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Каналы продаж</h1>
      <button class="btn btn-primary" @click="openCreate">+ Добавить</button>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">Загрузка...</div>
      <div v-else-if="!channels.length" class="empty">
        <div class="icon">🏪</div>Каналов пока нет
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr><th>Название</th><th>Тип</th><th>Дата</th><th>Место</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="c in channels" :key="c.id" class="clickable" @click="openDetail(c)">
              <td><strong>{{ c.name }}</strong></td>
              <td>
                <span :class="c.type === 'ярмарка' ? 'badge-success' : 'badge-neutral'" class="badge">
                  {{ c.type === 'ярмарка' ? '🎪 Ярмарка' : c.type === 'лс' ? '💬 ЛС' : c.type }}
                </span>
              </td>
              <td>{{ c.event_date ? fmtDate(c.event_date) : '—' }}</td>
              <td style="color:var(--text-muted)">{{ c.location || '—' }}</td>
              <td @click.stop>
                <button class="btn-icon" @click="editChannel(c)">✏️</button>
                <button class="btn-icon" @click="deleteChannel(c.id)">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit -->
    <BaseModal v-if="showModal" :title="editing ? 'Редактировать канал' : 'Новый канал'" @close="showModal = false">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-group"><label>Название *</label><input v-model="form.name" placeholder="Весенняя ярмарка 2026" /></div>
      <div class="form-group">
        <label>Тип *</label>
        <select v-model="form.type">
          <option value="ярмарка">🎪 Ярмарка</option>
          <option value="лс">💬 Личные сообщения</option>
          <option value="другое">Другое</option>
        </select>
      </div>
      <template v-if="form.type === 'ярмарка'">
        <div class="form-row">
          <div class="form-group"><label>Дата проведения</label><input v-model="form.event_date" type="date" /></div>
          <div class="form-group"><label>Место</label><input v-model="form.location" placeholder="Минск, ТЦ Galileo" /></div>
        </div>
      </template>
      <div class="form-group"><label>Заметки</label><textarea v-model="form.notes"></textarea></div>
      <template #footer>
        <button class="btn btn-secondary" @click="showModal = false">Отмена</button>
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
      </template>
    </BaseModal>

    <!-- Detail -->
    <BaseModal v-if="showDetail && detail" :title="detail.name" @close="showDetail = false">
      <div style="margin-bottom:16px;display:flex;flex-direction:column;gap:6px">
        <div><span style="color:var(--text-muted)">Тип:</span> {{ detail.type }}</div>
        <div v-if="detail.event_date"><span style="color:var(--text-muted)">Дата:</span> {{ fmtDate(detail.event_date) }}</div>
        <div v-if="detail.location"><span style="color:var(--text-muted)">Место:</span> {{ detail.location }}</div>
        <div v-if="detail.notes"><span style="color:var(--text-muted)">Заметки:</span> {{ detail.notes }}</div>
      </div>
      <div style="font-weight:600;margin-bottom:8px">Продажи ({{ detail.sales_count }})</div>
      <div v-if="!detail.sales?.length" class="empty" style="padding:12px 0">Продаж нет</div>
      <table v-else>
        <thead><tr><th>Дата</th><th>Сумма</th></tr></thead>
        <tbody>
          <tr v-for="s in detail.sales" :key="s.id">
            <td>{{ fmtDate(s.sale_date) }}</td>
            <td>{{ s.total_amount }} {{ cur }}</td>
          </tr>
        </tbody>
      </table>
    </BaseModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import BaseModal from '../components/BaseModal.vue'
import { channelsApi } from '../api/channels.js'
import { settingsStore } from '../stores/settings.js'

const channels = ref([])
const loading = ref(true)
const showModal = ref(false)
const showDetail = ref(false)
const saving = ref(false)
const editing = ref(null)
const detail = ref(null)
const error = ref('')
const form = reactive({ name: '', type: 'ярмарка', event_date: '', location: '', notes: '' })

const cur = computed(() => settingsStore.currency)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'

async function load() {
  loading.value = true
  try { const res = await channelsApi.list(); channels.value = res.data }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', type: 'ярмарка', event_date: '', location: '', notes: '' })
  error.value = ''
  showModal.value = true
}

function editChannel(c) {
  editing.value = c.id
  Object.assign(form, { name: c.name, type: c.type, event_date: c.event_date || '', location: c.location || '', notes: c.notes || '' })
  error.value = ''
  showModal.value = true
}

async function openDetail(c) {
  const res = await channelsApi.get(c.id)
  detail.value = res.data
  showDetail.value = true
}

async function save() {
  if (!form.name) { error.value = 'Введите название'; return }
  saving.value = true
  try {
    const data = { ...form, event_date: form.event_date || null, location: form.location || null, notes: form.notes || null }
    if (editing.value) await channelsApi.update(editing.value, data)
    else await channelsApi.create(data)
    showModal.value = false
    await load()
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function deleteChannel(id) {
  if (!confirm('Удалить канал?')) return
  await channelsApi.delete(id)
  await load()
}

onMounted(load)
</script>
