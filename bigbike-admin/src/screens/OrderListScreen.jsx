import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { toast } from '@/lib/toast'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { AdminTable } from '../components/AdminTable'
import { exportOrdersCsv, fetchOrders } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const ORDER_STATUS_KEYS = ['PENDING', 'PROCESSING', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED']
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
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const isFirstPage = query.page === 1 && query.orderStatus === 'ALL' && !query.search

  const fullQuery = { ...query }
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

  const statusTabs = useMemo(() => [
    { key: 'ALL', label: t('common.all') },
    ...ORDER_STATUS_KEYS.map((k) => ({ key: k, label: t(`status.order.${k}`) })),
  ], [t])

  const items = useMemo(() => state.items || [], [state.items])
  const pagination = state.pagination
  const isFiltered = !!query.search || query.orderStatus !== 'ALL' || query.paymentStatus !== 'ALL'

  // Sort hiện do FilterSelect quản (chuỗi "field:dir"). Cho phép bấm tiêu đề cột
  // Ngày/Tổng để đổi sort ngay trên lưới — backend chỉ sort được 2 trường này.
  const [sortKey, sortDir] = useMemo(() => {
    const [k, d] = String(query.sort || 'createdAt:desc').split(':')
    return [k, d === 'asc' ? 'asc' : 'desc']
  }, [query.sort])

  function handleSortChange(key, dir) {
    updateQuery({ sort: `${key}:${dir}` }, { resetPage: true })
  }

  const columns = [
    {
      key: 'orderNumber',
      label: t('orders.colOrder'),
      render: (order) => (
        <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {formatText(order.orderNumber)}
        </span>
      ),
    },
    {
      key: 'customer',
      label: t('orders.colCustomer'),
      render: (order) => (
        <div className="bb-product-cell">
          <div>
            <div style={{ fontWeight: 500 }}>{formatText(order.customerName) || formatText(order.customerEmail)}</div>
            <div className="bb-cell-sub">{formatText(order.customerEmail)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: t('orders.colDate'),
      sortable: true,
      render: (order) => <span className="bb-muted">{formatDateTime(order.createdAt)}</span>,
    },
    {
      key: 'total',
      label: t('orders.colTotal'),
      align: 'right',
      sortable: true,
      render: (order) => <span style={{ fontWeight: 700 }}>{formatCurrencyVnd(order.total)}</span>,
    },
    {
      key: 'paymentStatus',
      label: t('orders.colPaymentStatus'),
      render: (order) => <StatusBadge type="payment" status={order.paymentStatus} />,
    },
    {
      key: 'orderStatus',
      label: t('orders.colStatus'),
      render: (order) => <StatusBadge type="order" status={order.orderStatus} />,
    },
  ]

  const mobileCard = (order) => ({
    title: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {formatText(order.orderNumber)}
      </span>
    ),
    subtitle: formatText(order.customerName) || formatText(order.customerEmail),
    status: <StatusBadge type="order" status={order.orderStatus} />,
    meta: [
      { label: t('orders.colDate'), value: formatDateTime(order.createdAt) },
      { label: t('orders.colTotal'), value: formatCurrencyVnd(order.total), tone: 'strong' },
      { label: t('orders.colPaymentStatus'), value: <StatusBadge type="payment" status={order.paymentStatus} /> },
    ],
    onClick: () => navigate(`/admin/orders/${order.id}`),
  })

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('orders.eyebrow')}</p>
          <h1>{t('orders.title')}</h1>
          <p className="bb-muted">{t('orders.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <ExportButton
            onExport={async () => {
              await exportOrdersCsv({
                status: query.orderStatus !== 'ALL' ? query.orderStatus : undefined,
              })
              toast.success(t('common.exportCsvDone', { defaultValue: 'Đã tải file CSV' }))
            }}
          >
            {t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </ExportButton>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Status tabs */}
      <div className="bb-seg" style={{ marginBottom: 12 }} role="tablist" aria-label={t('orders.filterStatus')}>
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={query.orderStatus === tab.key}
            className={query.orderStatus === tab.key ? 'active' : ''}
            onClick={() => updateQuery({ orderStatus: tab.key }, { resetPage: true })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('orders.searchPlaceholder')}
          wrapperClassName="flex-1 min-w-[200px]"
        />
        <FilterSelect
          value={query.paymentStatus}
          onValueChange={(v) => updateQuery({ paymentStatus: v }, { resetPage: true })}
          ariaLabel={t('orders.filterPaymentStatus')}
          options={[
            { value: 'ALL', label: t('orders.filterPaymentStatus') },
            ...PAYMENT_STATUS_KEYS.map((k) => ({ value: k, label: t(`status.payment.${k}`) })),
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('orders.filterSort')}
          options={[
            { value: 'createdAt:desc', label: t('sort.newestOrder') },
            { value: 'createdAt:asc', label: t('sort.oldestOrder') },
            { value: 'total:desc', label: t('sort.highestValue') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
        <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={resetFilters}>
          <SlidersHorizontal size={13} />{t('orders.clearFilters')}
        </button>
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('orders.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}

      {state.status === 'success' && items.length === 0 && (
        isFiltered ? (
          <StatePanel tone="neutral" title={t('orders.empty')} description={t('orders.emptyDesc')}
            actionLabel={t('orders.clearFilters')} onAction={resetFilters} />
        ) : (
          <StatePanel tone="neutral"
            title={t('orders.emptyAll', { defaultValue: 'Chưa có đơn hàng nào' })}
            description={t('orders.emptyAllDesc', { defaultValue: 'Khi có đơn đặt trên website, đơn sẽ hiện ở đây.' })} />
        )
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div
            className="bb-card-body bb-card-body--flush"
            aria-busy={state.isFetching}
            style={state.isFetching ? { opacity: 0.6, transition: 'opacity 0.15s' } : undefined}
          >
            <AdminTable
              columns={columns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
              rowHref={(order) => `/admin/orders/${order.id}`}
              mobileCard={mobileCard}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={handleSortChange}
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
