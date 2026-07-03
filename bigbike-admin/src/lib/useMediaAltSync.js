import { useRef, useState } from 'react'
import { updateMedia } from './adminApi'

/**
 * Shared logic for every MediaPickerModal / VideoPickerModal call site:
 *  - pickAlt(): when the admin picks an existing library item, prefill the
 *    context alt/title field from the item's saved altText/title — but only
 *    if the context field is currently empty, so a value the admin already
 *    typed is never overwritten.
 *  - flushAltSync(): when the picked item was a brand-new upload (no saved
 *    alt/title yet), write whatever the admin types into the context field
 *    back into the library item's altText/title, so it's prefilled next time
 *    this same file is reused anywhere else. No-op for library items that
 *    already existed before this pick.
 */
export function createMediaAltSync() {
  let pendingId = null

  function pickAlt(currentAlt, media) {
    pendingId = media?.isNewUpload ? media.id : null
    if ((currentAlt ?? '').trim()) return currentAlt
    return media?.altText || media?.title || currentAlt || ''
  }

  function flushAltSync(altText) {
    const id = pendingId
    if (!id) return
    const trimmed = (altText ?? '').trim()
    if (!trimmed) return
    pendingId = null
    updateMedia(id, { altText: trimmed, title: trimmed }).catch(() => {
      // Best-effort background sync — losing it just means the admin
      // re-types the alt text next time this file is picked elsewhere.
    })
  }

  return { pickAlt, flushAltSync }
}

/** Single-instance case: one component instance = one picker + one context field. */
export function useMediaAltSync() {
  const [instance] = useState(() => createMediaAltSync())
  return instance
}

/**
 * Multi-instance case: a list where each row has its own picker + context
 * field, rendered inline (no per-row subcomponent), so `useMediaAltSync()`
 * can't be called per row. Keyed by row index — lazily creates one instance
 * per row and reuses it across renders.
 */
export function useMediaAltSyncList() {
  const mapRef = useRef(new Map())
  return function getMediaAltSync(key) {
    if (!mapRef.current.has(key)) mapRef.current.set(key, createMediaAltSync())
    return mapRef.current.get(key)
  }
}
