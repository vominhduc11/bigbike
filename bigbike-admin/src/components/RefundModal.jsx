import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { createRefund } from '../lib/adminApi'
import { formatCurrencyVnd } from '../lib/formatters'

const REFUND_REASONS = [
  'Khách yêu cầu huỷ',
  'Sản phẩm lỗi / không đúng mô tả',
  'Giao hàng thất bại',
  'Trùng đơn',
  'Khác',
]

export function RefundModal({ orderId, paidAmount, alreadyRefunded, onSuccess, onClose }) {
  const { t } = useTranslation()
  const maxRefundable = (paidAmount || 0) - (alreadyRefunded || 0)

  const [form, setForm] = useState({
    refundAmount: String(maxRefundable),
    refundReason: REFUND_REASONS[0],
    note: '',
    customerVisible: false,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const errs = {}
    const amount = Number(form.refundAmount)
    if (!form.refundAmount || isNaN(amount) || amount <= 0) {
      errs.refundAmount = t('refund.errorAmountRequired')
    } else if (amount > maxRefundable) {
      errs.refundAmount = t('refund.errorAmountExceeds', { max: formatCurrencyVnd(maxRefundable) })
    }
    if (!form.refundReason) errs.refundReason = t('refund.errorReasonRequired')
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const result = await createRefund(orderId, {
        refundAmount: Number(form.refundAmount),
        refundReason: form.refundReason,
        note: form.note || undefined,
        customerVisible: form.customerVisible,
      })
      toast.success(t('refund.success'))
      onSuccess(result.item)
    } catch (err) {
      toast.error(err.message || t('refund.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <header className="modal-header">
          <h2 id="refund-modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>{t('refund.modalTitle')}</h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.25rem 0.5rem' }} aria-label={t('common.close')}>✕</button>
        </header>

        <div className="modal-body" style={{ padding: '1.25rem' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--admin-color-text-muted)', fontSize: '0.875rem' }}>
            {t('refund.paidAmount')}: <strong>{formatCurrencyVnd(paidAmount)}</strong>
            {alreadyRefunded > 0 && (
              <> · {t('refund.alreadyRefunded')}: <strong style={{ color: 'var(--admin-color-danger)' }}>{formatCurrencyVnd(alreadyRefunded)}</strong></>
            )}
            <br />
            {t('refund.maxRefundable')}: <strong>{formatCurrencyVnd(maxRefundable)}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="refund-amount">
                {t('refund.labelAmount')} <span aria-hidden="true">*</span>
              </label>
              <input
                id="refund-amount"
                className="control-input"
                type="number"
                min="1"
                max={maxRefundable}
                step="1"
                value={form.refundAmount}
                onChange={(e) => setForm((p) => ({ ...p, refundAmount: e.target.value }))}
              />
              {errors.refundAmount && <p className="field-error">{errors.refundAmount}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="refund-reason">{t('refund.labelReason')}</label>
              <select
                id="refund-reason"
                className="control-select"
                value={form.refundReason}
                onChange={(e) => setForm((p) => ({ ...p, refundReason: e.target.value }))}
              >
                {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.refundReason && <p className="field-error">{errors.refundReason}</p>}
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="refund-note">{t('refund.labelNote')}</label>
              <textarea
                id="refund-note"
                className="control-input"
                rows={3}
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder={t('refund.notePlaceholder')}
                style={{ resize: 'vertical', minHeight: 72 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.customerVisible}
                  onChange={(e) => setForm((p) => ({ ...p, customerVisible: e.target.checked }))}
                />
                {t('refund.labelCustomerVisible')}
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-danger" disabled={saving || maxRefundable <= 0}>
                {saving ? t('refund.processing') : t('refund.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
