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
        </div>
        <div class="card">
          <div class="kpi-label">Прибыль</div>
          <div class="kpi-value" :class="summary.profit >= 0 ? 'success' : 'danger'">
            {{ fmt(summary.profit) }} {{ cur }}
          </div>
        </div>
      </div>

      <div class="form-row" style="gap:16px;align-items:start">
        <div class="card">
          <div style="font-weight:600;margin-bottom:12px;">Топ изделий</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Изделие</th><th>Продано</th><th>Выручка</th></tr></thead>
              <tbody>
                <tr v-for="p in topProducts" :key="p.product_id">
                  <td>{{ p.product_name || '—' }}</td>
                  <td>{{ p.quantity }}</td>
                  <td>{{ fmt(p.revenue) }} {{ cur }}</td>
                </tr>
                <tr v-if="!topProducts.length">
                  <td colspan="3" class="empty">Нет данных</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:600;margin-bottom:12px;">⚠️ Мало на складе</div>
          <div v-if="!lowStock.length" class="empty" style="padding:12px 0">Всё в порядке</div>
          <div v-for="p in lowStock" :key="p.id" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span>{{ p.name }}</span>
            <span class="badge badge-warning">{{ p.stock_qty }} шт</span>
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
const summary = ref({ total_revenue: 0, total_expenses: 0, profit: 0 })
const topProducts = ref([])
const lowStock = ref([])

const cur = computed(() => settingsStore.currency)
const fmt = (v) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function load() {
  loading.value = true
  try {
    const params = {}
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    const [s, t, l] = await Promise.all([
      dashboardApi.summary(params),
      dashboardApi.topProducts(params),
      dashboardApi.lowStock(settingsStore.low_stock_threshold),
    ])
    summary.value = s.data
    topProducts.value = t.data
    lowStock.value = l.data
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
