import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { StatusBadge } from '../components/StatusBadge'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const ORDER_STATUS_KEYS = ['PENDING', 'ON_HOLD', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED']
const PAYMENT_STATUS_KEYS = ['UNPAID', 'PAID', 'REFUNDED', 'CANCELLED']

const INITIAL_QUERY = {
  search: '',
  orderStatus: 'ALL',
  paymentStatus: 'ALL',
  sort: 'createdAt:desc',
  page: 1,
  pageSize: 20,
}

export function OrderListScreen({ navigate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [dateRange, setDateRange] = useState(undefined)
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const isFirstPage = query.page === 1 && query.orderStatus === 'ALL' && !query.search

  const fullQuery = { ...query, dateRange }
  const state = useAdminList(['orders', fullQuery], () => fetchOrders(fullQuery))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false
      return
    }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
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
          <div className="flex items-center gap-1.5">
            <strong>{formatText(order.orderNumber)}</strong>
            {order.source === 'pos' && <span className="badge-pos">POS</span>}
          </div>
          <p className="text-sm text-muted-foreground">{formatText(order.customerEmail)}</p>
        </div>
      ),
    },
    { key: 'customerName', label: t('orders.colCustomer'), render: (order) => formatText(order.customerName) },
    { key: 'orderStatus', label: t('orders.colStatus'), render: (order) => <StatusBadge type="order" status={order.orderStatus} /> },
    {
      key: 'paymentStatus',
      label: t('orders.colPaymentStatus'),
      render: (order) => <StatusBadge type="payment" status={order.paymentStatus} />,
    },
    { key: 'total', label: t('orders.colTotal'), render: (order) => formatCurrencyVnd(order.total) },
    { key: 'createdAt', label: t('orders.colDate'), render: (order) => formatDateTime(order.createdAt) },
    {
      key: 'actions', label: '', align: 'right',
      render: (order) => (
        <Button variant="outline" onClick={() => navigate(`/admin/orders/${order.id}`)}>{t('orders.viewDetail')}</Button>
      ),
    },
  ], [navigate, t])

  // Mobile card mapping — same data as the table row, laid out for <640px.
  const orderCard = useCallback((order) => ({
    title: (
      <span className="flex items-center gap-1.5">
        {formatText(order.orderNumber)}
        {order.source === 'pos' && <span className="badge-pos">POS</span>}
      </span>
    ),
    subtitle: formatText(order.customerName) || formatText(order.customerEmail),
    status: <StatusBadge type="order" status={order.orderStatus} />,
    meta: [
      { label: t('orders.colPaymentStatus'), value: <StatusBadge type="payment" status={order.paymentStatus} /> },
      { label: t('orders.colTotal'), value: formatCurrencyVnd(order.total), tone: 'strong' },
      { label: t('orders.colDate'), value: formatDateTime(order.createdAt) },
    ],
    actions: (
      <Button variant="outline" onClick={() => navigate(`/admin/orders/${order.id}`)}>
        {t('orders.viewDetail')}
      </Button>
    ),
  }), [navigate, t])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setDateRange(undefined)
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
            from: dateRange?.from?.toISOString().slice(0, 10),
            to: dateRange?.to?.toISOString().slice(0, 10),
          })}
        />
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input type="search" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}  />
        </label>
        <label>
          {t('orders.filterStatus')}
          <Select value={query.orderStatus}
            onValueChange={(val) => updateQuery({ orderStatus: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            {ORDER_STATUS_KEYS.map((k) => (
              <SelectItem key={k} value={k}>{t(`status.order.${k}`)}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
        <label>
          {t('orders.filterPaymentStatus')}
          <Select value={query.paymentStatus}
            onValueChange={(val) => updateQuery({ paymentStatus: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            {PAYMENT_STATUS_KEYS.map((k) => (
              <SelectItem key={k} value={k}>{t(`status.payment.${k}`)}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
        <label>
          {t('orders.filterDate')}
          <div className="mt-1">
            <DateRangePicker
              value={dateRange}
              onChange={(range) => { setDateRange(range); updateQuery({ page: 1 }) }}
            />
          </div>
        </label>
        <label>
          {t('orders.filterSort')}
          <Select value={query.sort}
            onValueChange={(val) => updateQuery({ sort: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="createdAt:desc">{t('sort.newestOrder')}</SelectItem>
            <SelectItem value="createdAt:asc">{t('sort.oldestOrder')}</SelectItem>
            <SelectItem value="total:desc">{t('sort.highestValue')}</SelectItem>
          </SelectContent></Select>
        </label>
        <label>
          {t('common.rowsPerPage')}
          <Select value={String(query.pageSize)}
            onValueChange={(val) => updateQuery({ pageSize: Number(val) }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent></Select>
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
            mobileCard={orderCard}
          />
          {state.status === 'success' && (
            <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
          )}
        </>
      ) : null}
    </section>
  )
}
