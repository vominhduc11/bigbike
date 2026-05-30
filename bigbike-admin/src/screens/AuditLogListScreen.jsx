import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAuditLogs } from '../lib/adminApi'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { formatDateTimeWithSeconds } from '../lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ── Actions that are dangerous — shown with a warning indicator ────────────────
const DANGEROUS_ACTIONS = new Set([
  'ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_REFUND_CREATED',
  'PRODUCT_DELETED', 'PRODUCT_SOFT_DELETED',
  'COUPON_DELETED', 'CUSTOMER_DELETED',
  'CATEGORY_DELETED', 'CATEGORY_SOFT_DELETED',
  'BRAND_DELETED', 'BRAND_SOFT_DELETED',
  'MEDIA_DELETED', 'MEDIA_HARD_DELETED',
  'MENU_ITEM_DELETED', 'ROLE_DELETED', 'REDIRECT_DELETED',
  'CONTENT_ARTICLE_DELETED', 'CONTENT_PAGE_DELETED',
])

// Values considered dangerous in diff table (shown with danger highlight)
const DANGEROUS_VALUES = new Set([
  'CANCELLED', 'REFUNDED', 'FAILED', 'BANNED', 'SUSPENDED',
])

// ── Date preset helper ─────────────────────────────────────────────────────────
function getDatePreset(preset) {
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const todayStr = fmt(today)

  if (preset === 'today') return { from: todayStr, to: todayStr }
  if (preset === '7d') {
    const from = new Date(today); from.setDate(from.getDate() - 6)
    return { from: fmt(from), to: todayStr }
  }
  if (preset === '30d') {
    const from = new Date(today); from.setDate(from.getDate() - 29)
    return { from: fmt(from), to: todayStr }
  }
  if (preset === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: fmt(from), to: todayStr }
  }
  return { from: '', to: '' }
}

function toBadgeVariant(tone) {
  return tone === 'neutral' ? 'muted' : tone
}

// ── Diff helpers ───────────────────────────────────────────────────────────────
function tryParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function buildCsvRow(log, t) {
  const actor = log.actorDisplayName || log.actorEmail || t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType || '' })
  const actorType = t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType || '' })
  const action = t(`auditLog.action.${log.action}`, { defaultValue: log.action || '' })
  const module = t(`auditLog.module.${log.resourceType}`, { defaultValue: log.resourceType || '' })
  const entity = log.resourceCode || log.resourceDisplayName || log.resourceId || ''
  return [formatDateTimeWithSeconds(log.createdAt), actor, actorType, action, module, entity]
}

function exportToCsv(items, t) {
  const headers = [
    t('auditLog.colTime'),
    t('auditLog.colActor'),
    t('auditLog.filterActorType'),
    t('auditLog.colAction'),
    t('auditLog.colModule'),
    t('auditLog.colEntity'),
  ]
  const rows = items.map((log) => buildCsvRow(log, t))
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const bom = '﻿'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Filter constants ───────────────────────────────────────────────────────────
const ACTOR_OPTIONS    = ['ALL', 'ADMIN', 'CUSTOMER', 'SYSTEM']
const RESOURCE_OPTIONS = [
  'ALL',
  'ORDER', 'PRODUCT', 'CATEGORY', 'BRAND', 'INVENTORY',
  'COUPON', 'CUSTOMER', 'CONTENT', 'MEDIA', 'MENU', 'MENU_ITEM',
  'SITE_SETTING', 'ADMIN_ROLE', 'ADMIN_USER', 'REDIRECT',
  'REVIEW', 'RECEIVABLE', 'REPORT',
]
const PRESET_KEYS      = ['today', '7d', '30d', 'month']

const INITIAL_QUERY = {
  actorType: 'ALL', resourceType: 'ALL',
  q: '', from: '', to: '', page: 1, pageSize: 20,
}

function setDetailParam(id) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('detail', id)
  else url.searchParams.delete('detail')
  window.history.replaceState(null, '', url.toString())
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModuleBadge({ resourceType }) {
  const { t } = useTranslation()
  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', COUPON: 'warning', CUSTOMER: 'neutral', SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ROLE: 'danger', ADMIN_USER: 'neutral', REDIRECT: 'warning',
  }
  const tone = TONE_MAP[resourceType] || 'neutral'
  const label = t(`auditLog.module.${resourceType}`, { defaultValue: resourceType || t('auditLog.module.OTHER') })
  return <Badge variant={toBadgeVariant(tone)}>{label}</Badge>
}

function ActorCell({ log }) {
  const { t } = useTranslation()
  const displayName = log.actorDisplayName || log.actorEmail || null
  const fallback = t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('auditLog.actorType.ADMIN') })
  const actorTypeLabel = log.actorType && log.actorType !== 'ADMIN'
    ? t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType })
    : null

  return (
    <div className="audit-actor-cell">
      {displayName
        ? <span className="audit-actor-name">
            {displayName}
            {actorTypeLabel && <span className="audit-actor-type"> ({actorTypeLabel})</span>}
          </span>
        : <span className="audit-actor-unknown">{fallback}</span>
      }
    </div>
  )
}

function ResourceCell({ log }) {
  const label = log.resourceCode || log.resourceDisplayName || null
  if (label) return <span className="audit-resource-label">{label}</span>
  if (log.resourceId) {
    // #9: show raw ID instead of "ID #abc123" prefix — just the short hex
    return <span className="audit-resource-label audit-resource-id" title={log.resourceId}>{log.resourceId.slice(0, 8)}</span>
  }
  return <span className="text-muted-foreground">—</span>
}

function ActionLabel({ action }) {
  const { t } = useTranslation()
  const isDangerous = DANGEROUS_ACTIONS.has(action)
  // #9: fall back to raw code in parens rather than generic "other activity"
  const label = action
    ? t(`auditLog.action.${action}`, { defaultValue: null }) ?? t('auditLog.actionOther', { code: action })
    : '—'

  return (
    <span className={`audit-action-label${isDangerous ? ' audit-action-danger' : ''}`}>
      {isDangerous && <span className="audit-danger-icon" aria-label={label}>⚠</span>}
      {label}
    </span>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="audit-detail-row">
      <span className="audit-detail-label">{label}</span>
      <span className="audit-detail-value">{children}</span>
    </div>
  )
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────

function AuditDetailDrawer({ log, onClose }) {
  const { t } = useTranslation()
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)
  const hasRaw = !!(log.beforeData || log.afterData)
  const [showRaw, setShowRaw] = useState(false)

  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', COUPON: 'warning', CUSTOMER: 'neutral', SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ROLE: 'danger', ADMIN_USER: 'neutral', REDIRECT: 'warning',
  }
  const moduleTone = TONE_MAP[log.resourceType] || 'neutral'
  const moduleLabel = t(`auditLog.module.${log.resourceType}`, { defaultValue: log.resourceType || t('auditLog.module.OTHER') })
  const actionLabel = log.action
    ? t(`auditLog.action.${log.action}`, { defaultValue: null }) ?? t('auditLog.actionOther', { code: log.action })
    : '—'
  const displayName = log.actorDisplayName || log.actorEmail || null
  const actorFallback = t(`auditLog.actorType.${log.actorType}`, { defaultValue: t('auditLog.actorType.ADMIN') })

  const diff = useMemo(() => {
    const before = log.beforeData ? tryParse(log.beforeData) : null
    const after  = log.afterData  ? tryParse(log.afterData)  : null
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return null
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changes = []
    for (const key of allKeys) {
      if (String(before[key]) !== String(after[key])) {
        const mapVal = (v) => {
          if (v === null || v === undefined) return '—'
          const str = String(v)
          return t(`auditLog.value.${str}`, { defaultValue: str })
        }
        changes.push({
          key,
          label: t(`auditLog.field.${key}`, { defaultValue: key }),
          before: mapVal(before[key]),
          after:  mapVal(after[key]),
          rawAfter: String(after[key] ?? ''),
        })
      }
    }
    return changes
  }, [log.beforeData, log.afterData, t])

  return (
    <Modal
      open={Boolean(log)}
      onClose={onClose}
      title={t('auditLog.drawerTitle')}
      closeLabel={t('auditLog.drawerClose')}
      wide
    >
      <div className="-mx-5 -my-4">
        <div className="audit-drawer-body">
          {isDangerous && (
            <div className="audit-danger-banner">
              ⚠ {t('auditLog.drawerDangerBanner')}
            </div>
          )}

          <div className="audit-detail-section">
            <DetailRow label={t('auditLog.drawerTimeLabel')}>
              <time title={log.createdAt}>{formatDateTimeWithSeconds(log.createdAt)}</time>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActorLabel')}>
              <div className="flex flex-wrap items-center gap-1.5">
                {displayName
                  ? <strong className="text-sm">{displayName}</strong>
                  : <span className="text-sm italic text-muted-foreground">{actorFallback}</span>
                }
                {log.actorType && log.actorType !== 'ADMIN' && (
                  <Badge variant="muted" className="text-xs">
                    {t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType })}
                  </Badge>
                )}
              </div>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActionLabel')}>
              <strong>{actionLabel}</strong>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerModuleLabel')}>
              <Badge variant={toBadgeVariant(moduleTone)}>{moduleLabel}</Badge>
            </DetailRow>

            {(log.resourceCode || log.resourceDisplayName || log.resourceId) && (
              <DetailRow label={t('auditLog.drawerEntityLabel')}>
                <strong className="text-sm">
                  {log.resourceCode || log.resourceDisplayName || log.resourceId?.slice(0, 8)}
                </strong>
              </DetailRow>
            )}
          </div>

          <div className="audit-drawer-section">
            <h3 className="audit-drawer-section-title">{t('auditLog.drawerChangesLabel')}</h3>
            {(!diff || diff.length === 0) && (
              <p className="audit-no-changes">{t('auditLog.drawerNoChanges')}</p>
            )}
            {diff && diff.length > 0 && (
              <table className="audit-diff-table">
                <thead>
                  <tr>
                    <th>{t('auditLog.drawerFieldCol')}</th>
                    <th>{t('auditLog.drawerBefore')}</th>
                    <th>{t('auditLog.drawerAfter')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((row) => {
                    const isDangerousAfter = DANGEROUS_VALUES.has(row.rawAfter)
                    return (
                      <tr key={row.key}>
                        <td className="audit-diff-field">{row.label}</td>
                        <td className="audit-diff-before">{row.before}</td>
                        <td className={`audit-diff-after${isDangerousAfter ? ' audit-diff-after--danger' : ''}`}>{row.after}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* #2: Raw JSON panel — only shown if data exists; hidden for non-dev but togglable */}
          {hasRaw && (
            <div className="audit-drawer-section">
              <button
                type="button"
                className="audit-tech-toggle"
                onClick={() => setShowRaw((p) => !p)}
                aria-expanded={showRaw}
              >
                {t('auditLog.drawerTechData')}
                <span aria-hidden="true" className="ml-1">{showRaw ? '▲' : '▼'}</span>
              </button>
              {showRaw && (
                <div className="audit-tech-body">
                  {log.beforeData && (
                    <>
                      <p className="audit-tech-label">{t('auditLog.drawerBefore')}</p>
                      <pre className="audit-tech-pre">
                        {JSON.stringify(tryParse(log.beforeData) ?? log.beforeData, null, 2)}
                      </pre>
                    </>
                  )}
                  {log.afterData && (
                    <>
                      <p className="audit-tech-label mt-3">{t('auditLog.drawerAfter')}</p>
                      <pre className="audit-tech-pre">
                        {JSON.stringify(tryParse(log.afterData) ?? log.afterData, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Mobile audit card ──────────────────────────────────────────────────────────

function AuditCard({ log, onClick }) {
  const { t } = useTranslation()
  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', COUPON: 'warning', CUSTOMER: 'neutral', SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ROLE: 'danger', ADMIN_USER: 'neutral',
  }
  const moduleTone = TONE_MAP[log.resourceType] || 'neutral'
  const moduleLabel = t(`auditLog.module.${log.resourceType}`, { defaultValue: log.resourceType || t('auditLog.module.OTHER') })
  const actionLabel = log.action
    ? t(`auditLog.action.${log.action}`, { defaultValue: null }) ?? t('auditLog.actionOther', { code: log.action })
    : '—'
  const actorName = log.actorDisplayName || log.actorEmail || t(`auditLog.actorType.${log.actorType}`, { defaultValue: '' })
  const resourceLabel = log.resourceCode || log.resourceDisplayName || null
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)

  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }

  return (
    <div
      className={`audit-card${isDangerous ? ' audit-card--danger' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-label={`${actionLabel}, ${formatDateTimeWithSeconds(log.createdAt)}`}
    >
      <div className="audit-card-top">
        <span className="audit-card-action">
          {isDangerous && <span className="audit-danger-icon" aria-hidden="true">⚠ </span>}
          {actionLabel}
        </span>
        <time className="audit-card-time" title={log.createdAt}>
          {formatDateTimeWithSeconds(log.createdAt)}
        </time>
      </div>
      <div className="audit-card-meta">
        <Badge variant={toBadgeVariant(moduleTone)} className="text-xs">
          {moduleLabel}
        </Badge>
        <span>{actorName}</span>
        {resourceLabel && (
          <span className="audit-resource-label text-xs">{resourceLabel}</span>
        )}
      </div>
      <div className="audit-card-chevron" aria-hidden="true">›</div>
    </div>
  )
}

// ── Mobile Filter Drawer ───────────────────────────────────────────────────────

function MobileFilterDrawer({ query, searchInput, onSearch, setSearchInput, onUpdate, onReset, onClose, isFiltered }) {
  const { t } = useTranslation()
  const [localFrom, setLocalFrom] = useState(query.from)
  const [localTo, setLocalTo]     = useState(query.to)

  function applyDates() {
    onUpdate({ from: localFrom, to: localTo }, { resetPage: true })
    onClose()
  }

  function applyPreset(preset) {
    const { from, to } = getDatePreset(preset)
    setLocalFrom(from)
    setLocalTo(to)
    onUpdate({ from, to }, { resetPage: true })
    onClose()
  }

  return (
    <div className="audit-mobile-filter-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="audit-mobile-filter-sheet">
        <div className="audit-mobile-filter-header">
          <strong>{t('auditLog.mobileFilterLabel')}</strong>
          <Button variant="outline" size="icon" onClick={onClose}>✕</Button>
        </div>
        <div className="audit-mobile-filter-body">
          <label>
            <span>{t('auditLog.filterSearch')}</span>
            <div className="flex gap-1.5">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onSearch(); onClose() } }}
                placeholder={t('auditLog.filterSearchPlaceholder')}
               />
              <Button variant="outline" onClick={() => { onSearch(); onClose() }}>
                {t('auditLog.mobileSearchBtn')}
              </Button>
            </div>
          </label>

          <label>
            <span>{t('auditLog.filterModule')}</span>
            <Select value={query.resourceType}
              onValueChange={(val) => onUpdate({ resourceType: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <SelectItem key={r} value={r}>{t(`auditLog.module.${r}`, { defaultValue: r })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          <label>
            <span>{t('auditLog.filterActorType')}</span>
            <Select value={query.actorType}
              onValueChange={(val) => onUpdate({ actorType: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <SelectItem key={a} value={a}>{t(`auditLog.actorType.${a}`, { defaultValue: a })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium">
              {t('auditLog.filterQuickTime')}
            </span>
            <div className="audit-preset-chips">
              {PRESET_KEYS.map((key) => (
                <Button key={key} variant="outline" size="sm" onClick={() => applyPreset(key)}>
                  {t(`auditLog.preset.${key}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex-1">
              <span>{t('auditLog.filterFrom')}</span>
              <Input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)}  />
            </label>
            <label className="flex-1">
              <span>{t('auditLog.filterTo')}</span>
              <Input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)}  />
            </label>
          </div>
          <Button className="w-full" onClick={applyDates}>
            {t('auditLog.mobileFilterApplyDates')}
          </Button>

          {isFiltered && (
            <Button variant="outline" className="w-full" onClick={() => { onReset(); onClose() }}>
              {t('auditLog.mobileFilterResetAll')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function AuditLogListScreen() {
  const { t } = useTranslation()
  const initialQuery = useMemo(() => readQueryFromUrl(INITIAL_QUERY), [])
  const [query, setQuery]             = useState(initialQuery)
  const [searchInput, setSearchInput] = useState(() => initialQuery.q)
  const [state, setState]             = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [activePreset, setActivePreset] = useState(null)
  const [showMobileFilter, setShowMobileFilter] = useState(false)

  // deep-link: read detail id from URL once on mount (does not trigger fetch)
  const [initialDetailId] = useState(
    () => new URLSearchParams(window.location.search).get('detail')
  )
  const [selectedLog, setSelectedLog] = useState(null)

  const isFiltered = query.actorType !== 'ALL' || query.resourceType !== 'ALL' || !!query.q || !!query.from || !!query.to
  const activeFilterCount = [
    query.actorType    !== 'ALL',
    query.resourceType !== 'ALL',
    !!query.q,
    !!query.from || !!query.to,
  ].filter(Boolean).length

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    let active = true
    fetchAuditLogs(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: '' })
        // Restore detail drawer from URL deep-link on initial load
        if (initialDetailId) {
          const match = r.items.find((item) => item.id === initialDetailId)
          if (match) setSelectedLog(match)
        }
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query])

  const columns = useMemo(() => [
    {
      key: 'createdAt',
      label: t('auditLog.colTime'),
      render: (r) => <time className="audit-col-time" title={r.createdAt}>{formatDateTimeWithSeconds(r.createdAt)}</time>,
    },
    {
      key: 'actor',
      label: t('auditLog.colActor'),
      render: (r) => <ActorCell log={r} />,
    },
    {
      key: 'action',
      label: t('auditLog.colAction'),
      render: (r) => <ActionLabel action={r.action} />,
    },
    {
      key: 'module',
      label: t('auditLog.colModule'),
      render: (r) => <ModuleBadge resourceType={r.resourceType} />,
    },
    {
      key: 'entity',
      label: t('auditLog.colEntity'),
      render: (r) => <ResourceCell log={r} />,
    },
  ], [t])

  const updateQuery = useCallback((partial, options = { resetPage: false }) => {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }, [])

  function handleSearch() {
    setState((p) => ({ ...p, status: 'loading' }))
    updateQuery({ q: searchInput }, { resetPage: true })
  }

  function handleReset() {
    setSearchInput('')
    setActivePreset(null)
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery({ ...INITIAL_QUERY })
  }

  function handlePreset(preset) {
    setActivePreset(preset)
    const { from, to } = getDatePreset(preset)
    updateQuery({ from, to }, { resetPage: true })
  }

  function handleRowClick(log) {
    setSelectedLog(log)
    setDetailParam(log.id)
  }

  function handleCloseDrawer() {
    setSelectedLog(null)
    setDetailParam(null)
  }

  function handleExport() {
    if (state.items.length === 0) return
    exportToCsv(state.items, t)
  }

  const totalItems = state.pagination?.totalItems

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('auditLog.eyebrow')}</p>
          <h1>{t('auditLog.title')}</h1>
          <p className="bb-muted">{t('auditLog.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={handleExport}
            disabled={state.items.length === 0}
            title={
              state.items.length > 0
                ? t('auditLog.exportTooltip', { count: state.items.length })
                : t('auditLog.exportTooltipEmpty')
            }
          >
            ↓ {t('auditLog.exportBtn')}
          </button>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {/* ── Desktop filter bar — 2-row layout (#3) ── */}
      <section className="bb-filter-bar audit-filter-bar">
        {/* Row 1: search + module + actor + page size */}
        <div className="audit-filter-row">
          <label className="audit-filter-search-group">
            <span>{t('auditLog.filterSearch')}</span>
            <div className="flex gap-1.5">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('auditLog.filterSearchPlaceholder')}
                className="min-w-56"
               />
              <Button variant="outline" onClick={handleSearch}>
                {t('auditLog.filterQuickSearch')}
              </Button>
            </div>
          </label>

          <label>
            <span>{t('auditLog.filterModule')}</span>
            <Select
              value={query.resourceType}
              onValueChange={(val) => updateQuery({ resourceType: val }, { resetPage: true })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <SelectItem key={r} value={r}>{t(`auditLog.module.${r}`, { defaultValue: r })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          <label>
            <span>{t('auditLog.filterActorType')}</span>
            <Select
              value={query.actorType}
              onValueChange={(val) => updateQuery({ actorType: val }, { resetPage: true })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <SelectItem key={a} value={a}>{t(`auditLog.actorType.${a}`, { defaultValue: a })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          {/* #11: Page size switcher */}
          <label>
            <span>{t('auditLog.pageSizeLabel')}</span>
            <Select
              value={query.pageSize}
              onValueChange={(val) => updateQuery({ pageSize: Number(val), page: 1 })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {[20, 50, 100].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent></Select>
          </label>
        </div>

        {/* Row 2: date presets + date pickers + clear */}
        <div className="audit-filter-row audit-filter-row--dates">
          <div>
            <span className="block text-sm font-medium mb-1.5">
              {t('auditLog.filterQuickTime')}
            </span>
            <div className="audit-preset-chips">
              {PRESET_KEYS.map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={activePreset === key ? 'audit-preset-active' : undefined}
                  onClick={() => handlePreset(key)}
                >
                  {t(`auditLog.preset.${key}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-end">
            <label>
              <span>{t('auditLog.filterFrom')}</span>
              <Input
                type="date"
                value={query.from}
                onChange={(e) => { setActivePreset(null); updateQuery({ from: e.target.value }, { resetPage: true }) }}
               />
            </label>
            <label>
              <span>{t('auditLog.filterTo')}</span>
              <Input
                type="date"
                value={query.to}
                onChange={(e) => { setActivePreset(null); updateQuery({ to: e.target.value }, { resetPage: true }) }}
               />
            </label>
            {isFiltered && (
              <Button variant="outline" onClick={handleReset} className="self-end">
                {t('auditLog.resetFilters')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Mobile filter toggle — #10: hidden at ≤900px via CSS ── */}
      <div className="audit-mobile-filter-toggle">
        <Button variant="outline" onClick={() => setShowMobileFilter(true)}>
          {t('auditLog.mobileFilterLabel')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
        {query.q && (
          <span className="audit-mobile-search-chip">
            "{query.q}"
            <button type="button" onClick={() => { setSearchInput(''); updateQuery({ q: '' }, { resetPage: true }) }} aria-label={t('auditLog.resetFilters')}>✕</button>
          </span>
        )}
        {isFiltered && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            {t('auditLog.resetFilters')}
          </Button>
        )}
      </div>

      {/* ── Results summary bar ── */}
      {state.status === 'success' && totalItems != null && totalItems > 0 && (
        <div className="audit-summary-bar">
          <span>
            {t('auditLog.summaryFound', { count: totalItems.toLocaleString('vi-VN') })}
            {isFiltered && ` ${t('auditLog.summaryFiltered')}`}
          </span>
        </div>
      )}

      {/* ── Error state ── */}
      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title={t('auditLog.errorLoadTitle')}
          description={state.error}
          actionLabel={t('auditLog.errorRetry')}
          onAction={() => setQuery((p) => ({ ...p }))}
        />
      )}

      {/* ── Empty state ── */}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={isFiltered ? t('auditLog.emptyFiltered') : t('auditLog.empty')}
          description={isFiltered ? t('auditLog.emptyFilteredDesc') : t('auditLog.emptyDesc')}
          {...(isFiltered ? { actionLabel: t('auditLog.resetFilters'), onAction: handleReset } : {})}
        />
      )}

      {/* ── Data ── */}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <div className="audit-table-wrapper">
            <AdminTable
              caption={t('auditLog.tableCaption')}
              columns={columns}
              rows={state.items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={handleRowClick}
              rowClassName={(r) => `audit-table-row${DANGEROUS_ACTIONS.has(r.action) ? ' audit-row-danger' : ''}`}
            />
          </div>

          <div className="audit-card-list" aria-label={t('auditLog.tableCaption')} role="list">
            {state.status === 'loading'
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="audit-card audit-card--skeleton" aria-hidden="true">
                    <div className="skeleton-cell w-3/5 h-3.5 mb-2 rounded" />
                    <div className="skeleton-cell w-2/5 h-3 rounded" />
                  </div>
                ))
              : state.items.map((log) => (
                  <AuditCard key={log.id} log={log} onClick={() => handleRowClick(log)} />
                ))
            }
          </div>

          {state.status === 'success' && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </>
      )}

      {selectedLog && (
        <AuditDetailDrawer log={selectedLog} onClose={handleCloseDrawer} />
      )}

      {showMobileFilter && (
        <MobileFilterDrawer
          query={query}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={handleSearch}
          onUpdate={updateQuery}
          onReset={handleReset}
          onClose={() => setShowMobileFilter(false)}
          isFiltered={isFiltered}
        />
      )}
    </div>
  )
}
