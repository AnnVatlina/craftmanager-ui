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
        v-if="!isLocalMode && open && query.length > 0 && query.length < SEARCH_MIN_LENGTH"
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
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useProductPicker, SEARCH_MIN_LENGTH } from '../composables/useProductPicker.js'
import { productsApi } from '../api/products.js'

const props = defineProps({
  excludeIds: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Найти изделие...' },
  // When given, the picker offers only these products (filtered locally by
  // name as the user types) instead of searching the full catalog on the
  // server. Used to scope the picker to e.g. a sales channel's fair-prep
  // list. Reactive: switching this on/off while the picker is open (already
  // mounted, not yet picked from) takes effect immediately.
  products: { type: Array, default: null },
})
const emit = defineEmits(['select'])

const isLocalMode = computed(() => props.products !== null)

// Always created — even in local mode, where its fetch results just go
// unused — because whether we need it can change reactively after mount
// (e.g. a channel gets picked while this row's picker is still open), and
// useProductPicker's setup can't be re-run once switched off. The one
// wasted recent-30 request in that case is the same cost this component
// already paid on every mount before scoping existed.
const server = useProductPicker((params) => productsApi.list(params))

const localQuery = ref('')
const localResults = computed(() => {
  if (!isLocalMode.value) return []
  const q = localQuery.value.trim().toLowerCase()
  return q ? props.products.filter((p) => p.name.toLowerCase().includes(q)) : props.products
})

// A scoped list (e.g. a sales channel's fair-prep items) is the default in
// local mode, but it shouldn't trap someone who sold something off-list: at
// SEARCH_MIN_LENGTH+ characters with zero local matches, fall back to the
// normal server-wide search instead of just saying "not found".
const usingFallback = computed(() => {
  if (!isLocalMode.value) return false
  return localQuery.value.trim().length >= SEARCH_MIN_LENGTH && localResults.value.length === 0
})

watch(localQuery, (q) => {
  if (!isLocalMode.value) return
  const trimmed = q.trim()
  server.query.value = (trimmed.length >= SEARCH_MIN_LENGTH && localResults.value.length === 0) ? trimmed : ''
})

const query = computed({
  get: () => (isLocalMode.value ? localQuery.value : server.query.value),
  set: (v) => { if (isLocalMode.value) localQuery.value = v; else server.query.value = v },
})
const results = computed(() => (isLocalMode.value ? (usingFallback.value ? server.results.value : localResults.value) : server.results.value))
const loading = computed(() => (isLocalMode.value ? (usingFallback.value ? server.loading.value : false) : server.loading.value))

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
