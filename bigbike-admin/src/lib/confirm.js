let _handler = null

export function setConfirmHandler(fn) {
  _handler = fn
}

/**
 * Drop-in replacement for window.confirm() that returns a Promise<boolean>.
 * Falls back to window.confirm if ConfirmDialogProvider is not mounted.
 */
export function showConfirm(message, title) {
  if (_handler) return _handler(message, title)
  return Promise.resolve(window.confirm(message))
}
