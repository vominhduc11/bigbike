import { useCallback, useEffect, useRef } from 'react'
import { registerNavGuard } from './navigationGuard'

/** Returns a stable function that clears only this editor before save-and-navigate. */
export function useUnsavedChanges(when, message) {
  const disposeRef = useRef(null)
  const clearOwnGuard = useCallback(() => {
    disposeRef.current?.()
    disposeRef.current = null
  }, [])

  useEffect(() => {
    if (!when) return undefined
    const dispose = registerNavGuard(() => true, message)
    disposeRef.current = dispose
    return () => {
      dispose()
      if (disposeRef.current === dispose) disposeRef.current = null
    }
  }, [when, message])

  return clearOwnGuard
}
