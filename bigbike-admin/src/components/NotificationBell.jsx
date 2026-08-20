import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bell, Check, ShoppingCart } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { fetchAdminNotifications, markAllAdminNotificationsRead } from '../lib/adminApi'
import { useAuth, useHasPermission } from '../lib/auth'
import { formatCurrencyVnd } from '../lib/formatters'
import { toast } from '../lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MAX_ITEMS = 30

// Cache localStorage tách theo TỪNG tài khoản admin (AUD-017): trước đây mọi tài khoản
// dùng chung 1 key 'bb-admin-notifications', logout không xoá → đăng nhập tài khoản khác
// trên cùng trình duyệt đọc được thông báo (số đơn/khách/giá trị) của tài khoản trước,
// kể cả khi tài khoản mới không có quyền orders.read. Namespace theo email → cô lập.
function storageKeyFor(identity) {
  return `bb-admin-notifications:${identity || 'anon'}`
}

// Dedupe key shared by WS events and server-persisted items: an order can raise both
// a NEW_ORDER and later ORDER_UPDATE event, so key on orderId + type.
function keyOf(it) {
  return it.orderId ? `${it.orderId}:${it.type}` : `id:${it.id}`
}

function loadStored(storageKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey))
    return Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

function persist(storageKey, items) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items))
  } catch {
    /* quota / private mode — keep working from memory */
  }
}

function formatWhen(ts, locale) {
  const d = new Date(ts)
  // Guard: timestamp thiếu/hỏng → không hiện "Invalid Date".
  if (Number.isNaN(d.getTime())) return '—'
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const sameDay = new Date().toDateString() === d.toDateString()
  return sameDay
    ? time
    : `${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })} ${time}`
}

// Topbar notification centre — accumulates the order events that already
// arrive over the admin WebSocket (the same feed OrderNotificationToast uses),
// so the admin keeps a persistent, catch-up list instead of only fleeting toasts.
export function NotificationBell({ navigate }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const hasPermission = useHasPermission()
  // Chuông chỉ dành cho tài khoản có quyền đọc đơn (AUD-017) — không render/không fetch
  // cho tài khoản không có orders.read.
  const canViewOrders = hasPermission('orders.read')
  const storageKey = storageKeyFor(user?.email)
  const [items, setItems] = useState(() => (canViewOrders ? loadStored(storageKey) : []))
  const [open, setOpen] = useState(false)
  // Lỗi khi nạp danh sách từ server (V102): dùng để phân biệt "chưa có thông báo"
  // với "không tải được" thay vì nuốt lỗi im lặng.
  const [loadError, setLoadError] = useState(false)
  // Ids that were unread at the moment the panel was opened. We snapshot them
  // *before* markAllRead() clears the flags, so the open panel can still show a
  // per-row "new" marker for this viewing (the bell badge correctly clears).
  const [seenUnread, setSeenUnread] = useState(() => new Set())

  // Đổi tài khoản trên cùng trình duyệt: nạp lại cache của đúng tài khoản mới (theo
  // storageKey), hoặc dọn sạch nếu tài khoản mới không có quyền đọc đơn (AUD-017).
  // Pattern reset-state-khi-đổi-prop trong render (React docs) thay vì setState-in-effect.
  const [activeKey, setActiveKey] = useState(storageKey)
  if (activeKey !== storageKey) {
    setActiveKey(storageKey)
    setSeenUnread(new Set())
    setItems(canViewOrders ? loadStored(storageKey) : [])
  }

  useEffect(() => {
    if (!canViewOrders) return undefined
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', (event) => {
      if (!event?.orderId) return
      setItems((prev) => {
        const next = [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            at: Date.now(),
            read: false,
            ...event,
          },
          ...prev,
        ].slice(0, MAX_ITEMS)
        persist(storageKey, next)
        return next
      })
    })
    return unsubscribe
  }, [canViewOrders, storageKey])

  // Hydrate from the server-persisted notification store so a fresh browser or a
  // previously-offline admin catches up on stored order events, not only live WS ones.
  // Read state is now per-admin server-side, so item.read reflects THIS admin only.
  useEffect(() => {
    if (!canViewOrders) return undefined
    let active = true
    fetchAdminNotifications()
      .then(({ items: serverItems }) => {
        if (!active) return
        setLoadError(false)
        if (serverItems.length === 0) return
        setItems((prev) => {
          const prevByKey = new Map(prev.map((it) => [keyOf(it), it]))
          const merged = new Map()
          // server items carry this admin's own read flag (authoritative)
          for (const it of serverItems) {
            const local = prevByKey.get(keyOf(it))
            merged.set(keyOf(it), local?.read ? { ...it, read: true } : it)
          }
          // keep local items the server did not return (live WS not yet persisted, read history)
          for (const it of prev) {
            if (!merged.has(keyOf(it))) merged.set(keyOf(it), it)
          }
          const next = [...merged.values()].sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS)
          persist(storageKey, next)
          return next
        })
      })
      .catch(() => {
        // Trước đây nuốt lỗi hoàn toàn: ô trống trông như "chưa có thông báo".
        // Vẫn giữ được item trong localStorage, chỉ đánh dấu lỗi để panel báo rõ.
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [canViewOrders, storageKey])

  const unread = items.reduce((n, it) => n + (it.read ? 0 : 1), 0)

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((it) => (it.read ? it : { ...it, read: true }))
      persist(storageKey, next)
      return next
    })
    // Sync to the server so the unread state stays cleared across browsers and reloads.
    // Server chỉ dời mốc đã-đọc của RIÊNG tài khoản này (AUD-018/019) — không ảnh hưởng admin khác.
    markAllAdminNotificationsRead().catch(() => {
      // id: gộp toast trùng khi mở lại panel lúc offline (không xếp chồng vô hạn).
      toast.error(
        t('notifications.syncError', { defaultValue: 'Không đồng bộ được trạng thái đã đọc.' }),
        { id: 'notif-sync-error', duration: 6000 },
      )
    })
  }, [t, storageKey])

  // Radix quản lý focus/keyboard/đóng-mở; chỉ cần chạy logic snapshot khi MỞ.
  const handleOpenChange = useCallback(
    (next) => {
      if (next) {
        if (unread > 0) {
          setSeenUnread(new Set(items.filter((it) => !it.read).map((it) => it.id)))
          markAllRead()
        } else {
          setSeenUnread(new Set())
        }
      }
      setOpen(next)
    },
    [unread, items, markAllRead],
  )

  // Xoá danh sách cục bộ (lịch sử đã đọc trong trình duyệt này). Backend V102 chưa có
  // endpoint xoá nên đây là thao tác dọn cục bộ; item đã được đánh dấu đã đọc khi mở
  // panel nên badge không sáng lại. preventDefault để menu không đóng sau khi dọn.
  function clearAll() {
    setItems([])
    persist(storageKey, [])
  }

  function openOrder(item) {
    if (item.orderId) navigate(`/admin/orders/${item.orderId}`)
  }

  // Không có quyền đọc đơn → không hiển thị chuông (AUD-017).
  if (!canViewOrders) return null

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('notifications.bellLabel')}
          className="relative text-secondary-foreground hover:text-foreground"
        >
          <Bell size={18} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold leading-none text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <strong className="text-sm font-semibold text-foreground">
            {t('notifications.panelTitle')}
          </strong>
          {items.length > 0 && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                clearAll()
              }}
              className="h-auto rounded-[var(--admin-radius-control)] px-2 py-1 text-xs font-medium text-muted-foreground focus:text-primary"
            >
              {t('notifications.clearAll')}
            </DropdownMenuItem>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              {loadError ? (
                <>
                  <AlertCircle size={22} className="text-danger" aria-hidden="true" />
                  <p className="text-sm text-danger">
                    {t('notifications.loadError', {
                      defaultValue: 'Không tải được thông báo. Vui lòng thử lại.',
                    })}
                  </p>
                </>
              ) : (
                <>
                  <Check size={22} className="text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
                </>
              )}
            </div>
          ) : (
            items.map((item) => {
              const fresh = seenUnread.has(item.id)
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => openOrder(item)}
                  className={cn(
                    'flex items-start gap-3 rounded-none border-b border-border px-4 py-3 last:border-b-0',
                    fresh && 'bg-surface-selected',
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-selected text-primary">
                    <ShoppingCart size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="block text-sm font-semibold text-foreground">
                        {item.type === 'NEW_ORDER'
                          ? t('notifications.newOrder')
                          : t('notifications.orderUpdate')}
                      </span>
                      {fresh && (
                        <>
                          <span
                            className="inline-block size-1.5 shrink-0 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                          <span className="sr-only">{t('notifications.unread')}</span>
                        </>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.orderNumber ||
                        t('notifications.unknownOrder', { defaultValue: 'Đơn hàng' })}
                      {item.customerName ? ` — ${item.customerName}` : ''}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.total ? `${formatCurrencyVnd(item.total)} · ` : ''}
                      {formatWhen(item.at, i18n.language)}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
