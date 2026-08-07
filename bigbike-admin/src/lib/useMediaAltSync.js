import { useRef, useState } from 'react'

/**
 * Shared logic for every MediaPickerModal / VideoPickerModal call site:
 *  - pickAlt(): when the admin picks an existing library item, prefill the
 *    context alt/title field from the item's saved altText/title — but only
 *    if the context field is currently empty, so a value the admin already
 *    typed is never overwritten.
 *  - flushAltSync(): compatibility no-op. Editing library metadata belongs to
 *    the Media Library; a contextual picker must not silently overwrite a
 *    deduplicated library item after upload.
 */
export function createMediaAltSync() {
  function pickAlt(currentAlt, media) {
    if ((currentAlt ?? '').trim()) return currentAlt
    return media?.altText || media?.title || currentAlt || ''
  }

  function flushAltSync() {}

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
 * can't be called per row. Callers should use the row's stable `_key`/id so a
 * reorder or deletion cannot attach a pending sync to the wrong media item.
 */
export function useMediaAltSyncList() {
  const mapRef = useRef(new Map())
  return function getMediaAltSync(key) {
    if (!mapRef.current.has(key)) mapRef.current.set(key, createMediaAltSync())
    return mapRef.current.get(key)
  }
}
