import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useQuery } from '@tanstack/react-query'
import { Crown, UserCheck, UserPlus, Users } from 'lucide-react'
import { toast } from '@/lib/toast'
import { ExportButton } from '@/components/ExportButton'
import { FilterChips } from '../components/FilterChips'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
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

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

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
  const debouncedSearch = useDebounce(searchInput, 300)
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

  function resetFilters() {
    setSearchInput('')
    setQuery(INITIAL_QUERY)
  }

  const items = state.items || []
  const pagination = state.pagination
  const isFiltered = !!query.search || query.status !== 'ALL'

  const activeFilterChips = []
  if (query.search) {
    activeFilterChips.push({
      key: 'search',
      label: t('customers.filterChipSearch', { value: query.search, defaultValue: `Tìm: "{{value}}"` }),
      removeLabel: t('customers.removeFilter', { filter: t('common.search'), defaultValue: `Bỏ bộ lọc {{filter}}` }),
      onRemove: () => {
        setSearchInput('')
        updateQuery({ search: '' }, { resetPage: true })
      },
    })
  }
  if (query.status !== 'ALL') {
    activeFilterChips.push({
      key: 'status',
      label: t('customers.filterChipStatus', {
        value: t(`status.customer.${query.status}`, { defaultValue: query.status }),
        defaultValue: `Trạng thái: {{value}}`,
      }),
      removeLabel: t('customers.removeFilter', { filter: t('customers.filterStatus'), defaultValue: `Bỏ bộ lọc {{filter}}` }),
      onRemove: () => updateQuery({ status: 'ALL' }, { resetPage: true }),
    })
  }

  const columns = [
    {
      key: 'customer',
      label: t('customers.colCustomer'),
      render: (c) => {
        const name = formatText(c.fullName)
        return (
          <div className="bb-product-cell">
            <span className="bb-product-thumb">{(name || '?').charAt(0).toUpperCase()}</span>
            <span>
              <div>{name}</div>
              <div className="bb-cell-sub">{formatText(c.email)}</div>
            </span>
          </div>
        )
      },
    },
    { key: 'phone', label: t('customers.colPhone'), render: (c) => formatText(c.phone) },
    { key: 'status', label: t('customers.colStatus'), render: (c) => <CustomerStatusBadge value={c.status} /> },
    { key: 'orderCount', label: t('customers.colOrders'), align: 'right', render: (c) => c.orderCount },
    { key: 'totalSpent', label: t('customers.colSpent'), align: 'right', render: (c) => <span className="font-bold">{formatCurrencyVnd(c.totalSpent)}</span> },
    { key: 'createdAt', label: t('customers.colRegistered'), render: (c) => <span className="bb-muted text-xs">{formatDateTime(c.createdAt)}</span> },
  ]

  const mobileCard = (c) => ({
    title: formatText(c.fullName),
    subtitle: formatText(c.email),
    status: <CustomerStatusBadge value={c.status} />,
    meta: [
      { label: t('customers.colPhone'), value: formatText(c.phone) },
      { label: t('customers.colOrders'), value: c.orderCount },
      { label: t('customers.colSpent'), value: formatCurrencyVnd(c.totalSpent), tone: 'strong' },
      { label: t('customers.colRegistered'), value: formatDateTime(c.createdAt) },
    ],
    onClick: () => navigate(`/admin/customers/${c.id}`),
  })

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('customers.eyebrow')}</p>
          <h1>{t('customers.title')}</h1>
          <p className="bb-muted">{t('customers.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <ExportButton
            onExport={async () => {
              try {
                const r = await exportCustomersCsv({ status: query.status !== 'ALL' ? query.status : undefined })
                if (r?.truncated) toast.warning(t('export.truncated', { max: r.maxRows }))
              } catch {
                throw new Error(t('export.error'))
              }
            }}
          >
            {t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </ExportButton>
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
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
      </div>

      {/* Filter chips — báo gọn đang lọc gì + gỡ từng filter / xoá tất cả. */}
      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('customers.activeFiltersAria', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('customers.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral"
          title={isFiltered ? t('customers.emptyFiltered', { defaultValue: t('customers.empty') }) : t('customers.empty')}
          description={isFiltered ? t('customers.emptyFilteredDesc', { defaultValue: t('customers.emptyDesc') }) : t('customers.emptyDesc')}
          actionLabel={isFiltered ? t('common.resetFilters') : undefined}
          onAction={isFiltered ? resetFilters : undefined} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
              rowHref={(c) => `/admin/customers/${c.id}`}
              mobileCard={mobileCard}
            />
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
