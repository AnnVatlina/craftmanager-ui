<template>
  <div class="product-picker">
    <input
      ref="inputEl"
      v-model="query"
      type="text"
      :placeholder="placeholder"
      @focus="onFocus"
      @blur="scheduleClose"
    />
    <Teleport to="body">
      <div
        v-if="open && query.length > 0 && query.length < SEARCH_MIN_LENGTH"
        class="picker-list picker-hint"
        :style="floatingStyle"
      >
        Введите ещё {{ SEARCH_MIN_LENGTH - query.length }} симв. для поиска
      </div>
      <div v-else-if="open" class="picker-list" :style="floatingStyle">
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
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useProductPicker, SEARCH_MIN_LENGTH } from '../composables/useProductPicker.js'
import { productsApi } from '../api/products.js'

const props = defineProps({
  excludeIds: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Найти изделие...' },
})
const emit = defineEmits(['select'])

const { query, results, loading } = useProductPicker((params) => productsApi.list(params))
const open = ref(false)
const inputEl = ref(null)
const coords = ref({ top: 0, left: 0, width: 0 })

const visibleResults = computed(() => {
  const excluded = new Set(props.excludeIds)
  return results.value.filter((p) => !excluded.has(p.id))
})

const floatingStyle = computed(() => ({
  position: 'fixed',
  top: coords.value.top + 'px',
  left: coords.value.left + 'px',
  width: coords.value.width + 'px',
}))

// The dropdown is teleported to <body> and positioned via getBoundingClientRect
// instead of `position: absolute` inside the component, because this picker
// lives inside a table row wrapped in an `overflow-x: auto` container — and
// per the CSS overflow spec, an ancestor with overflow-x non-visible also
// clips on the y-axis, so an absolutely-positioned dropdown gets cut off
// there instead of floating over the page.
function updateCoords() {
  const el = inputEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  coords.value = { top: r.bottom + 4, left: r.left, width: r.width }
}

function onFocus() {
  open.value = true
  updateCoords()
}

function onReposition() {
  if (open.value) updateCoords()
}
// `true` = capture phase, so this also catches scroll on ancestor containers
// (like .table-wrap), whose scroll events don't bubble to window otherwise.
window.addEventListener('scroll', onReposition, true)
window.addEventListener('resize', onReposition)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onReposition, true)
  window.removeEventListener('resize', onReposition)
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
  z-index: 1000;
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
