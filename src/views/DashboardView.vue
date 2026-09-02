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

const cur = computed(() => settingsStore.currency)
const fmt = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

onMounted(load)
</script>
