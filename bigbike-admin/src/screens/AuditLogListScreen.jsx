import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAuditLogs } from '../lib/adminApi'
import { formatDateTimeWithSeconds } from '../lib/formatters'

// ── Actions that are dangerous — shown with a warning indicator ────────────────
const DANGEROUS_ACTIONS = new Set([
  'ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_REFUND_CREATED',
  'PRODUCT_DELETED', 'COUPON_DELETED', 'CUSTOMER_DELETED',
  'CATEGORY_DELETED', 'BRAND_DELETED', 'MEDIA_DELETED', 'MEDIA_HARD_DELETED',
  'MENU_ITEM_DELETED', 'ROLE_DELETED',
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
    t('auditLog.actorType.ADMIN'),
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
const RESOURCE_OPTIONS = ['ALL', 'ORDER', 'PRODUCT', 'CATEGORY', 'BRAND', 'INVENTORY', 'COUPON', 'CUSTOMER', 'SETTING', 'MEDIA', 'MENU', 'CONTENT', 'ROLE', 'ADMIN_USER']
const PRESET_KEYS      = ['today', '7d', '30d', 'month']

function readQueryFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search)
    return {
      actorType:    p.get('actorType')    || 'ALL',
      resourceType: p.get('resourceType') || 'ALL',
      q:            p.get('q')            || '',
      from:         p.get('from')         || '',
      to:           p.get('to')           || '',
      page:         Number(p.get('page')) || 1,
      pageSize:     Number(p.get('pageSize')) || 20,
      detail:       p.get('detail')       || null,
    }
  } catch {
    return null
  }
}

const INITIAL_QUERY = {
  actorType: 'ALL', resourceType: 'ALL',
  q: '', from: '', to: '', page: 1, pageSize: 20, detail: null,
}

function buildInitialQuery() {
  return readQueryFromUrl() || INITIAL_QUERY
}

function pushQueryToUrl(query) {
  try {
    const p = new URLSearchParams()
    if (query.actorType    !== 'ALL') p.set('actorType',    query.actorType)
    if (query.resourceType !== 'ALL') p.set('resourceType', query.resourceType)
    if (query.q)     p.set('q',    query.q)
    if (query.from)  p.set('from', query.from)
    if (query.to)    p.set('to',   query.to)
    if (query.page   !== 1)  p.set('page',     String(query.page))
    if (query.pageSize !== 20) p.set('pageSize', String(query.pageSize))
    if (query.detail) p.set('detail', query.detail)
    const qs = p.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''))
  } catch { /* ignore */ }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModuleBadge({ resourceType }) {
  const { t } = useTranslation()
  const TONE_MAP = {
    ORDER: 'info', PRODUCT: 'success', CATEGORY: 'neutral', BRAND: 'neutral',
    INVENTORY: 'warning', COUPON: 'warning', CUSTOMER: 'neutral', SETTING: 'danger',
    MEDIA: 'neutral', MENU: 'neutral', CONTENT: 'neutral', ROLE: 'danger', ADMIN_USER: 'neutral',
  }
  const tone = TONE_MAP[resourceType] || 'neutral'
  const label = t(`auditLog.module.${resourceType}`, { defaultValue: resourceType || t('auditLog.module.OTHER') })
  return <span className={`status-badge status-${tone}`}>{label}</span>
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
  return <span style={{ color: 'var(--admin-color-text-muted)' }}>—</span>
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
  const closeRef = useRef(null)
  const isDangerous = DANGEROUS_ACTIONS.has(log.action)
  const hasRaw = !!(log.beforeData || log.afterData)
  const [showRaw, setShowRaw] = useState(false)

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

  useEffect(() => { closeRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className="audit-drawer-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      aria-hidden="false"
    >
      <aside className="audit-drawer" role="dialog" aria-modal="true" aria-labelledby="audit-drawer-title">
        <div className="audit-drawer-header">
          <h2 id="audit-drawer-title" className="audit-drawer-title">
            {t('auditLog.drawerTitle')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label={t('auditLog.drawerClose')}
            style={{ padding: '0.2rem 0.55rem', fontSize: '1rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {displayName
                  ? <strong style={{ fontSize: '0.875rem' }}>{displayName}</strong>
                  : <span style={{ fontSize: '0.875rem', color: 'var(--admin-color-text-muted)', fontStyle: 'italic' }}>
                      {actorFallback}
                    </span>
                }
                {log.actorType && log.actorType !== 'ADMIN' && (
                  <span className="status-badge status-neutral" style={{ fontSize: '0.72rem' }}>
                    {t(`auditLog.actorType.${log.actorType}`, { defaultValue: log.actorType })}
                  </span>
                )}
              </div>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerActionLabel')}>
              <strong>{actionLabel}</strong>
            </DetailRow>

            <DetailRow label={t('auditLog.drawerModuleLabel')}>
              <span className={`status-badge status-${moduleTone}`}>{moduleLabel}</span>
            </DetailRow>

            {(log.resourceCode || log.resourceDisplayName || log.resourceId) && (
              <DetailRow label={t('auditLog.drawerEntityLabel')}>
                <strong style={{ fontSize: '0.875rem' }}>
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
                <span aria-hidden="true" style={{ marginLeft: 4 }}>{showRaw ? '▲' : '▼'}</span>
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
                      <p className="audit-tech-label" style={{ marginTop: '0.75rem' }}>{t('auditLog.drawerAfter')}</p>
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
      </aside>
    </div>
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
        <span className={`status-badge status-${moduleTone}`} style={{ fontSize: '0.72rem' }}>
          {moduleLabel}
        </span>
        <span>{actorName}</span>
        {resourceLabel && (
          <span className="audit-resource-label" style={{ fontSize: '0.75rem' }}>{resourceLabel}</span>
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
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '0.2rem 0.55rem' }}>✕</button>
        </div>
        <div className="audit-mobile-filter-body">
          <label>
            <span>{t('auditLog.filterSearch')}</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                className="control-input"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onSearch(); onClose() } }}
                placeholder={t('auditLog.filterSearchPlaceholder')}
              />
              <button type="button" className="btn btn-secondary" onClick={() => { onSearch(); onClose() }}>
                {t('auditLog.mobileSearchBtn')}
              </button>
            </div>
          </label>

          <label>
            <span>{t('auditLog.filterModule')}</span>
            <select className="control-select" value={query.resourceType}
              onChange={(e) => onUpdate({ resourceType: e.target.value }, { resetPage: true })}>
              <option value="ALL">{t('common.all')}</option>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <option key={r} value={r}>{t(`auditLog.module.${r}`, { defaultValue: r })}</option>
              ))}
            </select>
          </label>

          <label>
            <span>{t('auditLog.filterActorType')}</span>
            <select className="control-select" value={query.actorType}
              onChange={(e) => onUpdate({ actorType: e.target.value }, { resetPage: true })}>
              <option value="ALL">{t('common.all')}</option>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <option key={a} value={a}>{t(`auditLog.actorType.${a}`, { defaultValue: a })}</option>
              ))}
            </select>
          </label>

          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
              {t('auditLog.filterQuickTime')}
            </span>
            <div className="audit-preset-chips">
              {PRESET_KEYS.map((key) => (
                <button key={key} type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset(key)}>
                  {t(`auditLog.preset.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1 }}>
              <span>{t('auditLog.filterFrom')}</span>
              <input className="control-input" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              <span>{t('auditLog.filterTo')}</span>
              <input className="control-input" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={applyDates}>
            {t('auditLog.mobileFilterApplyDates')}
          </button>

          {isFiltered && (
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { onReset(); onClose() }}>
              {t('auditLog.mobileFilterResetAll')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function AuditLogListScreen() {
  const { t } = useTranslation()
  const initialQuery = useMemo(buildInitialQuery, [])
  const [query, setQuery]             = useState(initialQuery)
  const [searchInput, setSearchInput] = useState(() => initialQuery.q)
  const [state, setState]             = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [activePreset, setActivePreset] = useState(null)
  const [showMobileFilter, setShowMobileFilter] = useState(false)

  // #6: deep-link for detail drawer — restore from URL on mount
  const [selectedLog, setSelectedLog] = useState(null)

  const isFiltered = query.actorType !== 'ALL' || query.resourceType !== 'ALL' || !!query.q || !!query.from || !!query.to
  const activeFilterCount = [
    query.actorType    !== 'ALL',
    query.resourceType !== 'ALL',
    !!query.q,
    !!query.from || !!query.to,
  ].filter(Boolean).length

  useEffect(() => {
    pushQueryToUrl(query)
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchAuditLogs(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' })
        // Restore detail drawer from URL on initial load
        if (query.detail) {
          const match = r.items.find((item) => item.id === query.detail)
          if (match) setSelectedLog(match)
        }
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }, [])

  function handleSearch() {
    updateQuery({ q: searchInput }, { resetPage: true })
  }

  function handleReset() {
    setSearchInput('')
    setActivePreset(null)
    setQuery({ ...INITIAL_QUERY })
  }

  function handlePreset(preset) {
    setActivePreset(preset)
    const { from, to } = getDatePreset(preset)
    updateQuery({ from, to }, { resetPage: true })
  }

  function handleRowClick(log) {
    setSelectedLog(log)
    // #6: update URL with detail id
    updateQuery({ detail: log.id })
  }

  function handleCloseDrawer() {
    setSelectedLog(null)
    updateQuery({ detail: null })
  }

  function handleExport() {
    if (state.items.length === 0) return
    exportToCsv(state.items, t)
  }

  const totalItems = state.pagination?.totalItems

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('auditLog.eyebrow')}</p>
          <h1>{t('auditLog.title')}</h1>
          <p style={{ color: 'var(--admin-color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {t('auditLog.description')}
          </p>
        </div>
        <div className="audit-header-actions">
          {/* #5: Refresh button removed — WebSocket keeps data live */}
          {/* #8: Export button with tooltip showing row count */}
          <button
            type="button"
            className="btn btn-secondary"
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
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {/* ── Desktop filter bar — 2-row layout (#3) ── */}
      <section className="filter-bar audit-filter-bar">
        {/* Row 1: search + module + actor + page size */}
        <div className="audit-filter-row">
          <label className="audit-filter-search-group">
            <span>{t('auditLog.filterSearch')}</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                className="control-input"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('auditLog.filterSearchPlaceholder')}
                style={{ minWidth: 220 }}
              />
              <button type="button" className="btn btn-secondary" onClick={handleSearch}>
                {t('auditLog.filterQuickSearch')}
              </button>
            </div>
          </label>

          <label>
            <span>{t('auditLog.filterModule')}</span>
            <select
              className="control-select"
              value={query.resourceType}
              onChange={(e) => updateQuery({ resourceType: e.target.value }, { resetPage: true })}
            >
              <option value="ALL">{t('common.all')}</option>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <option key={r} value={r}>{t(`auditLog.module.${r}`, { defaultValue: r })}</option>
              ))}
            </select>
          </label>

          <label>
            <span>{t('auditLog.filterActorType')}</span>
            <select
              className="control-select"
              value={query.actorType}
              onChange={(e) => updateQuery({ actorType: e.target.value }, { resetPage: true })}
            >
              <option value="ALL">{t('common.all')}</option>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <option key={a} value={a}>{t(`auditLog.actorType.${a}`, { defaultValue: a })}</option>
              ))}
            </select>
          </label>

          {/* #11: Page size switcher */}
          <label>
            <span>{t('auditLog.pageSizeLabel')}</span>
            <select
              className="control-select"
              value={query.pageSize}
              onChange={(e) => updateQuery({ pageSize: Number(e.target.value), page: 1 })}
            >
              {[20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        {/* Row 2: date presets + date pickers + clear */}
        <div className="audit-filter-row audit-filter-row--dates">
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>
              {t('auditLog.filterQuickTime')}
            </span>
            <div className="audit-preset-chips">
              {PRESET_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-secondary btn-sm${activePreset === key ? ' audit-preset-active' : ''}`}
                  onClick={() => handlePreset(key)}
                >
                  {t(`auditLog.preset.${key}`)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <label>
              <span>{t('auditLog.filterFrom')}</span>
              <input
                className="control-input"
                type="date"
                value={query.from}
                onChange={(e) => { setActivePreset(null); updateQuery({ from: e.target.value }, { resetPage: true }) }}
              />
            </label>
            <label>
              <span>{t('auditLog.filterTo')}</span>
              <input
                className="control-input"
                type="date"
                value={query.to}
                onChange={(e) => { setActivePreset(null); updateQuery({ to: e.target.value }, { resetPage: true }) }}
              />
            </label>
            {isFiltered && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                style={{ alignSelf: 'flex-end' }}
              >
                {t('auditLog.resetFilters')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Mobile filter toggle — #10: hidden at ≤900px via CSS ── */}
      <div className="audit-mobile-filter-toggle">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowMobileFilter(true)}
        >
          {t('auditLog.mobileFilterLabel')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        {query.q && (
          <span className="audit-mobile-search-chip">
            "{query.q}"
            <button type="button" onClick={() => { setSearchInput(''); updateQuery({ q: '' }, { resetPage: true }) }} aria-label={t('auditLog.resetFilters')}>✕</button>
          </span>
        )}
        {isFiltered && (
          <button type="button" className="btn btn-secondary" onClick={handleReset} style={{ fontSize: '0.8rem' }}>
            {t('auditLog.resetFilters')}
          </button>
        )}
      </div>

      {/* ── Results summary bar ── */}
      {state.status === 'success' && totalItems != null && totalItems > 0 && (
        <div className="audit-summary-bar">
          <span
            dangerouslySetInnerHTML={{
              __html: t('auditLog.summaryFound', { count: totalItems.toLocaleString('vi-VN') })
                + (isFiltered ? ` ${t('auditLog.summaryFiltered')}` : ''),
            }}
          />
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
                    <div className="skeleton-cell" style={{ width: '60%', height: 14, marginBottom: 8, borderRadius: 4 }} />
                    <div className="skeleton-cell" style={{ width: '40%', height: 12, borderRadius: 4 }} />
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
    </section>
  )
}
