import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Award,
  FileText,
  FolderTree,
  Loader2,
  Package,
  Search,
  Shield,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { fetchAdminQuickSearch } from '../lib/adminApi'
import { formatCurrencyVnd, formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { useDialogA11y } from '../lib/useDialogA11y'
import { StatePanel } from './StatePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MIN_CHARS = 1
const EMPTY_GROUPS = {}

const GROUP_DEFS = [
  { key: 'orders', path: '/admin/orders', icon: ShoppingCart },
  { key: 'products', path: '/admin/products', icon: Package },
  { key: 'customers', path: '/admin/customers', icon: Users },
  { key: 'categories', path: '/admin/categories', icon: FolderTree },
  { key: 'brands', path: '/admin/brands', icon: Award },
  { key: 'articles', path: '/admin/content', icon: FileText },
  { key: 'adminUsers', path: '/admin/admin-users', icon: Shield },
]

function foldSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase()
}

function detectShortcutLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl K'
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘K' : 'Ctrl K'
}

/** Accent-insensitive highlighting that keeps the original Vietnamese text visible. */
function highlightText(value, query, fallback = '—') {
  const text = formatText(value, fallback)
  const normalized = foldSearchText(text)
  const normalizedToOriginal = []
  let originalOffset = 0

  for (const character of Array.from(text)) {
    const foldedCharacter = foldSearchText(character)
    Array.from(foldedCharacter).forEach(() => {
      normalizedToOriginal.push({ start: originalOffset, end: originalOffset + character.length })
    })
    originalOffset += character.length
  }

  const tokens = [...new Set(foldSearchText(query).trim().split(/\s+/).filter(Boolean))]
  const ranges = []
  tokens.forEach((token) => {
    let startAt = 0
    while (startAt < normalized.length) {
      const foundAt = normalized.indexOf(token, startAt)
      if (foundAt < 0) break
      const endAt = foundAt + token.length - 1
      const start = normalizedToOriginal[foundAt]?.start
      const end = normalizedToOriginal[endAt]?.end
      if (start !== undefined && end !== undefined) ranges.push({ start, end })
      startAt = foundAt + Math.max(1, token.length)
    }
  })

  if (!ranges.length) return text

  ranges.sort((left, right) => left.start - right.start || left.end - right.end)
  const merged = []
  ranges.forEach((range) => {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
  })

  const output = []
  let cursor = 0
  merged.forEach((range, index) => {
    if (range.start > cursor) output.push(text.slice(cursor, range.start))
    output.push(
      <mark key={`match-${index}`} className="bg-primary-subtle font-semibold text-primary">
        {text.slice(range.start, range.end)}
      </mark>,
    )
    cursor = range.end
  })
  if (cursor < text.length) output.push(text.slice(cursor))
  return output
}

function listRoute(path, query) {
  const params = new URLSearchParams({ search: query })
  return `${path}?${params.toString()}`
}

function detailRoute(group, id, query) {
  if (!id) return listRoute(group.path, query)
  if (group.key === 'articles') return `/admin/content/article/${id}`
  if (group.key === 'adminUsers') return listRoute(group.path, query)
  return `${group.path}/${id}`
}

function uniqueNonBlank(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))]
}

function variantText(variant) {
  if (!variant || typeof variant !== 'object') return ''
  const options = Array.isArray(variant.options)
    ? variant.options
      .map((option) => [option?.name, option?.value].filter(Boolean).join(': '))
      .filter(Boolean)
      .join(', ')
    : ''
  return [variant.sku, variant.name, options].filter(Boolean).join(' · ')
}

function makeResultRow(group, item, query, t) {
  const source = item && typeof item === 'object' ? item : {}
  if (group.key === 'orders') {
    const names = uniqueNonBlank([source.customerName, source.shippingRecipientName])
    const contacts = uniqueNonBlank([source.customerEmail, source.customerPhone])
    return {
      group: group.key,
      key: `${group.key}-${source.id}`,
      to: detailRoute(group, source.id, query),
      primaryText: formatText(source.orderNumber),
      secondaryText: [...names, ...contacts].join(' · '),
      trailing: source.totalAmount == null ? '' : formatCurrencyVnd(source.totalAmount),
    }
  }
  if (group.key === 'products') {
    const matchedVariants = Array.isArray(source.matchedVariants)
      ? source.matchedVariants.map(variantText).filter(Boolean)
      : []
    return {
      group: group.key,
      key: `${group.key}-${source.id}`,
      to: detailRoute(group, source.id, query),
      primaryText: formatText(source.name),
      secondaryText: matchedVariants.join(' | ') || formatText(source.sku, t('search.skuTbd')),
    }
  }
  if (group.key === 'customers') {
    return {
      group: group.key,
      key: `${group.key}-${source.id}`,
      to: detailRoute(group, source.id, query),
      primaryText: formatText(source.displayName, source.email || source.phone || '—'),
      secondaryText: uniqueNonBlank([source.email, source.phone]).join(' · '),
    }
  }
  if (group.key === 'articles') {
    return {
      group: group.key,
      key: `${group.key}-${source.id}`,
      to: detailRoute(group, source.id, query),
      primaryText: formatText(source.title),
      secondaryText: formatText(source.slug),
    }
  }
  if (group.key === 'adminUsers') {
    return {
      group: group.key,
      key: `${group.key}-${source.id}`,
      to: detailRoute(group, source.id, query),
      primaryText: formatText(source.displayName, source.email),
      secondaryText: uniqueNonBlank([source.email, source.role]).join(' · '),
    }
  }
  return {
    group: group.key,
    key: `${group.key}-${source.id}`,
    to: detailRoute(group, source.id, query),
    primaryText: formatText(source.name),
    secondaryText: formatText(source.slug),
  }
}

// Ô tìm kiếm nhanh ở topbar. Kết quả được trả bởi một API có phạm vi quyền,
// mỗi nhóm giữ trạng thái riêng để lỗi một nhóm không che lấp nhóm còn lại.
export function GlobalSearch({ navigate, visiblePaths }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState(EMPTY_GROUPS)
  const [loading, setLoading] = useState(false)
  const [requestError, setRequestError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [shortcutLabel] = useState(detectShortcutLabel)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)
  const listRef = useRef(null)
  const reqIdRef = useRef(0)
  const debounced = useDebounce(term, 300)

  const visibleGroups = useMemo(
    () => GROUP_DEFS.filter((group) => visiblePaths?.has?.(group.path)),
    [visiblePaths],
  )
  const visibleGroupKey = visibleGroups.map((group) => group.key).join(',')

  const close = useCallback(() => {
    setOpen(false)
    setTerm('')
    setResults(EMPTY_GROUPS)
    setActiveIndex(0)
    setRequestError(false)
  }, [])

  useDialogA11y(dialogRef, { active: open, onClose: close })

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (open) close()
        else setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return undefined
    inputRef.current?.focus()
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`#bb-search-opt-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, open])

  useEffect(() => {
    if (!open) return undefined
    const query = debounced.trim()
    let cancelled = false

    if (query.length < MIN_CHARS) {
      queueMicrotask(() => {
        if (cancelled) return
        setResults(EMPTY_GROUPS)
        setRequestError(false)
        setLoading(false)
      })
      return () => { cancelled = true }
    }

    const requestId = ++reqIdRef.current
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setRequestError(false)
      fetchAdminQuickSearch(query)
        .then((response) => {
          if (cancelled || requestId !== reqIdRef.current) return
          setResults(response?.groups || EMPTY_GROUPS)
          setActiveIndex(0)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled || requestId !== reqIdRef.current) return
          setResults(EMPTY_GROUPS)
          setRequestError(true)
          setActiveIndex(0)
          setLoading(false)
        })
    })
    return () => { cancelled = true }
  }, [debounced, open, visibleGroupKey])

  const flat = useMemo(() => {
    const rows = []
    visibleGroups.forEach((group) => {
      const result = results[group.key]
      if (!result || result.state === 'ERROR') return
      const query = debounced.trim()
      ;(Array.isArray(result.items) ? result.items : []).forEach((item) => {
        rows.push(makeResultRow(group, item, query, t))
      })
      if (Number(result.total) > 0) {
        rows.push({
          group: group.key,
          key: `${group.key}-view-all`,
          to: listRoute(group.path, query),
          primaryText: t('search.viewAll', { count: Number(result.total) }),
          secondaryText: '',
          isViewAll: true,
        })
      }
    })
    return rows
  }, [results, t, debounced, visibleGroups])

  const go = useCallback((to) => {
    close()
    navigate(to)
  }, [close, navigate])

  function onInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => flat.length ? Math.min(index + 1, flat.length - 1) : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const hit = flat[activeIndex]
      if (hit) go(hit.to)
    }
  }

  if (!visibleGroups.length) return null

  const hasQuery = debounced.trim().length >= MIN_CHARS
  const resultGroups = visibleGroups.filter((group) => results[group.key])

  return (
    <>
      <Button
        variant="unstyled"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-full max-w-xs items-center gap-2 rounded-[var(--admin-radius-control)] border border-border bg-surface-muted px-3 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:flex"
        aria-label={t('search.open')}
      >
        <Search size={15} className="shrink-0" />
        <span className="flex-1 truncate text-left text-sm">{t('search.placeholder')}</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs font-semibold">{shortcutLabel}</kbd>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t('search.open')}
        className="md:hidden"
      >
        <Search size={18} aria-hidden="true" />
      </Button>

      {open && createPortal(
        <div
          ref={dialogRef}
          className="fixed inset-0 flex items-start justify-center px-4 pt-20 sm:pt-24"
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
            className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-[var(--admin-radius-card)] border border-border bg-surface"
            style={{ boxShadow: 'var(--admin-shadow-lg)' }}
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              {loading
                ? <Loader2 size={17} className="shrink-0 animate-spin text-muted-foreground" />
                : <Search size={17} className="shrink-0 text-muted-foreground" />}
              <Input
                ref={inputRef}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t('search.placeholder')}
                className="h-12 flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                role="combobox"
                aria-expanded={hasQuery && flat.length > 0}
                aria-controls="bb-search-listbox"
                aria-activedescendant={hasQuery && flat.length > 0 ? `bb-search-opt-${activeIndex}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
              />
              <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">Esc</kbd>
            </div>

            <div ref={listRef} id="bb-search-listbox" role="listbox" aria-label={t('search.title')} className="max-h-[52vh] overflow-y-auto p-1.5">
              {!hasQuery && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('search.hint')}</p>
              )}
              {hasQuery && loading && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="status">{t('search.loading')}</p>
              )}
              {hasQuery && !loading && requestError && (
                <div className="p-2">
                  <StatePanel
                    tone="danger"
                    title={t('search.errorTitle')}
                    description={t('search.errorBody')}
                  />
                </div>
              )}
              {hasQuery && !loading && !requestError && !resultGroups.length && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('search.empty')}</p>
              )}
              {hasQuery && !loading && !requestError && resultGroups.map((group) => {
                const result = results[group.key]
                const groupRows = flat.filter((row) => row.group === group.key)
                const GroupIcon = group.icon
                const numericTotal = Number(result.total)
                const total = result.total !== null && result.total !== undefined
                  && Number.isFinite(numericTotal)
                  ? Math.max(0, numericTotal)
                  : null
                return (
                  <div key={group.key} className="mb-2 last:mb-0">
                    <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <span>{t(`search.group.${group.key}`)}</span>
                      {result.state === 'READY' && total !== null ? <span>{total}</span> : null}
                    </div>
                    {result.state === 'ERROR' ? (
                      <StatePanel
                        tone="danger"
                        title={t('search.groupErrorTitle')}
                        description={t('search.groupErrorBody')}
                        className="px-4 py-4"
                      />
                    ) : groupRows.length ? (
                      groupRows.map((row) => {
                        const flatIndex = flat.findIndex((candidate) => candidate.key === row.key)
                        const isActive = flatIndex === activeIndex
                        return (
                          <Button
                            variant="unstyled"
                            key={row.key}
                            id={`bb-search-opt-${flatIndex}`}
                            role="option"
                            aria-selected={isActive}
                            tabIndex={-1}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            onClick={() => go(row.to)}
                            className={cn(
                              'flex min-h-11 w-full items-center gap-2.5 rounded-[var(--admin-radius-control)] px-2.5 py-2 text-left transition-colors',
                              isActive ? 'bg-surface-selected' : 'hover:bg-surface-muted',
                            )}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] bg-surface-muted text-muted-foreground">
                              <GroupIcon size={15} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm ${row.isViewAll ? 'font-semibold text-primary' : 'font-semibold text-foreground'}`}>
                                {row.isViewAll ? row.primaryText : highlightText(row.primaryText, debounced)}
                              </span>
                              {row.secondaryText ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {highlightText(row.secondaryText, debounced)}
                                </span>
                              ) : null}
                            </span>
                            {row.trailing ? (
                              <span className="shrink-0 text-xs font-semibold text-foreground">{row.trailing}</span>
                            ) : null}
                          </Button>
                        )
                      })
                    ) : (
                      <p className="px-2.5 py-2 text-xs text-muted-foreground">{t('search.groupEmpty')}</p>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
              {t('search.keyboardHint')}
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
