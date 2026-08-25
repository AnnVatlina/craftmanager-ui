<template>
  <div class="product-picker">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      @focus="open = true"
      @blur="scheduleClose"
    />
    <div v-if="open && query.length > 0 && query.length < SEARCH_MIN_LENGTH" class="picker-list picker-hint">
      Введите ещё {{ SEARCH_MIN_LENGTH - query.length }} симв. для поиска
    </div>
    <div v-else-if="open" class="picker-list">
      <div v-if="loading" class="picker-item picker-empty">Загрузка...</div>
      <template v-else-if="visibleResults.length">
        <button
          v-for="p in visibleResults"
          :key="p.id"
          type="button"
          class="picker-item"
          @mousedown.prevent="select(p)"
        >
          {{ p.name }}<span v-if="p.category" class="picker-item-category"> · {{ p.category }}</span>
        </button>
      </template>
      <div v-else class="picker-item picker-empty">Ничего не найдено</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProductPicker, SEARCH_MIN_LENGTH } from '../composables/useProductPicker.js'
import { productsApi } from '../api/products.js'

const props = defineProps({
  excludeIds: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Найти изделие...' },
})
const emit = defineEmits(['select'])

const { query, results, loading } = useProductPicker((params) => productsApi.list(params))
const open = ref(false)

const visibleResults = computed(() => {
  const excluded = new Set(props.excludeIds)
  return results.value.filter((p) => !excluded.has(p.id))
})

function select(product) {
  emit('select', product)
  query.value = ''
  open.value = false
}

function scheduleClose() {
  // Delay so a click on a result (mousedown) fires before the list unmounts.
  setTimeout(() => { open.value = false }, 150)
}
</script>

<style scoped>
.product-picker { position: relative; }

.picker-list {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow); max-height: 240px; overflow-y: auto;
}

.picker-item {
  display: block; width: 100%; text-align: left; padding: 8px 12px;
  background: none; border: none; font-size: 14px; color: var(--text); cursor: pointer;
}
.picker-item:hover { background: var(--bg); }

.picker-item-category { color: var(--text-muted); font-size: 12px; }

.picker-empty, .picker-hint { color: var(--text-muted); cursor: default; }
.picker-empty:hover, .picker-hint:hover { background: none; }
</style>
