import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RefundModal } from '../components/RefundModal'
import { StatePanel } from '../components/StatePanel'
import { addOrderNote, adminCreateReturn, fetchOrderAllowedTransitions, fetchOrderDetail, fetchReturnsByOrder, updateOrderFulfillment, updateOrderPaymentStatus, updateOrderStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
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

// Visual config for order status action buttons.
// BACS ON_HOLD → PROCESSING tự động mark PAID — label phải rõ ý nghĩa này.
const ORDER_STATUS_ACTION = {
  PROCESSING: { label: 'Xác nhận xử lý',             variant: 'primary',     confirm: false },
  ON_HOLD:    { label: 'Tạm giữ đơn',                variant: 'secondary',   confirm: false },
  COMPLETED:  { label: 'Hoàn thành đơn',             variant: 'success',     confirm: true  },
  CANCELLED:  { label: 'Huỷ đơn',                    variant: 'destructive', confirm: true  },
  FAILED:     { label: 'Đánh dấu thất bại',          variant: 'destructive', confirm: true  },
}

// Cho đơn BACS đang ON_HOLD, label nút PROCESSING cần rõ hơn.
function getOrderStatusLabel(targetStatus, order) {
  if (targetStatus === 'PROCESSING' && order?.orderStatus === 'ON_HOLD' && order?.paymentMethod === 'BACS') {
    return 'Xác nhận đã nhận chuyển khoản'
  }
  return ORDER_STATUS_ACTION[targetStatus]?.label ?? targetStatus
}

const PAYMENT_ACTION_LABEL = {
  PAID:      'Xác nhận đã thu tiền',
  UNPAID:    'Đặt lại chưa thanh toán',
  CANCELLED: 'Huỷ thanh toán',
}

const RETURN_REASONS = [
  { value: 'DEFECTIVE', label: 'Hàng bị lỗi' },
  { value: 'WRONG_ITEM', label: 'Sai sản phẩm' },
  { value: 'NOT_AS_DESCRIBED', label: 'Không như mô tả' },
  { value: 'CHANGED_MIND', label: 'Đổi ý' },
  { value: 'OTHER', label: 'Khác' },
]

function AdminCreateReturnModal({ order, onClose, onSuccess }) {
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
    if (!hasAny) { setError('Chọn ít nhất 1 sản phẩm cần trả.'); return }
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
      setError(err.message || 'Lỗi khi tạo yêu cầu đổi trả.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tạo yêu cầu đổi trả</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field">
              <label className="field-label">Lý do *</label>
              <Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent></Select>
            </div>

            <div className="form-field">
              <label className="field-label">Sản phẩm trả lại *</label>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Sản phẩm</th>
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>Đã mua</th>
                    <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600 }}>Số lượng trả</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--admin-color-border-subtle)' }}>
                      <td style={{ padding: '6px 0' }}>
                        <div style={{ fontWeight: 500 }}>{item.productName}</div>
                        {item.variantName && <div style={{ fontSize: '0.8rem', color: 'var(--admin-color-text-muted)' }}>{item.variantName}</div>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px 8px' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                        <Input
                          type="number"
                          min={0}
                          max={item.quantity}
                          style={{ width: 60, textAlign: 'center', padding: '3px 6px' }}
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
              <label className="field-label">Ghi chú (tuỳ chọn)</label>
              <Textarea rows={2} value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}  />
            </div>

            {error && <p className="field-error">{error}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Huỷ</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !hasAny}>
                {saving ? 'Đang tạo…' : 'Tạo yêu cầu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function OrderDetailScreen({ orderId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', order: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [allowedTransitions, setAllowedTransitions] = useState([])
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

  useEffect(() => {
    let active = true
    fetchOrderDetail(orderId)
      .then((response) => {
        if (!active) return
        setState({ status: 'success', order: response.item, warning: response.mode === 'mock' ? response.warning : '' })
      })
      .catch((error) => {
        if (!active) return
        setState({ status: 'error', order: null, warning: '', error: error.message })
      })
    return () => { active = false }
  }, [orderId])

  useEffect(() => {
    if (state.status !== 'success') return undefined
    let active = true
    fetchReturnsByOrder(orderId).then((r) => { if (active) setOrderReturns(r) })
    return () => { active = false }
  }, [orderId, state.status])

  useEffect(() => {
    if (state.status !== 'success' || !state.order?.orderStatus) return undefined
    let active = true
    fetchOrderAllowedTransitions(orderId)
      .then((response) => {
        if (!active) return
        setAllowedTransitions(response.transitions || [])
      })
      .catch(() => {
        if (!active) return
        setAllowedTransitions([])
      })
    return () => { active = false }
  }, [orderId, state.status, state.order?.orderStatus, state.order?.paymentStatus, state.order?.fulfillmentStatus])

  async function handleStatusChange(newStatus) {
    const DANGEROUS = new Set(['CANCELLED', 'COMPLETED', 'REFUNDED'])
    // BACS ON_HOLD → PROCESSING auto-marks payment as PAID. Require explicit confirmation
    // so admin doesn't accidentally record a receipt they haven't actually verified.
    const isBACSAutoPayConfirm =
      newStatus === 'PROCESSING' &&
      order?.orderStatus === 'ON_HOLD' &&
      order?.paymentMethod === 'BACS'
    if (isBACSAutoPayConfirm) {
      const confirmed = window.confirm(
        'Xác nhận đã nhận tiền chuyển khoản?\n\nHành động này sẽ đánh dấu đơn hàng là ĐÃ THU TIỀN (PAID) tự động. Chỉ xác nhận khi bạn đã kiểm tra sao kê ngân hàng.'
      )
      if (!confirmed) return
    } else if (DANGEROUS.has(newStatus)) {
      const labels = { CANCELLED: 'hủy', COMPLETED: 'hoàn thành', REFUNDED: 'hoàn tiền' }
      const confirmed = window.confirm(
        `Bạn có chắc muốn chuyển đơn hàng sang trạng thái "${labels[newStatus] ?? newStatus}"?\n\nHành động này không thể hoàn tác.`
      )
      if (!confirmed) return
    }
    setSaving(true)
    try {
      const response = await updateOrderStatus(orderId, newStatus)
      const updatedOrder = response.item
      setState((prev) => ({ ...prev, order: updatedOrder }))
      const wasOnHold = order.orderStatus === 'ON_HOLD'
      const isBACS = order.paymentMethod === 'BACS'
      const autoMarkedPaid = wasOnHold && isBACS && newStatus === 'PROCESSING' && updatedOrder.paymentStatus === 'PAID'
      if (autoMarkedPaid) {
        toast.success('Đã xác nhận đơn hàng. Thanh toán tự động được đánh dấu đã thu tiền.')
      } else {
        toast.success(t('orders.detail.statusUpdated'))
      }
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePaymentStatusChange(newStatus) {
    setSaving(true)
    try {
      const response = await updateOrderPaymentStatus(orderId, newStatus)
      setState((prev) => ({ ...prev, order: response.item }))
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
      setState((prev) => ({
        ...prev,
        order: { ...prev.order, notes: [...(prev.order.notes ?? []), note] },
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
      const labels = { CANCELLED: 'huỷ vận chuyển', RETURNED: 'trả hàng' }
      if (!window.confirm(`Bạn có chắc muốn chuyển vận chuyển sang "${labels[newFulfillmentStatus]}"?\nHành động này không thể hoàn tác.`)) return
    }
    setFulfillmentSaving(true)
    try {
      const body = { fulfillmentStatus: newFulfillmentStatus }
      if (newFulfillmentStatus === 'SHIPPED') {
        if (trackingNumber.trim()) body.trackingNumber = trackingNumber.trim()
        if (shippingCarrier.trim()) body.shippingCarrier = shippingCarrier.trim()
      }
      const response = await updateOrderFulfillment(orderId, body)
      setState((prev) => ({ ...prev, order: response.item }))
      setShowShipForm(false)
      setTrackingNumber('')
      setShippingCarrier('')
      toast.success('Đã cập nhật trạng thái vận chuyển.')
    } catch (err) {
      toast.error(err.message || 'Lỗi cập nhật vận chuyển.')
    } finally {
      setFulfillmentSaving(false)
    }
  }

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('orders.detail.loading')} description={t('common.pleaseWait')} />
  }
  if (state.status === 'error') {
    return <StatePanel tone="danger" title={t('orders.detail.loadError')} description={state.error}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }
  if (!state.order) {
    return <StatePanel tone="neutral" title={t('orders.detail.notFound')} description={`ID: ${orderId}`}
      actionLabel={t('common.back')} onAction={() => navigate('/admin/orders')} />
  }

  const { order } = state

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('orders.detail.eyebrow')}</p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {formatText(order.orderNumber, `#${orderId}`)}
            {order.source === 'pos' && <span className="badge-pos">POS</span>}
          </h1>
          <p>{t('orders.detail.orderDate')} {formatDateTime(order.createdAt)}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/orders')}>
          {t('orders.detail.backToList')}
        </button>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

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
          <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('orders.detail.orderStatus')}
            </p>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
              {t(`status.order.${order.orderStatus}`, { defaultValue: order.orderStatus })}
            </span>
          </div>

          {/* Order status action buttons — chỉ hiện nút hợp lệ */}
          {canUpdate && allowedTransitions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {allowedTransitions.map((s) => {
                const cfg = ORDER_STATUS_ACTION[s] ?? { label: s, variant: 'secondary', confirm: false }
                const variantClass = {
                  primary:     'btn btn-primary',
                  secondary:   'btn btn-secondary',
                  success:     'btn btn-success',
                  destructive: 'btn btn-danger',
                }[cfg.variant] ?? 'btn btn-secondary'
                return (
                  <button
                    key={s}
                    type="button"
                    className={variantClass}
                    disabled={saving}
                    onClick={() => handleStatusChange(s)}
                  >
                    {getOrderStatusLabel(s, order)}
                  </button>
                )
              })}
            </div>
          )}
          {canUpdate && allowedTransitions.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)', marginBottom: '0.75rem' }}>
              {t('orders.detail.noTransition')}
            </p>
          )}

          {/* Current payment status + action buttons */}
          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '0.75rem' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('orders.detail.paymentStatus')}
            </p>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
              {t(`status.payment.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
            </span>
            {canUpdate && !['CANCELLED', 'FAILED', 'REFUNDED'].includes(order.orderStatus) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {(PAYMENT_TRANSITIONS[order.paymentStatus] ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={s === 'CANCELLED' ? 'btn btn-danger' : 'btn btn-secondary'}
                    disabled={saving}
                    onClick={() => handlePaymentStatusChange(s)}
                  >
                    {PAYMENT_ACTION_LABEL[s] ?? s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
            <strong>{t('orders.detail.paymentMethod')}</strong> {formatText(order.paymentMethod)}
          </p>
        </DetailSection>
      </div>

      {/* Refund section: visible when payment status is PAID */}
      {canUpdate && order.paymentStatus === 'PAID' && (
        <DetailSection title={t('refund.sectionTitle')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{t('refund.paidAmount')}: <strong>{formatCurrencyVnd(order.paidAmount)}</strong></p>
              {(order.refundAmount > 0) && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--admin-color-danger)' }}>
                  {t('refund.alreadyRefunded')}: <strong>{formatCurrencyVnd(order.refundAmount)}</strong>
                </p>
              )}
            </div>
            <button type="button" className="btn btn-danger" onClick={() => setShowRefundModal(true)}>
              {t('refund.buttonCreate')}
            </button>
          </div>
          {order.refundReason && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-color-text-muted)' }}>
              {t('refund.reason')}: {order.refundReason}
            </p>
          )}
          {order.refundedAt && (
            <p style={{ fontSize: '0.8rem', color: 'var(--admin-color-text-muted)', marginTop: 4 }}>
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
            setState((prev) => ({ ...prev, order: updatedOrder }))
            setShowRefundModal(false)
          }}
          onClose={() => setShowRefundModal(false)}
        />
      )}

      {/* Fulfillment section — chỉ cho đơn giao hàng (không phải POS) */}
      {order.fulfillmentType === 'DELIVERY' && (
        <DetailSection title="Vận chuyển">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span>
              <strong>Trạng thái:</strong>{' '}
              {order.fulfillmentStatus
                ? ({ UNFULFILLED: 'Chưa xử lý', PROCESSING: 'Đang chuẩn bị', SHIPPED: 'Đang giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã huỷ', RETURNED: 'Đã trả hàng' }[order.fulfillmentStatus] ?? order.fulfillmentStatus)
                : 'Chưa giao vận chuyển'}
            </span>
            {order.trackingNumber && (
              <span style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
                {order.shippingCarrier && <strong>{order.shippingCarrier}: </strong>}
                <span style={{ fontFamily: 'monospace' }}>{order.trackingNumber}</span>
              </span>
            )}
            {order.shippedAt && (
              <span style={{ fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
                Giao vận chuyển: {formatDateTime(order.shippedAt)}
              </span>
            )}
          </div>

          {canUpdate && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {/* UNFULFILLED: chỉ cho chuyển sang PROCESSING trước, không được nhảy thẳng SHIPPED */}
                {(order.fulfillmentStatus == null || order.fulfillmentStatus === 'UNFULFILLED') && (
                  <button type="button" className="btn btn-secondary" disabled={fulfillmentSaving}
                    onClick={() => handleFulfillmentUpdate('PROCESSING')}>
                    {fulfillmentSaving ? 'Đang lưu…' : 'Bắt đầu chuẩn bị hàng'}
                  </button>
                )}
                {/* PROCESSING: cho điền mã vận đơn rồi chuyển SHIPPED */}
                {order.fulfillmentStatus === 'PROCESSING' && (
                  <button type="button" className="btn btn-secondary" disabled={fulfillmentSaving}
                    onClick={() => setShowShipForm((p) => !p)}>
                    Đánh dấu đã giao vận chuyển
                  </button>
                )}
                {order.fulfillmentStatus === 'SHIPPED' && (
                  <button type="button" className="btn btn-primary" disabled={fulfillmentSaving}
                    onClick={() => handleFulfillmentUpdate('DELIVERED')}>
                    {fulfillmentSaving ? 'Đang lưu…' : 'Đánh dấu đã giao tới khách'}
                  </button>
                )}
              </div>

              {showShipForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 400, marginTop: 4 }}>
                  <Input type="text"
                    placeholder="Mã vận đơn *"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    disabled={fulfillmentSaving}
                    required  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', margin: 0 }}>
                    Mã vận đơn là bắt buộc để chuyển sang trạng thái Đang giao.
                  </p>
                  <Input type="text"
                    placeholder="Đơn vị vận chuyển — GHN, GHTK, ViettelPost…"
                    value={shippingCarrier}
                    onChange={(e) => setShippingCarrier(e.target.value)}
                    disabled={fulfillmentSaving}  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-primary" disabled={fulfillmentSaving}
                      onClick={() => handleFulfillmentUpdate('SHIPPED')}>
                      {fulfillmentSaving ? 'Đang lưu…' : 'Xác nhận giao vận chuyển'}
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={fulfillmentSaving}
                      onClick={() => { setShowShipForm(false); setTrackingNumber(''); setShippingCarrier('') }}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </DetailSection>
      )}

      <DetailSection title={t('orders.detail.items')}>
        {(order.items ?? []).length === 0 ? (
          <p style={{ color: 'var(--c-text-muted)' }}>{t('orders.detail.noItems')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0' }}>{t('orders.detail.colProduct')}</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>{t('orders.detail.colQty')}</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>{t('orders.detail.colUnitPrice')}</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>{t('orders.detail.colLineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '0.5rem 0' }}>{formatText(item.productName)}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem 0' }}>{formatCurrencyVnd(item.unitPrice)}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem 0' }}>{formatCurrencyVnd(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <p>{t('orders.detail.subtotal')} <strong>{formatCurrencyVnd(order.subtotal)}</strong></p>
          {order.shippingFee > 0 && <p>{t('orders.detail.shippingFee')} <strong>{formatCurrencyVnd(order.shippingFee)}</strong></p>}
          {order.discount > 0 && <p>{t('orders.detail.discount')} <strong>-{formatCurrencyVnd(order.discount)}</strong></p>}
          <p style={{ fontSize: '1.1rem' }}>{t('orders.detail.total')} <strong>{formatCurrencyVnd(order.total)}</strong></p>
        </div>
      </DetailSection>

      {/* Payments */}
      {(order.payments ?? []).length > 0 && (
        <DetailSection title={t('orders.detail.payments')}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0' }}>{t('orders.detail.colPaymentMethod')}</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0' }}>{t('orders.detail.colPaymentStatus')}</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>{t('orders.detail.colAmount')}</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>{t('orders.detail.colPaidAt')}</th>
              </tr>
            </thead>
            <tbody>
              {(order.payments ?? []).map((p, i) => (
                <tr key={p.id ?? i} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '0.5rem 0' }}>{formatText(p.paymentMethod)}</td>
                  <td style={{ padding: '0.5rem 0' }}>{t(`status.payment.${p.status}`, { defaultValue: p.status })}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem 0' }}>{formatCurrencyVnd(p.amount)}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem 0' }}>{p.paidAt ? formatDateTime(p.paidAt) : '—'}</td>
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
            <p key={s.id ?? i} style={{ margin: '0.25rem 0' }}>
              <strong>{formatText(s.methodTitle)}</strong>
              {s.amount > 0 && <span> — {formatCurrencyVnd(s.amount)}</span>}
            </p>
          ))}
        </DetailSection>
      )}

      {/* Returns section */}
      <DetailSection title="Đổi trả (RMA)">
        {orderReturns.length === 0 ? (
          <p style={{ color: 'var(--admin-color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Chưa có yêu cầu đổi trả nào.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Mã RMA</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Lý do</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600 }}>Trạng thái</th>
                <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>Hoàn tiền</th>
              </tr>
            </thead>
            <tbody>
              {orderReturns.map((r) => {
                const STATUS_COLORS = { PENDING: '#d97706', APPROVED: '#2563eb', RECEIVED: '#7c3aed', COMPLETED: '#16a34a', REFUNDED: '#16a34a', REJECTED: '#dc2626' }
                const STATUS_VI = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', RECEIVED: 'Đã nhận', COMPLETED: 'Hoàn thành', REFUNDED: 'Đã hoàn tiền', REJECTED: 'Từ chối' }
                const REASON_VI = { DEFECTIVE: 'Hàng lỗi', WRONG_ITEM: 'Sai sản phẩm', NOT_AS_DESCRIBED: 'Không như mô tả', CHANGED_MIND: 'Đổi ý', OTHER: 'Khác' }
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--admin-color-border-subtle)' }}>
                    <td style={{ padding: '6px 0', fontFamily: 'monospace', fontWeight: 500 }}>{r.returnNumber}</td>
                    <td style={{ padding: '6px 8px' }}>{REASON_VI[r.reason] ?? r.reason}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ color: STATUS_COLORS[r.status] ?? '#9ca3af', fontWeight: 600 }}>
                        {STATUS_VI[r.status] ?? r.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>
                      {r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {canUpdate && order.orderStatus === 'COMPLETED' && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: orderReturns.length > 0 ? 0 : 8 }}
            onClick={() => setShowCreateReturn(true)}
          >
            + Tạo yêu cầu đổi trả
          </button>
        )}
      </DetailSection>

      {showCreateReturn && (
        <AdminCreateReturnModal
          order={order}
          onClose={() => setShowCreateReturn(false)}
          onSuccess={(ret) => {
            setOrderReturns((prev) => [ret, ...prev])
            setShowCreateReturn(false)
            toast.success(`Đã tạo yêu cầu đổi trả ${ret.returnNumber}`)
          }}
        />
      )}

      {/* Timestamps */}
      <DetailSection title={t('orders.detail.timestamps')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
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
          <p style={{ color: 'var(--c-text-muted)', fontSize: '0.875rem' }}>{t('orders.detail.noNotes')}</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
            {(order.notes ?? []).map((note, i) => (
              <li key={note.id ?? i} style={{ borderBottom: '1px solid var(--c-border)', padding: '0.5rem 0', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--c-text-muted)', marginRight: '0.5rem' }}>{note.createdAt ? formatDateTime(note.createdAt) : ''}</span>
                {note.content}
              </li>
            ))}
          </ul>
        )}
        {canUpdate && (
          <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Textarea
              rows={3}
              placeholder={t('orders.detail.notePlaceholder')}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={submittingNote}
              style={{ resize: 'vertical' }}
             />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <Checkbox
                  checked={noteCustomerVisible}
                  onCheckedChange={(checked) => setNoteCustomerVisible(checked)}
                  disabled={submittingNote}
                 />
                {t('orders.detail.noteCustomerVisible')}
              </label>
              <button type="submit" className="btn btn-primary" disabled={submittingNote || !noteContent.trim()}>
                {submittingNote ? t('common.saving') : t('orders.detail.submitNote')}
              </button>
            </div>
          </form>
        )}
      </DetailSection>
    </section>
  )
}
