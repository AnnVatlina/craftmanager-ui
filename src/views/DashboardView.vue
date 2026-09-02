<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Дашборд</h1>
    </div>

    <div class="filters">
      <div class="form-group">
        <label>С</label>
        <input v-model="dateFrom" type="date" @change="load" />
      </div>
      <div class="form-group">
        <label>По</label>
        <input v-model="dateTo" type="date" @change="load" />
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <template v-else>
      <div class="cards-grid">
        <div class="card">
          <div class="kpi-label">Выручка</div>
          <div class="kpi-value success">{{ fmt(summary.total_revenue) }} {{ cur }}</div>
        </div>
        <div class="card">
          <div class="kpi-label">Расходы</div>
          <div class="kpi-value danger">{{ fmt(summary.total_expenses) }} {{ cur }}</div>
          <div class="kpi-breakdown">
            <span>Прочие: {{ fmt(summary.manual_expenses) }} {{ cur }}</span>
            <span>Материалы: {{ fmt(summary.material_expenses) }} {{ cur }}</span>
          </div>
        </div>
        <div class="card">
          <div class="kpi-label">Прибыль</div>
          <div class="kpi-value" :class="summary.profit >= 0 ? 'success' : 'danger'">
            {{ fmt(summary.profit) }} {{ cur }}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div style="font-weight:600;margin-bottom:12px;">Результаты по ярмаркам</div>
        <div v-if="!fairChannels.length" class="empty" style="padding:12px 0">Ярмарок пока нет</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ярмарка</th>
                <th>Дата</th>
                <th style="text-align:center">Взято</th>
                <th style="text-align:center">Продано</th>
                <th style="text-align:right">Выручка</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in fairChannels" :key="f.channel_id">
                <td>{{ f.channel_name }}</td>
                <td>{{ fmtDate(f.event_date) }}</td>
                <td style="text-align:center">{{ f.total_planned }}</td>
                <td style="text-align:center">{{ f.total_sold }}</td>
                <td style="text-align:right">{{ fmt(f.total_revenue) }} {{ cur }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { dashboardApi } from '../api/dashboard.js'
import { settingsStore } from '../stores/settings.js'

const loading = ref(true)
const dateFrom = ref('')
const dateTo = ref('')
const summary = ref({ total_revenue: 0, total_expenses: 0, manual_expenses: 0, material_expenses: 0, profit: 0 })
// Planned-vs-sold per fair is always all-time (see GET /dashboard/fair-channels)
// and doesn't react to the С/По filter above — loaded once, separately.
const fairChannels = ref([])

const cur = computed(() => settingsStore.currency)
const fmt = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—'

async function load() {
  loading.value = true
  try {
    const params = {}
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    const res = await dashboardApi.summary(params)
    summary.value = res.data
  } finally {
    loading.value = false
  }
}

async function loadFairChannels() {
  const res = await dashboardApi.fairChannels()
  fairChannels.value = res.data
}

onMounted(() => {
  load()
  loadFairChannels()
})
</script>
