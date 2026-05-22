import { reactive } from 'vue'
import { settingsApi } from '../api/settings.js'

export const settingsStore = reactive({
  currency: 'Br',
  categories: ['Вязаные игрушки плюш', 'Вязаные игрушки акрил', 'Лотерейные игрушки', 'Брелоки'],
  low_stock_threshold: 5,
  loaded: false,

  async load() {
    try {
      const res = await settingsApi.get()
      this.currency = res.data.currency
      this.categories = res.data.categories
      this.low_stock_threshold = res.data.low_stock_threshold
      this.loaded = true
    } catch {}
  },
})
