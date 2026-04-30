import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminTable } from '../components/AdminTable'
import { ExportButton } from '../components/ExportButton'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { exportCustomersCsv, fetchCustomers } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const STATUS_TONES = { ACTIVE: 'success', DISABLED: 'warning', BLOCKED: 'danger', UNKNOWN: 'neutral' }

function CustomerStatusBadge({ value }) {
  const { t } = useTranslation()
  const tone = STATUS_TONES[value] || 'neutral'
  return <span className={`status-badge status-${tone}`}>{t(`status.customer.${value}`, { defaultValue: value })}</span>
}

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }

export function CustomerListScreen({ navigate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })

  useEffect(() => {
    let active = true
    fetchCustomers(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const columns = useMemo(() => [
    {
      key: 'name', label: t('customers.colCustomer'),
      render: (c) => (
        <div>
          <strong>{formatText(c.fullName)}</strong>
          <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{formatText(c.email)}</p>
        </div>
      ),
    },
    { key: 'phone', label: t('customers.colPhone'), render: (c) => formatText(c.phone) },
    { key: 'status', label: t('customers.colStatus'), render: (c) => <CustomerStatusBadge value={c.status} /> },
    { key: 'orderCount', label: t('customers.colOrders'), render: (c) => c.orderCount },
    { key: 'totalSpent', label: t('customers.colSpent'), render: (c) => formatCurrencyVnd(c.totalSpent) },
    { key: 'createdAt', label: t('customers.colRegistered'), render: (c) => formatDateTime(c.createdAt) },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/admin/customers/${c.id}`)}>{t('customers.viewDetail')}</button>
      ),
    },
  ], [navigate, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p>{t('customers.description')}</p>
        </div>
        <ExportButton
          label="Xuất CSV"
          filename={`customers_${new Date().toISOString().slice(0,10)}.csv`}
          onExport={() => exportCustomersCsv({ status: query.status !== 'ALL' ? query.status : undefined })}
        />
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('customers.searchPlaceholder')} />
        </label>
        <label>
          {t('customers.filterStatus')}
          <select className="control-select" value={query.status}
            onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            <option value="ALL">{t('common.all')}</option>
            <option value="ACTIVE">{t('status.customer.ACTIVE')}</option>
            <option value="DISABLED">{t('status.customer.DISABLED')}</option>
            <option value="BLOCKED">{t('status.customer.BLOCKED')}</option>
          </select>
        </label>
      </section>

      {state.status === 'error' && <StatePanel tone="danger" title={t('customers.loadError')} description={state.error} actionLabel={t('common.retry')} onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title={t('customers.empty')} description={t('customers.emptyDesc')} actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('customers.tableCaption')}
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
