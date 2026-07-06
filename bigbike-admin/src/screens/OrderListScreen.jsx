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
import { BulkActionBar } from '../components/BulkActionBar'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { exportOrdersCsv, fetchOrders, updateOrderStatus } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const ORDER_STATUS_KEYS = ['PENDING', 'PROCESSING', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'FAILED']
const PAYMENT_STATUS_KEYS = ['UNPAID', 'PAID', 'CANCELLED']

// T2 — CTA cho trạng thái "chưa từng có đơn nào" (không phải do lọc).
const STOREFRONT_BASE = (import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn').replace(/\/$/, '')

// O4 — các bước chuyển trạng thái không cần lý do/xác nhận, cho phép đổi ngay
// trên danh sách (đúng ALLOWED_TRANSITIONS trong STATE_MACHINES.md: PENDING → PROCESSING/ON_HOLD,
// ON_HOLD → PROCESSING).
const INLINE_STATUS_TARGETS = {
  PENDING: ['ON_HOLD', 'PROCESSING'],
  ON_HOLD: ['PROCESSING'],
}

const INITIAL_QUERY = {
  search: '',
  orderStatus: 'ALL',
  paymentStatus: 'ALL',
  sort: 'createdAt:desc',
  page: 1,
  pageSize: 20,
}

export function OrderListScreen({ navigate, canUpdate }) {
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
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkProgress, setBulkProgress] = useState(null) // {done,total} or null
  const [inlineUpdating, setInlineUpdating] = useState({}) // { [orderId]: targetStatus }

  const fullQuery = { ...query }
  const state = useAdminList(['orders', fullQuery], () => fetchOrders(fullQuery))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    // T9: lưu lại query string đang áp dụng để nút "Quay lại danh sách" ở trang
    // chi tiết không làm mất filter/sort/trang.
    try { sessionStorage.setItem('orders:listQuery', window.location.search) } catch { /* ignore */ }
    // Selections refer to ids that may leave the visible page after a filter
    // or page change; clear so the bulk bar never shows hidden items.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds([])
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

  // O4 — đổi trạng thái ngay trên 1 dòng (không cần lý do/xác nhận).
  async function handleInlineStatusChange(order, newStatus) {
    if (inlineUpdating[order.id]) return
    setInlineUpdating((prev) => ({ ...prev, [order.id]: newStatus }))
    try {
      await updateOrderStatus(order.id, newStatus)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(t('orders.detail.statusUpdated'))
    } catch (err) {
      toast.error(err.message || t('orders.detail.updateStatusError'))
    } finally {
      setInlineUpdating((prev) => {
        const next = { ...prev }
        delete next[order.id]
        return next
      })
    }
  }

  // O6 — chuyển hàng loạt các đơn đã chọn (đang PENDING/ON_HOLD) sang "Đang xử lý".
  async function runBulkProcessing() {
    if (!canUpdate || bulkProgress) return
    const byId = new Map(items.map((o) => [o.id, o]))
    const ids = selectedIds.filter((id) => INLINE_STATUS_TARGETS[byId.get(id)?.orderStatus]?.includes('PROCESSING'))
    if (ids.length === 0) {
      toast.error(t('orders.bulkNoEligible', { defaultValue: 'Không có đơn nào đủ điều kiện chuyển "Đang xử lý" trong lựa chọn.' }))
      return
    }

    const ok = await showConfirm(
      t('orders.bulkProcessingConfirm', { count: ids.length, defaultValue: `Chuyển {{count}} đơn đã chọn sang "Đang xử lý"?` }),
      t('orders.bulkProcessingTitle', { defaultValue: 'Chuyển trạng thái hàng loạt' }),
    )
    if (!ok) return

    setBulkProgress({ done: 0, total: ids.length })
    let success = 0
    let failed = 0
    await Promise.allSettled(
      ids.map((id) =>
        updateOrderStatus(id, 'PROCESSING')
          .then(() => { success += 1 })
          .catch((err) => {
            failed += 1
            const order = byId.get(id)
            toast.error(`${order?.orderNumber || id}: ${err.message || t('common.error')}`)
          })
          .finally(() => {
            setBulkProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: ids.length }))
          })
      )
    )
    setBulkProgress(null)
    setSelectedIds([])
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    const summary = t('orders.bulkProcessingResult', {
      success,
      failed,
      defaultValue: `Đã chuyển {{success}} đơn, {{failed}} lỗi.`,
    })
    if (failed === 0) toast.success(summary)
    else if (success === 0) toast.error(summary)
    else toast.warning(summary)
  }

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
        <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      render: (order) => {
        const inlineTargets = canUpdate ? (INLINE_STATUS_TARGETS[order.orderStatus] ?? []) : []
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge type="order" status={order.orderStatus} />
            {inlineTargets.map((target) => (
              <button
                key={target}
                type="button"
                className="bb-btn bb-btn-ghost bb-btn-sm"
                disabled={!!inlineUpdating[order.id]}
                onClick={(e) => { e.stopPropagation(); handleInlineStatusChange(order, target) }}
              >
                {inlineUpdating[order.id] === target
                  ? t('orders.detail.savingShort')
                  : `→ ${target === 'PROCESSING' ? t('orders.detail.actionProcessing') : t('orders.detail.actionOnHold')}`}
              </button>
            ))}
          </div>
        )
      },
    },
  ]

  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:orders')

  const mobileCard = (order) => ({
    title: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={resetFilters}>
          <SlidersHorizontal size={13} />{t('orders.clearFilters')}
        </button>
      </div>

      {/* Thanh hành động hàng loạt — chuyển nhiều đơn PENDING/ON_HOLD sang Đang xử lý. */}
      <BulkActionBar
        selectedCount={canUpdate && selectedIds.length > 0
          ? (bulkProgress
            ? t('orders.bulkProcessingProgress', { done: bulkProgress.done, total: bulkProgress.total, defaultValue: `Đang xử lý {{done}}/{{total}}...` })
            : selectedIds.length)
          : null}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            label: t('orders.bulkProcessingAction', { defaultValue: 'Chuyển sang Đang xử lý' }),
            onClick: runBulkProcessing,
            disabled: Boolean(bulkProgress),
          },
        ]}
      />

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
            description={t('orders.emptyAllDesc', { defaultValue: 'Khi có đơn đặt trên website, đơn sẽ hiện ở đây.' })}
            actionLabel={t('orders.viewStorefrontCta', { defaultValue: 'Xem trang web' })}
            onAction={() => window.open(STOREFRONT_BASE, '_blank', 'noopener')} />
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
              columns={visibleColumns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              selectable={canUpdate}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
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
