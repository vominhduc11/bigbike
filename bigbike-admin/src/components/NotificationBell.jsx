import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Check, ShoppingCart } from 'lucide-react'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { fetchAdminNotifications, markAllAdminNotificationsRead } from '../lib/adminApi'
import { formatCurrencyVnd } from '../lib/formatters'

const STORAGE_KEY = 'bb-admin-notifications'
const MAX_ITEMS = 30

// Dedupe key shared by WS events and server-persisted items: an order can raise both
// a NEW_ORDER and later ORDER_UPDATE event, so key on orderId + type.
function keyOf(it) {
  return it.orderId ? `${it.orderId}:${it.type}` : `id:${it.id}`
}

function loadStored() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(raw) ? raw.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch { /* quota / private mode — keep working from memory */ }
}

function formatWhen(ts, locale) {
  const d = new Date(ts)
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const sameDay = new Date().toDateString() === d.toDateString()
  return sameDay ? time : `${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })} ${time}`
}

// Topbar notification centre — accumulates the order events that already
// arrive over the admin WebSocket (the same feed OrderNotificationToast uses),
// so the admin keeps a persistent, catch-up list instead of only fleeting toasts.
export function NotificationBell({ navigate }) {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState(loadStored)
  const [open, setOpen] = useState(false)
  // Ids that were unread at the moment the panel was opened. We snapshot them
  // *before* markAllRead() clears the flags, so the open panel can still show a
  // per-row "new" marker for this viewing (the bell badge correctly clears).
  const [seenUnread, setSeenUnread] = useState(() => new Set())
  const wrapRef = useRef(null)

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', (event) => {
      if (!event?.orderId) return
      setItems((prev) => {
        const next = [
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), read: false, ...event },
          ...prev,
        ].slice(0, MAX_ITEMS)
        persist(next)
        return next
      })
    })
    return unsubscribe
  }, [])

  // Hydrate from the server-persisted notification store (V102) so a fresh browser or a
  // previously-offline admin catches up on stored order events, not only live WS ones.
  useEffect(() => {
    let active = true
    fetchAdminNotifications()
      .then(({ items: serverItems }) => {
        if (!active || serverItems.length === 0) return
        setItems((prev) => {
          const prevByKey = new Map(prev.map((it) => [keyOf(it), it]))
          const merged = new Map()
          // server unread items are authoritative; keep a locally-read flag if we have one
          for (const it of serverItems) {
            const local = prevByKey.get(keyOf(it))
            merged.set(keyOf(it), local?.read ? { ...it, read: true } : it)
          }
          // keep local items the server did not return (live WS not yet persisted, read history)
          for (const it of prev) {
            if (!merged.has(keyOf(it))) merged.set(keyOf(it), it)
          }
          const next = [...merged.values()].sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS)
          persist(next)
          return next
        })
      })
      .catch(() => { /* offline / error: keep showing localStorage items (graceful) */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = items.reduce((n, it) => n + (it.read ? 0 : 1), 0)

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const next = prev.map((it) => (it.read ? it : { ...it, read: true }))
      persist(next)
      return next
    })
    // Sync to the server so the unread state stays cleared across browsers and reloads.
    markAllAdminNotificationsRead().catch(() => { /* best-effort, UI already updated */ })
  }, [])

  function toggle() {
    if (!open) {
      // Opening: snapshot which items are unread now, then clear the unread state.
      if (unread > 0) {
        setSeenUnread(new Set(items.filter((it) => !it.read).map((it) => it.id)))
        markAllRead()
      } else {
        setSeenUnread(new Set())
      }
    }
    setOpen((wasOpen) => !wasOpen)
  }

  function clearAll() {
    setItems([])
    persist([])
  }

  function openOrder(item) {
    setOpen(false)
    if (item.orderId) navigate(`/admin/orders/${item.orderId}`)
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t('notifications.bellLabel')}
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-sm text-secondary-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold leading-none text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface"
          style={{ boxShadow: 'var(--admin-shadow-lg)', zIndex: 'var(--z-popup)' }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <strong className="text-sm font-semibold text-foreground">{t('notifications.panelTitle')}</strong>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {t('notifications.clearAll')}
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Check size={22} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
              </div>
            ) : (
              items.map((item) => {
                const fresh = seenUnread.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openOrder(item)}
                    className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-muted${fresh ? ' bg-surface-selected' : ''}`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-selected text-primary">
                      <ShoppingCart size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="block text-sm font-semibold text-foreground">
                          {item.type === 'NEW_ORDER' ? t('notifications.newOrder') : t('notifications.orderUpdate')}
                        </span>
                        {fresh && (
                          <>
                            <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                            <span className="sr-only">{t('notifications.unread')}</span>
                          </>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.orderNumber}{item.customerName ? ` — ${item.customerName}` : ''}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.total ? `${formatCurrencyVnd(item.total)} · ` : ''}{formatWhen(item.at, i18n.language)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
