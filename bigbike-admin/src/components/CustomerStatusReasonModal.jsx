import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Xác nhận đổi trạng thái tài khoản khách hàng (BLOCKED/DISABLED) kèm ô "Lý do" TÙY CHỌN —
// khác ReasonConfirmModal của đơn hàng (order-detail/ReasonConfirmModal.jsx), nơi lý do là
// bắt buộc. Backend (UpdateCustomerStatusRequest.reason) chỉ dùng @Size, không @NotBlank,
// nên form không được ép người dùng nhập. Dùng chung cho cả CustomerListScreen (đổi nhanh
// trên dòng) và CustomerDetailScreen (panel trạng thái) — đặt ở components/ vì không có
// customer-list/ hay customer-detail/ subfolder nào để đặt riêng cho 1 màn hình.
export function CustomerStatusReasonModal({ title, description, confirmLabel, onConfirm, onClose, loading = false }) {
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customer-status-reason-input" className="text-sm font-medium">
            {t('customers.detail.statusReasonLabel', { defaultValue: 'Lý do (không bắt buộc)' })}
          </label>
          <Textarea
            id="customer-status-reason-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('customers.detail.statusReasonPlaceholder', { defaultValue: 'Ghi chú nội bộ, ví dụ: khách báo cáo gian lận thanh toán…' })}
            className="resize-y"
            autoFocus
            disabled={busy}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" size="sm" disabled={busy}>
            {busy ? t('orders.detail.savingShort', { defaultValue: 'Đang lưu…' }) : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
