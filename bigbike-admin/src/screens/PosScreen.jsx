import { useEffect, useRef, useState } from 'react'
import { Minus, Pencil, Plus, Printer, RotateCcw, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { StatePanel } from '../components/StatePanel'
import { formatCurrencyVnd } from '../lib/formatters'
import { fetchCustomers, fetchCustomerCredit, posCreateOrder, posCreateRefund, posSearchProducts } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { Modal } from '../components/layout'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { generateId } from '@/lib/utils'

const PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL', 'CREDIT']

function priceOf(priceObj) {
  if (priceObj == null) return 0
  if (typeof priceObj === 'number') return priceObj
  return Number(priceObj.salePrice ?? priceObj.retailPrice ?? 0)
}

function summarizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return ''
  return options.map((o) => o.value ?? o.name ?? '').filter(Boolean).join(' / ')
}

function effectivePrice(item) {
  return item.overriddenPrice != null ? item.overriddenPrice : item.price
}

function PaymentModal({ cart, total, onClose, onSuccess, canOverrideCreditLimit }) {
  const { t } = useTranslation()
  const [method, setMethod] = useState('CASH')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [tendered, setTendered] = useState('')
  const [cardRef, setCardRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [idempotencyKey] = useState(() =>
    generateId()
  )

  // Walk-in customer link (CASH / CARD_TERMINAL)
  const [walkInQuery, setWalkInQuery] = useState('')
  const [walkInResults, setWalkInResults] = useState([])
  const [walkInCustomer, setWalkInCustomer] = useState(null)

  // CREDIT state
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerCredit, setCustomerCredit] = useState(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const tenderedNum = tendered === '' ? 0 : Number(String(tendered).replace(/\D/g, ''))
  const change = method === 'CASH' && tenderedNum > 0 ? tenderedNum - total : null
  const insufficientTendered = method === 'CASH' && tendered !== '' && tenderedNum < total

  // Credit eligibility checks
  const creditEnabled = customerCredit?.creditEnabled === true
  const creditActive = customerCredit?.creditStatus === 'ACTIVE'
  const availableCredit = customerCredit?.availableCredit ?? null
  const overLimit = method === 'CREDIT' && availableCredit !== null && total > availableCredit
  const creditBlocked = method === 'CREDIT' && selectedCustomer && customerCredit && (!creditEnabled || !creditActive)
  const creditOverLimitBlocked = overLimit && !canOverrideCreditLimit
  const submitDisabled = submitting || insufficientTendered || creditBlocked || creditOverLimitBlocked
      || (method === 'CREDIT' && !selectedCustomer)

  function handleMethodChange(m) {
    setMethod(m)
    if (m !== 'CREDIT') {
      setSelectedCustomer(null)
      setCustomerCredit(null)
      setCustomerResults([])
      setCustomerQuery('')
    } else {
      setWalkInCustomer(null)
      setWalkInQuery('')
      setWalkInResults([])
    }
  }

  async function searchCustomers(q) {
    if (!q || q.length < 2) { setCustomerResults([]); return }
    try {
      const res = await fetchCustomers({ search: q, page: 1, pageSize: 10 })
      setCustomerResults(res.items || [])
    } catch { setCustomerResults([]) }
  }

  async function searchWalkIn(q) {
    if (!q || q.length < 2) { setWalkInResults([]); return }
    try {
      const res = await fetchCustomers({ search: q, page: 1, pageSize: 5 })
      setWalkInResults(res.items || [])
    } catch { setWalkInResults([]) }
  }

  function handleSelectWalkIn(c) {
    setWalkInCustomer(c)
    setWalkInQuery('')
    setWalkInResults([])
    if (!customerName) setCustomerName(c.displayName || '')
    if (!customerPhone && c.phone) setCustomerPhone(c.phone)
  }

  async function loadCustomerCredit(customerId) {
    setCreditLoading(true)
    try {
      const credit = await fetchCustomerCredit(customerId)
      setCustomerCredit(credit)
    } catch (e) {
      setCustomerCredit(null)
      toast.error(e.message || t('common.error'))
    }
    finally { setCreditLoading(false) }
  }

  function handleSelectCustomer(c) {
    setSelectedCustomer(c)
    setCustomerResults([])
    setCustomerQuery(c.displayName || c.email || '')
    loadCustomerCredit(c.id)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitDisabled) return
    setError('')
    setSubmitting(true)
    try {
      const basePayload = {
        paymentMethod: method,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        staffNote: staffNote.trim() || undefined,
        posIdempotencyKey: idempotencyKey,
        ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
        ...(walkInCustomer ? { customerId: walkInCustomer.id } : {}),
        items: cart.map((item) => ({
          productId: item.productId,
          productVariantId: item.variantId,
          quantity: item.qty,
          ...(item.overriddenPrice != null ? { unitPriceOverride: item.overriddenPrice } : {}),
        })),
      }
      let payload
      if (method === 'CASH') {
        payload = { ...basePayload, tenderedAmount: tenderedNum > 0 ? tenderedNum : undefined }
      } else if (method === 'CARD_TERMINAL') {
        payload = { ...basePayload, cardReferenceNumber: cardRef.trim() || undefined }
      } else if (method === 'CREDIT') {
        payload = {
          ...basePayload,
          customerId: selectedCustomer.id,
        }
      } else {
        payload = basePayload
      }
      const result = await posCreateOrder(payload)
      onSuccess({ ...result, _cardRef: method === 'CARD_TERMINAL' ? cardRef.trim() : null }, method)
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo đơn hàng.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={t('pos.paymentMethod')} onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div>
              <label className="field-label">Tên khách (tuỳ chọn)</label>
              <Input
                placeholder="Nguyễn Văn A"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
               />
            </div>
            <div>
              <label className="field-label">Số điện thoại (tuỳ chọn)</label>
              <Input
                placeholder="0901 234 567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
               />
            </div>
          </div>

          {method !== 'CREDIT' && (
            <div className="mb-3">
              <label className="field-label">Liên kết khách hàng cũ (tuỳ chọn)</label>
              {!walkInCustomer ? (
                <div className="relative">
                  <Input
                    placeholder="Tìm theo tên hoặc email..."
                    value={walkInQuery}
                    onChange={(e) => { setWalkInQuery(e.target.value); searchWalkIn(e.target.value) }}
                    autoComplete="off"
                  />
                  {walkInResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[100] bg-surface-raised border border-border rounded-md shadow-md max-h-[180px] overflow-y-auto">
                      {walkInResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="block w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer text-sm hover:bg-surface-hover"
                          onClick={() => handleSelectWalkIn(c)}
                        >
                          <strong>{c.displayName || c.email}</strong>
                          {c.email && c.displayName && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface border border-border rounded-md">
                  <span className="flex-1 text-sm">Đã liên kết: <strong>{walkInCustomer.displayName || walkInCustomer.email}</strong></span>
                  <button type="button" onClick={() => { setWalkInCustomer(null); setWalkInQuery('') }} className="bg-transparent border-none cursor-pointer p-0.5 flex">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pos-method-grid">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`pos-method-btn${method === m ? ' active' : ''}`}
                onClick={() => handleMethodChange(m)}
              >
                {t(`pos.method.${m}`, { defaultValue: m })}
              </button>
            ))}
          </div>

          {method === 'CASH' && (
            <div className="mt-3">
              <label className="field-label">Tiền khách đưa (tuỳ chọn)</label>
              <Input
                type="number"
                min={0}
                placeholder="Nhập số tiền khách đưa..."
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
               />
              {change !== null && change >= 0 && (
                <p className="mt-1 text-sm text-success">
                  Tiền thừa trả lại: <strong>{formatCurrencyVnd(change)}</strong>
                </p>
              )}
              {insufficientTendered && (
                <p className="field-error mt-1">Tiền đưa chưa đủ tổng thanh toán.</p>
              )}
              {method === 'CASH' && (tendered === '' || tenderedNum === 0) && !insufficientTendered && (
                <Alert className="mt-2 py-1.5 text-xs" role="note">
                  Chưa nhập tiền khách đưa — không thể tính tiền thừa.
                </Alert>
              )}
            </div>
          )}

          {method === 'CARD_TERMINAL' && (
            <div className="mt-3">
              <label className="field-label">Mã giao dịch thẻ (tuỳ chọn)</label>
              <Input
                placeholder="REF-12345"
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
               />
            </div>
          )}

          {method === 'CREDIT' && (
            <div className="mt-3">
              <label className="field-label">Tìm khách hàng *</label>
              <div className="relative">
                <Input
                  placeholder="Nhập tên hoặc email khách hàng..."
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    setSelectedCustomer(null)
                    setCustomerCredit(null)
                    searchCustomers(e.target.value)
                  }}
                  autoComplete="off"
                 />
                {customerResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-[100] bg-surface-raised border border-border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer text-sm hover:bg-surface-hover"
                        onClick={() => handleSelectCustomer(c)}
                      >
                        <strong>{c.displayName || c.email}</strong>
                        {c.email && c.displayName && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {creditLoading && <p className="text-sm text-muted-foreground mt-1.5">Đang tải thông tin tín dụng...</p>}

              {selectedCustomer && customerCredit && !creditLoading && (
                <div className="mt-2.5 px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Bán chịu:</span>
                    <strong className={creditEnabled ? 'text-success' : 'text-danger'}>
                      {creditEnabled ? 'Được phép' : 'Bị tắt'}
                    </strong>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Trạng thái:</span>
                    <strong>{customerCredit.creditStatus}</strong>
                  </div>
                  {customerCredit.creditLimit != null && (
                    <>
                      <div className="flex justify-between mb-1">
                        <span>Hạn mức:</span>
                        <span>{formatCurrencyVnd(customerCredit.creditLimit)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Đang nợ:</span>
                        <span>{formatCurrencyVnd(customerCredit.currentOutstanding)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Còn có thể bán chịu:</span>
                        <strong className={availableCredit >= total ? 'text-success' : 'text-warning'}>
                          {formatCurrencyVnd(availableCredit)}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              )}

              {creditBlocked && (
                <p className="field-error mt-1.5">
                  Khách hàng không đủ điều kiện bán chịu
                  {!creditEnabled ? ' (chưa được bật tín dụng)' : ` (trạng thái: ${customerCredit?.creditStatus})`}.
                </p>
              )}

              {overLimit && canOverrideCreditLimit && (
                <p className="mt-1.5 text-sm text-warning">
                  Vượt hạn mức tín dụng — sẽ override (bạn có quyền).
                </p>
              )}

              {creditOverLimitBlocked && (
                <p className="field-error mt-1.5">
                  Vượt hạn mức tín dụng ({formatCurrencyVnd(total)} &gt; còn lại {formatCurrencyVnd(availableCredit)}). Bạn không có quyền override.
                </p>
              )}

            </div>
          )}

          <div className="mt-3">
            <label className="field-label">Mã giảm giá (tuỳ chọn)</label>
            <Input
              placeholder="Nhập mã giảm giá POS..."
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              autoComplete="off"
             />
          </div>

          <div className="mt-3">
            <label className="field-label">{t('pos.note')}</label>
            <Input
              placeholder={t('pos.notePlaceholder')}
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
             />
          </div>

          <div className="pos-pay-total">
            <span>{t('pos.total')}</span>
            <strong>{formatCurrencyVnd(total)}</strong>
          </div>

          {error && <p className="field-error mb-2">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            disabled={submitDisabled}
          >
            {t('pos.confirmPayment')}
          </Button>
        </form>
    </Modal>
  )
}

function printReceipt(order, cart, cardRef) {
  const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
  const items = cart || []
  const total = order?.totalAmount != null
    ? Number(order.totalAmount)
    : items.reduce((s, c) => s + effectivePrice(c) * c.qty, 0)
  const discountAmt = order?.discountAmount ? Number(order.discountAmount) : 0
  const couponCode = order?.couponCode || null
  const dateStr = new Date().toLocaleString('vi-VN')
  const methodLabel = { CASH: 'Tiền mặt', CARD_TERMINAL: 'Quẹt thẻ', CREDIT: 'Bán chịu' }
  const method = methodLabel[order?.paymentMethod] || order?.paymentMethod || '—'
  const rows = items.map((item) => `
    <tr>
      <td>${item.productName}${item.variantName ? `<br><small>${item.variantName}</small>` : ''}</td>
      <td class="r">${item.qty}</td>
      <td class="r">${fmt(effectivePrice(item))}</td>
      <td class="r">${fmt(effectivePrice(item) * item.qty)}</td>
    </tr>`).join('')
  const discountRow = discountAmt > 0
    ? `<tr><td colspan="3">Giảm giá${couponCode ? ` (${couponCode})` : ''}</td><td class="r" style="color:green">-${fmt(discountAmt)}</td></tr>`
    : ''
  const changeRow = order?.changeAmount > 0
    ? `<tr><td colspan="3">Tiền thừa trả lại</td><td class="r">${fmt(order.changeAmount)}</td></tr>`
    : (order?.paymentMethod === 'CASH' && !order?.tenderedAmount
      ? `<tr><td colspan="4" style="color:#888;font-style:italic">Tiền khách đưa: Chưa ghi nhận</td></tr>`
      : '')
  const customerInfo = (order?.customerName || order?.customerPhone)
    ? `<p style="margin:2px 0">Khách: ${order.customerName || ''}${order.customerPhone ? ' — ' + order.customerPhone : ''}</p>`
    : ''
  const cardRefRow = cardRef
    ? `<p style="margin:2px 0">Ref thẻ: ${cardRef}</p>`
    : ''
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Hóa đơn ${order?.orderNumber || ''}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:320px;margin:0 auto;padding:12px}
  h2{text-align:center;margin:0 0 2px}
  .center{text-align:center}
  .sep{border:none;border-top:1px dashed #000;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  td,th{padding:3px 2px;vertical-align:top}
  th{border-bottom:1px solid #000;text-align:left}
  .r{text-align:right;white-space:nowrap}
  .total-row td{border-top:1px solid #000;font-weight:bold}
  small{color:#555}
  @media print{@page{margin:6mm}}
</style></head>
<body>
<h2 style="text-align:center">BigBike — Phụ kiện mô tô</h2>
<p class="center" style="margin:2px 0">Hóa đơn bán hàng tại quầy</p>
<hr class="sep">
<p style="margin:2px 0">Số đơn: <strong>${order?.orderNumber || '—'}</strong></p>
<p style="margin:2px 0">Ngày: ${dateStr}</p>
<p style="margin:2px 0">Thanh toán: <strong>${method}</strong></p>
${customerInfo}${cardRefRow}<hr class="sep">
<table>
  <thead><tr><th>Sản phẩm</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">T.tiền</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    ${discountRow}
    <tr class="total-row"><td colspan="3">Tổng cộng</td><td class="r">${fmt(total)}</td></tr>
    ${changeRow}
  </tfoot>
</table>
<hr class="sep">
<p class="center" style="margin-top:12px">Cảm ơn quý khách!</p>
</body></html>`

  const w = window.open('', '_blank', 'width=420,height=640')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
    return
  }
  // Fallback: hidden iframe khi browser chặn popup
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:420px;height:640px;border:none'
  document.body.appendChild(iframe)
  try {
    iframe.contentDocument.open()
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch { /* print best-effort */ }
      setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* already removed */ } }, 1000)
    }, 300)
  } catch { /* iframe print unsupported */
    try { document.body.removeChild(iframe) } catch { /* already removed */ }
  }
}

function RefundDialog({ order, maxRefundable, hasSerialItems, onClose, onSuccess }) {
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

function ReceiptModal({ order, paymentMethod, cart, canRefund, onClose }) {
  const { t } = useTranslation()
  const isCreditOrder = paymentMethod === 'CREDIT' || order?.paymentMethod === 'CREDIT'
  // Prefer items from BE response (survives page reload); fall back to cart snapshot
  const items = (order?.items?.length
    ? order.items.map((it, i) => ({
        cartKey: `be-${i}`,
        productName: it.productName,
        variantName: it.variantName,
        sku: it.sku,
        qty: it.quantity,
        price: Number(it.unitPrice),
        overriddenPrice: null,
        hasSerial: false,
      }))
    : null) || cart || []
  const total = order?.totalAmount != null
    ? Number(order.totalAmount)
    : items.reduce((s, c) => s + effectivePrice(c) * c.qty, 0)
  const hasSerialItems = (cart || []).some((it) => it.hasSerial === true)
  const canHaveRefund = order?.paymentStatus === 'PAID'
  const [refundedAmount, setRefundedAmount] = useState(0)
  const [showRefund, setShowRefund] = useState(false)
  // Use paidAmount from BE when available; fall back to cart total for legacy PAID orders
  const effectivePaid = order?.paidAmount != null ? Number(order.paidAmount) : (order?.paymentStatus === 'PAID' ? total : 0)
  const alreadyRefunded = (order?.refundAmount != null ? Number(order.refundAmount) : 0) + refundedAmount
  const refundableRemaining = canHaveRefund ? Math.max(0, effectivePaid - alreadyRefunded) : 0
  const canRefundAction = canHaveRefund && refundableRemaining > 0
  return (
    <Modal open title={t('pos.success')} onClose={onClose}>
        <div className="text-center mb-4">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success mx-auto">
            <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
          </svg>
          <p className="text-sm text-muted-foreground mt-2 mb-0">
            {t('pos.orderNumber')}: <strong>{order?.orderNumber || '—'}</strong>
          </p>
        </div>

        {items.length > 0 && (
          <table className="w-full border-collapse text-xs mb-3">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-1.5 py-1 font-semibold">Sản phẩm</th>
                <th className="text-right px-1.5 py-1 font-semibold">SL</th>
                <th className="text-right px-1.5 py-1 font-semibold">Đơn giá</th>
                <th className="text-right px-1.5 py-1 font-semibold">T.tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.cartKey}>
                  <td className="px-1.5 py-1">
                    <div>{item.productName}</div>
                    {item.variantName && <div className="text-xs text-muted-foreground">{item.variantName}</div>}
                  </td>
                  <td className="text-right px-1.5 py-1">{item.qty}</td>
                  <td className="text-right px-1.5 py-1 whitespace-nowrap">
                    {formatCurrencyVnd(effectivePrice(item))}
                    {item.overriddenPrice != null && (
                      <div className="text-xs text-muted-foreground line-through">
                        {formatCurrencyVnd(item.price)}
                      </div>
                    )}
                  </td>
                  <td className="text-right px-1.5 py-1 whitespace-nowrap">{formatCurrencyVnd(effectivePrice(item) * item.qty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Number(order?.discountAmount) > 0 && (
                <tr>
                  <td colSpan={3} className="px-1.5 pt-1.5 text-right text-sm text-success">
                    Giảm giá{order.couponCode ? ` (${order.couponCode})` : ''}
                  </td>
                  <td className="px-1.5 pt-1.5 text-right text-sm text-success whitespace-nowrap">
                    -{formatCurrencyVnd(Number(order.discountAmount))}
                  </td>
                </tr>
              )}
              <tr className="border-t border-border font-bold">
                <td colSpan={3} className="px-1.5 pt-1.5 pb-0.5 text-right">Tổng cộng</td>
                <td className="px-1.5 pt-1.5 pb-0.5 text-right whitespace-nowrap">{formatCurrencyVnd(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {isCreditOrder && (
          <p className="text-sm mb-2 text-warning text-center">
            Công nợ: <strong>{order?.paymentStatus || 'UNPAID'}</strong>
          </p>
        )}
        {!isCreditOrder && order?.changeAmount != null && order.changeAmount > 0 && (
          <p className="text-sm mb-2 text-center">
            Tiền thừa: <strong className="text-success">{formatCurrencyVnd(order.changeAmount)}</strong>
          </p>
        )}
        {refundedAmount > 0 && (
          <p className="text-sm mb-2 text-center text-danger">
            {t('pos.refundedBadge')}: <strong>{formatCurrencyVnd(refundedAmount)}</strong>
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" type="button" className="flex items-center gap-1.5"
            onClick={() => printReceipt(order, items, order?._cardRef)}
          >
            <Printer size={14} /> In hóa đơn
          </Button>
          {canHaveRefund && canRefund && (
            <Button
              variant="danger"
              type="button"
              disabled={!canRefundAction}
              title={!canRefundAction ? t('pos.refundedBadge') : undefined}
              className="flex items-center gap-1.5"
              onClick={() => setShowRefund(true)}
            >
              <RotateCcw size={14} /> {t('pos.refundButton')}
            </Button>
          )}
          {!canHaveRefund && isCreditOrder && (
            <span className="shrink-0 px-3 py-2 text-xs text-muted-foreground self-center">
              {t('pos.refundUnavailableCredit')}
            </span>
          )}
          <Button type="button" className="flex-1 min-w-[120px]" onClick={onClose}>
            {t('pos.newSale')}
          </Button>
        </div>

        {showRefund && (
          <RefundDialog
            order={order}
            maxRefundable={refundableRemaining}
            hasSerialItems={hasSerialItems}
            onClose={() => setShowRefund(false)}
            onSuccess={(amount) => {
              setRefundedAmount((prev) => prev + amount)
              setShowRefund(false)
            }}
          />
        )}
    </Modal>
  )
}

const POS_CART_KEY = 'pos_cart'
const POS_CART_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export function PosScreen({ canUpdate, userId, canOverrideCreditLimit, canOverridePrice, canRefund }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 200)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(POS_CART_KEY)
      if (!raw) return []
      const saved = JSON.parse(raw)
      const isExpired = !saved.savedAt || (Date.now() - saved.savedAt) > POS_CART_TTL_MS
      const isWrongUser = userId && saved.userId && saved.userId !== userId
      if (isExpired || isWrongUser) { localStorage.removeItem(POS_CART_KEY); return [] }
      return saved.items || []
    } catch { return [] }
  })
  const [modal, setModal] = useState(null) // null | 'payment' | 'receipt'
  const [lastOrder, setLastOrder] = useState(null)

  // Price override editing state
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [priceInput, setPriceInput] = useState('')
  const priceInputRef = useRef(null)

  // Persist cart to localStorage with expiry metadata
  useEffect(() => {
    try { localStorage.setItem(POS_CART_KEY, JSON.stringify({ items: cart, savedAt: Date.now(), userId: userId ?? null })) } catch { /* ignore */ }
  }, [cart, userId])

  useEffect(() => {
    if (!dq.trim()) return
    let cancelled = false
    posSearchProducts(dq)
      .then((r) => { if (!cancelled) setResults(r.items || []) })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [dq])

  useEffect(() => {
    if (editingPriceId && priceInputRef.current) priceInputRef.current.focus()
  }, [editingPriceId])

  function handleSearchChange(value) {
    setQ(value)
    if (!value.trim()) {
      setSearching(false)
      setResults([])
      return
    }
    setSearching(true)
  }

  function addToCart(variant, product) {
    const unitPrice = priceOf(variant.price ?? product.price)
    // Variants synthesized for product-level serials have id = null; key by product id instead.
    const cartKey = variant.id ?? ('p:' + product.id)
    setCart((prev) => {
      const existing = prev.find((c) => c.cartKey === cartKey)
      if (existing) {
        return prev.map((c) => c.cartKey === cartKey ? { ...c, qty: Math.min(c.stock, c.qty + 1) } : c)
      }
      return [...prev, {
        cartKey,
        productId: product.id,
        variantId: variant.id ?? null,
        productName: product.name,
        variantName: summarizeOptions(variant.options),
        sku: variant.sku,
        price: unitPrice,
        overriddenPrice: null,
        thumbnail: product.image?.url ?? null,
        qty: 1,
        stock: variant.stockQuantity ?? 999,
        hasSerial: variant.trackSerials === true,
      }]
    })
  }

  function handleVariantClick(variant, product) {
    if (!canUpdate) return
    addToCart(variant, product)
  }

  function updateQty(cartKey, delta) {
    setCart((prev) => prev
      .map((c) => c.cartKey === cartKey ? { ...c, qty: Math.max(1, Math.min(c.stock, c.qty + delta)) } : c)
      .filter((c) => c.qty > 0)
    )
  }

  function removeFromCart(cartKey) {
    setCart((prev) => prev.filter((c) => c.cartKey !== cartKey))
  }

  function startEditPrice(item) {
    setEditingPriceId(item.cartKey)
    setPriceInput(String(item.overriddenPrice != null ? item.overriddenPrice : item.price))
  }

  function commitEditPrice(cartKey) {
    const parsed = Number(priceInput)
    if (!isNaN(parsed) && parsed > 0) {
      setCart((prev) => prev.map((c) =>
        c.cartKey === cartKey ? { ...c, overriddenPrice: parsed === c.price ? null : parsed } : c
      ))
    }
    setEditingPriceId(null)
  }

  function cancelEditPrice() {
    setEditingPriceId(null)
  }

  const total = cart.reduce((s, c) => s + effectivePrice(c) * c.qty, 0)

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('pos.eyebrow')}</p>
          <h1>{t('pos.title')}</h1>
          <p className="bb-muted">{t('pos.searchHint')}</p>
        </div>
      </div>

      <div className="pos-layout">
        {/* Product picker */}
        <div className="pos-search-col">
          <div className="pos-search-wrap">
            <span className="pos-search-icon"><Search size={14} /></span>
            <input
              className="bb-input pos-search-input"
              placeholder={t('pos.searchPlaceholder')}
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoFocus
            />
          </div>

          {searching && (
            <div className="pos-empty-hint">{t('common.loading')}…</div>
          )}

          {!searching && results.length === 0 && dq.trim() && (
            <StatePanel tone="neutral" title={t('pos.noResults')} description={t('pos.noResultsDesc')} />
          )}

          {!searching && results.length === 0 && !dq.trim() && (
            <div className="pos-empty-hint">
              <Search size={28} />
              <span>{t('pos.searchHint')}</span>
            </div>
          )}

          <div className="pos-product-grid">
            {results.map((product) =>
              (product.variants || []).filter((v) => v.stockQuantity === null || v.stockQuantity > 0).map((variant) => {
                const displayPrice = priceOf(variant.price ?? product.price)
                const variantLabel = summarizeOptions(variant.options)
                const outOfStock = variant.stockQuantity !== null && variant.stockQuantity <= 0
                const disabled = !canUpdate || outOfStock
                return (
                  <div
                    key={variant.id ?? ('p:' + product.id)}
                    className="pos-product-card"
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled}
                    style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    onClick={() => { if (!disabled) handleVariantClick(variant, product) }}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        handleVariantClick(variant, product)
                      }
                    }}
                  >
                    <div className="pos-product-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-color-text-muted)' }}>
                      {product.image?.url
                        ? <img src={product.image.url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <ShoppingCart size={28} />}
                    </div>
                    <div className="pos-product-info">
                      {variant.sku && <div className="pos-product-attrs">{variant.sku}</div>}
                      <div className="pos-product-name">{product.name}</div>
                      {variantLabel && <div className="pos-product-attrs">{variantLabel}</div>}
                      <div className="pos-product-price">{formatCurrencyVnd(displayPrice)}</div>
                      {outOfStock
                        ? <div className="pos-product-stock out">{t('pos.outOfStock', { defaultValue: 'Hết hàng' })}</div>
                        : variant.stockQuantity != null
                          ? <div className="pos-product-stock">{t('pos.inStock', { count: variant.stockQuantity, defaultValue: `Còn ${variant.stockQuantity}` })}</div>
                          : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="pos-cart-col">
          <div className="pos-cart-header">
            <span style={{ flex: 1 }}>{t('pos.cart')} ({cart.length})</span>
            {cart.length > 0 && (
              <button
                type="button"
                className="bb-btn bb-btn-ghost bb-btn-sm"
                onClick={async () => {
                  if (await showConfirm('Xoá toàn bộ giỏ hàng?', 'Xoá giỏ hàng')) {
                    setCart([])
                    try { localStorage.removeItem(POS_CART_KEY) } catch { /* ignore */ }
                  }
                }}
              >
                <Trash2 size={13} />{t('pos.clearCart', { defaultValue: 'Xoá hết' })}
              </button>
            )}
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">
                <ShoppingCart size={28} />
                <strong>{t('pos.cartEmpty')}</strong>
                <span>{t('pos.searchHint')}</span>
              </div>
            ) : cart.map((item) => (
              <div key={item.cartKey} className="pos-cart-item">
                <div className="pos-cart-item-info">
                  <div className="pos-cart-item-name">{item.productName}</div>
                  {(item.variantName || item.sku) && (
                    <div className="pos-cart-item-sku">{item.variantName || item.sku}</div>
                  )}
                  <div className="pos-cart-item-price">
                    {editingPriceId === item.cartKey ? (
                      <Input
                        ref={priceInputRef}
                        type="number"
                        min={0}
                        className="w-[110px] py-0.5 px-1.5 text-xs h-auto inline-block"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditPrice(item.cartKey)
                          if (e.key === 'Escape') cancelEditPrice()
                        }}
                        onBlur={() => commitEditPrice(item.cartKey)}
                      />
                    ) : (
                      <>
                        {formatCurrencyVnd(effectivePrice(item))}
                        {item.overriddenPrice != null && (
                          <span style={{ textDecoration: 'line-through', marginLeft: 4, color: 'var(--admin-color-text-muted)' }}>
                            {formatCurrencyVnd(item.price)}
                          </span>
                        )}
                        {canOverridePrice && (
                          <button
                            type="button"
                            className="bb-icon-btn"
                            title="Sửa giá"
                            style={{ width: 20, height: 20, marginLeft: 4 }}
                            onClick={() => startEditPrice(item)}
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="pos-cart-item-qty">
                  <button type="button" className="bb-btn bb-btn-secondary" style={{ width: 24, height: 24, padding: 0, minWidth: 24 }} onClick={() => updateQty(item.cartKey, -1)}><Minus size={12} /></button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontSize: 'var(--admin-text-sm)', fontWeight: 600 }}>{item.qty}</span>
                  <button type="button" className="bb-btn bb-btn-secondary" style={{ width: 24, height: 24, padding: 0, minWidth: 24 }} onClick={() => updateQty(item.cartKey, 1)}><Plus size={12} /></button>
                </div>
                <div className="pos-cart-item-subtotal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span>{formatCurrencyVnd(effectivePrice(item) * item.qty)}</span>
                  <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" style={{ fontSize: 11, padding: '0 6px', height: 20 }} onClick={() => removeFromCart(item.cartKey)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pos-cart-footer">
            <div className="pos-cart-total" style={{ fontSize: 'var(--admin-text-sm)', fontWeight: 400 }}>
              <span>{t('pos.itemCount', { count: cart.length, defaultValue: `Tạm tính (${cart.length} mục)` })}</span>
              <span>{formatCurrencyVnd(total)}</span>
            </div>
            <div className="pos-cart-total">
              <span>{t('pos.total')}</span>
              <strong style={{ color: 'var(--admin-color-brand-red)' }}>{formatCurrencyVnd(total)}</strong>
            </div>
            <button
              type="button"
              className="pos-checkout-btn bb-btn bb-btn-primary"
              disabled={cart.length === 0 || !canUpdate}
              onClick={() => setModal('payment')}
            >
              {t('pos.checkout')}
            </button>
          </div>
        </div>
      </div>

      {modal === 'payment' && (
        <PaymentModal
          cart={cart}
          total={total}
          canOverrideCreditLimit={canOverrideCreditLimit}
          onClose={() => setModal(null)}
          onSuccess={(order, usedMethod) => {
            const cartSnapshot = [...cart]
            setLastOrder({ ...order, usedMethod, cartSnapshot })
            setCart([])
            try { localStorage.removeItem(POS_CART_KEY) } catch { /* ignore */ }
            setQ('')
            setResults([])
            setModal('receipt')
          }}
        />
      )}

      {modal === 'receipt' && (
        <ReceiptModal
          order={lastOrder}
          paymentMethod={lastOrder?.usedMethod}
          cart={lastOrder?.cartSnapshot}
          canRefund={canRefund}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  )
}
