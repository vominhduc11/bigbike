import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatCurrencyVnd } from '../../lib/formatters'
import { posCreateRefund } from '../../lib/adminApi'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'

export function RefundDialog({ order, maxRefundable, hasSerialItems, onClose, onSuccess }) {
  const { t } = useTranslation()
  const REASONS = [
    { value: 'CUSTOMER_REQUEST', label: t('pos.refundReasonCustomerRequest') },
    { value: 'WRONG_PRICE', label: t('pos.refundReasonWrongPrice') },
    { value: 'DEFECTIVE', label: t('pos.refundReasonDefective') },
    { value: 'WRONG_ITEM', label: t('pos.refundReasonWrongItem') },
    { value: 'OTHER', label: t('pos.refundReasonOther') },
  ]
  const [reasonValue, setReasonValue] = useState(REASONS[0].value)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submitDisabled = submitting || !maxRefundable || maxRefundable <= 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitDisabled) return
    setError('')
    setSubmitting(true)
    try {
      const selectedReason = REASONS.find((r) => r.value === reasonValue)?.label || ''
      await posCreateRefund(order.orderId, {
        refundAmount: maxRefundable,
        reason: selectedReason,
        note: note.trim() || undefined,
      })
      toast.success(`${t('pos.refundSuccess')} ${order.orderNumber || ''}`.trim())
      onSuccess(maxRefundable)
    } catch (err) {
      const msg = err?.message || t('pos.refundError')
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={t('pos.refundTitle')} onClose={onClose}>
        <p className="text-sm text-muted-foreground mb-3">
          {t('pos.orderNumber')}: <strong>{order?.orderNumber || '—'}</strong>
          {' · '}{t('pos.refundMax')}: <strong>{formatCurrencyVnd(maxRefundable)}</strong>
        </p>

        {hasSerialItems && (
          <Alert tone="warning" size="sm" role="note" className="mb-3">
            {t('pos.refundSerialWarning')}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <p className="m-0 text-sm text-muted-foreground">
              {t('pos.refundLabelAmount')}: <strong className="text-base text-foreground">{formatCurrencyVnd(maxRefundable)}</strong>
            </p>
            <p className="m-0 mt-1 text-xs text-muted-foreground">
              {t('pos.refundFullOnly')}
            </p>
          </div>

          <div className="mb-3">
            <label className="field-label" htmlFor="pos-refund-reason">{t('pos.refundLabelReason')}</label>
            <Select value={reasonValue} onValueChange={setReasonValue}>
              <SelectTrigger id="pos-refund-reason"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-3">
            <label className="field-label" htmlFor="pos-refund-note">{t('pos.refundLabelNote')}</label>
            <Textarea
              id="pos-refund-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('pos.refundNotePlaceholder')}
              className="w-full resize-y min-h-14"
            />
          </div>

          {error && (
            <p className="m-0 mb-3 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" type="submit" disabled={submitDisabled}>
              {submitting ? t('pos.refundProcessing') : t('pos.refundConfirm')}
            </Button>
          </div>
        </form>
    </Modal>
  )
}
