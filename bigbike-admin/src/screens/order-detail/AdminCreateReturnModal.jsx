import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { adminCreateReturn } from '../../lib/adminApi'
import { Modal } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RETURN_REASONS } from './constants'

export function AdminCreateReturnModal({ order, onClose, onSuccess }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('DEFECTIVE')
  const [customerNote, setCustomerNote] = useState('')
  const [qtys, setQtys] = useState(() =>
    Object.fromEntries((order.items ?? []).map((i) => [i.id, 0]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasAny = Object.values(qtys).some((q) => q > 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!hasAny) { setError(t('orders.detail.crmNoItemError')); return }
    setSaving(true)
    setError('')
    try {
      const items = (order.items ?? [])
        .filter((i) => qtys[i.id] > 0)
        .map((i) => ({ orderLineItemId: i.id, quantity: qtys[i.id] }))
      const ret = await adminCreateReturn({
        orderId: order.id,
        reason,
        customerNote: customerNote.trim() || undefined,
        items,
      })
      onSuccess(ret)
    } catch (err) {
      setError(err.message || t('orders.detail.crmError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title={t('orders.detail.createReturnTitle')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="form-field">
          <label className="field-label">{t('orders.detail.crmReasonLabel')} *</label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="form-field">
          <label className="field-label">{t('orders.detail.crmItemsLabel')} *</label>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 font-semibold">{t('orders.detail.crmColProduct')}</th>
                <th className="text-center py-1 px-2 font-semibold">{t('orders.detail.crmColBought')}</th>
                <th className="text-center py-1 px-2 font-semibold">{t('orders.detail.crmColReturnQty')}</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item) => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="py-1.5">
                    <div className="font-medium">{item.productName}</div>
                    {item.variantName && <div className="text-xs text-muted-foreground">{item.variantName}</div>}
                  </td>
                  <td className="text-center py-1.5 px-2">{item.quantity}</td>
                  <td className="text-center py-1.5 px-2">
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      className="w-16 text-center"
                      aria-label={t('orders.detail.crmReturnQtyAria', { product: item.productName, defaultValue: `Số lượng trả ${item.productName}` })}
                      value={qtys[item.id] ?? 0}
                      onChange={(e) => setQtys((prev) => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(0, Number(e.target.value))) }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="form-field">
          <label className="field-label">{t('orders.detail.crmNoteLabel')}</label>
          <Textarea rows={2} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
        </div>

        {error && (
          <p className="field-error flex items-center gap-1.5" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" size="sm" loading={saving} disabled={!hasAny}>
            {t('orders.detail.crmSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
