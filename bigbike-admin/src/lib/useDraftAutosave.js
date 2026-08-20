import { useEffect, useMemo, useState } from 'react'

const DRAFT_VERSION = 1
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_DELAY_MS = 10 * 1000

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readDraft(key, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!key || !canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (draft?.version !== DRAFT_VERSION || !draft.savedAt || !('value' in draft)) {
      window.localStorage.removeItem(key)
      return null
    }
    if (Date.now() - Number(draft.savedAt) > ttlMs) {
      window.localStorage.removeItem(key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function writeDraft(key, value) {
  if (!key || !canUseStorage()) return false
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: DRAFT_VERSION,
        savedAt: Date.now(),
        value,
      }),
    )
    return true
  } catch {
    return false
  }
}

export function clearDraft(key) {
  if (!key || !canUseStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* storage may be blocked */
  }
}

/**
 * Lưu tạm dữ liệu form không nhạy cảm trong trình duyệt.
 * Caller chịu trách nhiệm không truyền mật khẩu, file, token hoặc dữ liệu bí mật.
 */
export function useDraftAutosave(
  key,
  value,
  { enabled = true, dirty = true, delayMs = DEFAULT_DELAY_MS, ttlMs = DEFAULT_TTL_MS } = {},
) {
  const [revision, setRevision] = useState(0)
  const recovered = useMemo(
    () => (revision >= 0 ? readDraft(key, { ttlMs }) : null),
    [key, revision, ttlMs],
  )
  const serializedValue = useMemo(() => JSON.stringify(value), [value])

  useEffect(() => {
    if (!enabled || !dirty || !key) return undefined
    const timer = window.setTimeout(() => writeDraft(key, value), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, dirty, enabled, key, serializedValue, value])

  return {
    recovered,
    clear: () => {
      clearDraft(key)
      setRevision((current) => current + 1)
    },
  }
}
