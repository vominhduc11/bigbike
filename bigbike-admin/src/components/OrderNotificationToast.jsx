import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { cn } from '@/lib/utils'

const TOAST_DURATION_MS = 6000
const MAX_TOASTS = 5

function formatVnd(amount) {
  if (amount == null) return ''
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(amount))) + ' ₫'
}

function Toast({ toast, onDismiss, navigate }) {
  const { t } = useTranslation()
  const isNew = toast.type === 'NEW_ORDER'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'bg-surface border border-border rounded-md shadow-sm py-3 px-3.5 flex gap-3 items-start min-w-[280px] max-w-[340px] cursor-pointer border-l-4',
        isNew ? 'border-l-primary' : 'border-l-info'
      )}
      onClick={() => {
        onDismiss(toast.id)
        navigate(`/admin/orders/${toast.orderId}`)
      }}
    >
      <div className="flex-1 overflow-hidden">
        <p className="m-0 font-semibold text-[0.85rem] text-foreground">
          {isNew ? t('notifications.newOrder') : t('notifications.orderUpdate')}
        </p>
        <p className="mt-0.5 mb-0 text-[0.8rem] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
          {toast.orderNumber} — {toast.customerName}
        </p>
        <p className="mt-0.5 mb-0 text-[0.8rem] text-muted-foreground">
          {formatVnd(toast.total)}
          {!isNew && toast.status ? ` · ${t('status.order.' + toast.status, toast.status)}` : ''}
        </p>
      </div>
      <button
        type="button"
        aria-label={t('notifications.close')}
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id) }}
        className="bg-transparent border-none cursor-pointer text-muted-foreground text-base leading-none p-0 shrink-0"
      >
        ✕
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
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismiss} navigate={navigate} />
        </div>
      ))}
    </div>
  )
}
