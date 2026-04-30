import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { AdminTable } from '../components/AdminTable'
import { DateRangePicker } from '../components/DateRangePicker'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { exportOrdersCsv, fetchOrders } from '../lib/adminApi'
import { ExportButton } from '../components/ExportButton'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'

const STATUS_TONES = {
  PENDING: 'warning',
  ON_HOLD: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  UNKNOWN: 'neutral',
}

const ORDER_STATUS_KEYS = ['PENDING', 'ON_HOLD', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED']

function OrderStatusBadge({ value }) {
  const { t } = useTranslation()
  const tone = STATUS_TONES[value] || 'neutral'
  return <span className={`status-badge status-${tone}`}>{t(`status.order.${value}`, { defaultValue: value })}</span>
}

const INITIAL_QUERY = {
  search: '',
  orderStatus: 'ALL',
  dateRange: undefined,
  sort: 'createdAt:desc',
  page: 1,
  pageSize: 20,
}

export function OrderListScreen({ navigate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState(INITIAL_QUERY.search)
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const isFirstPage = query.page === 1 && query.orderStatus === 'ALL' && !query.search

  const state = useAdminList(['orders', query], () => fetchOrders(query))

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    if (!isFirstPage) return
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    })
    return unsubscribe
  }, [isFirstPage, queryClient])

  const columns = useMemo(() => [
    {
      key: 'orderNumber',
      label: t('orders.colOrder'),
      render: (order) => (
        <div>
          <strong>{formatText(order.orderNumber)}</strong>
          <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{formatText(order.customerEmail)}</p>
        </div>
      ),
    },
    { key: 'customerName', label: t('orders.colCustomer'), render: (order) => formatText(order.customerName) },
    { key: 'orderStatus', label: t('orders.colStatus'), render: (order) => <OrderStatusBadge value={order.orderStatus} /> },
    { key: 'total', label: t('orders.colTotal'), render: (order) => formatCurrencyVnd(order.total) },
    { key: 'createdAt', label: t('orders.colDate'), render: (order) => formatDateTime(order.createdAt) },
    {
      key: 'actions', label: '', align: 'right',
      render: (order) => (
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/admin/orders/${order.id}`)}>{t('orders.viewDetail')}</button>
      ),
    },
  ], [navigate, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('orders.eyebrow')}</p>
          <h1>{t('orders.title')}</h1>
          <p>{t('orders.description')}</p>
        </div>
        <ExportButton
          filename={`orders_${new Date().toISOString().slice(0, 10)}.csv`}
          onExport={() => exportOrdersCsv({
            status: query.orderStatus !== 'ALL' ? query.orderStatus : undefined,
            from: query.dateRange?.from?.toISOString().slice(0, 10),
            to: query.dateRange?.to?.toISOString().slice(0, 10),
          })}
        />
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input className="control-input" type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('orders.searchPlaceholder')} />
        </label>
        <label>
          {t('orders.filterStatus')}
          <select className="control-select" value={query.orderStatus}
            onChange={(e) => updateQuery({ orderStatus: e.target.value }, { resetPage: true })}>
            <option value="ALL">{t('common.all')}</option>
            {ORDER_STATUS_KEYS.map((k) => (
              <option key={k} value={k}>{t(`status.order.${k}`)}</option>
            ))}
          </select>
        </label>
        <label>
          {t('orders.filterDate', { defaultValue: 'Khoảng ngày' })}
          <div style={{ marginTop: 5 }}>
            <DateRangePicker
              value={query.dateRange}
              onChange={(range) => updateQuery({ dateRange: range }, { resetPage: true })}
            />
          </div>
        </label>
        <label>
          {t('orders.filterSort')}
          <select className="control-select" value={query.sort}
            onChange={(e) => updateQuery({ sort: e.target.value }, { resetPage: true })}>
            <option value="createdAt:desc">{t('sort.newestOrder')}</option>
            <option value="createdAt:asc">{t('sort.oldestOrder')}</option>
            <option value="total:desc">{t('sort.highestValue')}</option>
          </select>
        </label>
        <label>
          {t('common.rowsPerPage')}
          <select className="control-select" value={query.pageSize}
            onChange={(e) => updateQuery({ pageSize: Number(e.target.value) }, { resetPage: true })}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('orders.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('orders.empty')} description={t('orders.emptyDesc')}
          actionLabel={t('orders.clearFilters')} onAction={resetFilters} />
      )}
      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('orders.tableCaption')}
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
