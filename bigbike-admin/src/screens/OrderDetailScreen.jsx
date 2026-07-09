import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { AlertCircle } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { addOrderNote, fetchOrderAllowedTransitions, fetchOrderAuditTrail, fetchOrderDetail, updateOrderFulfillment, updateOrderPaymentStatus, updateOrderStatus } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { recordRecentItem } from '../lib/useRecentItems'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  PAYMENT_TRANSITIONS, REASON_REQUIRED, addressLine, sameAddress,
  ORDER_STATUS_ACTION, getOrderStatusLabel, PAYMENT_ACTION_LABEL,
} from './order-detail/constants'
import { ReasonConfirmModal } from './order-detail/ReasonConfirmModal'

// T9: đọc lại query string (filter/sort/trang) mà OrderListScreen đã lưu trước khi
// điều hướng sang trang chi tiết, để nút "Quay lại danh sách" không làm mất bộ lọc.
function readListQuery() {
  try {
    return sessionStorage.getItem('orders:listQuery') || ''
  } catch {
    return ''
  }
}

// N5: khung skeleton phỏng theo bố cục thật (header + action panel + 2 cột card)
// để tránh dịch chuyển layout (CLS) khi dữ liệu đơn hàng về — cùng cách làm với
// DashboardScreen.jsx (SkeletonBlock).
function SkeletonBlock({ height }) {
  return <div className="bb-skeleton-block" style={{ height }} />
}

function OrderDetailSkeleton() {
  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title bb-stack-xs">
          <SkeletonBlock height={28} />
          <SkeletonBlock height={16} />
        </div>
      </div>
      <div className="mb-4"><SkeletonBlock height={84} /></div>
      <div className="bb-grid-2-1">
        <div className="bb-stack">
          <SkeletonBlock height={220} />
          <SkeletonBlock height={140} />
          <SkeletonBlock height={140} />
        </div>
        <div className="bb-stack">
          <SkeletonBlock height={180} />
          <SkeletonBlock height={160} />
          <SkeletonBlock height={140} />
        </div>
      </div>
    </div>
  )
}

export function OrderDetailScreen({ orderId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrderDetail(orderId),
  })
  const auditQuery = useQuery({
    queryKey: ['order-audit', orderId],
    queryFn: () => fetchOrderAuditTrail(orderId),
    enabled: Boolean(orderId),
  })

  // Live-refresh khi đơn ĐANG XEM có thay đổi (trạng thái/thanh toán/note/refund) đẩy về
  // qua WebSocket admin. Chỉ refetch khi event đúng orderId này — tránh refetch thừa.
  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', (event) => {
      if (String(event?.orderId) === String(orderId)) {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] })
        queryClient.invalidateQueries({ queryKey: ['order-audit', orderId] })
      }
    })
    return unsubscribe
  }, [orderId, queryClient])

  const order = orderQuery.data?.item ?? null
  const warning = ''
  const status = orderQuery.isLoading ? 'loading' : orderQuery.isError ? 'error' : 'success'

  const [saving, setSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [allowedTransitions, setAllowedTransitions] = useState([])
  const [transitionsError, setTransitionsError] = useState(false)
  const [transitionsKey, setTransitionsKey] = useState(0)
  const [noteContent, setNoteContent] = useState('')
  const [noteCustomerVisible, setNoteCustomerVisible] = useState(false)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false)
  const [showShipForm, setShowShipForm] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingError, setTrackingError] = useState('')
  const [shippingCarrier, setShippingCarrier] = useState('')
  const [reasonModal, setReasonModal] = useState(null)

  // F6: cảnh báo rời trang khi đang gõ dở ghi chú hoặc form giao hàng chưa lưu.
  useUnsavedChanges(!!noteContent.trim() || showShipForm)

  // O9: ghi lại đơn hàng vừa xem để hiện trong widget "Vừa xem gần đây".
  useEffect(() => {
    if (order?.id) {
      recordRecentItem('recent:orders', { id: order.id, label: formatText(order.orderNumber, `#${order.id}`) })
    }
  }, [order?.id, order?.orderNumber])

  function applyOrderUpdate(updatedOrder) {
    queryClient.setQueryData(['order', orderId], (old) => ({ ...old, item: updatedOrder }))
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['order-audit', orderId] })
  }

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
    setPendingAction(`status:${newStatus}`)
    try {
      const response = await updateOrderStatus(orderId, newStatus, reason)
      const updatedOrder = response.item
      applyOrderUpdate(updatedOrder)
      const wasOnHold = order.orderStatus === 'ON_HOLD'
      const isBACS = order.paymentMethod === 'BACS'
      const autoMarkedPaid = wasOnHold && isBACS && newStatus === 'PROCESSING' && updatedOrder.paymentStatus === 'PAID'
      toast.success(autoMarkedPaid ? t('orders.detail.autoMarkedPaidToast') : t('orders.detail.statusUpdated'))
      return true
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
      return false
    } finally {
      setSaving(false)
      setPendingAction(null)
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
    } else if (newStatus === 'COMPLETED') {
      const labelKeys = { COMPLETED: 'orders.detail.dangerCompleted' }
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
    setPendingAction(`payment:${newStatus}`)
    try {
      const response = await updateOrderPaymentStatus(orderId, newStatus)
      applyOrderUpdate(response.item)
      toast.success(t('orders.detail.paymentUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.updatePaymentError'))
    } finally {
      setSaving(false)
      setPendingAction(null)
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
    const DANGEROUS = new Set(['CANCELLED'])
    if (DANGEROUS.has(newFulfillmentStatus)) {
      const labelKeys = { CANCELLED: 'orders.detail.ffDangerCancelled' }
      const label = t(labelKeys[newFulfillmentStatus])
      if (!await showConfirm(t('orders.detail.confirmFulfillmentMessage', { label }), t('orders.detail.confirmFulfillmentTitle'))) return
    }
    if (newFulfillmentStatus === 'SHIPPED' && !trackingNumber.trim()) {
      setTrackingError(t('orders.detail.trackingRequiredError'))
      return
    }
    setTrackingError('')
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
      setTrackingError('')
      toast.success(t('orders.detail.fulfillmentUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.fulfillmentError'))
    } finally {
      setFulfillmentSaving(false)
    }
  }

  if (status === 'loading') {
    return <OrderDetailSkeleton />
  }
  if (status === 'error') {
    return <StatePanel tone="danger" title={t('orders.detail.loadError')} description={orderQuery.error?.message}
      actionLabel={t('common.retry')} onAction={() => orderQuery.refetch()} />
  }
  if (!order) {
    return <StatePanel tone="neutral" title={t('orders.detail.notFound')} description={`ID: ${orderId}`}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }

  const ffStatusLabel = order.fulfillmentStatus
    ? t({ UNFULFILLED: 'orders.detail.ffUnfulfilled', PROCESSING: 'orders.detail.ffProcessing', SHIPPED: 'orders.detail.ffShipped', DELIVERED: 'orders.detail.ffDelivered', CANCELLED: 'orders.detail.ffCancelled' }[order.fulfillmentStatus] ?? order.fulfillmentStatus)
    : t('orders.detail.ffNone')

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <h1 className="bb-heading-inline">
            {t('orders.detail.eyebrow')}{' '}
            <span className="mono bb-heading-key">
              {formatText(order.orderNumber, `#${orderId}`)}
            </span>
            <StatusBadge type="order" status={order.orderStatus} />
            <StatusBadge type="payment" status={order.paymentStatus} />
          </h1>
          <p className="bb-muted">
            {t('orders.detail.orderDate')} {formatDateTime(order.createdAt)}
            {' · '}{t('orders.detail.paymentMethod')} <span className="mono">{t(`status.paymentMethod.${order.paymentMethod}`, { defaultValue: formatText(order.paymentMethod) })}</span>
          </p>
        </div>
        <div className="bb-screen-actions">
          <button type="button" className="bb-btn bb-btn-secondary" onClick={() => navigate(`/admin/orders${readListQuery()}`)}>
            {t('orders.detail.backToList')}
          </button>
        </div>
      </div>

      {warning && <ReadOnlyBanner warning={warning} />}

      {/* Action panel */}
      {canUpdate && (
        <div className="bb-card bb-action-panel">
          <div className="bb-card-body">
            <div className="bb-action-panel-main">
              <div className="bb-action-panel-title">{t('orders.detail.orderStatus')}</div>
              <div className="bb-action-panel-copy">
                {transitionsError
                  ? t('orders.detail.transitionsLoadError')
                  : allowedTransitions.length === 0
                    ? t('orders.detail.noTransition')
                    : t('orders.detail.selectActionHint')}
              </div>
            </div>
            <div className="bb-action-panel-actions">
              {allowedTransitions.map((s) => {
                const cfg = ORDER_STATUS_ACTION[s] ?? { variant: 'secondary' }
                const isPrimary = cfg.variant === 'primary' || cfg.variant === 'success'
                const isDanger = cfg.variant === 'destructive'
                const isPending = pendingAction === `status:${s}`
                return (
                  <button
                    key={s}
                    type="button"
                    className={`bb-btn ${isDanger ? 'bb-btn-danger-ghost' : isPrimary ? 'bb-btn-primary' : 'bb-btn-secondary'}`}
                    disabled={saving}
                    onClick={() => handleStatusChange(s)}
                  >
                    {isPending ? t('orders.detail.savingShort') : <>→ {getOrderStatusLabel(s, order, t)}</>}
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
          {!['CANCELLED', 'FAILED'].includes(order.orderStatus)
            && (PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).length > 0 && (
            <div className="bb-action-strip">
              <span className="bb-action-strip-label">{t('orders.detail.paymentStatus')}</span>
              {(PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`bb-btn bb-btn-secondary bb-btn-sm${s === 'CANCELLED' ? ' bb-btn-danger-ghost' : ''}`}
                  disabled={saving}
                  onClick={() => handlePaymentStatusChange(s)}
                >
                  {pendingAction === `payment:${s}`
                    ? t('orders.detail.savingShort')
                    : PAYMENT_ACTION_LABEL[s] ? t(PAYMENT_ACTION_LABEL[s]) : s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bb-grid-2-1">
        {/* Left column */}
        <div className="bb-stack">
          {/* Items */}
          <div className="bb-card">
            <div className="bb-card-header">
              <h3>{t('orders.detail.items')} ({(order.items ?? []).length})</h3>
            </div>
            <div className="bb-card-body--flush">
              {(order.items ?? []).length === 0 ? (
                <div className="bb-card-body"><p className="bb-muted">{t('orders.detail.noItems')}</p></div>
              ) : (
                <>
                <div className="hide-on-mobile">
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
                            <div className="font-semibold">{formatText(item.productName)}</div>
                            {item.variantName && <div className="bb-cell-sub">{item.variantName}</div>}
                          </td>
                          <td className="num">{formatCurrencyVnd(item.unitPrice)}</td>
                          <td className="num">×{item.quantity}</td>
                          <td className="num font-bold">{formatCurrencyVnd(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                <MobileCardList>
                  {(order.items ?? []).map((item) => (
                    <MobileCard
                      key={item.id}
                      title={formatText(item.productName)}
                      subtitle={item.variantName || undefined}
                      meta={[
                        { label: t('orders.detail.colUnitPrice'), value: formatCurrencyVnd(item.unitPrice) },
                        { label: t('orders.detail.colQty'), value: `×${item.quantity}` },
                        { label: t('orders.detail.colLineTotal'), value: formatCurrencyVnd(item.lineTotal), tone: 'strong' },
                      ]}
                    />
                  ))}
                </MobileCardList>
                </>
              )}
              <div className="bb-total-panel">
                <dl className="bb-info-grid bb-total-grid">
                  <dt>{t('orders.detail.subtotal')}</dt>
                  <dd>{formatCurrencyVnd(order.subtotal)}</dd>
                  {order.shippingFee > 0 && (
                    <>
                      <dt>{t('orders.detail.shippingFee')}</dt>
                      <dd>{formatCurrencyVnd(order.shippingFee)}</dd>
                    </>
                  )}
                  {order.discount > 0 && (
                    <>
                      <dt>{t('orders.detail.discount')}</dt>
                      <dd className="text-danger">-{formatCurrencyVnd(order.discount)}</dd>
                    </>
                  )}
                  <dt className="bb-total-label">{t('orders.detail.total')}</dt>
                  <dd className="bb-total-value">
                    {formatCurrencyVnd(order.total)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Payments */}
          {(order.payments ?? []).length > 0 && (
            <div className="bb-card">
              <div className="bb-card-header"><h3>{t('orders.detail.payments')}</h3></div>
              <div className="bb-card-body--flush">
                <div className="hide-on-mobile">
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
                          <td className="mono">{t(`status.paymentMethod.${p.paymentMethod}`, { defaultValue: formatText(p.paymentMethod) })}</td>
                          <td>{t(`status.payment.${p.status}`, { defaultValue: p.status })}</td>
                          <td className="num">{formatCurrencyVnd(p.amount)}</td>
                          <td className="num bb-muted">{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                <MobileCardList>
                  {(order.payments ?? []).map((p, i) => (
                    <MobileCard
                      key={p.id ?? i}
                      title={t(`status.paymentMethod.${p.paymentMethod}`, { defaultValue: formatText(p.paymentMethod) })}
                      subtitle={p.paidAt ? formatDateTime(p.paidAt) : undefined}
                      meta={[
                        { label: t('orders.detail.colAmount'), value: formatCurrencyVnd(p.amount), tone: 'strong' },
                        { label: t('orders.detail.colPaymentStatus'), value: t(`status.payment.${p.status}`, { defaultValue: p.status }) },
                      ]}
                    />
                  ))}
                </MobileCardList>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.detail.notes')}</h3></div>
            <div className="bb-card-body">
              {(order.notes ?? []).length === 0 ? (
                <p className="bb-muted">{t('orders.detail.noNotes')}</p>
              ) : (
                <ul className="bb-list-clean bb-list-spaced">
                  {(order.notes ?? []).map((note, i) => (
                    <li key={note.id ?? i} className="bb-list-item">
                      <span className="bb-muted mr-2">
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
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={noteCustomerVisible}
                        onCheckedChange={(checked) => setNoteCustomerVisible(checked)}
                        disabled={submittingNote}
                      />
                      {t('orders.detail.noteCustomerVisible')}
                    </label>
                    <button type="submit" className="bb-btn bb-btn-primary bb-btn-sm" disabled={submittingNote || !noteContent.trim()}>
                      {submittingNote ? t('orders.detail.savingShort') : t('orders.detail.submitNote')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Audit trail — lịch sử thao tác trên đơn (status/payment/fulfillment/note/refund) */}
          <div className="bb-card">
            <div className="bb-card-header"><h3>{t('orders.audit.title')}</h3></div>
            <div className="bb-card-body">
              {auditQuery.isLoading ? (
                <p className="bb-muted">{t('orders.audit.loading')}</p>
              ) : auditQuery.isError ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="bb-muted m-0">{t('orders.audit.error')}</p>
                  <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={() => auditQuery.refetch()}>
                    {t('common.retry')}
                  </button>
                </div>
              ) : (auditQuery.data ?? []).length === 0 ? (
                <p className="bb-muted">{t('orders.audit.empty')}</p>
              ) : (
                <ul className="bb-list-clean">
                  {(auditQuery.data ?? []).map((entry, i) => (
                    <li key={entry.id ?? i} className="bb-list-item">
                      <div className="flex items-center justify-between gap-2">
                        <span className="bb-list-title">
                          {t(`orders.audit.action.${entry.action}`, { defaultValue: entry.action })}
                        </span>
                        <span className="bb-muted">{entry.createdAt ? formatDateTime(entry.createdAt) : ''}</span>
                      </div>
                      <div className="bb-list-meta">
                        {entry.actorType}{entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="bb-stack">
          {/* Customer */}
          <div className="bb-card">
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
                    <dd>{addressLine(order.shippingAddress) || '—'}</dd>
                  </>
                )}
                {order.billingAddress && !sameAddress(order.billingAddress, order.shippingAddress) && (
                  <>
                    <dt>{t('orders.detail.billingAddress')}</dt>
                    <dd>
                      {[order.billingAddress.fullName, order.billingAddress.phone].filter(Boolean).join(' · ')}
                      {(order.billingAddress.fullName || order.billingAddress.phone) && <br />}
                      {addressLine(order.billingAddress) || '—'}
                    </dd>
                  </>
                )}
                {order.customerNote && (
                  <>
                    <dt>{t('orders.detail.customerNote')}</dt>
                    <dd className="bb-prewrap-strong">{order.customerNote}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Fulfillment */}
          {order.fulfillmentType === 'DELIVERY' && (
            <div className="bb-card">
              <div className="bb-card-header"><h3>{t('orders.detail.fulfillment')}</h3></div>
              <div className="bb-card-body">
                <dl className="bb-info-grid">
                  <dt>{t('orders.detail.fulfillmentStatusLabel')}</dt>
                  <dd className="font-semibold">{ffStatusLabel}</dd>
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
                    <div className="bb-detail-actions">
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
                        className="bb-detail-form"
                        onSubmit={(e) => { e.preventDefault(); handleFulfillmentUpdate('SHIPPED') }}
                      >
                        <div className="flex flex-col gap-1">
                          <label htmlFor="ship-tracking-input" className="text-sm font-medium">
                            {t('orders.detail.trackingLabel')} *
                          </label>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-danger" aria-hidden="true">*</span> {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
                          </p>
                          <Input
                            id="ship-tracking-input"
                            type="text"
                            placeholder={t('orders.detail.trackingPlaceholder')}
                            value={trackingNumber}
                            onChange={(e) => { setTrackingNumber(e.target.value); if (trackingError) setTrackingError('') }}
                            onBlur={() => { if (!trackingNumber.trim()) setTrackingError(t('orders.detail.trackingRequiredError')) }}
                            disabled={fulfillmentSaving}
                            required
                            aria-invalid={trackingError ? true : undefined}
                            aria-describedby={trackingError ? 'ship-tracking-error' : undefined}
                          />
                        </div>
                        {trackingError ? (
                          <p id="ship-tracking-error" role="alert" className="bb-error-inline">
                            <AlertCircle size={13} aria-hidden="true" />
                            {trackingError}
                          </p>
                        ) : (
                          <p className="bb-muted text-xs">{t('orders.detail.trackingHint')}</p>
                        )}
                        <Input
                          type="text"
                          placeholder={t('orders.detail.carrierPlaceholder')}
                          value={shippingCarrier}
                          onChange={(e) => setShippingCarrier(e.target.value)}
                          disabled={fulfillmentSaving}
                        />
                        <div className="bb-detail-form-actions">
                          <button type="submit" className="bb-btn bb-btn-primary bb-btn-sm" disabled={fulfillmentSaving}>
                            {fulfillmentSaving ? t('orders.detail.savingShort') : t('orders.detail.ffConfirmShip')}
                          </button>
                          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" disabled={fulfillmentSaving}
                            onClick={() => { setShowShipForm(false); setTrackingNumber(''); setShippingCarrier(''); setTrackingError('') }}>
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

      {reasonModal && (
        <ReasonConfirmModal
          targetStatus={reasonModal.targetStatus}
          loading={saving}
          onConfirm={async (reason) => {
            const ok = await doStatusChange(reasonModal.targetStatus, reason)
            if (ok) setReasonModal(null)
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  )
}
