import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { toast } from '@/lib/toast'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { FilterChips } from '../components/FilterChips'
import { StatePanel } from '../components/StatePanel'
import { AdminTable } from '../components/AdminTable'
import { BulkActionBar } from '../components/BulkActionBar'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { exportOrdersCsv, fetchOrders, updateOrderStatus } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { FilterBar } from '@/components/layout/FilterBar'
import { orderRowAccent } from '../lib/statusTone'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { useHasPermission } from '../lib/auth'
import { getOrderMutationError } from './order-detail/constants'

const ORDER_STATUS_KEYS = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']
const ORDER_SORT_KEYS = ['createdAt:desc', 'createdAt:asc', 'total:desc']
const ORDER_PAGE_SIZES = [20, 50, 100]

// T2 — CTA cho trạng thái "chưa từng có đơn nào" (không phải do lọc).
const STOREFRONT_BASE = (import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn').replace(/\/$/, '')

// Chỉ bước PENDING → PROCESSING được thực hiện nhanh trên danh sách.
const INLINE_STATUS_TARGETS = {
  PENDING: ['PROCESSING'],
}

const INITIAL_QUERY = {
  search: '',
  orderStatus: 'ALL',
  sort: 'createdAt:desc',
  page: 1,
  pageSize: 20,
  from: '',
  to: '',
}

function isIsoCalendarDate(value) {
  if (value === '') return true
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function readInitialOrderQuery() {
  const query = readQueryFromUrl(INITIAL_QUERY)
  return {
    ...query,
    orderStatus: query.orderStatus === 'ALL' || ORDER_STATUS_KEYS.includes(query.orderStatus)
      ? query.orderStatus
      : INITIAL_QUERY.orderStatus,
    sort: ORDER_SORT_KEYS.includes(query.sort) ? query.sort : INITIAL_QUERY.sort,
    page: Number.isInteger(query.page) && query.page >= 1 ? query.page : INITIAL_QUERY.page,
    pageSize: ORDER_PAGE_SIZES.includes(query.pageSize) ? query.pageSize : INITIAL_QUERY.pageSize,
    from: isIsoCalendarDate(query.from) ? query.from : INITIAL_QUERY.from,
    to: isIsoCalendarDate(query.to) ? query.to : INITIAL_QUERY.to,
  }
}

export function OrderListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const hasPermission = useHasPermission()
  const canExport = hasPermission('reports.export')
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(readInitialOrderQuery)
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkConfirming, setBulkConfirming] = useState(false)
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
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    })
    return unsubscribe
  }, [queryClient])

  useEffect(() => {
    if (state.status !== 'success' || state.isFetching || !state.pagination) return
    const lastPage = Math.max(1, Number(state.pagination.totalPages) || 1)
    if (query.page <= lastPage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((prev) => ({ ...prev, page: lastPage }))
  }, [query.page, state.isFetching, state.pagination, state.status])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((prev) => {
      const next = { ...prev, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery((prev) => ({
      ...prev,
      search: INITIAL_QUERY.search,
      orderStatus: INITIAL_QUERY.orderStatus,
      from: INITIAL_QUERY.from,
      to: INITIAL_QUERY.to,
      page: 1,
    }))
  }

  const items = useMemo(() => state.items || [], [state.items])
  const pagination = state.pagination
  const hasCachedPage = state.status === 'error' && pagination !== null
  const listStatus = hasCachedPage ? 'success' : state.status
  const mutationsDisabled = state.isFetching || state.status === 'error'
  const isFiltered = !!query.search || query.orderStatus !== 'ALL' || !!query.from || !!query.to
  const filterChips = [
    query.search
      ? {
          key: 'search',
          label: t('orders.filterSearchChip', { value: query.search }),
          onRemove: () => {
            setSearchInput('')
            updateQuery({ search: '' }, { resetPage: true })
          },
        }
      : null,
    query.orderStatus !== 'ALL'
      ? {
          key: 'status',
          label: t('orders.filterStatusChip', {
            value: t(`status.order.${query.orderStatus}`, { defaultValue: t('common.unknown') }),
          }),
          onRemove: () => updateQuery({ orderStatus: 'ALL' }, { resetPage: true }),
        }
      : null,
    query.from
      ? {
          key: 'from',
          label: t('orders.filterFromChip', { value: query.from }),
          onRemove: () => updateQuery({ from: '' }, { resetPage: true }),
        }
      : null,
    query.to
      ? {
          key: 'to',
          label: t('orders.filterToChip', { value: query.to }),
          onRemove: () => updateQuery({ to: '' }, { resetPage: true }),
        }
      : null,
  ].filter(Boolean)

  // O4 — đổi trạng thái ngay trên 1 dòng (không cần lý do/xác nhận).
  async function handleInlineStatusChange(order, newStatus) {
    // Khi danh sách đang làm mới nền (stale), khoá thao tác để không đổi trạng thái
    // dựa trên dữ liệu sắp bị thay.
    if (inlineUpdating[order.id] || mutationsDisabled) return
    setInlineUpdating((prev) => ({ ...prev, [order.id]: newStatus }))
    try {
      await updateOrderStatus(order.id, newStatus)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(t('orders.detail.statusUpdated'))
    } catch (err) {
      toast.error(getOrderMutationError(err, t))
      if ([404, 409].includes(Number(err?.status))) {
        await queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    } finally {
      setInlineUpdating((prev) => {
        const next = { ...prev }
        delete next[order.id]
        return next
      })
    }
  }

  // Chuyển hàng loạt các đơn PENDING đã chọn sang "Đang xử lý".
  async function runBulkProcessing() {
    if (!canUpdate || bulkConfirming || bulkProgress || mutationsDisabled) return
    const byId = new Map(items.map((o) => [o.id, o]))
    const ids = selectedIds.filter((id) => INLINE_STATUS_TARGETS[byId.get(id)?.orderStatus]?.includes('PROCESSING'))
    if (ids.length === 0) {
      toast.error(t('orders.bulkNoEligible', { defaultValue: 'Không có đơn nào đủ điều kiện chuyển "Đang xử lý" trong lựa chọn.' }))
      return
    }

    setBulkConfirming(true)
    let ok = false
    try {
      ok = await showConfirm(
        t('orders.bulkProcessingConfirm', { count: ids.length, defaultValue: `Chuyển {{count}} đơn đã chọn sang "Đang xử lý"?` }),
        t('orders.bulkProcessingTitle', { defaultValue: 'Chuyển trạng thái hàng loạt' }),
      )
    } finally {
      setBulkConfirming(false)
    }
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
            toast.error(`${order?.orderNumber || id}: ${getOrderMutationError(err, t)}`)
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
        <span className="mono flex items-center gap-2">
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
            <div className="font-medium">{formatText(order.customerName, '') || formatText(order.customerEmail)}</div>
            {order.customerName && order.customerEmail ? (
              <div className="bb-cell-sub">{formatText(order.customerEmail)}</div>
            ) : null}
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
      render: (order) => <span className="font-bold">{formatCurrencyVnd(order.total)}</span>,
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
              <Button
                key={target}
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                disabled={!!inlineUpdating[order.id] || mutationsDisabled}
                aria-busy={inlineUpdating[order.id] === target}
                aria-label={t('orders.processingOrderLabel', {
                  order: formatText(order.orderNumber),
                })}
                onClick={(e) => { e.stopPropagation(); handleInlineStatusChange(order, target) }}
              >
                {inlineUpdating[order.id] === target
                  ? t('orders.detail.savingShort')
                  : <><ArrowRight size={14} aria-hidden="true" />{t('orders.detail.actionProcessing')}</>}
              </Button>
            ))}
          </div>
        )
      },
    },
  ]

  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:orders')

  const mobileCard = (order) => {
    // O4/O6 mobile parity — cùng nút đổi trạng thái nhanh như desktop, hiện ở khu action
    // của thẻ (không lồng trong vùng bấm mở chi tiết).
    const inlineTargets = canUpdate ? (INLINE_STATUS_TARGETS[order.orderStatus] ?? []) : []
    return {
      title: (
        <span className="flex items-center gap-2">
          {formatText(order.orderNumber)}
        </span>
      ),
      subtitle: formatText(order.customerName, '') || formatText(order.customerEmail),
      status: <StatusBadge type="order" status={order.orderStatus} />,
      meta: [
        { label: t('orders.colDate'), value: formatDateTime(order.createdAt) },
        { label: t('orders.colTotal'), value: formatCurrencyVnd(order.total), tone: 'strong' },
      ],
      onClick: () => navigate(`/admin/orders/${order.id}`),
      actions: inlineTargets.length > 0
        ? inlineTargets.map((target) => (
          <Button
            key={target}
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            disabled={!!inlineUpdating[order.id] || mutationsDisabled}
            aria-busy={inlineUpdating[order.id] === target}
            aria-label={t('orders.processingOrderLabel', {
              order: formatText(order.orderNumber),
            })}
            onClick={() => handleInlineStatusChange(order, target)}
          >
            {inlineUpdating[order.id] === target
              ? t('orders.detail.savingShort')
              : <><ArrowRight size={14} aria-hidden="true" />{t('orders.detail.actionProcessing')}</>}
          </Button>
        ))
        : undefined,
    }
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('orders.eyebrow')}</p>
          <h1>{t('orders.title')}</h1>
          <p className="bb-muted">{t('orders.description')}</p>
        </div>
        <div className="bb-screen-actions">
          {canExport && (
            <ExportButton
              onExport={async () => {
                await exportOrdersCsv({
                  q: query.search || undefined,
                  status: query.orderStatus !== 'ALL' ? query.orderStatus : undefined,
                  from: query.from || undefined,
                  to: query.to || undefined,
                })
                toast.success(t('common.exportCsvDone', { defaultValue: 'Đã tải tệp dữ liệu' }))
              }}
            >
              {t('common.exportCsv', { defaultValue: 'Xuất dữ liệu' })}
            </ExportButton>
          )}
        </div>
      </div>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}
      {!canUpdate ? (
        <ReadOnlyBanner warning={t('orders.readOnlyWarning', { defaultValue: 'Bạn chỉ có quyền xem đơn hàng. Không thể thay đổi trạng thái đơn.' })} />
      ) : null}
      {hasCachedPage ? (
        <Alert tone="danger" size="sm" className="mb-4 flex flex-wrap items-center justify-between gap-3" role="alert">
          <span>{t('orders.refreshError')}</span>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => state.refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      ) : null}

      <FilterBar
        ariaLabel={t('orders.filterAria', { defaultValue: 'Bộ lọc đơn hàng' })}
        className="items-center"
      >
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('orders.searchPlaceholder')}
          className="min-h-11"
          wrapperClassName="w-full min-w-0 sm:min-w-48 sm:flex-1"
        />
        <FilterSelect
          value={query.orderStatus}
          onValueChange={(v) => updateQuery({ orderStatus: v }, { resetPage: true })}
          ariaLabel={t('orders.filterStatus')}
          className="min-h-11"
          options={[
            { value: 'ALL', label: t('orders.filterStatus') },
            ...ORDER_STATUS_KEYS.map((status) => ({
              value: status,
              label: t(`status.order.${status}`),
            })),
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('orders.filterSort')}
          className="min-h-11"
          options={[
            { value: 'createdAt:desc', label: t('sort.newestOrder') },
            { value: 'createdAt:asc', label: t('sort.oldestOrder') },
            { value: 'total:desc', label: t('sort.highestValue') },
          ]}
        />
        <div className="w-full sm:w-40">
          <Input
            id="orders-filter-from"
            type="date"
            aria-label={t('orders.filterFrom')}
            className="min-h-11 w-full"
            value={query.from}
            max={query.to || undefined}
            onChange={(event) => updateQuery({ from: event.target.value }, { resetPage: true })}
          />
        </div>
        <div className="w-full sm:w-40">
          <Input
            id="orders-filter-to"
            type="date"
            aria-label={t('orders.filterTo')}
            className="min-h-11 w-full"
            value={query.to}
            min={query.from || undefined}
            onChange={(event) => updateQuery({ to: event.target.value }, { resetPage: true })}
          />
        </div>
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
          className="min-h-11"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={state.isFetching}
          onClick={() => state.refetch()}
        >
          <RefreshCw size={16} className={state.isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          {t('common.refresh', { defaultValue: 'Làm mới' })}
        </Button>
        <div className="hide-on-mobile">
          <ColumnVisibilityToggle
            allColumns={allColumns}
            hiddenKeys={hiddenKeys}
            onToggle={toggleColumn}
            className="min-h-11"
          />
        </div>
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={resetFilters} disabled={!isFiltered}>
          <SlidersHorizontal size={13} aria-hidden="true" />{t('orders.clearFilters')}
        </Button>
        {state.isFetching && state.status === 'success' ? (
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('orders.refreshing', { defaultValue: 'Đang cập nhật' })}
          </span>
        ) : null}
      </FilterBar>

      <FilterChips
        chips={filterChips}
        onClearAll={resetFilters}
        ariaLabel={t('orders.activeFilters')}
      />

      {/* Thanh hành động hàng loạt — chuyển nhiều đơn PENDING sang Đang xử lý. */}
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
            disabled: bulkConfirming || Boolean(bulkProgress) || mutationsDisabled,
          },
        ]}
      />

      {state.status === 'error' && !hasCachedPage && (
        <StatePanel tone="danger" title={t('orders.loadError')} description={t('orders.loadErrorDesc')}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}

      {listStatus === 'success' && items.length === 0 && (
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

      {(listStatus === 'loading' || (listStatus === 'success' && items.length > 0)) && (
        <div className="bb-card">
          {listStatus === 'loading' ? (
            <span role="status" className="sr-only">{t('orders.loading')}</span>
          ) : null}
          <div
            className={`bb-card-body bb-card-body--flush transition-opacity ${state.isFetching ? 'opacity-60' : 'opacity-100'}`}
            aria-busy={state.isFetching}
          >
            <AdminTable
              caption={t('orders.tableCaption')}
              columns={visibleColumns}
              rows={items}
              loading={listStatus === 'loading'}
              pageSize={query.pageSize}
              selectable={canUpdate}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
              rowHref={(order) => `/admin/orders/${order.id}`}
              mobileCard={mobileCard}
              rowClassName={(order) => orderRowAccent(order.orderStatus)}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={handleSortChange}
            />
          </div>
          {listStatus === 'success' && pagination && (
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
