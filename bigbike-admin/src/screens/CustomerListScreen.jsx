import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, UserCheck, UserPlus, Users } from 'lucide-react'
import { toast } from '@/lib/toast'
import { ExportButton } from '@/components/ExportButton'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { FilterChips } from '../components/FilterChips'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { StatePanel } from '../components/StatePanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { exportCustomersCsv, fetchCustomers, fetchCustomerSummary, updateCustomerStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

// O4: tái dùng đúng danh sách trạng thái có thể set thủ công của CustomerDetailScreen
// (giữ local thay vì import chéo giữa 2 screen — mỗi screen là 1 lazy chunk riêng).
const CUSTOMER_STATUSES = ['ACTIVE', 'DISABLED', 'BLOCKED']

const STATUS_BADGE = {
  ACTIVE: 'bb-badge-success',
  PENDING: 'bb-badge-warning',
  DISABLED: 'bb-badge-neutral',
  BLOCKED: 'bb-badge-danger',
  UNKNOWN: 'bb-badge-neutral',
}

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

// N5: khung skeleton cùng chiều cao 1 thẻ .bb-kpi thật, dự trữ không gian ngay từ lần
// render đầu tiên (cùng cách DashboardScreen.jsx làm với khối bb-kpi-grid của nó).
function SkeletonBlock({ height }) {
  return <div className="bb-skeleton-block" style={{ height }} />
}

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

export function CustomerListScreen({ navigate, canUpdate }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  // O4: id khách hàng đang đổi trạng thái ngay trên dòng — khoá Select + chặn double-submit.
  const [statusSaving, setStatusSaving] = useState({})
  // O9 — khách hàng admin vừa xem gần đây, cho phép quay lại nhanh.
  const recentCustomerItems = useRecentItems('recent:customers')

  const state = useAdminList(['customers', query], () => fetchCustomers(query))

  const { data: summary } = useQuery({
    queryKey: ['customer-summary'],
    queryFn: fetchCustomerSummary,
    staleTime: 60_000,
  })

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    // T9: lưu lại query string đang áp dụng để nút "Quay lại danh sách" ở trang
    // chi tiết không làm mất filter/trang.
    try { sessionStorage.setItem('customers:listQuery', window.location.search) } catch { /* ignore */ }
  }, [query])

  // O4: đổi trạng thái ngay trên 1 dòng — tái dùng CUSTOMER_STATUSES + xác nhận
  // BLOCKED/DISABLED của CustomerDetailScreen, không cần rời danh sách.
  async function handleStatusChange(customer, value) {
    if (!value || value === customer.status || statusSaving[customer.id]) return
    if (value === 'BLOCKED' || value === 'DISABLED') {
      const label = t(`status.customer.${value}`, { defaultValue: value })
      const ok = await showConfirm(
        t('customers.detail.statusConfirmBody', {
          status: label,
          defaultValue: `Chuyển tài khoản sang "${label}" sẽ chặn khách hàng đăng nhập và mua hàng. Tiếp tục?`,
        }),
        t('customers.detail.statusConfirmTitle', { defaultValue: 'Đổi trạng thái tài khoản' }),
        { confirmLabel: t('customers.detail.statusConfirmOk', { defaultValue: 'Đổi trạng thái' }) },
      )
      if (!ok) return
    }
    setStatusSaving((prev) => ({ ...prev, [customer.id]: true }))
    // N7: cập nhật lạc quan ngay trên dòng đang xem, rollback nếu API lỗi — cùng
    // pattern optimistic đã có ở ReviewListScreen.handleStatusChange /
    // CustomerDetailScreen.handleStatusChange, thay vì đợi round-trip mới đổi Select.
    const queryKey = ['customers', query]
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, (old) => (
      old?.items
        ? { ...old, items: old.items.map((c) => (c.id === customer.id ? { ...c, status: value } : c)) }
        : old
    ))
    try {
      await updateCustomerStatus(customer.id, value)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
      toast.success(t('customers.detail.statusUpdated'))
    } catch (err) {
      if (previous !== undefined) queryClient.setQueryData(queryKey, previous)
      toast.error(err.message || t('common.error'))
    } finally {
      setStatusSaving((prev) => {
        const next = { ...prev }
        delete next[customer.id]
        return next
      })
    }
  }

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
    {
      key: 'status',
      label: t('customers.colStatus'),
      // Trạng thái ngoài nhóm set-được (vd PENDING "chờ kích hoạt") → huy hiệu chỉ-đọc,
      // KHÔNG để Select trống trông như lỗi (audit P0-5).
      render: (c) => (canUpdate && CUSTOMER_STATUSES.includes(c.status)) ? (
        <Select
          value={c.status}
          onValueChange={(v) => handleStatusChange(c, v)}
          disabled={!!statusSaving[c.id]}
        >
          <SelectTrigger className="h-8 w-auto" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent onClick={(e) => e.stopPropagation()}>
            {CUSTOMER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.customer.${s}`, { defaultValue: s })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : <CustomerStatusBadge value={c.status} />,
    },
    { key: 'orderCount', label: t('customers.colOrders'), align: 'right', render: (c) => c.orderCount },
    { key: 'totalSpent', label: t('customers.colSpent'), align: 'right', render: (c) => <span className="font-bold">{formatCurrencyVnd(c.totalSpent)}</span> },
    { key: 'createdAt', label: t('customers.colRegistered'), render: (c) => <span className="bb-muted text-xs">{formatDateTime(c.createdAt)}</span> },
  ]

  // T7: cho phép ẩn/hiện cột trên bảng khách hàng, lưu lựa chọn theo trình duyệt.
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:customers')

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

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentCustomerItems} onSelect={(item) => navigate(`/admin/customers/${item.id}`)} />

      {/* O5: chỉ thẻ "Đang hoạt động" click được ra filter — nó khớp 1-1 với
          query.status=ACTIVE đã có. VIP/Mới 30 ngày tính theo phân khúc chi tiêu/ngày
          đăng ký, API danh sách khách hàng hiện chưa có filter tương ứng (chỉ filter
          theo status ACTIVE/PENDING/DISABLED/BLOCKED) nên chưa thể click-lọc đúng mà
          không đổi API — để nguyên dạng số liệu tĩnh cho 2 thẻ đó. */}
      {summary ? (
        <div className="bb-kpi-grid bb-kpi-grid-4">
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
          <div
            className={`bb-kpi clickable${query.status === 'ACTIVE' ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={t('customers.kpi.activeFilterAria', { defaultValue: 'Đang hoạt động — lọc danh sách theo trạng thái Hoạt động' })}
            onClick={() => updateQuery({ status: query.status === 'ACTIVE' ? 'ALL' : 'ACTIVE' }, { resetPage: true })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                updateQuery({ status: query.status === 'ACTIVE' ? 'ALL' : 'ACTIVE' }, { resetPage: true })
              }
            }}
          >
            <div className="bb-kpi-head">
              <span className="bb-kpi-icon success"><UserCheck size={15} /></span>
              <span>{t('customers.kpi.active')}</span>
            </div>
            <div className="bb-kpi-value">{summary.active.toLocaleString(i18n.language)}</div>
            <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('customers.kpi.activeHint')}</span></div>
          </div>
        </div>
      ) : (
        <div className="bb-kpi-grid bb-kpi-grid-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonBlock key={i} height={120} />
          ))}
        </div>
      )}

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
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
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
              columns={visibleColumns}
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
