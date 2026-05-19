import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Crown, Download, Search, UserCheck, UserPlus, Users } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { exportCustomersCsv, fetchCustomers, fetchCustomerSummary } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

// Customer account status → prototype badge palette.
const STATUS_BADGE = {
  ACTIVE: 'badge-success',
  PENDING: 'badge-warn',
  DISABLED: 'badge-neutral',
  BLOCKED: 'badge-danger',
  UNKNOWN: 'badge-neutral',
}
// Avatar gradient variants — cycle so adjacent rows differ.
const AVATAR_VARIANTS = ['', 'b', 'c', 'd', 'e', 'f']

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }

function CustomerStatusBadge({ value }) {
  const { t } = useTranslation()
  const cls = STATUS_BADGE[value] || 'badge-neutral'
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {t(`status.customer.${value}`, { defaultValue: value })}
    </span>
  )
}

export function CustomerListScreen({ navigate }) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)

  const state = useAdminList(['customers', query], () => fetchCustomers(query))

  const { data: summary } = useQuery({
    queryKey: ['customer-summary'],
    queryFn: fetchCustomerSummary,
    staleTime: 60_000,
  })

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((p) => {
      const next = { ...p, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  const items = state.items || []
  const pagination = state.pagination

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p className="desc">{t('customers.description')}</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => exportCustomersCsv({ status: query.status !== 'ALL' ? query.status : undefined })}
          >
            <Download size={14} />{t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-head">
              <span className="kpi-icon red"><Users size={15} /></span>
              <span>{t('customers.kpi.total')}</span>
            </div>
            <div className="kpi-value">{summary.total.toLocaleString(i18n.language)}</div>
            <div className="kpi-foot"><span className="kpi-foot-label">{t('customers.kpi.totalHint')}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-head">
              <span className="kpi-icon amber"><Crown size={15} /></span>
              <span>{t('customers.kpi.vip')}</span>
            </div>
            <div className="kpi-value">{summary.vip.toLocaleString(i18n.language)}</div>
            <div className="kpi-foot"><span className="kpi-foot-label">{t('customers.kpi.vipHint')}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-head">
              <span className="kpi-icon blue"><UserPlus size={15} /></span>
              <span>{t('customers.kpi.new30d')}</span>
            </div>
            <div className="kpi-value">{summary.newLast30Days.toLocaleString(i18n.language)}</div>
            <div className="kpi-foot"><span className="kpi-foot-label">{t('customers.kpi.new30dHint')}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-head">
              <span className="kpi-icon green"><UserCheck size={15} /></span>
              <span>{t('customers.kpi.active')}</span>
            </div>
            <div className="kpi-value">{summary.active.toLocaleString(i18n.language)}</div>
            <div className="kpi-foot"><span className="kpi-foot-label">{t('customers.kpi.activeHint')}</span></div>
          </div>
        </div>
      ) : null}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('customers.searchPlaceholder')}
          />
        </div>
        <select
          className="filter-select"
          value={query.status}
          onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}
          aria-label={t('customers.filterStatus')}
        >
          <option value="ALL">{t('customers.filterStatus')}</option>
          <option value="ACTIVE">{t('status.customer.ACTIVE')}</option>
          <option value="PENDING">{t('status.customer.PENDING')}</option>
          <option value="DISABLED">{t('status.customer.DISABLED')}</option>
          <option value="BLOCKED">{t('status.customer.BLOCKED')}</option>
        </select>
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('customers.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral" title={t('customers.empty')} description={t('customers.emptyDesc')}
          actionLabel={t('common.resetFilters')} onAction={() => { setSearchInput(''); setQuery(INITIAL_QUERY) }} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="card">
          <div className="card-body card-body--flush">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('customers.colCustomer')}</th>
                    <th>{t('customers.colPhone')}</th>
                    <th>{t('customers.colStatus')}</th>
                    <th className="num">{t('customers.colOrders')}</th>
                    <th className="num">{t('customers.colSpent')}</th>
                    <th>{t('customers.colRegistered')}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(6)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={6}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((c, i) => {
                    const name = formatText(c.fullName)
                    const initial = (name || '?').charAt(0).toUpperCase()
                    return (
                      <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)}>
                        <td>
                          <div className="product-cell">
                            <span className={`avatar-text ${AVATAR_VARIANTS[i % AVATAR_VARIANTS.length]}`}>{initial}</span>
                            <div className="info">
                              <div className="name">{name}</div>
                              <div className="sku" style={{ fontFamily: 'inherit' }}>{formatText(c.email)}</div>
                            </div>
                          </div>
                        </td>
                        <td>{formatText(c.phone)}</td>
                        <td><CustomerStatusBadge value={c.status} /></td>
                        <td className="num">{c.orderCount}</td>
                        <td className="num fw-700">{formatCurrencyVnd(c.totalSpent)}</td>
                        <td className="muted text-xs">{formatDateTime(c.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {state.status === 'success' && pagination && (
            <div className="card-foot">
              <span>
                {t('common.paginationSummary', {
                  defaultValue: `Hiển thị ${items.length} trong ${pagination.totalItems} khách hàng`,
                  count: items.length,
                  total: pagination.totalItems,
                })}
              </span>
              <div className="pager">
                <button type="button" disabled={pagination.page <= 1} onClick={() => updateQuery({ page: pagination.page - 1 })}>‹</button>
                <button type="button" className="active">{pagination.page}</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateQuery({ page: pagination.page + 1 })}>›</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
