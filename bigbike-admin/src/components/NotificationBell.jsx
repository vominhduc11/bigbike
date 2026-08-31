import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bell, Check, Clock, PackageX, ShoppingCart } from 'lucide-react'
import { registerAdminWsReconnectListener, subscribeAdminWs } from '../lib/adminWebSocket'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const MAX_ITEMS = 30

// Cache localStorage tách theo TỪNG tài khoản admin (AUD-017): trước đây mọi tài khoản
// dùng chung 1 key 'bb-admin-notifications', logout không xoá → đăng nhập tài khoản khác
// trên cùng trình duyệt đọc được thông báo (số đơn/khách/giá trị) của tài khoản trước,
// kể cả khi tài khoản mới không có quyền orders.read. Namespace theo email → cô lập.
function storageKeyFor(identity, scopes) {
  return `bb-admin-notifications:v2:${identity || 'anon'}:${scopes}`
}

// Dedupe key shared by WS events and server-persisted items: an order can raise both
// a NEW_ORDER and later ORDER_UPDATE event, so key on orderId + type.
function keyOf(it) {
  if (it.orderId) return `${it.orderId}:${it.type}`
  return `id:${it.id}`
}

function loadStored(storageKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey))
    return Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

// Mốc bấm "Xoá tất cả" của riêng tài khoản này trên trình duyệt này. Kho thông báo phía
// máy chủ dùng chung cho mọi admin nên không thể xoá thật; thiếu mốc này thì lần nạp lại
// kế tiếp lại kéo nguyên danh sách vừa dọn về, trông như nút không ăn.
function clearedAtKey(storageKey) {
  return `${storageKey}:cleared-at`
}

function loadClearedAt(storageKey) {
  const raw = Number(localStorage.getItem(clearedAtKey(storageKey)))
  return Number.isFinite(raw) ? raw : 0
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

function digestDateLabel(value) {
  const [year, month, day] = String(value || '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function localizedName(item, language) {
  const english = String(language || '')
    .toLowerCase()
    .startsWith('en')
  return english ? item?.nameEn || item?.nameVi || '—' : item?.nameVi || item?.nameEn || '—'
}

function ageLabel(item, t) {
  const days = Math.max(0, Number(item?.outOfStockDays) || 0)
  if (item?.outOfStockSinceEstimated) {
    return t('notifications.estimatedAge', { days })
  }
  return days === 0 ? t('notifications.outToday') : t('notifications.outDays', { count: days })
}

function ProductEditLink({ item, language, navigate, onClose, children }) {
  const href = item?.editPath || `/admin/products/${item?.productId || ''}`
  function handleClick(event) {
    if (!navigate) return
    event.preventDefault()
    onClose()
    navigate(href)
  }
  return (
    <a
      href={href}
      onClick={handleClick}
      className="block focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {children || localizedName(item, language)}
    </a>
  )
}

function InventoryDigestDialog({ item, language, navigate, onOpenChange, t }) {
  const digest = item?.digest || {}
  const full = Array.isArray(digest.fullyOutOfStock) ? digest.fullyOutOfStock : []
  const partial = Array.isArray(digest.partiallyOutOfStock) ? digest.partiallyOutOfStock : []
  const counts = digest.counts || {}
  const close = () => onOpenChange(false)

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border pr-14">
          <DialogTitle>{t('notifications.inventoryDigest')}</DialogTitle>
          <DialogDescription>
            {t('notifications.digestDate', { date: digestDateLabel(digest.digestDate) })}
            {' · '}
            {t('notifications.digestDialogDescription')}
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-2 text-xs font-semibold">
            <span className="rounded-[var(--admin-radius-control)] bg-surface-muted px-3 py-2 text-foreground">
              {t('notifications.fullyOutTitle')}:{' '}
              {Number(counts.fullyOutOfStockProducts) || full.length}
            </span>
            <span className="rounded-[var(--admin-radius-control)] bg-surface-muted px-3 py-2 text-foreground">
              {t('notifications.partiallyOutTitle')}:{' '}
              {Number(counts.partiallyOutOfStockProducts) || partial.length}
            </span>
            <span className="rounded-[var(--admin-radius-control)] bg-surface-muted px-3 py-2 text-foreground">
              {t('notifications.unavailableVariants', {
                count: Number(counts.unavailableVariants) || 0,
              })}
            </span>
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
          <section aria-labelledby="fully-out-heading">
            <div className="mb-3">
              <h3
                id="fully-out-heading"
                className="m-0 text-sm font-bold uppercase text-foreground"
              >
                {t('notifications.fullyOutTitle')}
              </h3>
              <p className="mb-0 mt-1 text-xs text-muted-foreground">
                {t('notifications.fullyOutDescription')}
              </p>
            </div>
            <div className="space-y-2">
              {full.map((product) => (
                <ProductEditLink
                  key={product.productId}
                  item={product}
                  language={language}
                  navigate={navigate}
                  onClose={close}
                >
                  <span className="flex flex-col gap-2 rounded-[var(--admin-radius-control)] border border-border bg-card px-4 py-3 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {localizedName(product, language)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t('notifications.sku')}: {product.sku || '—'}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {ageLabel(product, t)}
                    </span>
                  </span>
                </ProductEditLink>
              ))}
            </div>
          </section>

          <section aria-labelledby="partially-out-heading">
            <div className="mb-3">
              <h3
                id="partially-out-heading"
                className="m-0 text-sm font-bold uppercase text-foreground"
              >
                {t('notifications.partiallyOutTitle')}
              </h3>
              <p className="mb-0 mt-1 text-xs text-muted-foreground">
                {t('notifications.partiallyOutDescription')}
              </p>
            </div>
            <div className="space-y-3">
              {partial.map((product) => {
                const variants = Array.isArray(product.unavailableVariants)
                  ? product.unavailableVariants
                  : []
                return (
                  <div
                    key={product.productId}
                    className="overflow-hidden rounded-[var(--admin-radius-card)] border border-border bg-card"
                  >
                    <ProductEditLink
                      item={product}
                      language={language}
                      navigate={navigate}
                      onClose={close}
                    >
                      <span className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3 hover:bg-surface-hover">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {localizedName(product, language)}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t('notifications.sku')}: {product.sku || '—'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {ageLabel(product, t)}
                        </span>
                      </span>
                    </ProductEditLink>
                    <div className="divide-y divide-border">
                      {variants.map((variant) => (
                        <ProductEditLink
                          key={variant.variantId}
                          item={product}
                          language={language}
                          navigate={navigate}
                          onClose={close}
                        >
                          <span className="flex flex-col gap-1 px-4 py-3 pl-7 hover:bg-surface-hover sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm text-foreground">
                              {localizedName(variant, language)}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {t('notifications.sku')}: {variant.sku || '—'}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {ageLabel(variant, t)}
                            </span>
                          </span>
                        </ProductEditLink>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Topbar notification centre — accumulates the order events that already
// arrive over the admin WebSocket (the same feed OrderNotificationToast uses),
// so the admin keeps a persistent, catch-up list instead of only fleeting toasts.
export function NotificationBell({ navigate }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const hasPermission = useHasPermission()
  const canViewOrders = hasPermission('orders.read')
  const canViewInventory = hasPermission('inventory.read')
  const canViewNotifications = canViewOrders || canViewInventory
  const scopes =
    [canViewOrders ? 'orders' : null, canViewInventory ? 'inventory' : null]
      .filter(Boolean)
      .join('+') || 'none'
  const storageKey = storageKeyFor(user?.email, scopes)
  const [items, setItems] = useState(() => (canViewNotifications ? loadStored(storageKey) : []))
  const [open, setOpen] = useState(false)
  const [selectedDigest, setSelectedDigest] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)
  // Lỗi khi nạp danh sách từ server (V102): dùng để phân biệt "chưa có thông báo"
  // với "không tải được" thay vì nuốt lỗi im lặng.
  const [loadError, setLoadError] = useState(false)
  // The server count covers the full retained backlog, while `items` is intentionally
  // capped at MAX_ITEMS for the dropdown. Keep this separate so the badge never
  // undercounts notifications outside the 30 displayed rows.
  const [serverUnreadCount, setServerUnreadCount] = useState(null)
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
    setSelectedDigest(null)
    setItems(canViewNotifications ? loadStored(storageKey) : [])
    setServerUnreadCount(null)
  }

  useEffect(() => {
    if (!canViewNotifications) return undefined
    const unsubscribers = []
    const addItem = (event) => {
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
      // A live event arrives after the last server snapshot. Keep the exact server
      // baseline and add only this newly observed event until the next refresh.
      setServerUnreadCount((current) => (current === null ? current : current + 1))
    }
    if (canViewOrders) {
      unsubscribers.push(
        subscribeAdminWs('/topic/admin/orders', (event) => {
          if (event?.orderId || event?.type === 'ORDER_OVERDUE_DIGEST') {
            addItem({
              ...event,
              at: event?.timestamp ? new Date(event.timestamp).getTime() : Date.now(),
            })
          }
        }),
      )
    }
    if (canViewInventory) {
      unsubscribers.push(
        subscribeAdminWs('/topic/admin/inventory', (event) => {
          if (event?.type === 'INVENTORY_OUT_OF_STOCK_DIGEST_READY') {
            setRefreshToken((current) => current + 1)
          }
        }),
      )
    }
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [canViewNotifications, canViewOrders, canViewInventory, storageKey])

  // Hydrate from the server-persisted notification store so a fresh browser or a
  // previously-offline admin catches up on stored order events, not only live WS ones.
  // Read state is now per-admin server-side, so item.read reflects THIS admin only.
  useEffect(() => {
    if (!canViewNotifications) return undefined
    let active = true
    const hydrate = () =>
      fetchAdminNotifications()
        .then(({ items: serverItems, unreadCount: fetchedUnreadCount }) => {
          if (!active) return
          setLoadError(false)
          setServerUnreadCount(
            Number.isFinite(fetchedUnreadCount) && fetchedUnreadCount >= 0
              ? fetchedUnreadCount
              : null,
          )
          if (serverItems.length === 0) return
          setItems((prev) => {
            const prevByKey = new Map(prev.map((it) => [keyOf(it), it]))
            const merged = new Map()
            // server items carry this admin's own read flag (authoritative)
            const clearedAt = loadClearedAt(storageKey)
            for (const it of serverItems) {
              if (it.at <= clearedAt) continue
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

    hydrate()
    // Máy ngủ / rớt mạng: sự kiện phát ra trong lúc đứt kết nối KHÔNG được gửi bù qua
    // realtime, nên chỉ nghe tiếp là mất luôn phần đó cho tới lần tải lại trang. Nối lại
    // được thì nạp lại kho thông báo để bắt kịp (cùng cách useAdminPresence đang dùng).
    const removeReconnectListener = registerAdminWsReconnectListener(hydrate)
    return () => {
      active = false
      removeReconnectListener()
    }
  }, [canViewNotifications, storageKey, refreshToken])

  const localUnread = items.reduce((n, it) => n + (it.read ? 0 : 1), 0)
  // Once the server has answered, its count is authoritative even when the local
  // dropdown only retains/displays the newest 30 rows. Before that, use the account-
  // scoped cache so the bell remains useful during the request or offline.
  const unread = serverUnreadCount ?? localUnread

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((it) => (it.read ? it : { ...it, read: true }))
      persist(storageKey, next)
      return next
    })
    // Sync to the server so the unread state stays cleared across browsers and reloads.
    // Server chỉ dời mốc đã-đọc của RIÊNG tài khoản này (AUD-018/019) — không ảnh hưởng admin khác.
    markAllAdminNotificationsRead()
      .then(({ unreadCount: remaining }) => {
        setServerUnreadCount(Number.isFinite(remaining) && remaining >= 0 ? remaining : 0)
      })
      .catch(() => {
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

  // Xoá danh sách trong trình duyệt này. Kho V102 dùng chung mọi admin nên không có
  // endpoint xoá; ghi lại mốc xoá để các lần nạp sau bỏ qua đúng phần đã dọn, chỉ hiện
  // thông báo mới hơn. preventDefault để menu không đóng sau khi dọn.
  function clearAll() {
    setItems([])
    persist(storageKey, [])
    try {
      localStorage.setItem(clearedAtKey(storageKey), String(Date.now()))
    } catch {
      /* quota / private mode — danh sách vẫn dọn trong phiên này */
    }
  }

  function openNotification(item) {
    if (item.type === 'INVENTORY_OUT_OF_STOCK_DIGEST') {
      setSelectedDigest(item)
    } else if (item.type === 'ORDER_OVERDUE_DIGEST') {
      navigate('/admin/orders?orderScope=OPERATIONAL&orderStatus=PENDING&attention=OVERDUE')
    } else if (item.orderId) {
      navigate(`/admin/orders/${item.orderId}`)
    }
  }

  if (!canViewNotifications) return null

  return (
    <>
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
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center whitespace-nowrap rounded-full bg-primary px-1 text-xs font-bold leading-none text-primary-foreground">
                {unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
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
                const isOverdueDigest = item.type === 'ORDER_OVERDUE_DIGEST'
                const isInventoryDigest = item.type === 'INVENTORY_OUT_OF_STOCK_DIGEST'
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => openNotification(item)}
                    className={cn(
                      'flex items-start gap-3 rounded-none border-b border-border px-4 py-3 last:border-b-0',
                      fresh && 'bg-surface-selected',
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-selected text-primary">
                      {isInventoryDigest ? (
                        <PackageX size={15} aria-hidden="true" />
                      ) : isOverdueDigest ? (
                        <Clock size={15} aria-hidden="true" />
                      ) : (
                        <ShoppingCart size={15} aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block text-sm font-semibold text-foreground">
                          {isInventoryDigest
                            ? t('notifications.inventoryDigest')
                            : isOverdueDigest
                              ? t('notifications.overdueDigestTitle')
                              : item.type === 'NEW_ORDER'
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
                        {isInventoryDigest ? (
                          t('notifications.inventoryDigestSummary', {
                            full: Number(item.digest?.counts?.fullyOutOfStockProducts) || 0,
                            partial: Number(item.digest?.counts?.partiallyOutOfStockProducts) || 0,
                          })
                        ) : isOverdueDigest ? (
                          t('notifications.overdueDigestDescription', {
                            count: item.count,
                            days: item.thresholdDays,
                          })
                        ) : (
                          <>
                            {item.orderNumber ||
                              t('notifications.unknownOrder', { defaultValue: 'Đơn hàng' })}
                            {item.customerName ? ` — ${item.customerName}` : ''}
                          </>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {!isOverdueDigest && !isInventoryDigest && item.total
                          ? `${formatCurrencyVnd(item.total)} · `
                          : ''}
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
      <InventoryDigestDialog
        item={selectedDigest}
        language={i18n.language}
        navigate={navigate}
        t={t}
        onOpenChange={(next) => {
          if (!next) setSelectedDigest(null)
        }}
      />
    </>
  )
}
