import { useEffect, useRef, useState } from 'react'

/**
 * Wires drag-drop upload onto a target ref. Only triggers when the file leaves
 * the document and re-enters — drag-over child elements doesn't reset state.
 *
 * `onFiles` is captured via ref so the hook re-binds at most once per mount,
 * even if the parent re-renders the callback identity on every render.
 *
 * Returns `{ isDragging }` so the UI can render an overlay while a file is hovered.
 */
export function useDragDropUpload(targetRef, onFiles) {
  const [isDragging, setIsDragging] = useState(false)
  const onFilesRef = useRef(onFiles)
  // Keep the latest callback in a ref so listeners don't re-bind on each render.
  useEffect(() => { onFilesRef.current = onFiles }, [onFiles])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    let dragCounter = 0

    function preventDefault(e) {
      e.preventDefault()
      e.stopPropagation()
    }
    function handleEnter(e) {
      preventDefault(e)
      if (e.dataTransfer.types?.includes('Files')) {
        dragCounter++
        setIsDragging(true)
      }
    }
    function handleLeave(e) {
      preventDefault(e)
      dragCounter--
      if (dragCounter <= 0) {
        dragCounter = 0
        setIsDragging(false)
      }
    }
    function handleDrop(e) {
      preventDefault(e)
      dragCounter = 0
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files || [])
      if (files.length > 0) onFilesRef.current?.(files)
    }

    target.addEventListener('dragenter', handleEnter)
    target.addEventListener('dragover', preventDefault)
    target.addEventListener('dragleave', handleLeave)
    target.addEventListener('drop', handleDrop)
    return () => {
      target.removeEventListener('dragenter', handleEnter)
      target.removeEventListener('dragover', preventDefault)
      target.removeEventListener('dragleave', handleLeave)
      target.removeEventListener('drop', handleDrop)
    }
  }, [targetRef]) // onFiles via ref → no re-bind

  return { isDragging }
}
