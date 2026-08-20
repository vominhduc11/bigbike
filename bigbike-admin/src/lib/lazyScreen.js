import { lazy } from 'react'

// Wrap lazy imports with a one-shot reload on chunk load failure.
// After a new deploy, stale chunk hashes cause dynamic imports to 404.
// One auto-reload fetches the new manifest and resolves the stale reference.
const CHUNK_RELOAD_KEY = 'bb-admin-chunk-reload'

/**
 * Lỗi sai quy ước export — KHÔNG phải lỗi tải chunk, nên tuyệt đối không reload.
 * Màn hình phải dùng `export function Ten()`, không phải `export default`.
 */
class ScreenExportError extends Error {}

export function lazyScreen(factory, exportName) {
  return lazy(() =>
    factory()
      .then((m) => {
        // Tải chunk thành công → xoá cờ chống-lặp để lần deploy sau vẫn được tự reload 1 lần.
        sessionStorage.removeItem(CHUNK_RELOAD_KEY)
        const Screen = m[exportName]
        // Không có export đúng tên thì React chỉ ném "Minified React error #306 … resolves to
        // undefined" — vô phương lần ra nguyên nhân trên production. Báo thẳng cái sai.
        if (typeof Screen !== 'function') {
          throw new ScreenExportError(
            `lazyScreen: module không có export tên "${exportName}". ` +
              'Màn hình phải dùng `export function ' +
              exportName +
              '()`, không phải `export default`.',
          )
        }
        return { default: Screen }
      })
      .catch((err) => {
        // Sai export là lỗi code: reload lại cũng y hệt, chỉ làm mất thông báo lỗi.
        if (err instanceof ScreenExportError) throw err
        const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'
        if (!alreadyReloaded) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          window.location.reload()
          return new Promise(() => {}) // prevent error propagation until reload
        }
        throw err
      }),
  )
}
