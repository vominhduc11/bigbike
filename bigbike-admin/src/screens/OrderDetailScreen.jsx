import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RefundModal } from '../components/RefundModal'
import { StatePanel } from '../components/StatePanel'
import { addOrderNote, fetchOrderAllowedTransitions, fetchOrderDetail, updateOrderPaymentStatus, updateOrderStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const PAYMENT_STATUSES = ['UNPAID', 'PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'REFUNDED', 'CANCELLED', 'PARTIALLY_REFUNDED']

export function OrderDetailScreen({ orderId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', order: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [allowedTransitions, setAllowedTransitions] = useState([])
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [pendingPaymentStatus, setPendingPaymentStatus] = useState(null)
  const [partialPaidAmount, setPartialPaidAmount] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteCustomerVisible, setNoteCustomerVisible] = useState(false)
  const [submittingNote, setSubmittingNote] = useState(false)

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
  }, [orderId, state.status, state.order?.orderStatus])

  async function handleStatusChange(e) {
    const newStatus = e.target.value
    const DANGEROUS = new Set(['CANCELLED', 'COMPLETED', 'REFUNDED'])
    if (DANGEROUS.has(newStatus)) {
      const labels = { CANCELLED: 'hủy', COMPLETED: 'hoàn thành', REFUNDED: 'hoàn tiền' }
      const confirmed = window.confirm(
        `Bạn có chắc muốn chuyển đơn hàng sang trạng thái "${labels[newStatus] ?? newStatus}"?\n\nHành động này không thể hoàn tác.`
      )
      if (!confirmed) return
    }
    setSaving(true)
    try {
      const response = await updateOrderStatus(orderId, newStatus)
      setState((prev) => ({ ...prev, order: response.item }))
      toast.success(t('orders.detail.statusUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePaymentStatusChange(e) {
    const newStatus = e.target.value
    if (newStatus === 'PARTIALLY_PAID') {
      setPendingPaymentStatus(newStatus)
      setPartialPaidAmount('')
      return
    }
    setPendingPaymentStatus(null)
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

  async function handlePartialPaidConfirm() {
    const amount = parseFloat(partialPaidAmount)
    if (!partialPaidAmount || isNaN(amount) || amount <= 0) {
      toast.error(t('orders.detail.partialAmountRequired'))
      return
    }
    setSaving(true)
    try {
      const response = await updateOrderPaymentStatus(orderId, 'PARTIALLY_PAID', amount)
      setState((prev) => ({ ...prev, order: response.item }))
      setPendingPaymentStatus(null)
      setPartialPaidAmount('')
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
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            {t('orders.detail.deliveryStatus')}
            <select
              className="control-select"
              value={order.orderStatus}
              onChange={handleStatusChange}
              disabled={!canUpdate || saving || allowedTransitions.length === 0}
            >
              <option value={order.orderStatus}>
                {t(`status.order.${order.orderStatus}`, { defaultValue: order.orderStatus })}
              </option>
              {allowedTransitions
                .filter((s) => s !== order.orderStatus)
                .map((s) => (
                  <option key={s} value={s}>{t(`status.order.${s}`, { defaultValue: s })}</option>
                ))}
            </select>
            {allowedTransitions.length === 0 && (
              <small style={{ color: 'var(--c-text-muted)' }}>
                {t('orders.detail.noTransition')}
              </small>
            )}
          </label>
          <label style={{ display: 'block' }}>
            {t('orders.detail.paymentStatus')}
            <select
              className="control-select"
              value={pendingPaymentStatus ?? order.paymentStatus}
              onChange={handlePaymentStatusChange}
              disabled={!canUpdate || saving}
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{t(`status.payment.${s}`, { defaultValue: s })}</option>
              ))}
            </select>
          </label>
          {pendingPaymentStatus === 'PARTIALLY_PAID' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <input
                type="number"
                min="0"
                className="control-input"
                style={{ flex: 1 }}
                placeholder={t('orders.detail.partialAmountPlaceholder')}
                value={partialPaidAmount}
                onChange={(e) => setPartialPaidAmount(e.target.value)}
                disabled={saving}
              />
              <button type="button" className="btn btn-primary" onClick={handlePartialPaidConfirm} disabled={saving}>
                {t('common.confirm')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setPendingPaymentStatus(null); setPartialPaidAmount('') }} disabled={saving}>
                {t('common.cancel')}
              </button>
            </div>
          )}
          <p style={{ marginTop: '0.5rem' }}><strong>{t('orders.detail.paymentMethod')}</strong> {formatText(order.paymentMethod)}</p>
        </DetailSection>
      </div>

      {/* Refund section: visible when payment status is PAID or PARTIALLY_PAID */}
      {canUpdate && (order.paymentStatus === 'PAID' || order.paymentStatus === 'PARTIALLY_PAID') && (
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
            <textarea
              className="control-input"
              rows={3}
              placeholder={t('orders.detail.notePlaceholder')}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              disabled={submittingNote}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={noteCustomerVisible}
                  onChange={(e) => setNoteCustomerVisible(e.target.checked)}
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
