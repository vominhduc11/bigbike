import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ReasonConfirmModal({ targetStatus, onConfirm, onClose }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const isFailed = targetStatus === 'FAILED'
  const title = isFailed ? t('orders.detail.confirmFailedTitle') : t('orders.detail.confirmCancelTitle')
  const description = isFailed
    ? t('orders.detail.confirmFailedDesc')
    : t('orders.detail.confirmCancelDesc')

  function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) {
      setError(t('orders.detail.reasonRequired'))
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <Modal open title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason-confirm-input" className="text-sm font-medium">{t('orders.detail.reasonLabel')} *</label>
          <Textarea
            id="reason-confirm-input"
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError('') }}
            onBlur={() => { if (!reason.trim()) setError(t('orders.detail.reasonRequired')) }}
            placeholder={t('orders.detail.reasonPlaceholder')}
            className="resize-y"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'reason-confirm-error' : undefined}
          />
          {error && (
            <p id="reason-confirm-error" role="alert" className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={13} aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" size="sm">
            {title}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
