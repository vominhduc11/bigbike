import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd } from '../lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const TOAST_DURATION_MS = 6000
const MAX_TOASTS = 5

function Toast({ toast, onDismiss, navigate }) {
  const { t } = useTranslation()
  const isNew = toast.type === 'NEW_ORDER'

  // Guard payload thiếu field (WebSocket có thể gửi partial) — không render "undefined".
  const subtitle = [toast.orderNumber, toast.customerName].filter(Boolean).join(' — ')
  const meta = []
  if (toast.total != null && !Number.isNaN(Number(toast.total))) {
    meta.push(formatCurrencyVnd(toast.total))
  }
  if (!isNew && toast.status) {
    meta.push(t('status.order.' + toast.status, toast.status))
  }

  // Body là <button> thật để bàn phím mở đơn bằng Enter/Space (nút đóng là sibling —
  // tránh lồng button-in-button). Thẻ này KHÔNG còn role="alert"/aria-live riêng: cả
  // stack chung một live region "polite" ở component cha (giảm ồn cho screen reader).
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-md shadow-sm py-3 px-4 flex gap-3 items-start w-[min(340px,calc(100vw-2rem))] border-l-4',
        isNew ? 'border-l-primary' : 'border-l-info'
      )}
    >
      <Button
        variant="unstyled"
        onClick={() => {
          onDismiss(toast.id)
          navigate(`/admin/orders/${toast.orderId}`)
        }}
        className="flex-1 overflow-hidden text-left bg-transparent border-0 p-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block font-semibold text-sm text-foreground">
          {isNew ? t('notifications.newOrder') : t('notifications.orderUpdate')}
        </span>
        {subtitle ? (
          <span className="mt-1 block text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
            {subtitle}
          </span>
        ) : null}
        {meta.length > 0 ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {meta.join(' · ')}
          </span>
        ) : null}
      </Button>
      <Button
        variant="unstyled"
        aria-label={t('notifications.close')}
        onClick={() => onDismiss(toast.id)}
        className="bg-transparent border-none cursor-pointer text-muted-foreground shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </div>
  )
}

export function OrderNotificationToast({ navigate, canViewOrders }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)
  // Theo dõi mọi setTimeout đang chạy để cleanup đầy đủ (unmount) + pause khi hover.
  const timersRef = useRef(new Map())

  const clearTimer = useCallback((id) => {
    const handle = timersRef.current.get(id)
    if (handle !== undefined) {
      clearTimeout(handle)
      timersRef.current.delete(id)
    }
  }, [])

  const scheduleTimer = useCallback((id) => {
    clearTimer(id)
    const handle = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, TOAST_DURATION_MS)
    timersRef.current.set(id, handle)
  }, [clearTimer])

  useEffect(() => {
    if (!canViewOrders) return undefined

    const timers = timersRef.current
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', (event) => {
      const id = ++counterRef.current
      setToasts((prev) => [{ id, ...event }, ...prev].slice(0, MAX_TOASTS))
      scheduleTimer(id)
    })
    return () => {
      unsubscribe()
      timers.forEach((handle) => clearTimeout(handle))
      timers.clear()
    }
  }, [canViewOrders, scheduleTimer])

  const dismiss = (id) => {
    clearTimer(id)
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }

  if (!canViewOrders || toasts.length === 0) return null

  // Neo góc TRÊN-phải (dưới topbar) thay vì dưới-phải: tránh che thanh hành động dính
  // đáy (.sticky-action-bar) khi cuộn tới cuối form. z lấy theo token --admin-z-toast.
  // Cả stack là MỘT live region polite; rê chuột vào thì tạm dừng đếm giờ tự ẩn.
  return (
    <div
      aria-label={t('notifications.regionLabel')}
      aria-live="polite"
      aria-relevant="additions"
      className="fixed top-20 right-6 z-[var(--admin-z-toast)] flex flex-col gap-2 pointer-events-none"
      onMouseEnter={() => {
        timersRef.current.forEach((handle) => clearTimeout(handle))
        timersRef.current.clear()
      }}
      onMouseLeave={() => {
        toasts.forEach((item) => scheduleTimer(item.id))
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismiss} navigate={navigate} />
        </div>
      ))}
    </div>
  )
}
