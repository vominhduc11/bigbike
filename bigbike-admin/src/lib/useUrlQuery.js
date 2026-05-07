import { useCallback, useState } from 'react'

/**
 * Syncs a query-param object with the browser URL.
 * Returns [query, setQuery] where setQuery merges a partial update,
 * resets page to 1 on filter change, and reflects the state in window.location.search.
 */
export function useUrlQuery(defaults) {
  const [query, setQueryState] = useState(() => readQueryFromUrl(defaults))

  const setQuery = useCallback((update) => {
    setQueryState((prev) => {
      const next = typeof update === 'function' ? update(prev) : { ...prev, ...update }
      syncQueryToUrl(next, defaults)
      return next
    })
  }, [defaults])

  return [query, setQuery]
}

export function readQueryFromUrl(defaults) {
  const params = new URLSearchParams(window.location.search)
  const result = { ...defaults }
  for (const [key, val] of params) {
    if (key in defaults) {
      const def = defaults[key]
      if (typeof def === 'number') {
        const n = Number(val)
        if (!Number.isNaN(n)) result[key] = n
      } else {
        result[key] = val
      }
    }
  }
  return result
}

export function syncQueryToUrl(query, defaults) {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(query)) {
    if (val !== undefined && val !== null) {
      const def = defaults?.[key]
      const isDefault = val === def || (key === 'page' && val === 1)
      if (!isDefault && val !== '') {
        params.set(key, String(val))
      }
    }
  }
  const search = params.toString()
  const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}`
  if (window.location.href !== window.location.origin + newUrl) {
    window.history.replaceState({}, '', newUrl)
  }
}
