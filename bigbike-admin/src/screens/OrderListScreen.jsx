import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Download, Plus, Search, SlidersHorizontal, Store, X } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
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
  const [selected, setSelected] = useState(() => new Set())
  const debouncedSearch = useDebounce(searchInput, 250)
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
    setSelected(new Set())
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
    // Any query change loads a different result page — drop the stale selection.
    setSelected(new Set())
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

  // Order status as a segmented tab bar — mirrors backend ALLOWED_ORDER_STATUSES.
  const statusTabs = useMemo(() => [
    { key: 'ALL', label: t('common.all') },
    ...ORDER_STATUS_KEYS.map((k) => ({ key: k, label: t(`status.order.${k}`) })),
  ], [t])

  const items = useMemo(() => state.items || [], [state.items])
  const pagination = state.pagination

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const toggleAll = useCallback(() => {
    setSelected((prev) => (
      prev.size === items.length ? new Set() : new Set(items.map((o) => o.id))
    ))
  }, [items])

  const allChecked = items.length > 0 && selected.size === items.length

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('orders.eyebrow')}</p>
          <h1>{t('orders.title')}</h1>
          <p className="desc">{t('orders.description')}</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => exportOrdersCsv({
              status: query.orderStatus !== 'ALL' ? query.orderStatus : undefined,
            })}
          >
            <Download size={14} />{t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/pos')}>
            <Store size={14} />{t('orders.openPos', { defaultValue: 'Mở POS' })}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/admin/pos')}>
            <Plus size={14} />{t('orders.createNew', { defaultValue: 'Tạo đơn mới' })}
          </button>
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* Status tabs — prototype segmented control */}
      <div className="seg mb-4" role="tablist" aria-label={t('orders.filterStatus')}>
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={query.orderStatus === tab.key}
            className={`seg-tab${query.orderStatus === tab.key ? ' active' : ''}`}
            onClick={() => updateQuery({ orderStatus: tab.key }, { resetPage: true })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
          />
        </div>
        <select
          className="filter-select"
          value={query.paymentStatus}
          onChange={(e) => updateQuery({ paymentStatus: e.target.value }, { resetPage: true })}
          aria-label={t('orders.filterPaymentStatus')}
        >
          <option value="ALL">{t('orders.filterPaymentStatus')}</option>
          {PAYMENT_STATUS_KEYS.map((k) => (
            <option key={k} value={k}>{t(`status.payment.${k}`)}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={query.sort}
          onChange={(e) => updateQuery({ sort: e.target.value }, { resetPage: true })}
          aria-label={t('orders.filterSort')}
        >
          <option value="createdAt:desc">{t('sort.newestOrder')}</option>
          <option value="createdAt:asc">{t('sort.oldestOrder')}</option>
          <option value="total:desc">{t('sort.highestValue')}</option>
        </select>
        <select
          className="filter-select"
          value={String(query.pageSize)}
          onChange={(e) => updateQuery({ pageSize: Number(e.target.value) }, { resetPage: true })}
          aria-label={t('common.rowsPerPage')}
        >
          <option value="20">20 / {t('common.page', { defaultValue: 'trang' })}</option>
          <option value="50">50 / {t('common.page', { defaultValue: 'trang' })}</option>
          <option value="100">100 / {t('common.page', { defaultValue: 'trang' })}</option>
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
          <SlidersHorizontal size={13} />{t('orders.clearFilters')}
        </button>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <Check size={16} />
          <span>{t('orders.bulkSelected', { count: selected.size, defaultValue: `Đã chọn ${selected.size} đơn hàng` })}</span>
          <div className="bulk-actions">
            <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('orders.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}

      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral" title={t('orders.empty')} description={t('orders.emptyDesc')}
          actionLabel={t('orders.clearFilters')} onAction={resetFilters} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="card">
          <div className="card-body card-body--flush">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <span
                        className={`cb${allChecked ? ' checked' : ''}`}
                        role="checkbox"
                        aria-checked={allChecked}
                        tabIndex={0}
                        onClick={toggleAll}
                        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAll() } }}
                      >
                        {allChecked && <Check size={11} />}
                      </span>
                    </th>
                    <th>{t('orders.colOrder')}</th>
                    <th>{t('orders.colCustomer')}</th>
                    <th>{t('orders.colDate')}</th>
                    <th className="num">{t('orders.colTotal')}</th>
                    <th>{t('orders.colPaymentStatus')}</th>
                    <th>{t('orders.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(8)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={7}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((order) => {
                    const checked = selected.has(order.id)
                    return (
                      <tr key={order.id} className={checked ? 'selected' : ''}>
                        <td className="checkbox-cell" onClick={(e) => { e.stopPropagation(); toggle(order.id) }}>
                          <span className={`cb${checked ? ' checked' : ''}`} role="checkbox" aria-checked={checked}>
                            {checked && <Check size={11} />}
                          </span>
                        </td>
                        <td className="id-cell" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          <span className="flex items-center gap-2">
                            {formatText(order.orderNumber)}
                            {order.source === 'pos' && <span className="badge badge-neutral">POS</span>}
                          </span>
                        </td>
                        <td onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          <div className="product-cell">
                            <div className="info">
                              <div className="name">{formatText(order.customerName) || formatText(order.customerEmail)}</div>
                              <div className="sku">{formatText(order.customerEmail)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="muted text-xs" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          {formatDateTime(order.createdAt)}
                        </td>
                        <td className="num fw-700" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          {formatCurrencyVnd(order.total)}
                        </td>
                        <td onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          <StatusBadge type="payment" status={order.paymentStatus} />
                        </td>
                        <td onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          <StatusBadge type="order" status={order.orderStatus} />
                        </td>
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
                  defaultValue: `Hiển thị ${items.length} trong ${pagination.totalItems} đơn`,
                  count: items.length,
                  total: pagination.totalItems,
                })}
              </span>
              <div className="pager">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => updateQuery({ page: pagination.page - 1 })}
                >
                  ‹
                </button>
                <button type="button" className="active">{pagination.page}</button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => updateQuery({ page: pagination.page + 1 })}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
