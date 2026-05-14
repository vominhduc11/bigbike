import { useEffect, useRef, useState } from 'react'
import { Bell, Package, RefreshCw } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { Button } from '@/components/ui/button'

const MAX_STORED = 50
const STORAGE_KEY = 'admin_notifications'

const STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  ON_HOLD: 'Tạm giữ',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn',
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore storage write failures in private mode or when quota is exhausted.
  }
}

function formatTime(iso) {
  const date = new Date(iso)
  const diffMins = Math.floor((Date.now() - date) / 60000)
  if (diffMins < 1) return 'Vừa xong'
  if (diffMins < 60) return `${diffMins} phút trước`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function formatVnd(amount) {
  if (amount == null) return ''
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(amount))) + ' ₫'
}

function NotificationItem({ item, onClick }) {
  const isNew = item.type === 'NEW_ORDER'
  const Icon = isNew ? Package : RefreshCw

  return (
    <button
      type="button"
      onClick={onClick}
      className={`noti-item${item.read ? '' : ' noti-item--unread'}`}
    >
      <div className={`noti-item-icon${isNew ? ' noti-item-icon--new' : ' noti-item-icon--update'}`}>
        <Icon size={14} strokeWidth={2} />
      </div>

      <div className="noti-item-body">
        <p className="noti-item-title">
          {isNew ? 'Đơn hàng mới' : 'Cập nhật đơn hàng'}
          {!item.read && <span className="noti-dot" aria-hidden="true" />}
        </p>
        <p className="noti-item-sub">
          {item.orderNumber} — {item.customerName}
        </p>
        <p className="noti-item-meta">
          {formatVnd(item.total)}
          {!isNew && item.status ? ` · ${STATUS_LABELS[item.status] || item.status}` : ''}
        </p>
      </div>

      <span className="noti-item-time">{formatTime(item.ts)}</span>
    </button>
  )
}

export function NotificationBell({ navigate }) {
  const [items, setItems] = useState(loadFromStorage)
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const counterRef = useRef(0)

  const unreadCount = items.filter((n) => !n.read).length

  useEffect(() => {
    const unsub = subscribeAdminWs('/topic/admin/orders', (event) => {
      const newItem = {
        id: `${Date.now()}-${++counterRef.current}`,
        type: event.type,
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        customerName: event.customerName,
        total: event.total,
        status: event.status ?? null,
        read: false,
        ts: new Date().toISOString(),
      }
      setItems((prev) => {
        const next = [newItem, ...prev].slice(0, MAX_STORED)
        saveToStorage(next)
        return next
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function markAllRead() {
    setItems((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      saveToStorage(next)
      return next
    })
  }

  function clearAll() {
    setItems([])
    saveToStorage([])
  }

  function handleItemClick(item) {
    setItems((prev) => {
      const next = prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      saveToStorage(next)
      return next
    })
    setOpen(false)
    navigate(`/admin/orders/${item.orderId}`)
  }

  return (
    <div ref={panelRef} className="noti-bell-root">
      <button
        type="button"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={`noti-bell-btn${open ? ' noti-bell-btn--active' : ''}`}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="noti-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Thông báo" className="noti-panel">
          {/* Header */}
          <div className="noti-panel-header">
            <div className="noti-panel-title">
              <span>Thông báo</span>
              {unreadCount > 0 && (
                <span className="noti-count-badge">{unreadCount}</span>
              )}
            </div>
            <div className="noti-panel-actions">
              {unreadCount > 0 && (
                <Button variant="secondary" className="noti-action-btn noti-action-btn--primary" type="button" onClick={markAllRead}>
                  Đánh dấu đã đọc
                </Button>
              )}
              {items.length > 0 && (
                <Button variant="secondary" className="noti-action-btn" type="button" onClick={clearAll}>
                  Xoá tất cả
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="noti-panel-list">
            {items.length === 0 ? (
              <div className="noti-empty">
                <Bell size={28} className="noti-empty-icon" />
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              items.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
