import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Package, Search, ShoppingCart, Users } from 'lucide-react'
import { fetchCustomers, fetchOrders, fetchProducts } from '../lib/adminApi'
import { formatCurrencyVnd, formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const MIN_CHARS = 2
const PER_GROUP = 5

const GROUP_META = {
  orders: { icon: ShoppingCart },
  products: { icon: Package },
  customers: { icon: Users },
}

// Topbar global search — a ⌘K command palette that fans a debounced query out
// to the existing orders / products / customers list endpoints (no new API),
// scoped to the modules the signed-in admin can actually open.
export function GlobalSearch({ navigate, visiblePaths }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState({ orders: [], products: [], customers: [] })
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const reqIdRef = useRef(0)
  const debounced = useDebounce(term, 220)

  const canOrders = visiblePaths.has('/admin/orders')
  const canProducts = visiblePaths.has('/admin/products')
  const canCustomers = visiblePaths.has('/admin/customers')

  const close = useCallback(() => {
    setOpen(false)
    setTerm('')
    setResults({ orders: [], products: [], customers: [] })
    setActiveIndex(0)
  }, [])

  // ⌘K / Ctrl+K toggles the palette; Esc closes it.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 20)
      return () => clearTimeout(id)
    }
  }, [open])

  // Fan-out search — latest request wins; failures degrade to empty per group.
  // All state writes are deferred out of the effect body via queueMicrotask so
  // they don't run as synchronous cascading renders (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return undefined
    const q = debounced.trim()
    let cancelled = false

    if (q.length < MIN_CHARS) {
      queueMicrotask(() => {
        if (cancelled) return
        setResults({ orders: [], products: [], customers: [] })
        setLoading(false)
      })
      return () => { cancelled = true }
    }

    const myId = ++reqIdRef.current
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      const listQuery = { search: q, page: 1, pageSize: PER_GROUP }
      Promise.all([
        canOrders ? fetchOrders(listQuery).then((r) => r.items || []).catch(() => []) : Promise.resolve([]),
        canProducts ? fetchProducts(listQuery).then((r) => r.items || []).catch(() => []) : Promise.resolve([]),
        canCustomers ? fetchCustomers(listQuery).then((r) => r.items || []).catch(() => []) : Promise.resolve([]),
      ]).then(([orders, products, customers]) => {
        if (myId !== reqIdRef.current) return
        setResults({ orders, products, customers })
        setActiveIndex(0)
        setLoading(false)
      })
    })
    return () => { cancelled = true }
  }, [debounced, open, canOrders, canProducts, canCustomers])

  // Flatten every result row into one list so ↑/↓ can move across groups.
  const flat = useMemo(() => {
    const rows = []
    results.orders.forEach((o) => rows.push({
      group: 'orders', key: `o-${o.id}`, to: `/admin/orders/${o.id}`,
      primary: formatText(o.orderNumber), secondary: formatText(o.customerName || o.customerEmail),
      trailing: formatCurrencyVnd(o.total),
    }))
    results.products.forEach((p) => rows.push({
      group: 'products', key: `p-${p.id}`, to: `/admin/products/${p.id}`,
      primary: formatText(p.name), secondary: formatText(p.sku, 'SKU TBD'),
    }))
    results.customers.forEach((c) => rows.push({
      group: 'customers', key: `c-${c.id}`, to: `/admin/customers/${c.id}`,
      primary: formatText(c.fullName), secondary: formatText(c.email || c.phone),
    }))
    return rows
  }, [results])

  const go = useCallback((to) => { close(); navigate(to) }, [close, navigate])

  function onInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (flat.length ? Math.min(i + 1, flat.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = flat[activeIndex]
      if (hit) go(hit.to)
    }
  }

  const hasQuery = debounced.trim().length >= MIN_CHARS
  const groupOrder = ['orders', 'products', 'customers']

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-[320px] items-center gap-2 rounded-sm border border-border bg-surface-muted px-3 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:flex"
        aria-label={t('search.open')}
      >
        <Search size={15} className="shrink-0" />
        <span className="flex-1 truncate text-left text-sm">{t('search.placeholder')}</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh]"
          style={{ zIndex: 'var(--z-modal)' }}
          role="dialog"
          aria-modal="true"
          aria-label={t('search.title')}
        >
          <div
            className="fixed inset-0"
            style={{ background: 'var(--admin-color-overlay)' }}
            onClick={close}
            aria-hidden="true"
          />
          <div
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface"
            style={{ boxShadow: 'var(--admin-shadow-lg)' }}
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              {loading
                ? <Loader2 size={17} className="shrink-0 animate-spin text-muted-foreground" />
                : <Search size={17} className="shrink-0 text-muted-foreground" />}
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t('search.placeholder')}
                className="h-12 flex-1 border-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Esc</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-1.5">
              {!hasQuery && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('search.hint')}</p>
              )}
              {hasQuery && !loading && flat.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('search.empty')}</p>
              )}
              {hasQuery && groupOrder.map((group) => {
                const groupRows = flat.filter((r) => r.group === group)
                if (!groupRows.length) return null
                const GroupIcon = GROUP_META[group].icon
                return (
                  <div key={group} className="mb-1 last:mb-0">
                    <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t(`search.group.${group}`)}
                    </p>
                    {groupRows.map((row) => {
                      const flatIndex = flat.indexOf(row)
                      const isActive = flatIndex === activeIndex
                      return (
                        <button
                          key={row.key}
                          type="button"
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => go(row.to)}
                          className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors ${
                            isActive ? 'bg-surface-selected' : 'hover:bg-surface-muted'
                          }`}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-surface-muted text-muted-foreground">
                            <GroupIcon size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {row.primary}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.secondary}
                            </span>
                          </span>
                          {row.trailing && (
                            <span className="shrink-0 text-xs font-semibold text-foreground">
                              {row.trailing}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
