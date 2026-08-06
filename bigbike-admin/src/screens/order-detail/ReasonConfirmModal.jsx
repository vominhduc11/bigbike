import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ReasonConfirmModal({ onConfirm, onClose, loading = false, initialReason = '', onReasonChange }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState(initialReason)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Đang xử lý = parent báo loading HOẶC lần submit này đang chờ (guard nội bộ chặn
  // double-submit trong khoảng thời gian parent chưa kịp bật loading).
  const busy = loading || submitting

  const title = t('orders.detail.confirmCancelTitle')
  const description = t('orders.detail.confirmCancelDesc')

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    if (!reason.trim()) {
      setError(t('orders.detail.reasonRequired'))
      return
    }
    setSubmitting(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={title} onClose={busy ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          <span className="text-danger" aria-hidden="true">*</span> {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason-confirm-input" className="text-sm font-medium">{t('orders.detail.reasonLabel')} *</label>
          <Textarea
            id="reason-confirm-input"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              onReasonChange?.(e.target.value)
              setError('')
            }}
            onBlur={() => { if (!reason.trim()) setError(t('orders.detail.reasonRequired')) }}
            placeholder={t('orders.detail.reasonPlaceholder')}
            className="resize-y"
            autoFocus
            disabled={busy}
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
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" size="sm" className="min-h-11" disabled={busy} aria-busy={busy}>
            {busy ? t('orders.detail.savingShort') : title}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
