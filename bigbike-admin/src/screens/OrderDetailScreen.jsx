import { useEffect, useState } from 'react'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchOrderAllowedTransitions, fetchOrderDetail, updateOrderPaymentStatus, updateOrderStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']

export function OrderDetailScreen({ orderId, navigate, canUpdate }) {
  const [state, setState] = useState({ status: 'loading', order: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [allowedTransitions, setAllowedTransitions] = useState([])

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

  // Load allowed transitions whenever the current order status changes so the
  // UI only surfaces buttons the backend will actually accept.
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
    setSaving(true)
    setSaveError('')
    try {
      const response = await updateOrderStatus(orderId, newStatus)
      setState((prev) => ({ ...prev, order: response.item }))
    } catch (err) {
      setSaveError(err.message || 'Lỗi cập nhật trạng thái')
    } finally {
      setSaving(false)
    }
  }

  async function handlePaymentStatusChange(e) {
    const newStatus = e.target.value
    setSaving(true)
    setSaveError('')
    try {
      const response = await updateOrderPaymentStatus(orderId, newStatus)
      setState((prev) => ({ ...prev, order: response.item }))
    } catch (err) {
      setSaveError(err.message || 'Lỗi cập nhật thanh toán')
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') {
    return <StatePanel tone="info" title="Đang tải đơn hàng" description="Vui lòng chờ..." />
  }
  if (state.status === 'error') {
    return <StatePanel tone="danger" title="Lỗi tải đơn hàng" description={state.error}
      actionLabel="Quay lại" onAction={() => navigate('/admin/orders')} />
  }
  if (!state.order) {
    return <StatePanel tone="neutral" title="Không tìm thấy đơn hàng" description={`ID: ${orderId}`}
      actionLabel="Quay lại" onAction={() => navigate('/admin/orders')} />
  }

  const { order } = state

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Commerce / Đơn hàng</p>
          <h1>{formatText(order.orderNumber, `Đơn #${orderId}`)}</h1>
          <p>Ngày đặt: {formatDateTime(order.createdAt)}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/orders')}>
          ← Danh sách
        </button>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}
      {saveError && <p style={{ color: 'var(--c-danger)', marginBottom: '1rem' }}>{saveError}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <DetailSection title="Thông tin khách hàng">
          <p><strong>Tên:</strong> {formatText(order.customerName)}</p>
          <p><strong>Email:</strong> {formatText(order.customerEmail)}</p>
          {order.shippingAddress && (
            <>
              <p><strong>ĐT:</strong> {formatText(order.shippingAddress.phone)}</p>
              <p><strong>Địa chỉ:</strong> {formatText(order.shippingAddress.addressLine1)}, {formatText(order.shippingAddress.city)}</p>
            </>
          )}
        </DetailSection>

        <DetailSection title="Trạng thái đơn hàng">
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            Trạng thái giao hàng
            <select
              className="control-select"
              value={order.orderStatus}
              onChange={handleStatusChange}
              disabled={!canUpdate || saving || allowedTransitions.length === 0}
            >
              {/* Current status is always shown as the selected value (even when
                  it is terminal and no transitions are allowed). */}
              <option value={order.orderStatus}>{order.orderStatus}</option>
              {allowedTransitions
                .filter((s) => s !== order.orderStatus)
                .map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {allowedTransitions.length === 0 && (
              <small style={{ color: 'var(--c-text-muted)' }}>
                Trạng thái hiện tại không thể chuyển tiếp.
              </small>
            )}
          </label>
          <label style={{ display: 'block' }}>
            Trạng thái thanh toán
            <select className="control-select" value={order.paymentStatus} onChange={handlePaymentStatusChange} disabled={!canUpdate || saving}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <p style={{ marginTop: '0.5rem' }}><strong>Phương thức:</strong> {formatText(order.paymentMethod)}</p>
        </DetailSection>
      </div>

      <DetailSection title="Sản phẩm trong đơn">
        {order.items.length === 0 ? (
          <p style={{ color: 'var(--c-text-muted)' }}>Không có sản phẩm</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0' }}>Sản phẩm</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>SL</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>Đơn giá</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0' }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
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
          <p>Tạm tính: <strong>{formatCurrencyVnd(order.subtotal)}</strong></p>
          {order.shippingFee > 0 && <p>Phí ship: <strong>{formatCurrencyVnd(order.shippingFee)}</strong></p>}
          {order.discount > 0 && <p>Giảm giá: <strong>-{formatCurrencyVnd(order.discount)}</strong></p>}
          <p style={{ fontSize: '1.1rem' }}>Tổng cộng: <strong>{formatCurrencyVnd(order.total)}</strong></p>
        </div>
      </DetailSection>
    </section>
  )
}
