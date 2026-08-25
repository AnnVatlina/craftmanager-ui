import { ref, watch } from 'vue'

export const SEARCH_MIN_LENGTH = 3
export const DEBOUNCE_MS = 300
export const PAGE_SIZE = 30

/**
 * Search-as-you-type product picker.
 *
 * Below SEARCH_MIN_LENGTH characters shows the most recently added products
 * (cached after the first fetch); at SEARCH_MIN_LENGTH+ it debounces and asks
 * the server to search by name, so the result set never grows with the size
 * of the catalog. `fetchProducts` is injected so this stays testable without
 * mocking the real API client.
 *
 * This is the server-backed mode only. ProductPicker.vue also supports a
 * "local list" mode (scoped to e.g. a sales channel's fair-prep items), but
 * that's implemented directly there as a plain computed over its `products`
 * prop — it needs to react to that prop changing after mount (a channel can
 * get picked while the row's picker is already open), which a value fixed
 * at this composable's setup() time can't do without extra plumbing this
 * doesn't need.
 */
export function useProductPicker(fetchProducts, { debounceMs = DEBOUNCE_MS } = {}) {
  const query = ref('')
  const results = ref([])
  const loading = ref(false)

  let recentCache = null
  let debounceTimer = null
  let requestId = 0

  async function loadRecent() {
    loading.value = true
    const id = ++requestId
    try {
      const res = await fetchProducts({ per_page: PAGE_SIZE })
      if (id !== requestId) return
      recentCache = res.data
      results.value = recentCache
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  async function runSearch(q) {
    loading.value = true
    const id = ++requestId
    try {
      const res = await fetchProducts({ search: q, per_page: PAGE_SIZE })
      if (id !== requestId) return
      results.value = res.data
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  watch(query, (q) => {
    clearTimeout(debounceTimer)
    const trimmed = q.trim()
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      results.value = recentCache ?? []
      return
    }
    debounceTimer = setTimeout(() => runSearch(trimmed), debounceMs)
  })

  loadRecent()

  return { query, results, loading, reload: loadRecent }
}
