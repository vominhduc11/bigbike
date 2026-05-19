import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
const ORDER_STATUS_ACTION = {
  PROCESSING: { labelKey: 'orders.detail.actionProcessing', variant: 'primary',     confirm: false },
  ON_HOLD:    { labelKey: 'orders.detail.actionOnHold',     variant: 'secondary',   confirm: false },
  COMPLETED:  { labelKey: 'orders.detail.actionCompleted',  variant: 'success',     confirm: true  },
  CANCELLED:  { labelKey: 'orders.detail.actionCancelled',  variant: 'destructive', confirm: true  },
  FAILED:     { labelKey: 'orders.detail.actionFailed',     variant: 'destructive', confirm: true  },
}

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

const RETURN_REASON_KEY = { DEFECTIVE: 'orders.detail.reasonDefective', WRONG_ITEM: 'orders.detail.reasonWrongItem', NOT_AS_DESCRIBED: 'orders.detail.reasonNotAsDescribed', CHANGED_MIND: 'orders.detail.reasonChangedMind', OTHER: 'orders.detail.reasonOther' }
const RETURN_STATUS_KEY = { PENDING: 1, APPROVED: 1, RECEIVED: 1, COMPLETED: 1, REFUNDED: 1, REJECTED: 1 }

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
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <Textarea rows={2} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
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
  const [reasonModal, setReasonModal] = useState(null)

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
        setAllowedTransitions([])
        setTransitionsError(true)
      })
    return () => { active = false }
  }, [orderId, orderQuery.isSuccess, order?.orderStatus, order?.paymentStatus, order?.fulfillmentStatus, transitionsKey])

  async function doStatusChange(newStatus, reason) {
    setSaving(true)
    try {
      const response = await updateOrderStatus(orderId, newStatus, reason)
      const updatedOrder = response.item
      applyOrderUpdate(updatedOrder)
      const wasOnHold = order.orderStatus === 'ON_HOLD'
      const isBACS = order.paymentMethod === 'BACS'
      const autoMarkedPaid = wasOnHold && isBACS && newStatus === 'PROCESSING' && updatedOrder.paymentStatus === 'PAID'
      toast.success(autoMarkedPaid ? t('orders.detail.autoMarkedPaidToast') : t('orders.detail.statusUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus) {
    if (REASON_REQUIRED.has(newStatus)) {
      setReasonModal({ targetStatus: newStatus })
      return
    }
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
    const PAYMENT_CONFIRM = {
      PAID: 'orders.detail.confirmPayPaidMessage',
      CANCELLED: 'orders.detail.confirmPayCancelledMessage',
    }
    if (PAYMENT_CONFIRM[newStatus]) {
      const confirmed = await showConfirm(t(PAYMENT_CONFIRM[newStatus]), t('orders.detail.confirmPaymentTitle'))
      if (!confirmed) return
    }
    setSaving(true)
    try {
      const response = await updateOrderPaymentStatus(orderId, newStatus)
      applyOrderUpdate(response.item)
      toast.success(t('orders.detail.paymentUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.updatePaymentError'))
    } finally {
      setSaving(false)
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

  const ffStatusLabel = order.fulfillmentStatus
    ? t({ UNFULFILLED: 'orders.detail.ffUnfulfilled', PROCESSING: 'orders.detail.ffProcessing', SHIPPED: 'orders.detail.ffShipped', DELIVERED: 'orders.detail.ffDelivered', CANCELLED: 'orders.detail.ffCancelled', RETURNED: 'orders.detail.ffReturned' }[order.fulfillmentStatus] ?? order.fulfillmentStatus)
    : t('orders.detail.ffNone')

  return (
    <div>
      {/* Screen header */}
      <div className="screen-header">
        <div>
          <p className="eyebrow">
            <a
              onClick={(e) => { e.preventDefault(); navigate('/admin/orders') }}
              style={{ cursor: 'pointer' }}
            >
              ← {t('orders.detail.backToList')}
            </a>
          </p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {t('orders.detail.eyebrow')}{' '}
            <span className="mono" style={{ color: 'var(--admin-color-brand-red)' }}>
              {formatText(order.orderNumber, `#${orderId}`)}
            </span>
            <StatusBadge type="order" status={order.orderStatus} />
            <StatusBadge type="payment" status={order.paymentStatus} />
            {order.source === 'pos' && <span className="badge badge-neutral">POS</span>}
          </h1>
          <p className="desc">
            {t('orders.detail.orderDate')} {formatDateTime(order.createdAt)}
            {' · '}{t('orders.detail.paymentMethod')} <span className="mono">{formatText(order.paymentMethod)}</span>
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/orders')}>
            {t('orders.detail.backToList')}
          </button>
        </div>
      </div>

      {warning && <ReadOnlyBanner warning={warning} />}

      {/* Action panel — allowed status / payment transitions */}
      {canUpdate && (
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--admin-color-brand-red)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 240 }}>
              <div className="fw-700 mb-2">{t('orders.detail.orderStatus')}</div>
              <div className="text-xs muted">
                {transitionsError
                  ? t('orders.detail.transitionsLoadError')
                  : allowedTransitions.length === 0
                    ? t('orders.detail.noTransition')
                    : t('orders.detail.eyebrow')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {allowedTransitions.map((s) => {
                const cfg = ORDER_STATUS_ACTION[s] ?? { variant: 'secondary' }
                const isPrimary = cfg.variant === 'primary' || cfg.variant === 'success'
                const isDanger = cfg.variant === 'destructive'
                return (
                  <button
                    key={s}
                    type="button"
                    className={`btn ${isPrimary ? 'btn-primary' : 'btn-outline'}`}
                    disabled={saving}
                    onClick={() => handleStatusChange(s)}
                    style={isDanger ? { color: 'var(--admin-color-status-danger-text)', borderColor: 'var(--admin-color-status-danger-border)' } : {}}
                  >
                    → {getOrderStatusLabel(s, order, t)}
                  </button>
                )
              })}
              {transitionsError && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTransitionsKey((k) => k + 1)}>
                  {t('common.retry')}
                </button>
              )}
            </div>
          </div>
          {/* Payment transitions */}
          {!['CANCELLED', 'FAILED', 'REFUNDED'].includes(order.orderStatus)
            && (PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).length > 0 && (
            <div
              style={{
                padding: '10px 18px',
                borderTop: '1px solid var(--admin-color-border-subtle)',
                background: 'var(--admin-color-surface-muted)',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}
            >
              <span className="text-xs muted fw-600">{t('orders.detail.paymentStatus')}</span>
              {(PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={saving}
                  onClick={() => handlePaymentStatusChange(s)}
                  style={s === 'CANCELLED' ? { color: 'var(--admin-color-status-danger-text)' } : {}}
                >
                  {PAYMENT_ACTION_LABEL[s] ? t(PAYMENT_ACTION_LABEL[s]) : s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid-2-1">
        {/* Left column — items, payments, returns, notes */}
        <div>
          {/* Items */}
          <div className="card mb-4">
            <div className="card-head">
              <h2>{t('orders.detail.items')} ({(order.items ?? []).length})</h2>
            </div>
            <div className="card-body card-body--flush">
              {(order.items ?? []).length === 0 ? (
                <div className="state-panel"><p>{t('orders.detail.noItems')}</p></div>
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('orders.detail.colProduct')}</th>
                        <th className="num">{t('orders.detail.colUnitPrice')}</th>
                        <th className="num">{t('orders.detail.colQty')}</th>
                        <th className="num">{t('orders.detail.colLineTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items ?? []).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="fw-600">{formatText(item.productName)}</div>
                            {item.variantName && <div className="text-xs muted">{item.variantName}</div>}
                          </td>
                          <td className="num">{formatCurrencyVnd(item.unitPrice)}</td>
                          <td className="num">×{item.quantity}</td>
                          <td className="num fw-700">{formatCurrencyVnd(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--admin-color-border-subtle)', background: 'var(--admin-color-surface-muted)' }}>
                <dl className="info-grid" style={{ gridTemplateColumns: '1fr auto', gap: '4px 24px', maxWidth: 360, marginLeft: 'auto', fontSize: 13 }}>
                  <dt>{t('orders.detail.subtotal')}</dt><dd className="num">{formatCurrencyVnd(order.subtotal)}</dd>
                  {order.shippingFee > 0 && (
                    <>
                      <dt>{t('orders.detail.shippingFee')}</dt>
                      <dd className="num">{formatCurrencyVnd(order.shippingFee)}</dd>
                    </>
                  )}
                  {order.discount > 0 && (
                    <>
                      <dt>{t('orders.detail.discount')}</dt>
                      <dd className="num text-danger">-{formatCurrencyVnd(order.discount)}</dd>
                    </>
                  )}
                  <dt style={{ fontWeight: 700, color: 'var(--admin-color-text-primary)', fontSize: 15, paddingTop: 8 }}>
                    {t('orders.detail.total')}
                  </dt>
                  <dd className="num strong" style={{ fontSize: 18, fontWeight: 800, color: 'var(--admin-color-brand-red)', paddingTop: 8 }}>
                    {formatCurrencyVnd(order.total)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Payments */}
          {(order.payments ?? []).length > 0 && (
            <div className="card mb-4">
              <div className="card-head"><h2>{t('orders.detail.payments')}</h2></div>
              <div className="card-body card-body--flush">
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('orders.detail.colPaymentMethod')}</th>
                        <th>{t('orders.detail.colPaymentStatus')}</th>
                        <th className="num">{t('orders.detail.colAmount')}</th>
                        <th className="num">{t('orders.detail.colPaidAt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.payments ?? []).map((p, i) => (
                        <tr key={p.id ?? i}>
                          <td className="mono">{formatText(p.paymentMethod)}</td>
                          <td>{t(`status.payment.${p.status}`, { defaultValue: p.status })}</td>
                          <td className="num">{formatCurrencyVnd(p.amount)}</td>
                          <td className="num muted text-xs">{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Returns */}
          <div className="card mb-4">
            <div className="card-head">
              <h2>{t('orders.detail.returnsTitle')}</h2>
              {canUpdate && order.orderStatus === 'COMPLETED' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreateReturn(true)}>
                  {t('orders.detail.createReturnBtn')}
                </button>
              )}
            </div>
            <div className="card-body card-body--flush">
              {returnsError ? (
                <div className="state-panel"><p className="text-danger">{t('orders.detail.returnsLoadError')}</p></div>
              ) : orderReturns.length === 0 ? (
                <div className="state-panel"><p>{t('orders.detail.returnsEmpty')}</p></div>
              ) : (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('orders.detail.colRma')}</th>
                        <th>{t('orders.detail.colReason')}</th>
                        <th>{t('orders.detail.colReturnStatus')}</th>
                        <th className="num">{t('orders.detail.colRefund')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderReturns.map((r) => (
                        <tr key={r.id}>
                          <td className="id-cell">{r.returnNumber}</td>
                          <td>{RETURN_REASON_KEY[r.reason] ? t(RETURN_REASON_KEY[r.reason]) : r.reason}</td>
                          <td><StatusBadge type="return" status={RETURN_STATUS_KEY[r.status] ? r.status : 'UNKNOWN'} /></td>
                          <td className="num">{r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card mb-4">
            <div className="card-head"><h2>{t('orders.detail.notes')}</h2></div>
            <div className="card-body">
              {(order.notes ?? []).length === 0 ? (
                <p className="muted text-sm">{t('orders.detail.noNotes')}</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                  {(order.notes ?? []).map((note, i) => (
                    <li key={note.id ?? i} style={{ borderBottom: '1px solid var(--admin-color-border-subtle)', padding: '8px 0', fontSize: 13 }}>
                      <span className="muted" style={{ marginRight: 8 }}>
                        {note.createdAt ? formatDateTime(note.createdAt) : ''}
                      </span>
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
                    <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                      <Checkbox
                        checked={noteCustomerVisible}
                        onCheckedChange={(checked) => setNoteCustomerVisible(checked)}
                        disabled={submittingNote}
                      />
                      {t('orders.detail.noteCustomerVisible')}
                    </label>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={submittingNote || !noteContent.trim()}>
                      {t('orders.detail.submitNote')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right column — customer, refund, fulfillment, timestamps */}
        <div>
          {/* Customer */}
          <div className="card mb-4">
            <div className="card-head"><h2>{t('orders.detail.customerInfo')}</h2></div>
            <div className="card-body">
              <dl className="info-grid">
                <dt>{t('orders.detail.name')}</dt><dd>{formatText(order.customerName)}</dd>
                <dt>{t('orders.detail.email')}</dt><dd>{formatText(order.customerEmail)}</dd>
                {order.shippingAddress && (
                  <>
                    <dt>{t('orders.detail.phone')}</dt>
                    <dd>{formatText(order.shippingAddress.phone)}</dd>
                    <dt>{t('orders.detail.address')}</dt>
                    <dd>
                      {[
                        order.shippingAddress.addressLine1,
                        order.shippingAddress.ward,
                        order.shippingAddress.district,
                        order.shippingAddress.province,
                      ].filter(Boolean).join(', ') || '—'}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Refund — visible when paymentStatus is PAID */}
          {canUpdate && order.paymentStatus === 'PAID' && (
            <div className="card mb-4">
              <div className="card-head"><h2>{t('refund.sectionTitle')}</h2></div>
              <div className="card-body">
                <dl className="info-grid">
                  <dt>{t('refund.paidAmount')}</dt>
                  <dd className="strong">{formatCurrencyVnd(order.paidAmount)}</dd>
                  {order.refundAmount > 0 && (
                    <>
                      <dt>{t('refund.alreadyRefunded')}</dt>
                      <dd className="text-danger strong">{formatCurrencyVnd(order.refundAmount)}</dd>
                    </>
                  )}
                </dl>
                <button type="button" className="btn btn-danger mt-3" onClick={() => setShowRefundModal(true)}>
                  {t('refund.buttonCreate')}
                </button>
                {order.refundReason && (
                  <p className="mt-2 text-xs muted">{t('refund.reason')}: {order.refundReason}</p>
                )}
                {order.refundedAt && (
                  <p className="text-xs muted">{t('refund.refundedAt')}: {formatDateTime(order.refundedAt)}</p>
                )}
              </div>
            </div>
          )}

          {/* Fulfillment — delivery orders only */}
          {order.fulfillmentType === 'DELIVERY' && (
            <div className="card mb-4">
              <div className="card-head"><h2>{t('orders.detail.fulfillment')}</h2></div>
              <div className="card-body">
                <dl className="info-grid">
                  <dt>{t('orders.detail.fulfillmentStatusLabel')}</dt>
                  <dd className="fw-600">{ffStatusLabel}</dd>
                  {order.trackingNumber && (
                    <>
                      <dt>{t('orders.detail.colRma', { defaultValue: 'Mã vận đơn' })}</dt>
                      <dd className="mono">
                        {order.shippingCarrier ? `${order.shippingCarrier} · ` : ''}{order.trackingNumber}
                      </dd>
                    </>
                  )}
                  {order.shippedAt && (
                    <>
                      <dt>{t('orders.detail.shippedAtLabel')}</dt>
                      <dd>{formatDateTime(order.shippedAt)}</dd>
                    </>
                  )}
                </dl>

                {canUpdate && (
                  <div className="mt-3">
                    <div className="flex gap-2 flex-wrap">
                      {(order.fulfillmentStatus == null || order.fulfillmentStatus === 'UNFULFILLED') && (
                        <button type="button" className="btn btn-outline btn-sm" disabled={fulfillmentSaving}
                          onClick={() => handleFulfillmentUpdate('PROCESSING')}>
                          {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffStartPreparing')}
                        </button>
                      )}
                      {order.fulfillmentStatus === 'PROCESSING' && (
                        <button type="button" className="btn btn-outline btn-sm" disabled={fulfillmentSaving}
                          onClick={() => setShowShipForm((p) => !p)}>
                          {t('orders.detail.ffMarkShipped')}
                        </button>
                      )}
                      {order.fulfillmentStatus === 'SHIPPED' && (
                        <button type="button" className="btn btn-primary btn-sm" disabled={fulfillmentSaving}
                          onClick={() => handleFulfillmentUpdate('DELIVERED')}>
                          {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffMarkDelivered')}
                        </button>
                      )}
                    </div>
                    {showShipForm && (
                      <form
                        className="flex flex-col gap-2 mt-3"
                        onSubmit={(e) => { e.preventDefault(); handleFulfillmentUpdate('SHIPPED') }}
                      >
                        <Input
                          type="text"
                          placeholder={t('orders.detail.trackingPlaceholder')}
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          disabled={fulfillmentSaving}
                          required
                        />
                        <p className="text-xs muted">{t('orders.detail.trackingHint')}</p>
                        <Input
                          type="text"
                          placeholder={t('orders.detail.carrierPlaceholder')}
                          value={shippingCarrier}
                          onChange={(e) => setShippingCarrier(e.target.value)}
                          disabled={fulfillmentSaving}
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={fulfillmentSaving}>
                            {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffConfirmShip')}
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" disabled={fulfillmentSaving}
                            onClick={() => { setShowShipForm(false); setTrackingNumber(''); setShippingCarrier('') }}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="card">
            <div className="card-head"><h2>{t('orders.detail.timestamps')}</h2></div>
            <div className="card-body">
              <dl className="info-grid">
                {order.placedAt && (<><dt>{t('orders.detail.tsPlacedAt')}</dt><dd>{formatDateTime(order.placedAt)}</dd></>)}
                {order.paidAt && (<><dt>{t('orders.detail.tsPaidAt')}</dt><dd>{formatDateTime(order.paidAt)}</dd></>)}
                {order.completedAt && (<><dt>{t('orders.detail.tsCompletedAt')}</dt><dd>{formatDateTime(order.completedAt)}</dd></>)}
                {order.cancelledAt && (<><dt>{t('orders.detail.tsCancelledAt')}</dt><dd>{formatDateTime(order.cancelledAt)}</dd></>)}
                {order.updatedAt && (<><dt>{t('orders.detail.tsUpdatedAt')}</dt><dd>{formatDateTime(order.updatedAt)}</dd></>)}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
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
    </div>
  )
}
