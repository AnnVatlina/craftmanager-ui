<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Настройки</h1>
    </div>

    <div class="card" style="max-width:520px">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="saved" class="alert alert-success">Сохранено</div>

      <div style="font-weight:600;margin-bottom:16px">Валюта и отображение</div>
      <div class="form-group">
        <label>Символ валюты</label>
        <input v-model="form.currency" placeholder="Br" style="max-width:120px" />
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

      <div style="font-weight:600;margin-bottom:12px">Категории изделий</div>
      <div v-for="(cat, i) in form.categories" :key="i" style="display:flex;gap:8px;margin-bottom:8px">
        <input v-model="form.categories[i]" style="flex:1" />
        <button class="btn-icon" @click="form.categories.splice(i,1)" style="color:var(--danger)">✕</button>
      </div>
      <button class="btn btn-secondary btn-sm" @click="form.categories.push('')" style="margin-bottom:20px">+ Добавить</button>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />
      <div style="font-weight:600;margin-bottom:12px">Категории расходов</div>
      <div v-for="(cat, i) in form.expense_categories" :key="i" style="display:flex;gap:8px;margin-bottom:8px">
        <input v-model="form.expense_categories[i]" style="flex:1" />
        <button class="btn-icon" @click="form.expense_categories.splice(i,1)" style="color:var(--danger)">✕</button>
      </div>
      <button class="btn btn-secondary btn-sm" @click="form.expense_categories.push('')" style="margin-bottom:20px">+ Добавить</button>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />
      <div style="font-weight:600;margin-bottom:12px">Единицы измерения материалов</div>
      <div v-for="(u, i) in form.material_units" :key="i" style="display:flex;gap:8px;margin-bottom:8px">
        <input v-model="form.material_units[i]" style="flex:1" />
        <button class="btn-icon" @click="form.material_units.splice(i,1)" style="color:var(--danger)">✕</button>
      </div>
      <button class="btn btn-secondary btn-sm" @click="form.material_units.push('')" style="margin-bottom:20px">+ Добавить</button>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? '...' : 'Сохранить' }}</button>
        <button class="btn btn-danger" @click="logout">Выйти</button>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

      <div style="font-weight:600;margin-bottom:8px">Экспорт данных</div>
      <div style="color:var(--text-secondary);font-size:14px;margin-bottom:12px">
        Скачать все данные в виде ZIP-архива с CSV-файлами (товары, материалы, продажи, расходы и др.)
      </div>
      <div v-if="exportError" class="alert alert-error">{{ exportError }}</div>
      <button class="btn btn-secondary" @click="doExport" :disabled="exporting">
        {{ exporting ? 'Подготовка...' : 'Скачать экспорт (CSV)' }}
      </button>

      <hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />

      <div style="font-weight:600;margin-bottom:8px">Импорт данных</div>
      <div style="color:var(--text-secondary);font-size:14px;margin-bottom:12px">
        Загрузить ZIP-архив, полученный через экспорт. Существующие записи (по ID) не перезаписываются; настройки обновляются всегда.
      </div>
      <div v-if="importError" class="alert alert-error">{{ importError }}</div>
      <div v-if="importResult" class="alert alert-success">
        Импорт завершён: товары {{ importResult.products }}, материалы {{ importResult.materials }},
        продажи {{ importResult.sales }}, расходы {{ importResult.expenses }},
        покупатели {{ importResult.buyers }}.
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label class="btn btn-secondary" style="cursor:pointer">
          {{ importing ? 'Импорт...' : 'Выбрать ZIP и импортировать' }}
          <input type="file" accept=".zip" style="display:none" :disabled="importing" @change="doImport" />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { settingsApi } from '../api/settings.js'
import { exportApi } from '../api/export.js'
import { importApi } from '../api/import.js'
import { settingsStore } from '../stores/settings.js'
import { authStore } from '../stores/auth.js'

const saving = ref(false)
const saved = ref(false)
const error = ref('')
const exporting = ref(false)
const exportError = ref('')
const importing = ref(false)
const importError = ref('')
const importResult = ref(null)
const form = reactive({ currency: 'Br', categories: [], expense_categories: [], material_units: [] })

async function load() {
  await settingsStore.load()
  form.currency = settingsStore.currency
  form.categories = [...settingsStore.categories]
  form.expense_categories = [...settingsStore.expense_categories]
  form.material_units = [...settingsStore.material_units]
}

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    await settingsApi.update({
      currency: form.currency,
      categories: form.categories.filter(c => c.trim()),
      expense_categories: form.expense_categories.filter(c => c.trim()),
      material_units: form.material_units.filter(c => c.trim()),
    })
    await settingsStore.load()
    saved.value = true
    setTimeout(() => saved.value = false, 3000)
  } catch (e) { error.value = e.message }
  finally { saving.value = false }
}

async function doImport(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  importing.value = true
  importError.value = ''
  importResult.value = null
  try {
    const res = await importApi.importCsv(file)
    importResult.value = res.data.imported
    setTimeout(() => importResult.value = null, 6000)
  } catch (err) { importError.value = err.message }
  finally { importing.value = false }
}

async function doExport() {
  exporting.value = true
  exportError.value = ''
  try {
    await exportApi.downloadCsv()
  } catch (e) { exportError.value = e.message }
  finally { exporting.value = false }
}

const logout = () => authStore.logout()
onMounted(load)
</script>
