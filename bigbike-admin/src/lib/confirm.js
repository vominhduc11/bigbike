let _handler = null

export function setConfirmHandler(fn) {
  _handler = fn
}

/**
 * Drop-in replacement for window.confirm() that returns a Promise<boolean>.
 * Falls back to window.confirm if ConfirmDialogProvider is not mounted.
 *
 * @param {string} message  Body text shown to the user.
 * @param {string} [title]  Dialog title.
 * @param {{ variant?: 'danger'|'default', confirmLabel?: string, cancelLabel?: string }} [options]
 *   variant controls the confirm button colour — use 'default' for
 *   non-destructive actions so a red button only ever means "destructive".
 */
export function showConfirm(message, title, options) {
  if (_handler) return _handler(message, title, options)
  return Promise.resolve(window.confirm(message))
}
