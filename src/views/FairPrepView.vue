<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Подготовка к ярмарке</h1>
      <button v-if="prep" class="btn btn-secondary" @click="printList">🖨 Распечатать</button>
    </div>

    <div class="form-group" style="max-width:360px;margin-bottom:24px">
      <label>Ярмарка</label>
      <select v-model="selectedChannelId" @change="loadPrep">
        <option value="">— Выберите ярмарку —</option>
        <option v-for="c in channels" :key="c.id" :value="c.id">
          {{ c.name }}{{ c.event_date ? ' · ' + fmtDate(c.event_date) : '' }}{{ c.location ? ' · ' + c.location : '' }}
        </option>
      </select>
    </div>

    <template v-if="selectedChannelId">
      <div v-if="loading" class="loading">Загрузка...</div>
      <template v-else-if="prep">

        <!-- Summary -->
        <div class="summary-bar" style="margin-bottom:16px">
          <span>Позиций: <strong>{{ prep.summary.total_positions }}</strong></span>
          <span>Всего взять: <strong>{{ prep.summary.total_planned }} шт</strong></span>
          <span v-if="prep.summary.total_need_to_make > 0" style="color:var(--danger)">
            Довязать: <strong>{{ prep.summary.total_need_to_make }} шт</strong>
          </span>
          <span v-else style="color:var(--success)">Всё есть на складе ✓</span>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Изделие</th>
                  <th style="text-align:center">Взять</th>
                  <th style="text-align:center">На складе</th>
                  <th style="text-align:center">Довязать</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in prep.items" :key="item.id">
                  <td>{{ item.product_name }}</td>
                  <td style="text-align:center">
                    <input
                      class="qty-input"
                      type="number" min="1"
                      :value="item.planned_qty"
                      @change="updateQty(item, $event.target.value)"
                    />
                  </td>
                  <td style="text-align:center">
                    <span :class="item.stock_qty >= item.planned_qty ? 'badge-success' : 'badge-danger'" class="badge">
                      {{ item.stock_qty }}
                    </span>
                  </td>
                  <td style="text-align:center">
                    <span v-if="item.need_to_make > 0" class="badge badge-danger">{{ item.need_to_make }}</span>
                    <span v-else class="badge badge-success">—</span>
                  </td>
                  <td>
                    <button class="btn-icon" @click="removeItem(item.id)">🗑</button>
                  </td>
                </tr>

                <!-- Add row -->
                <tr>
                  <td>
                    <select v-model="newProductId" style="width:100%">
                      <option value="">— Добавить изделие —</option>
                      <option v-for="p in availableProducts" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                  </td>
                  <td style="text-align:center">
                    <input class="qty-input" type="number" min="1" v-model.number="newQty" />
                  </td>
                  <td colspan="2"></td>
                  <td>
                    <button class="btn btn-primary btn-sm" :disabled="!newProductId || adding" @click="addItem">
                      {{ adding ? '...' : '+ Добавить' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>

    <div v-else-if="!channels.length" class="card">
      <div class="empty">
        <div class="icon">🎪</div>
        Нет ярмарок. Добавьте канал с типом «Ярмарка» в разделе «Каналы продаж».
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fairPrepApi } from '../api/fairPrep.js'
import { productsApi } from '../api/products.js'

const channels = ref([])
const selectedChannelId = ref('')
const prep = ref(null)
const loading = ref(false)
const adding = ref(false)
const newProductId = ref('')
const newQty = ref(1)
const allProducts = ref([])

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : ''

const availableProducts = computed(() => {
  if (!prep.value) return allProducts.value
  const usedIds = new Set(prep.value.items.map(i => i.product_id))
  return allProducts.value.filter(p => !usedIds.has(p.id))
})

async function loadPrep() {
  if (!selectedChannelId.value) { prep.value = null; return }
  loading.value = true
  try {
    const res = await fairPrepApi.getPrep(selectedChannelId.value)
    prep.value = res.data
  } finally { loading.value = false }
}

async function addItem() {
  if (!newProductId.value) return
  adding.value = true
  try {
    const res = await fairPrepApi.addItem(selectedChannelId.value, {
      product_id: newProductId.value,
      planned_qty: newQty.value || 1,
    })
    prep.value = res.data
    newProductId.value = ''
    newQty.value = 1
  } finally { adding.value = false }
}

async function updateQty(item, val) {
  const qty = parseInt(val)
  if (!qty || qty < 1) return
  const res = await fairPrepApi.updateItem(selectedChannelId.value, item.id, { planned_qty: qty })
  prep.value = res.data
}

async function removeItem(itemId) {
  const res = await fairPrepApi.removeItem(selectedChannelId.value, itemId)
  prep.value = res.data
}

function printList() {
  const channel = channels.value.find(c => c.id === selectedChannelId.value)
  const title = channel
    ? `${channel.name}${channel.event_date ? ' · ' + fmtDate(channel.event_date) : ''}${channel.location ? ' · ' + channel.location : ''}`
    : 'Список изделий'

  const rows = prep.value.items.map(item => `
    <tr>
      <td>${item.product_name}</td>
      <td style="text-align:center">${item.planned_qty}</td>
      <td style="text-align:center">${item.stock_qty}</td>
      <td style="text-align:center">${item.need_to_make > 0 ? '<strong style="color:#e11d48">' + item.need_to_make + '</strong>' : '—'}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 14px; }
      h2 { margin-bottom: 4px; }
      .meta { color: #666; margin-bottom: 16px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; }
      th { background: #f5f5f5; text-align: left; }
      .summary { margin-top: 16px; font-size: 13px; color: #555; }
    </style>
  </head><body>
    <h2>🎪 ${title}</h2>
    <p class="meta">Подготовлено: ${new Date().toLocaleDateString('ru-RU')}</p>
    <table>
      <thead><tr><th>Изделие</th><th>Взять</th><th>На складе</th><th>Довязать</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="summary">
      Позиций: ${prep.value.summary.total_positions} &nbsp;|&nbsp;
      Всего взять: ${prep.value.summary.total_planned} шт &nbsp;|&nbsp;
      Довязать: ${prep.value.summary.total_need_to_make} шт
    </p>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

onMounted(async () => {
  const [ch, pr] = await Promise.all([fairPrepApi.listChannels(), productsApi.list()])
  channels.value = ch.data
  allProducts.value = pr.data
})
</script>
