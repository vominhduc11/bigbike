import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd } from '../lib/formatters'
import { cn } from '@/lib/utils'

const TOAST_DURATION_MS = 6000
const MAX_TOASTS = 5

function Toast({ toast, onDismiss, navigate }) {
  const { t } = useTranslation()
  const isNew = toast.type === 'NEW_ORDER'

  // Body is a real <button> so keyboard users can open the order with Enter/Space
  // (the close <button> stays a sibling — avoids the invalid button-in-button nesting).
  // The wrapper keeps role="alert"/aria-live so screen readers still announce new orders.
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'bg-surface border border-border rounded-md shadow-sm py-3 px-3.5 flex gap-3 items-start w-[min(340px,calc(100vw-2rem))] border-l-4',
        isNew ? 'border-l-primary' : 'border-l-info'
      )}
    >
      <button
        type="button"
        onClick={() => {
          onDismiss(toast.id)
          navigate(`/admin/orders/${toast.orderId}`)
        }}
        className="flex-1 overflow-hidden text-left bg-transparent border-0 p-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block font-semibold text-sm text-foreground">
          {isNew ? t('notifications.newOrder') : t('notifications.orderUpdate')}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
          {toast.orderNumber} — {toast.customerName}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatCurrencyVnd(toast.total)}
          {!isNew && toast.status ? ` · ${t('status.order.' + toast.status, toast.status)}` : ''}
        </span>
      </button>
      <button
        type="button"
        aria-label={t('notifications.close')}
        onClick={() => onDismiss(toast.id)}
        className="bg-transparent border-none cursor-pointer text-muted-foreground shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function OrderNotificationToast({ navigate }) {
  const { t } = useTranslation()
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
      aria-label={t('notifications.regionLabel')}
      className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismiss} navigate={navigate} />
        </div>
      ))}
    </div>
  )
}
