import { confirmNavigation } from './navigationGuard'

const INDEX = 'bigbikeHistoryIndex'

/** Cancel browser Back/Forward at the existing entry, without pushing a new one. */
export function createGuardedHistory(onLocationChange) {
  let currentIndex = window.history.state?.[INDEX] ?? 0
  let currentUrl = window.location.pathname + window.location.search + window.location.hash
  let restoring = false
  window.history.replaceState({ ...window.history.state, [INDEX]: currentIndex }, '', currentUrl)

  const apply = () => {
    currentUrl = window.location.pathname + window.location.search + window.location.hash
    onLocationChange()
  }

  const onPopState = () => {
    if (restoring) {
      restoring = false
      return
    }
    const targetIndex = window.history.state?.[INDEX]
    if (!confirmNavigation()) {
      if (Number.isInteger(targetIndex) && targetIndex !== currentIndex) {
        restoring = true
        window.history.go(currentIndex - targetIndex)
      } else {
        // Entries supplied by integrations may not have our index.
        window.history.replaceState(
          { ...window.history.state, [INDEX]: currentIndex },
          '',
          currentUrl,
        )
      }
      return
    }
    currentIndex = Number.isInteger(targetIndex) ? targetIndex : currentIndex + 1
    window.history.replaceState({ ...window.history.state, [INDEX]: currentIndex }, '')
    apply()
  }
  window.addEventListener('popstate', onPopState)

  return {
    navigate(url, { replace = false, force = false } = {}) {
      if (restoring || (!force && !confirmNavigation())) return false
      if (!replace) currentIndex += 1
      const state = { ...window.history.state, [INDEX]: currentIndex }
      if (replace) window.history.replaceState(state, '', url)
      else window.history.pushState(state, '', url)
      apply()
      return true
    },
    dispose() {
      window.removeEventListener('popstate', onPopState)
    },
  }
}
