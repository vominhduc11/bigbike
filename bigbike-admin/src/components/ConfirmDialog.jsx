import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setConfirmHandler } from '../lib/confirm'

export function ConfirmDialogProvider() {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)

  useEffect(() => {
    setConfirmHandler((message, title = t('common.confirm')) =>
      new Promise((resolve) => {
        resolveRef.current = resolve
        setDialog({ message, title })
      })
    )
    return () => setConfirmHandler(null)
  }, [t])

  const handleClose = useCallback((result) => {
    setDialog(null)
    resolveRef.current?.(result)
  }, [])

  useEffect(() => {
    if (!dialog) return
    const handleKey = (e) => {
      if (e.key === 'Escape') handleClose(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [dialog, handleClose])

  if (!dialog) return null

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={() => handleClose(false)}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title" id="confirm-title">{dialog.title}</h3>
        <p className="confirm-message">{dialog.message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => handleClose(true)} autoFocus>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
