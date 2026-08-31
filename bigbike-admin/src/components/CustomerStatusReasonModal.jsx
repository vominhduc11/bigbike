import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const MAX_REASON_LENGTH = 1000

// The optional reason is audit-only and is never shown to the customer.
export function CustomerStatusReasonModal({
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  onConfirm,
  onClose,
  loading = false,
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const busy = loading || submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setSubmitting(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={title} onClose={busy ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={busy}>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-2">
          <label htmlFor="customer-status-reason-input" className="text-sm font-medium">
            {t('customers.detail.statusReasonLabel', { defaultValue: 'Lý do (không bắt buộc)' })}
          </label>
          <Textarea
            id="customer-status-reason-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('customers.detail.statusReasonPlaceholder', {
              defaultValue: 'Ghi chú nội bộ, ví dụ: khách báo cáo gian lận thanh toán…',
            })}
            className="resize-y"
            maxLength={MAX_REASON_LENGTH}
            aria-describedby="customer-status-reason-help customer-status-reason-count"
            autoFocus
            disabled={busy}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span id="customer-status-reason-help">{t('customers.detail.statusReasonHelp')}</span>
            <span id="customer-status-reason-count" aria-live="polite">
              {t('customers.detail.statusReasonCount', {
                count: reason.length,
                max: MAX_REASON_LENGTH,
              })}
            </span>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant={confirmVariant} className="min-h-11" disabled={busy}>
            {busy ? t('orders.detail.savingShort', { defaultValue: 'Đang lưu…' }) : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
