import { reactive } from 'vue'
import { settingsApi } from '../api/settings.js'

export const settingsStore = reactive({
  currency: 'Br',
  categories: ['Вязаные игрушки плюш', 'Вязаные игрушки акрил', 'Лотерейные игрушки', 'Брелоки'],
  expense_categories: ['материалы', 'инструменты', 'реклама', 'прочее'],
  material_units: ['г', 'кг', 'м', 'мл', 'шт'],
  loaded: false,

  async load() {
    try {
      const res = await settingsApi.get()
      this.currency = res.data.currency
      this.categories = res.data.categories
      this.expense_categories = res.data.expense_categories
      this.material_units = res.data.material_units
      this.loaded = true
    } catch {}
  },
})
