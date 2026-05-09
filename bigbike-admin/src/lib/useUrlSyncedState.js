import { useEffect, useRef, useState } from 'react'

/**
 * State that mirrors itself into the URL query string and reads from it on mount.
 *
 * - Reads initial values from `window.location.search` if present.
 * - Writes back to URL on change via `history.replaceState` (no navigation, no scroll).
 * - Only persists keys whose value differs from `defaults[key]` — keeps URL clean.
 *
 * The `serialize` and `deserialize` maps let callers customize per-key encoding
 * (e.g. numbers, booleans). Falls back to identity for keys without an entry.
 */
export function useUrlSyncedState(defaults, opts = {}) {
  const { serialize = {}, deserialize = {}, paramPrefix = '' } = opts

  const [state, setState] = useState(() => readFromUrl(defaults, deserialize, paramPrefix))
  const isFirstWrite = useRef(true)

  useEffect(() => {
    if (isFirstWrite.current) {
      isFirstWrite.current = false
      return
    }
    writeToUrl(state, defaults, serialize, paramPrefix)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return [state, setState]
}

function readFromUrl(defaults, deserialize, prefix) {
  if (typeof window === 'undefined') return { ...defaults }
  const params = new URLSearchParams(window.location.search)
  const result = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const raw = params.get(prefix + key)
    if (raw === null) continue
    const fn = deserialize[key]
    result[key] = fn ? fn(raw) : raw
  }
  return result
}

function writeToUrl(state, defaults, serialize, prefix) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)

  for (const key of Object.keys(state)) {
    const value = state[key]
    const def = defaults[key]
    const fn = serialize[key]
    const encoded = fn ? fn(value) : (value == null || value === '' ? null : String(value))
    const defEncoded = fn ? fn(def) : (def == null || def === '' ? null : String(def))

    if (encoded === null || encoded === defEncoded) {
      params.delete(prefix + key)
    } else {
      params.set(prefix + key, encoded)
    }
  }

  const qs = params.toString()
  const newUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
  window.history.replaceState(null, '', newUrl)
}
