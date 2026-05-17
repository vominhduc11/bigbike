import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { createRefund } from '../lib/adminApi'
import { formatCurrencyVnd } from '../lib/formatters'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

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
    } else if (amount !== maxRefundable) {
      // Backend chỉ hỗ trợ hoàn tiền toàn bộ số tiền còn lại
      errs.refundAmount = t('refund.errorMustBeFullAmount', { amount: formatCurrencyVnd(maxRefundable) })
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('refund.modalTitle')}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2 text-sm text-muted-foreground">
          <span>{t('refund.paidAmount')}: <strong className="text-foreground">{formatCurrencyVnd(paidAmount)}</strong></span>
          {alreadyRefunded > 0 && (
            <span> · {t('refund.alreadyRefunded')}: <strong className="text-danger">{formatCurrencyVnd(alreadyRefunded)}</strong></span>
          )}
          <br />
          <span>{t('refund.maxRefundable')}: <strong className="text-foreground">{formatCurrencyVnd(maxRefundable)}</strong></span>
        </div>

        <form id="refund-form" onSubmit={handleSubmit} className="px-6 pb-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-amount">
              {t('refund.labelAmount')} <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="refund-amount"
              type="number"
              min="1"
              max={maxRefundable}
              step="1"
              value={form.refundAmount}
              readOnly
              className="bg-muted cursor-not-allowed"
              aria-describedby="refund-amount-hint"
            />
            <p id="refund-amount-hint" className="text-xs text-muted-foreground">
              {t('refund.hintFullRefundOnly')}
            </p>
            {errors.refundAmount && <p className="text-xs text-danger">{errors.refundAmount}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('refund.labelReason')}</Label>
            <Select
              value={form.refundReason}
              onValueChange={(val) => setForm((p) => ({ ...p, refundReason: val }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-popup">
                {REFUND_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.refundReason && <p className="text-xs text-danger">{errors.refundReason}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-note">{t('refund.labelNote')}</Label>
            <Textarea
              id="refund-note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder={t('refund.notePlaceholder')}
              className="resize-y min-h-[72px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="refund-customer-visible"
              checked={form.customerVisible}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, customerVisible: checked }))}
            />
            <Label htmlFor="refund-customer-visible" className="cursor-pointer font-normal">
              {t('refund.labelCustomerVisible')}
            </Label>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="refund-form"
            variant="danger"
            disabled={saving || maxRefundable <= 0}
          >
            {saving ? t('refund.processing') : t('refund.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
