import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RefundModal } from '../components/RefundModal'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { addOrderNote, adminCreateReturn, fetchOrderAllowedTransitions, fetchOrderDetail, fetchReturnsByOrder, updateOrderFulfillment, updateOrderPaymentStatus, updateOrderStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { Modal } from '../components/layout'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

// Payment transitions mirror backend ALLOWED_PAYMENT_TRANSITIONS map.
// REFUNDED is excluded — only reachable via the Refund modal (RefundService).
const PAYMENT_TRANSITIONS = {
  UNPAID:    ['PAID', 'CANCELLED'],
  PAID:      ['UNPAID'],
  REFUNDED:  [],
  CANCELLED: [],
}

// Statuses that require a mandatory reason before transitioning.
const REASON_REQUIRED = new Set(['CANCELLED', 'FAILED'])

function ReasonConfirmModal({ targetStatus, t, onConfirm, onClose }) {
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
          <label className="text-sm font-medium">{t('orders.detail.reasonLabel')} *</label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError('') }}
            placeholder={t('orders.detail.reasonPlaceholder')}
            className="resize-y"
            autoFocus
          />
          {error && <p className="text-xs text-danger">{error}</p>}
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

// Visual config for order status action buttons.
// BACS ON_HOLD → PROCESSING tự động mark PAID — label phải rõ ý nghĩa này.
const ORDER_STATUS_ACTION = {
  PROCESSING: { labelKey: 'orders.detail.actionProcessing', variant: 'primary',     confirm: false },
  ON_HOLD:    { labelKey: 'orders.detail.actionOnHold',     variant: 'secondary',   confirm: false },
  COMPLETED:  { labelKey: 'orders.detail.actionCompleted',  variant: 'success',     confirm: true  },
  CANCELLED:  { labelKey: 'orders.detail.actionCancelled',  variant: 'destructive', confirm: true  },
  FAILED:     { labelKey: 'orders.detail.actionFailed',     variant: 'destructive', confirm: true  },
}

// Cho đơn BACS đang ON_HOLD, label nút PROCESSING cần rõ hơn.
function getOrderStatusLabel(targetStatus, order, t) {
  if (targetStatus === 'PROCESSING' && order?.orderStatus === 'ON_HOLD' && order?.paymentMethod === 'BACS') {
    return t('orders.detail.actionBacsConfirm')
  }
  const key = ORDER_STATUS_ACTION[targetStatus]?.labelKey
  return key ? t(key) : targetStatus
}

const PAYMENT_ACTION_LABEL = {
  PAID:      'orders.detail.payActionPaid',
  UNPAID:    'orders.detail.payActionUnpaid',
  CANCELLED: 'orders.detail.payActionCancelled',
}

const RETURN_REASONS = [
  { value: 'DEFECTIVE', labelKey: 'orders.detail.reasonDefective' },
  { value: 'WRONG_ITEM', labelKey: 'orders.detail.reasonWrongItem' },
  { value: 'NOT_AS_DESCRIBED', labelKey: 'orders.detail.reasonNotAsDescribed' },
  { value: 'CHANGED_MIND', labelKey: 'orders.detail.reasonChangedMind' },
  { value: 'OTHER', labelKey: 'orders.detail.reasonOther' },
]

const RETURN_STATUS_KEY = { PENDING: 'orders.detail.rsPending', APPROVED: 'orders.detail.rsApproved', RECEIVED: 'orders.detail.rsReceived', COMPLETED: 'orders.detail.rsCompleted', REFUNDED: 'orders.detail.rsRefunded', REJECTED: 'orders.detail.rsRejected' }
const RETURN_REASON_KEY = { DEFECTIVE: 'orders.detail.reasonDefective', WRONG_ITEM: 'orders.detail.reasonWrongItem', NOT_AS_DESCRIBED: 'orders.detail.reasonNotAsDescribed', CHANGED_MIND: 'orders.detail.reasonChangedMind', OTHER: 'orders.detail.reasonOther' }

function AdminCreateReturnModal({ order, onClose, onSuccess }) {
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
          <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>)}
          </SelectContent></Select>
        </div>

        <div className="form-field">
          <label className="field-label">{t('orders.detail.crmItemsLabel')} *</label>
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
                      value={qtys[item.id] ?? 0}
                      onChange={(e) => setQtys((prev) => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(0, Number(e.target.value))) }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="form-field">
          <label className="field-label">{t('orders.detail.crmNoteLabel')}</label>
          <Textarea rows={2} value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}  />
        </div>

        {error && <p className="field-error">{error}</p>}

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

export function OrderDetailScreen({ orderId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderDetail(orderId),
  })
  const order = orderQuery.data?.item ?? null
  const warning = orderQuery.data?.mode === 'mock' ? (orderQuery.data?.warning ?? '') : ''
  const status = orderQuery.isLoading ? 'loading' : orderQuery.isError ? 'error' : 'success'

  const [saving, setSaving] = useState(false)
  const [pendingTarget, setPendingTarget] = useState(null)
  const [allowedTransitions, setAllowedTransitions] = useState([])
  const [transitionsError, setTransitionsError] = useState(false)
  const [transitionsKey, setTransitionsKey] = useState(0)
  const [returnsError, setReturnsError] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteCustomerVisible, setNoteCustomerVisible] = useState(false)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false)
  const [showShipForm, setShowShipForm] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCarrier, setShippingCarrier] = useState('')
  const [orderReturns, setOrderReturns] = useState([])
  const [showCreateReturn, setShowCreateReturn] = useState(false)
  const [reasonModal, setReasonModal] = useState(null) // { targetStatus }

  // Patches the cached order in-place for instant UI feedback after a mutation,
  // then invalidates the order list so navigating back shows fresh data.
  function applyOrderUpdate(updatedOrder) {
    queryClient.setQueryData(['order', orderId], (old) => ({ ...old, item: updatedOrder }))
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  useEffect(() => {
    if (!orderQuery.isSuccess) return undefined
    let active = true
    fetchReturnsByOrder(orderId)
      .then((r) => { if (active) { setOrderReturns(r); setReturnsError(false) } })
      .catch(() => { if (active) setReturnsError(true) })
    return () => { active = false }
  }, [orderId, orderQuery.isSuccess])

  useEffect(() => {
    if (!orderQuery.isSuccess || !order?.orderStatus) return undefined
    let active = true
    fetchOrderAllowedTransitions(orderId)
      .then((response) => {
        if (!active) return
        setAllowedTransitions(response.transitions || [])
        setTransitionsError(false)
      })
      .catch(() => {
        if (!active) return
        // Distinguish a failed load from a legitimately empty transition list,
        // so the UI doesn't tell the admin "no actions" when it's really an error.
        setAllowedTransitions([])
        setTransitionsError(true)
      })
    return () => { active = false }
  }, [orderId, orderQuery.isSuccess, order?.orderStatus, order?.paymentStatus, order?.fulfillmentStatus, transitionsKey])

  async function doStatusChange(newStatus, reason) {
    setSaving(true)
    setPendingTarget(newStatus)
    try {
      const body = { status: newStatus }
      if (reason) body.reason = reason
      const response = await updateOrderStatus(orderId, newStatus, reason)
      const updatedOrder = response.item
      applyOrderUpdate(updatedOrder)
      const wasOnHold = order.orderStatus === 'ON_HOLD'
      const isBACS = order.paymentMethod === 'BACS'
      const autoMarkedPaid = wasOnHold && isBACS && newStatus === 'PROCESSING' && updatedOrder.paymentStatus === 'PAID'
      if (autoMarkedPaid) {
        toast.success(t('orders.detail.autoMarkedPaidToast'))
      } else {
        toast.success(t('orders.detail.statusUpdated'))
      }
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
    } finally {
      setSaving(false)
      setPendingTarget(null)
    }
  }

  async function handleStatusChange(newStatus) {
    // CANCELLED / FAILED: open reason modal (mandatory reason, destructive confirm inside modal)
    if (REASON_REQUIRED.has(newStatus)) {
      setReasonModal({ targetStatus: newStatus })
      return
    }
    // BACS ON_HOLD → PROCESSING auto-marks payment as PAID. Require explicit confirmation
    // so admin doesn't accidentally record a receipt they haven't actually verified.
    const isBACSAutoPayConfirm =
      newStatus === 'PROCESSING' &&
      order?.orderStatus === 'ON_HOLD' &&
      order?.paymentMethod === 'BACS'
    if (isBACSAutoPayConfirm) {
      const confirmed = await showConfirm(
        t('orders.detail.confirmBacsMessage'),
        t('orders.detail.confirmBacsTitle')
      )
      if (!confirmed) return
    } else if (newStatus === 'COMPLETED' || newStatus === 'REFUNDED') {
      const labelKeys = { COMPLETED: 'orders.detail.dangerCompleted', REFUNDED: 'orders.detail.dangerRefunded' }
      const label = labelKeys[newStatus] ? t(labelKeys[newStatus]) : newStatus
      const confirmed = await showConfirm(
        t('orders.detail.confirmStatusMessage', { label }),
        t('orders.detail.confirmStatusTitle')
      )
      if (!confirmed) return
    }
    await doStatusChange(newStatus, undefined)
  }

  async function handlePaymentStatusChange(newStatus) {
    // Payment status changes move real money on the books — confirm the
    // financially significant ones (BigBike reconciles payments manually).
    const PAYMENT_CONFIRM = {
      PAID: 'orders.detail.confirmPayPaidMessage',
      CANCELLED: 'orders.detail.confirmPayCancelledMessage',
    }
    if (PAYMENT_CONFIRM[newStatus]) {
      const confirmed = await showConfirm(t(PAYMENT_CONFIRM[newStatus]), t('orders.detail.confirmPaymentTitle'))
      if (!confirmed) return
    }
    setSaving(true)
    setPendingTarget(newStatus)
    try {
      const response = await updateOrderPaymentStatus(orderId, newStatus)
      applyOrderUpdate(response.item)
      toast.success(t('orders.detail.paymentUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.updatePaymentError'))
    } finally {
      setSaving(false)
      setPendingTarget(null)
    }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteContent.trim()) return
    setSubmittingNote(true)
    try {
      const note = await addOrderNote(orderId, { content: noteContent.trim(), customerVisible: noteCustomerVisible })
      queryClient.setQueryData(['order', orderId], (old) => ({
        ...old,
        item: { ...old.item, notes: [...(old.item.notes ?? []), note] },
      }))
      setNoteContent('')
      setNoteCustomerVisible(false)
      toast.success(t('orders.detail.noteAdded'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.noteError'))
    } finally {
      setSubmittingNote(false)
    }
  }

  async function handleFulfillmentUpdate(newFulfillmentStatus) {
    const DANGEROUS = new Set(['CANCELLED', 'RETURNED'])
    if (DANGEROUS.has(newFulfillmentStatus)) {
      const labelKeys = { CANCELLED: 'orders.detail.ffDangerCancelled', RETURNED: 'orders.detail.ffDangerReturned' }
      const label = t(labelKeys[newFulfillmentStatus])
      if (!await showConfirm(t('orders.detail.confirmFulfillmentMessage', { label }), t('orders.detail.confirmFulfillmentTitle'))) return
    }
    // Tracking number is mandatory to move into SHIPPED — validate before the
    // request so the admin gets a clear message instead of a backend reject.
    if (newFulfillmentStatus === 'SHIPPED' && !trackingNumber.trim()) {
      toast.error(t('orders.detail.trackingRequiredError'))
      return
    }
    setFulfillmentSaving(true)
    try {
      const body = { fulfillmentStatus: newFulfillmentStatus }
      if (newFulfillmentStatus === 'SHIPPED') {
        if (trackingNumber.trim()) body.trackingNumber = trackingNumber.trim()
        if (shippingCarrier.trim()) body.shippingCarrier = shippingCarrier.trim()
      }
      const response = await updateOrderFulfillment(orderId, body)
      applyOrderUpdate(response.item)
      setShowShipForm(false)
      setTrackingNumber('')
      setShippingCarrier('')
      toast.success(t('orders.detail.fulfillmentUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.fulfillmentError'))
    } finally {
      setFulfillmentSaving(false)
    }
  }

  if (status === 'loading') {
    return <StatePanel tone="info" title={t('orders.detail.loading')} description={t('common.pleaseWait')} />
  }
  if (status === 'error') {
    return <StatePanel tone="danger" title={t('orders.detail.loadError')} description={orderQuery.error?.message}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }
  if (!order) {
    return <StatePanel tone="neutral" title={t('orders.detail.notFound')} description={`ID: ${orderId}`}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('orders.detail.eyebrow')}</p>
          <h1 className="flex items-center gap-2 flex-wrap">
            {formatText(order.orderNumber, `#${orderId}`)}
            {order.source === 'pos' && <span className="badge-pos">POS</span>}
          </h1>
          <p>{t('orders.detail.orderDate')} {formatDateTime(order.createdAt)}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/orders')}>
          {t('orders.detail.backToList')}
        </Button>
      </header>

      {warning && <ReadOnlyBanner warning={warning} />}

      <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <DetailSection title={t('orders.detail.customerInfo')}>
          <p><strong>{t('orders.detail.name')}</strong> {formatText(order.customerName)}</p>
          <p><strong>{t('orders.detail.email')}</strong> {formatText(order.customerEmail)}</p>
          {order.shippingAddress && (
            <>
              <p><strong>{t('orders.detail.phone')}</strong> {formatText(order.shippingAddress.phone)}</p>
              <p><strong>{t('orders.detail.address')}</strong> {[
                order.shippingAddress.addressLine1,
                order.shippingAddress.ward,
                order.shippingAddress.district,
                order.shippingAddress.province,
              ].filter(Boolean).join(', ') || '—'}</p>
            </>
          )}
        </DetailSection>

        <DetailSection title={t('orders.detail.orderStatus')}>
          {/* Current order status badge */}
          <div className="mb-3">
            <p className="mb-1 text-xs text-muted-foreground uppercase tracking-wide">
              {t('orders.detail.orderStatus')}
            </p>
            <StatusBadge type="order" status={order.orderStatus} />
          </div>

          {/* Order status action buttons — chỉ hiện nút hợp lệ */}
          {canUpdate && allowedTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {allowedTransitions.map((s) => {
                const cfg = ORDER_STATUS_ACTION[s] ?? { label: s, variant: 'secondary', confirm: false }
                const variant = {
                  primary:     'default',
                  secondary:   'outline',
                  success:     'success',
                  destructive: 'danger',
                }[cfg.variant] ?? 'outline'
                return (
                  <Button
                    key={s}
                    variant={variant}
                    loading={pendingTarget === s}
                    disabled={saving}
                    onClick={() => handleStatusChange(s)}
                  >
                    {getOrderStatusLabel(s, order, t)}
                  </Button>
                )
              })}
            </div>
          )}
          {canUpdate && transitionsError && (
            <p className="text-sm text-danger mb-3">
              {t('orders.detail.transitionsLoadError')}{' '}
              <button type="button" className="bb-link" onClick={() => setTransitionsKey((k) => k + 1)}>
                {t('common.retry')}
              </button>
            </p>
          )}
          {canUpdate && !transitionsError && allowedTransitions.length === 0 && (
            <p className="text-sm text-muted-foreground mb-3">
              {t('orders.detail.noTransition')}
            </p>
          )}

          {/* Current payment status + action buttons */}
          <div className="border-t border-border pt-3">
            <p className="mb-1 text-xs text-muted-foreground uppercase tracking-wide">
              {t('orders.detail.paymentStatus')}
            </p>
            <StatusBadge type="payment" status={order.paymentStatus} />
            {canUpdate && !['CANCELLED', 'FAILED', 'REFUNDED'].includes(order.orderStatus) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).map((s) => (
                  <Button
                    key={s}
                    variant={s === 'CANCELLED' ? 'danger' : 'outline'}
                    loading={pendingTarget === s}
                    disabled={saving}
                    onClick={() => handlePaymentStatusChange(s)}
                  >
                    {PAYMENT_ACTION_LABEL[s] ? t(PAYMENT_ACTION_LABEL[s]) : s}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-3 text-sm">
            <strong>{t('orders.detail.paymentMethod')}</strong> {formatText(order.paymentMethod)}
          </p>
        </DetailSection>
      </div>

      {/* Refund section: visible when payment status is PAID */}
      {canUpdate && order.paymentStatus === 'PAID' && (
        <DetailSection title={t('refund.sectionTitle')}>
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-sm">{t('refund.paidAmount')}: <strong>{formatCurrencyVnd(order.paidAmount)}</strong></p>
              {(order.refundAmount > 0) && (
                <p className="mt-1 text-sm text-danger">
                  {t('refund.alreadyRefunded')}: <strong>{formatCurrencyVnd(order.refundAmount)}</strong>
                </p>
              )}
            </div>
            <Button variant="danger" onClick={() => setShowRefundModal(true)}>
              {t('refund.buttonCreate')}
            </Button>
          </div>
          {order.refundReason && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('refund.reason')}: {order.refundReason}
            </p>
          )}
          {order.refundedAt && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('refund.refundedAt')}: {formatDateTime(order.refundedAt)}
            </p>
          )}
        </DetailSection>
      )}

      {showRefundModal && (
        <RefundModal
          orderId={orderId}
          paidAmount={order.paidAmount}
          alreadyRefunded={order.refundAmount || 0}
          onSuccess={(updatedOrder) => {
            applyOrderUpdate(updatedOrder)
            setShowRefundModal(false)
          }}
          onClose={() => setShowRefundModal(false)}
        />
      )}

      {/* Fulfillment section — chỉ cho đơn giao hàng (không phải POS) */}
      {order.fulfillmentType === 'DELIVERY' && (
        <DetailSection title={t('orders.detail.fulfillment')}>
          <div className="flex items-center gap-4 flex-wrap mb-3">
            <span>
              <strong>{t('orders.detail.fulfillmentStatusLabel')}</strong>{' '}
              {order.fulfillmentStatus
                ? t({ UNFULFILLED: 'orders.detail.ffUnfulfilled', PROCESSING: 'orders.detail.ffProcessing', SHIPPED: 'orders.detail.ffShipped', DELIVERED: 'orders.detail.ffDelivered', CANCELLED: 'orders.detail.ffCancelled', RETURNED: 'orders.detail.ffReturned' }[order.fulfillmentStatus] ?? order.fulfillmentStatus)
                : t('orders.detail.ffNone')}
            </span>
            {order.trackingNumber && (
              <span className="text-sm text-muted-foreground">
                {order.shippingCarrier && <strong>{order.shippingCarrier}: </strong>}
                <span className="font-mono">{order.trackingNumber}</span>
              </span>
            )}
            {order.shippedAt && (
              <span className="text-sm text-muted-foreground">
                {t('orders.detail.shippedAtLabel')} {formatDateTime(order.shippedAt)}
              </span>
            )}
          </div>

          {canUpdate && (
            <>
              <div className="flex gap-2 flex-wrap mb-2">
                {/* UNFULFILLED: chỉ cho chuyển sang PROCESSING trước, không được nhảy thẳng SHIPPED */}
                {(order.fulfillmentStatus == null || order.fulfillmentStatus === 'UNFULFILLED') && (
                  <Button variant="outline" disabled={fulfillmentSaving}
                    onClick={() => handleFulfillmentUpdate('PROCESSING')}>
                    {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffStartPreparing')}
                  </Button>
                )}
                {/* PROCESSING: cho điền mã vận đơn rồi chuyển SHIPPED */}
                {order.fulfillmentStatus === 'PROCESSING' && (
                  <Button variant="outline" disabled={fulfillmentSaving}
                    onClick={() => setShowShipForm((p) => !p)}>
                    {t('orders.detail.ffMarkShipped')}
                  </Button>
                )}
                {order.fulfillmentStatus === 'SHIPPED' && (
                  <Button disabled={fulfillmentSaving}
                    onClick={() => handleFulfillmentUpdate('DELIVERED')}>
                    {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffMarkDelivered')}
                  </Button>
                )}
              </div>

              {showShipForm && (
                <div className="flex flex-col gap-2 max-w-[400px] mt-1">
                  <Input type="text"
                    placeholder={t('orders.detail.trackingPlaceholder')}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    disabled={fulfillmentSaving}
                    required  />
                  <p className="text-xs text-muted-foreground">
                    {t('orders.detail.trackingHint')}
                  </p>
                  <Input type="text"
                    placeholder={t('orders.detail.carrierPlaceholder')}
                    value={shippingCarrier}
                    onChange={(e) => setShippingCarrier(e.target.value)}
                    disabled={fulfillmentSaving}  />
                  <div className="flex gap-2">
                    <Button disabled={fulfillmentSaving}
                      onClick={() => handleFulfillmentUpdate('SHIPPED')}>
                      {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffConfirmShip')}
                    </Button>
                    <Button variant="outline" disabled={fulfillmentSaving}
                      onClick={() => { setShowShipForm(false); setTrackingNumber(''); setShippingCarrier('') }}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DetailSection>
      )}

      <DetailSection title={t('orders.detail.items')}>
        {(order.items ?? []).length === 0 ? (
          <p className="text-muted-foreground">{t('orders.detail.noItems')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '640px' }}>
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-2">{t('orders.detail.colProduct')}</th>
                  <th className="text-right py-2 whitespace-nowrap px-3" style={{ minWidth: '48px' }}>{t('orders.detail.colQty')}</th>
                  <th className="text-right py-2 whitespace-nowrap px-3" style={{ minWidth: '110px' }}>{t('orders.detail.colUnitPrice')}</th>
                  <th className="text-right py-2 whitespace-nowrap pl-3" style={{ minWidth: '110px' }}>{t('orders.detail.colLineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-2">{formatText(item.productName)}</td>
                    <td className="text-right py-2 px-3">{item.quantity}</td>
                    <td className="text-right py-2 px-3 whitespace-nowrap">{formatCurrencyVnd(item.unitPrice)}</td>
                    <td className="text-right py-2 pl-3 whitespace-nowrap">{formatCurrencyVnd(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 text-right">
          <p>{t('orders.detail.subtotal')} <strong>{formatCurrencyVnd(order.subtotal)}</strong></p>
          {order.shippingFee > 0 && <p>{t('orders.detail.shippingFee')} <strong>{formatCurrencyVnd(order.shippingFee)}</strong></p>}
          {order.discount > 0 && <p>{t('orders.detail.discount')} <strong>-{formatCurrencyVnd(order.discount)}</strong></p>}
          <p className="text-lg">{t('orders.detail.total')} <strong>{formatCurrencyVnd(order.total)}</strong></p>
        </div>
      </DetailSection>

      {/* Payments */}
      {(order.payments ?? []).length > 0 && (
        <DetailSection title={t('orders.detail.payments')}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2">{t('orders.detail.colPaymentMethod')}</th>
                <th className="text-left py-2">{t('orders.detail.colPaymentStatus')}</th>
                <th className="text-right py-2">{t('orders.detail.colAmount')}</th>
                <th className="text-right py-2">{t('orders.detail.colPaidAt')}</th>
              </tr>
            </thead>
            <tbody>
              {(order.payments ?? []).map((p, i) => (
                <tr key={p.id ?? i} className="border-b border-border">
                  <td className="py-2">{formatText(p.paymentMethod)}</td>
                  <td className="py-2">{t(`status.payment.${p.status}`, { defaultValue: p.status })}</td>
                  <td className="text-right py-2">{formatCurrencyVnd(p.amount)}</td>
                  <td className="text-right py-2">{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailSection>
      )}

      {/* Shipping methods */}
      {(order.shippingItems ?? []).length > 0 && (
        <DetailSection title={t('orders.detail.shippingMethods')}>
          {(order.shippingItems ?? []).map((s, i) => (
            <p key={s.id ?? i} className="my-1">
              <strong>{formatText(s.methodTitle)}</strong>
              {s.amount > 0 && <span> — {formatCurrencyVnd(s.amount)}</span>}
            </p>
          ))}
        </DetailSection>
      )}

      {/* Returns section */}
      <DetailSection title={t('orders.detail.returnsTitle')}>
        {returnsError ? (
          <p className="text-danger text-sm">
            {t('orders.detail.returnsLoadError')}
          </p>
        ) : orderReturns.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('orders.detail.returnsEmpty')}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm mb-3">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1 font-semibold">{t('orders.detail.colRma')}</th>
                <th className="text-left py-1 px-2 font-semibold">{t('orders.detail.colReason')}</th>
                <th className="text-left py-1 px-2 font-semibold">{t('orders.detail.colReturnStatus')}</th>
                <th className="text-right py-1 font-semibold">{t('orders.detail.colRefund')}</th>
              </tr>
            </thead>
            <tbody>
              {orderReturns.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-1.5 font-mono font-medium">{r.returnNumber}</td>
                  <td className="py-1.5 px-2">{RETURN_REASON_KEY[r.reason] ? t(RETURN_REASON_KEY[r.reason]) : r.reason}</td>
                  <td className="py-1.5 px-2">
                    <StatusBadge type="return" status={RETURN_STATUS_KEY[r.status] ? r.status : 'UNKNOWN'} />
                  </td>
                  <td className="py-1.5 text-right">
                    {r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canUpdate && order.orderStatus === 'COMPLETED' && (
          <Button variant="outline" className={orderReturns.length > 0 ? '' : 'mt-2'} onClick={() => setShowCreateReturn(true)}>
            {t('orders.detail.createReturnBtn')}
          </Button>
        )}
      </DetailSection>

      {reasonModal && (
        <ReasonConfirmModal
          targetStatus={reasonModal.targetStatus}
          t={t}
          onConfirm={(reason) => {
            setReasonModal(null)
            doStatusChange(reasonModal.targetStatus, reason)
          }}
          onClose={() => setReasonModal(null)}
        />
      )}

      {showCreateReturn && (
        <AdminCreateReturnModal
          order={order}
          onClose={() => setShowCreateReturn(false)}
          onSuccess={(ret) => {
            setOrderReturns((prev) => [ret, ...prev])
            queryClient.invalidateQueries({ queryKey: ['returns'] })
            setShowCreateReturn(false)
            toast.success(t('orders.detail.returnCreatedToast', { number: ret.returnNumber }))
          }}
        />
      )}

      {/* Timestamps */}
      <DetailSection title={t('orders.detail.timestamps')}>
        <div className="grid gap-2 text-sm" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {order.placedAt && <p><strong>{t('orders.detail.tsPlacedAt')}</strong> {formatDateTime(order.placedAt)}</p>}
          {order.paidAt && <p><strong>{t('orders.detail.tsPaidAt')}</strong> {formatDateTime(order.paidAt)}</p>}
          {order.completedAt && <p><strong>{t('orders.detail.tsCompletedAt')}</strong> {formatDateTime(order.completedAt)}</p>}
          {order.cancelledAt && <p><strong>{t('orders.detail.tsCancelledAt')}</strong> {formatDateTime(order.cancelledAt)}</p>}
          {order.updatedAt && <p><strong>{t('orders.detail.tsUpdatedAt')}</strong> {formatDateTime(order.updatedAt)}</p>}
        </div>
      </DetailSection>

      {/* Notes */}
      <DetailSection title={t('orders.detail.notes')}>
        {(order.notes ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('orders.detail.noNotes')}</p>
        ) : (
          <ul className="list-none p-0 mb-4">
            {(order.notes ?? []).map((note, i) => (
              <li key={note.id ?? i} className="border-b border-border py-2 text-sm">
                <span className="text-muted-foreground mr-2">{note.createdAt ? formatDateTime(note.createdAt) : ''}</span>
                {note.content}
              </li>
            ))}
          </ul>
        )}
        {canUpdate && (
          <form onSubmit={handleAddNote} className="flex flex-col gap-2">
            <Textarea
              rows={3}
              placeholder={t('orders.detail.notePlaceholder')}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={submittingNote}
              className="resize-y"
             />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={noteCustomerVisible}
                  onCheckedChange={(checked) => setNoteCustomerVisible(checked)}
                  disabled={submittingNote}
                 />
                {t('orders.detail.noteCustomerVisible')}
              </label>
              <Button type="submit" loading={submittingNote} disabled={!noteContent.trim()}>
                {t('orders.detail.submitNote')}
              </Button>
            </div>
          </form>
        )}
      </DetailSection>
    </section>
  )
}
