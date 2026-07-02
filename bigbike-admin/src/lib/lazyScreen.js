import { lazy } from 'react'

// Wrap lazy imports with a one-shot reload on chunk load failure.
// After a new deploy, stale chunk hashes cause dynamic imports to 404.
// One auto-reload fetches the new manifest and resolves the stale reference.
const CHUNK_RELOAD_KEY = 'bb-admin-chunk-reload'

export function lazyScreen(factory, exportName) {
  return lazy(() =>
    factory()
      .then((m) => {
        // Tải chunk thành công → xóa cờ chống-lặp để lần deploy sau vẫn được tự reload 1 lần.
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
        return { default: m[exportName] }
      })
      .catch((err) => {
        const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'
        if (!alreadyReloaded) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          window.location.reload()
          return new Promise(() => {}) // prevent error propagation until reload
        }
        throw err
      })
  )
}
