// Each editor owns its registration. Clearing one editor must never clear another.
const guards = new Map()
const DEFAULT_MESSAGE = 'Bạn có thay đổi chưa lưu. Rời khỏi trang và bỏ các thay đổi?'

function dirtyGuard() {
  return [...guards.values()].find((guard) => guard.getter())
}

function beforeUnload(event) {
  if (!dirtyGuard()) return
  event.preventDefault()
  event.returnValue = ''
}

export function registerNavGuard(getter, message) {
  const owner = Symbol('editor')
  guards.set(owner, { getter, message: message || DEFAULT_MESSAGE })
  if (guards.size === 1) window.addEventListener('beforeunload', beforeUnload)
  return () => {
    guards.delete(owner)
    if (guards.size === 0) window.removeEventListener('beforeunload', beforeUnload)
  }
}

export function confirmNavigation() {
  const guard = dirtyGuard()
  return !guard || window.confirm(guard.message)
}
