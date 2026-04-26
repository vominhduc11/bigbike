import { useEffect, useRef, useState } from 'react'
import { subscribeAdminWs } from '../lib/adminWebSocket'

const TOAST_DURATION_MS = 6000
const MAX_TOASTS = 5

const STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  ON_HOLD: 'Tạm giữ',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn',
}

function formatVnd(amount) {
  if (amount == null) return ''
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(amount))) + ' ₫'
}

function Toast({ toast, onDismiss, navigate }) {
  const isNew = toast.type === 'NEW_ORDER'

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background: 'var(--admin-color-surface-base)',
        border: '1px solid var(--admin-color-border-subtle)',
        borderLeft: isNew
          ? '4px solid var(--admin-color-brand-red)'
          : '4px solid var(--admin-color-status-info-text)',
        borderRadius: 'var(--admin-radius-md)',
        boxShadow: 'var(--admin-shadow-sm)',
        padding: '12px 14px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        minWidth: 280,
        maxWidth: 340,
        cursor: 'pointer',
      }}
      onClick={() => {
        onDismiss(toast.id)
        navigate(`/admin/orders/${toast.orderId}`)
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--admin-color-text-primary)' }}>
          {isNew ? 'Đơn hàng mới' : 'Cập nhật đơn hàng'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--admin-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toast.orderNumber} — {toast.customerName}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--admin-color-text-muted)' }}>
          {formatVnd(toast.total)}
          {!isNew && toast.status ? ` · ${STATUS_LABELS[toast.status] || toast.status}` : ''}
        </p>
      </div>
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id) }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--admin-color-text-muted)',
          fontSize: '1rem',
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}

export function OrderNotificationToast({ navigate }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', (event) => {
      const id = ++counterRef.current
      setToasts((prev) => [
        { id, ...event },
        ...prev,
      ].slice(0, MAX_TOASTS))

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, TOAST_DURATION_MS)
    })
    return unsubscribe
  }, [])

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Thông báo đơn hàng"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={toast} onDismiss={dismiss} navigate={navigate} />
        </div>
      ))}
    </div>
  )
}
