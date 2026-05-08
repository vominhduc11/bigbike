import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Modal — generic action modal built on existing .modal-overlay/.modal-box CSS.
 *
 * Layout: header (title + close X) / body (children) / footer (actions).
 * Closes on Escape and on overlay click.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  wide = false,
  closeLabel = 'Close',
}) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onMouseDown={handleOverlayClick}
    >
      <div className={`modal-box modal-box--flex${wide ? ' modal-box--wide' : ''}`}>
        <header className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button
            type="button"
            className="btn btn-icon"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {actions ? (
          <footer className="modal-footer modal-actions">{actions}</footer>
        ) : null}
      </div>
    </div>
  )
}
