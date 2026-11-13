import { useEffect } from 'react'
import { SESSION_ENDING_EVENT } from './authSession'

// Opt-in JSON form recovery. The existing screen owns storage, expiry and restore UI.
export function useFormAutosave(key, form, dirty, persist) {
  useEffect(() => {
    if (!dirty) return undefined
    const flush = () => persist(key, form)
    const timer = window.setTimeout(flush, 10_000)
    window.addEventListener(SESSION_ENDING_EVENT, flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(SESSION_ENDING_EVENT, flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [key, form, dirty, persist])
}
