import { useEffect, useRef, useState } from 'react'

/**
 * Keyboard navigation for card grids.
 *
 * Arrow keys navigate the focus index across `count` items, computed from
 * the actual rendered grid columns (DOM-measured).
 * Space toggles selection.
 * Enter triggers `onActivate(focusIndex)`.
 * Delete (NOT Backspace — too easy to trigger by accident) triggers `onDelete(focusIndex)`.
 *
 * Callbacks are captured via refs so the listener re-binds at most once per
 * mount/enable change, regardless of how often the parent re-renders.
 */
export function useKeyboardNav({ count, gridRef, onActivate, onSelect, onDelete, enabled = true }) {
  const [focusIndex, setFocusIndex] = useState(-1)

  const callbacks = useRef({ onActivate, onSelect, onDelete })
  useEffect(() => {
    callbacks.current = { onActivate, onSelect, onDelete }
  }, [onActivate, onSelect, onDelete])

  useEffect(() => {
    if (!enabled) return

    function getColumnsCount() {
      const grid = gridRef.current
      if (!grid) return 1
      const style = window.getComputedStyle(grid)
      const tpl = style.getPropertyValue('grid-template-columns')
      return Math.max(1, tpl.split(' ').filter(Boolean).length)
    }

    function isEditable(el) {
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    function onKey(e) {
      if (count === 0) return
      if (isEditable(document.activeElement)) return

      const cols = getColumnsCount()
      const cb = callbacks.current

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          setFocusIndex((i) => Math.min(count - 1, (i < 0 ? 0 : i + 1)))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setFocusIndex((i) => Math.max(0, (i < 0 ? 0 : i - 1)))
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocusIndex((i) => Math.min(count - 1, (i < 0 ? 0 : i + cols)))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusIndex((i) => Math.max(0, (i < 0 ? 0 : i - cols)))
          break
        case 'Home':
          e.preventDefault(); setFocusIndex(0); break
        case 'End':
          e.preventDefault(); setFocusIndex(count - 1); break
        case ' ':
          if (focusIndex >= 0 && cb.onSelect) { e.preventDefault(); cb.onSelect(focusIndex) }
          break
        case 'Enter':
          if (focusIndex >= 0 && cb.onActivate) { e.preventDefault(); cb.onActivate(focusIndex) }
          break
        case 'Delete':
          // Backspace deliberately omitted — too easy to trigger by mistake when
          // a button or thumbnail has focus, leading to data loss.
          if (focusIndex >= 0 && cb.onDelete) { e.preventDefault(); cb.onDelete(focusIndex) }
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, focusIndex, gridRef, enabled])

  // Scroll focused element into view
  useEffect(() => {
    if (focusIndex < 0) return
    const grid = gridRef.current
    if (!grid) return
    const child = grid.children[focusIndex]
    if (child && typeof child.scrollIntoView === 'function') {
      child.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusIndex, gridRef])

  // Reset when count changes
  useEffect(() => {
    if (focusIndex >= count) setFocusIndex(-1)
  }, [count, focusIndex])

  return { focusIndex, setFocusIndex }
}
