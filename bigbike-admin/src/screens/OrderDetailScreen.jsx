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

const PAYMENT_TRANSITIONS = {
  UNPAID:    ['PAID', 'CANCELLED'],
  PAID:      ['UNPAID'],
  REFUNDED:  [],
  CANCELLED: [],
}

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
  const warning = ''
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
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">
            <a onClick={(e) => { e.preventDefault(); navigate('/admin/orders') }} style={{ cursor: 'pointer' }}>
              ← {t('orders.detail.backToList')}
            </a>
          </p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {t('orders.detail.eyebrow')}{' '}
            <span className="mono" style={{ color: 'var(--bb-brand)' }}>
              {formatText(order.orderNumber, `#${orderId}`)}
            </span>
            <StatusBadge type="order" status={order.orderStatus} />
            <StatusBadge type="payment" status={order.paymentStatus} />
            {order.source === 'pos' && <span className="bb-badge bb-badge-neutral">POS</span>}
          </h1>
          <p className="bb-muted">
            {t('orders.detail.orderDate')} {formatDateTime(order.createdAt)}
            {' · '}{t('orders.detail.paymentMethod')} <span className="mono">{formatText(order.paymentMethod)}</span>
          </p>
        </div>
        <div className="bb-screen-actions">
          <button type="button" className="bb-btn bb-btn-secondary" onClick={() => navigate('/admin/orders')}>
            {t('orders.detail.backToList')}
          </button>
        </div>
      </div>

      {warning && <ReadOnlyBanner warning={warning} />}

      {/* Action panel */}
      {canUpdate && (
        <div className="bb-card" style={{ marginBottom: 16, borderLeft: '3px solid var(--bb-brand)' }}>
          <div className="bb-card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 auto', minWidth: 240 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('orders.detail.orderStatus')}</div>
              <div className="bb-muted" style={{ fontSize: 12.5 }}>
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
                    className={`bb-btn ${isDanger ? 'bb-btn-danger-ghost' : isPrimary ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
                    disabled={saving}
                    onClick={() => handleStatusChange(s)}
                  >
                    → {getOrderStatusLabel(s, order, t)}
                  </button>
                )
              })}
              {transitionsError && (
                <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={() => setTransitionsKey((k) => k + 1)}>
                  {t('common.retry')}
                </button>
              )}
            </div>
          </div>
          {!['CANCELLED', 'FAILED', 'REFUNDED'].includes(order.orderStatus)
            && (PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).length > 0 && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--bb-border-faint)',
              background: 'var(--bb-surface-muted)',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 12, color: 'var(--bb-text-muted)', fontWeight: 600 }}>{t('orders.detail.paymentStatus')}</span>
              {(PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`bb-btn bb-btn-secondary bb-btn-sm${s === 'CANCELLED' ? ' bb-btn-danger-ghost' : ''}`}
                  disabled={saving}
                  onClick={() => handlePaymentStatusChange(s)}
                >
                  {PAYMENT_ACTION_LABEL[s] ? t(PAYMENT_ACTION_LABEL[s]) : s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bb-grid-2-1">
        {/* Left column */}
        <div>
          {/* Items */}
          <div className="bb-card" style={{ marginBottom: 16 }}>
            <div className="bb-card-header">
              <h3>{t('orders.detail.items')} ({(order.items ?? []).length})</h3>
            </div>
            <div className="bb-card-body--flush">
              {(order.items ?? []).length === 0 ? (
                <div className="bb-card-body"><p className="bb-muted">{t('orders.detail.noItems')}</p></div>
              ) : (
                <div className="bb-table-wrap">
                  <table className="bb-table">
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
                            <div style={{ fontWeight: 600 }}>{formatText(item.productName)}</div>
                            {item.variantName && <div className="bb-cell-sub">{item.variantName}</div>}
                          </td>
                          <td className="num">{formatCurrencyVnd(item.unitPrice)}</td>
                          <td className="num">×{item.quantity}</td>
                          <td className="num" style={{ fontWeight: 700 }}>{formatCurrencyVnd(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--bb-border-faint)', background: 'var(--bb-surface-muted)' }}>
                <dl className="bb-info-grid" style={{ gridTemplateColumns: '1fr auto', maxWidth: 360, marginLeft: 'auto', gap: '4px 24px', fontSize: 13 }}>
                  <dt style={{ textTransform: 'none', fontSize: 13, letterSpacing: 0, fontWeight: 400 }}>{t('orders.detail.subtotal')}</dt>
                  <dd style={{ textAlign: 'right' }}>{formatCurrencyVnd(order.subtotal)}</dd>
                  {order.shippingFee > 0 && (
                    <>
                      <dt style={{ textTransform: 'none', fontSize: 13, letterSpacing: 0, fontWeight: 400 }}>{t('orders.detail.shippingFee')}</dt>
                      <dd style={{ textAlign: 'right' }}>{formatCurrencyVnd(order.shippingFee)}</dd>
                    </>
                  )}
                  {order.discount > 0 && (
                    <>
                      <dt style={{ textTransform: 'none', fontSize: 13, letterSpacing: 0, fontWeight: 400 }}>{t('orders.detail.discount')}</dt>
                      <dd style={{ textAlign: 'right', color: 'var(--bb-danger)' }}>-{formatCurrencyVnd(order.discount)}</dd>
                    </>
                  )}
                  <dt style={{ textTransform: 'none', fontWeight: 700, fontSize: 15, paddingTop: 8 }}>{t('orders.detail.total')}</dt>
                  <dd style={{ textAlign: 'right', fontSize: 18, fontWeight: 800, color: 'var(--bb-brand)', paddingTop: 8 }}>
                    {formatCurrencyVnd(order.total)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Payments */}
          {(order.payments ?? []).length > 0 && (
            <div className="bb-card" style={{ marginBottom: 16 }}>
              <div className="bb-card-header"><h3>{t('orders.detail.payments')}</h3></div>
              <div className="bb-card-body--flush">
                <div className="bb-table-wrap">
                  <table className="bb-table">
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
                          <td className="num bb-muted">{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Returns */}
          <div className="bb-card" style={{ marginBottom: 16 }}>
            <div className="bb-card-header">
              <h3>{t('orders.detail.returnsTitle')}</h3>
              {canUpdate && order.orderStatus === 'COMPLETED' && (
                <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={() => setShowCreateReturn(true)}>
                  {t('orders.detail.createReturnBtn')}
                </button>
              )}
            </div>
            <div className="bb-card-body--flush">
              {returnsError ? (
                <div className="bb-card-body"><p style={{ color: 'var(--bb-danger)' }}>{t('orders.detail.returnsLoadError')}</p></div>
              ) : orderReturns.length === 0 ? (
                <div className="bb-card-body"><p className="bb-muted">{t('orders.detail.returnsEmpty')}</p></div>
              ) : (
                <div className="bb-table-wrap">
                  <table className="bb-table">
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
                          <td className="mono">{r.returnNumber}</td>
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
          <div className="bb-card" style={{ marginBottom: 16 }}>
            <div className="bb-card-header"><h3>{t('orders.detail.notes')}</h3></div>
            <div className="bb-card-body">
              {(order.notes ?? []).length === 0 ? (
                <p className="bb-muted">{t('orders.detail.noNotes')}</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
                  {(order.notes ?? []).map((note, i) => (
                    <li key={note.id ?? i} style={{ borderBottom: '1px solid var(--bb-border-faint)', padding: '8px 0', fontSize: 13 }}>
                      <span className="bb-muted" style={{ marginRight: 8 }}>
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
                    <button type="submit" className="bb-btn bb-btn-primary bb-btn-sm" disabled={submittingNote || !noteContent.trim()}>
                      {t('orders.detail.submitNote')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Customer */}
          <div className="bb-card" style={{ marginBottom: 16 }}>
            <div className="bb-card-header"><h3>{t('orders.detail.customerInfo')}</h3></div>
            <div className="bb-card-body">
              <dl className="bb-info-grid">
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

          {/* Refund */}
          {canUpdate && order.paymentStatus === 'PAID' && (
            <div className="bb-card" style={{ marginBottom: 16 }}>
              <div className="bb-card-header"><h3>{t('refund.sectionTitle')}</h3></div>
              <div className="bb-card-body">
                <dl className="bb-info-grid">
                  <dt>{t('refund.paidAmount')}</dt>
                  <dd style={{ fontWeight: 600 }}>{formatCurrencyVnd(order.paidAmount)}</dd>
                  {order.refundAmount > 0 && (
                    <>
                      <dt>{t('refund.alreadyRefunded')}</dt>
                      <dd style={{ color: 'var(--bb-danger)', fontWeight: 600 }}>{formatCurrencyVnd(order.refundAmount)}</dd>
                    </>
                  )}
                </dl>
                <button type="button" className="bb-btn bb-btn-danger" style={{ marginTop: 12 }} onClick={() => setShowRefundModal(true)}>
                  {t('refund.buttonCreate')}
                </button>
                {order.refundReason && (
                  <p className="bb-muted" style={{ marginTop: 8, fontSize: 12 }}>{t('refund.reason')}: {order.refundReason}</p>
                )}
                {order.refundedAt && (
                  <p className="bb-muted" style={{ fontSize: 12 }}>{t('refund.refundedAt')}: {formatDateTime(order.refundedAt)}</p>
                )}
              </div>
            </div>
          )}

          {/* Fulfillment */}
          {order.fulfillmentType === 'DELIVERY' && (
            <div className="bb-card" style={{ marginBottom: 16 }}>
              <div className="bb-card-header"><h3>{t('orders.detail.fulfillment')}</h3></div>
              <div className="bb-card-body">
                <dl className="bb-info-grid">
                  <dt>{t('orders.detail.fulfillmentStatusLabel')}</dt>
                  <dd style={{ fontWeight: 600 }}>{ffStatusLabel}</dd>
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
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(order.fulfillmentStatus == null || order.fulfillmentStatus === 'UNFULFILLED') && (
                        <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" disabled={fulfillmentSaving}
                          onClick={() => handleFulfillmentUpdate('PROCESSING')}>
                          {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffStartPreparing')}
                        </button>
                      )}
                      {order.fulfillmentStatus === 'PROCESSING' && (
                        <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" disabled={fulfillmentSaving}
                          onClick={() => setShowShipForm((p) => !p)}>
                          {t('orders.detail.ffMarkShipped')}
                        </button>
                      )}
                      {order.fulfillmentStatus === 'SHIPPED' && (
                        <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" disabled={fulfillmentSaving}
                          onClick={() => handleFulfillmentUpdate('DELIVERED')}>
                          {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffMarkDelivered')}
                        </button>
                      )}
                    </div>
                    {showShipForm && (
                      <form
                        style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}
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
                        <p className="bb-muted" style={{ fontSize: 12 }}>{t('orders.detail.trackingHint')}</p>
                        <Input
                          type="text"
                          placeholder={t('orders.detail.carrierPlaceholder')}
                          value={shippingCarrier}
                          onChange={(e) => setShippingCarrier(e.target.value)}
                          disabled={fulfillmentSaving}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="submit" className="bb-btn bb-btn-primary bb-btn-sm" disabled={fulfillmentSaving}>
                            {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffConfirmShip')}
                          </button>
                          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" disabled={fulfillmentSaving}
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
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.detail.timestamps')}</h3></div>
            <div className="bb-card-body">
              <dl className="bb-info-grid">
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
