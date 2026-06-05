import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useQuery } from '@tanstack/react-query'
import { Crown, Download, UserCheck, UserPlus, Users } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { exportCustomersCsv, fetchCustomers, fetchCustomerSummary } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const STATUS_BADGE = {
  ACTIVE: 'bb-badge-success',
  PENDING: 'bb-badge-warning',
  DISABLED: 'bb-badge-neutral',
  BLOCKED: 'bb-badge-danger',
  UNKNOWN: 'bb-badge-neutral',
}
const AVATAR_VARIANTS = ['', 'b', 'c', 'd', 'e', 'f']

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 10 }

function CustomerStatusBadge({ value }) {
  const { t } = useTranslation()
  const cls = STATUS_BADGE[value] || 'bb-badge-neutral'
  return (
    <span className={`bb-badge ${cls}`}>
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
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p className="bb-muted">{t('customers.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={() => exportCustomersCsv({ status: query.status !== 'ALL' ? query.status : undefined })}
          >
            <Download size={14} />{t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="bb-kpi-grid">
          <div className="bb-kpi">
            <div className="bb-kpi-head">
              <span className="bb-kpi-icon danger"><Users size={15} /></span>
              <span>{t('customers.kpi.total')}</span>
            </div>
            <div className="bb-kpi-value">{summary.total.toLocaleString(i18n.language)}</div>
            <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('customers.kpi.totalHint')}</span></div>
          </div>
          <div className="bb-kpi">
            <div className="bb-kpi-head">
              <span className="bb-kpi-icon warning"><Crown size={15} /></span>
              <span>{t('customers.kpi.vip')}</span>
            </div>
            <div className="bb-kpi-value">{summary.vip.toLocaleString(i18n.language)}</div>
            <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('customers.kpi.vipHint')}</span></div>
          </div>
          <div className="bb-kpi">
            <div className="bb-kpi-head">
              <span className="bb-kpi-icon info"><UserPlus size={15} /></span>
              <span>{t('customers.kpi.new30d')}</span>
            </div>
            <div className="bb-kpi-value">{summary.newLast30Days.toLocaleString(i18n.language)}</div>
            <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('customers.kpi.new30dHint')}</span></div>
          </div>
          <div className="bb-kpi">
            <div className="bb-kpi-head">
              <span className="bb-kpi-icon success"><UserCheck size={15} /></span>
              <span>{t('customers.kpi.active')}</span>
            </div>
            <div className="bb-kpi-value">{summary.active.toLocaleString(i18n.language)}</div>
            <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('customers.kpi.activeHint')}</span></div>
          </div>
        </div>
      ) : null}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('customers.searchPlaceholder')}
          wrapperClassName="flex-1 min-w-[200px]"
        />
        <FilterSelect
          value={query.status}
          onValueChange={(v) => updateQuery({ status: v }, { resetPage: true })}
          ariaLabel={t('customers.filterStatus')}
          options={[
            { value: 'ALL', label: t('customers.filterStatus') },
            { value: 'ACTIVE', label: t('status.customer.ACTIVE') },
            { value: 'PENDING', label: t('status.customer.PENDING') },
            { value: 'DISABLED', label: t('status.customer.DISABLED') },
            { value: 'BLOCKED', label: t('status.customer.BLOCKED') },
          ]}
        />
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
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="hide-on-mobile">
            <div className="bb-table-wrap">
              <table className="bb-table">
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
                        <td colSpan={6}><div className="bb-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((c) => {
                    const name = formatText(c.fullName)
                    const initial = (name || '?').charAt(0).toUpperCase()
                    return (
                      <tr key={c.id} onClick={() => navigate(`/admin/customers/${c.id}`)}>
                        <td>
                          <div className="bb-product-cell">
                            <span className="bb-product-thumb">{initial}</span>
                            <span>
                              <div>{name}</div>
                              <div className="bb-cell-sub">{formatText(c.email)}</div>
                            </span>
                          </div>
                        </td>
                        <td>{formatText(c.phone)}</td>
                        <td><CustomerStatusBadge value={c.status} /></td>
                        <td className="num">{c.orderCount}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{formatCurrencyVnd(c.totalSpent)}</td>
                        <td className="bb-muted" style={{ fontSize: 12 }}>{formatDateTime(c.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
            <MobileCardList>
              {items.map((c) => {
                const name = formatText(c.fullName)
                return (
                  <MobileCard
                    key={c.id}
                    title={name}
                    subtitle={formatText(c.email)}
                    status={<CustomerStatusBadge value={c.status} />}
                    meta={[
                      { label: t('customers.colPhone'), value: formatText(c.phone) },
                      { label: t('customers.colOrders'), value: c.orderCount },
                      { label: t('customers.colSpent'), value: formatCurrencyVnd(c.totalSpent), tone: 'strong' },
                      { label: t('customers.colRegistered'), value: formatDateTime(c.createdAt) },
                    ]}
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                  />
                )
              })}
            </MobileCardList>
          </div>
          {state.status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </div>
      )}
    </div>
  )
}
