import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchAuditLogs } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

const ACTOR_OPTIONS = ['ALL', 'ADMIN', 'CUSTOMER', 'SYSTEM']
const RESOURCE_OPTIONS = ['ALL', 'ORDER', 'PRODUCT', 'CATEGORY', 'BRAND', 'CONTENT', 'COUPON', 'MEDIA', 'MENU', 'CUSTOMER', 'SETTING']

const INITIAL_QUERY = { actorType: 'ALL', resourceType: 'ALL', action: '', from: '', to: '', page: 1, pageSize: 20 }

function DataCell({ value }) {
  const [expanded, setExpanded] = useState(false)
  if (!value) return <span style={{ color: 'var(--admin-color-text-muted)' }}>—</span>
  const preview = value.length > 60 ? value.slice(0, 60) + '…' : value
  return (
    <span>
      <code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{expanded ? value : preview}</code>
      {value.length > 60 && (
        <button type="button" onClick={() => setExpanded((p) => !p)}
          style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--admin-color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {expanded ? 'Thu gọn' : 'Xem'}
        </button>
      )}
    </span>
  )
}

export function AuditLogListScreen() {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [actionInput, setActionInput] = useState('')
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })

  useEffect(() => {
    let active = true
    fetchAuditLogs(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  const columns = useMemo(() => [
    { key: 'createdAt', label: t('auditLog.colTime'), render: (r) => formatDateTime(r.createdAt) },
    { key: 'actor', label: t('auditLog.colActor'), render: (r) => (
      <span>
        <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>{r.actorType || '—'}</span>
        {r.actorId && <code style={{ fontSize: '0.7rem', marginLeft: 4, display: 'block', color: 'var(--admin-color-text-muted)' }}>{r.actorId}</code>}
      </span>
    )},
    { key: 'action', label: t('auditLog.colAction'), render: (r) => <code style={{ fontSize: '0.78rem', fontWeight: 600 }}>{r.action}</code> },
    { key: 'resource', label: t('auditLog.colResource'), render: (r) => (
      <span>
        <span className="status-badge status-neutral" style={{ fontSize: '0.7rem' }}>{r.resourceType || '—'}</span>
        {r.resourceId && <code style={{ fontSize: '0.68rem', display: 'block', color: 'var(--admin-color-text-muted)', marginTop: 2 }}>{r.resourceId}</code>}
      </span>
    )},
    { key: 'before', label: t('auditLog.colBefore'), render: (r) => <DataCell value={r.beforeData} /> },
    { key: 'after', label: t('auditLog.colAfter'), render: (r) => <DataCell value={r.afterData} /> },
  ], [t])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function handleActionSearch() {
    updateQuery({ action: actionInput }, { resetPage: true })
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('auditLog.eyebrow')}</p>
          <h1>{t('auditLog.title')}</h1>
          <p>{t('auditLog.description')}</p>
        </div>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <section className="filter-bar">
        <label>{t('auditLog.filterActor')}
          <select className="control-select" value={query.actorType}
            onChange={(e) => updateQuery({ actorType: e.target.value }, { resetPage: true })}>
            {ACTOR_OPTIONS.map((a) => (
              <option key={a} value={a}>{a === 'ALL' ? t('common.all') : a}</option>
            ))}
          </select>
        </label>
        <label>{t('auditLog.filterResource')}
          <select className="control-select" value={query.resourceType}
            onChange={(e) => updateQuery({ resourceType: e.target.value }, { resetPage: true })}>
            {RESOURCE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r === 'ALL' ? t('common.all') : r}</option>
            ))}
          </select>
        </label>
        <label>{t('auditLog.filterAction')}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input className="control-input" type="text" value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleActionSearch()}
              placeholder={t('auditLog.filterActionPlaceholder')} />
            <button type="button" className="btn btn-secondary" onClick={handleActionSearch}>
              {t('common.search')}
            </button>
          </div>
        </label>
        <label>{t('auditLog.filterFrom')}
          <input className="control-input" type="date" value={query.from}
            onChange={(e) => updateQuery({ from: e.target.value }, { resetPage: true })} />
        </label>
        <label>{t('auditLog.filterTo')}
          <input className="control-input" type="date" value={query.to}
            onChange={(e) => updateQuery({ to: e.target.value }, { resetPage: true })} />
        </label>
        <button type="button" className="btn btn-secondary"
          onClick={() => { setActionInput(''); setQuery(INITIAL_QUERY) }}>
          {t('common.resetFilters')}
        </button>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('auditLog.error')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('auditLog.empty')} description={t('auditLog.emptyDesc')} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('auditLog.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && (
            <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
          )}
        </>
      ) : null}
    </section>
  )
}
