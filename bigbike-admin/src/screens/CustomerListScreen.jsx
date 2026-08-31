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
import { DetailSection } from '../components/DetailSection'
import { CustomerStatusReasonModal } from '../components/CustomerStatusReasonModal'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { KpiCard } from '../components/KpiCard'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { ResponsiveFilterBar, Screen, ScreenHeader } from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { exportCustomersCsv, fetchCustomers, fetchCustomerSummary, updateCustomerStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { useHasPermission } from '@/lib/auth'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { customerRowAccent } from '../lib/statusTone'

// Backend accepts all CustomerStatus values for an explicit admin status change.
// Keep local to avoid importing one lazy-loaded screen from another.
const CUSTOMER_STATUSES = ['ACTIVE', 'PENDING', 'DISABLED', 'BLOCKED']

const STATUS_BADGE = {
  ACTIVE: 'bb-badge-success',
  PENDING: 'bb-badge-warning',
  DISABLED: 'bb-badge-neutral',
  BLOCKED: 'bb-badge-danger',
  UNKNOWN: 'bb-badge-neutral',
}

const INITIAL_QUERY = {
  search: '',
  status: 'ALL',
  synthetic: 'ALL',
  emailVerified: 'ALL',
  page: 1,
  pageSize: 20,
}

function CustomerStatusBadge({ value }) {
  const { t } = useTranslation()
  const cls = STATUS_BADGE[value] || 'bb-badge-neutral'
  return (
    <span className={`bb-badge ${cls}`}>
      <span className="dot" />
      {t(`status.customer.${value}`, { defaultValue: t('common.unknown') })}
    </span>
  )
}

export function CustomerListScreen({ navigate, canUpdate }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  // Q3: chỉ hiện nút Xuất CSV khi tài khoản có quyền xuất báo cáo.
  const hasPermission = useHasPermission()
  const canExport = hasPermission('reports.export')
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  // O4: id khách hàng đang đổi trạng thái ngay trên dòng — khoá Select + chặn double-submit.
  const [statusSaving, setStatusSaving] = useState({})
  // Every non-ACTIVE target revokes all active sessions. Ask for explicit
  // confirmation and an optional audit reason before applying that side effect.
  const [reasonModal, setReasonModal] = useState(null)
  // O9 — khách hàng admin vừa xem gần đây, cho phép quay lại nhanh.
  const recentCustomerItems = useRecentItems('recent:customers')

  const state = useAdminList(['customers', query], () => fetchCustomers(query))

  const { data: summary, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['customer-summary'],
    queryFn: fetchCustomerSummary,
    staleTime: 60_000,
  })

  useEffect(() => {
    const unsubscribe = subscribeAdminWs('/topic/admin/customers', () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
    })
    return unsubscribe
  }, [queryClient])

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    // T9: lưu lại query string đang áp dụng để nút "Quay lại danh sách" ở trang
    // chi tiết không làm mất filter/trang.
    try { sessionStorage.setItem('customers:listQuery', window.location.search) } catch { /* ignore */ }
  }, [query])

  async function handleStatusChange(customer, value) {
    if (!value || value === customer.status || statusSaving[customer.id]) return
    if (value !== 'ACTIVE') {
      setReasonModal({ customer, value })
      return
    }
    await applyStatusChange(customer, value)
  }

  async function applyStatusChange(customer, value, reason) {
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
      await updateCustomerStatus(customer.id, value, reason)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
      toast.success(t('customers.detail.statusUpdated'))
      return true
    } catch (err) {
      if (previous !== undefined) queryClient.setQueryData(queryKey, previous)
      toast.error(err.message || t('common.error'))
      return false
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
    setQuery((current) => ({ ...INITIAL_QUERY, pageSize: current.pageSize }))
  }

  const items = state.items || []
  const pagination = state.pagination

  useEffect(() => {
    if (state.status !== 'success' || state.isFetching || !pagination) return
    const lastPage = Math.max(1, Number(pagination.totalPages) || 1)
    if (query.page <= lastPage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((previous) => ({ ...previous, page: lastPage }))
  }, [pagination, query.page, state.isFetching, state.status])

  const isFiltered = !!query.search
    || query.status !== 'ALL'
    || query.synthetic !== 'ALL'
    || query.emailVerified !== 'ALL'

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
        value: t(`status.customer.${query.status}`, { defaultValue: t('common.unknown') }),
        defaultValue: `Trạng thái: {{value}}`,
      }),
      removeLabel: t('customers.removeFilter', { filter: t('customers.filterStatus'), defaultValue: `Bỏ bộ lọc {{filter}}` }),
      onRemove: () => updateQuery({ status: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.synthetic !== 'ALL') {
    activeFilterChips.push({
      key: 'synthetic',
      label: t('customers.filterChipSource', {
        value: query.synthetic === 'true' ? t('customers.sourceSynthetic') : t('customers.sourceReal'),
        defaultValue: `Nguồn: {{value}}`,
      }),
      removeLabel: t('customers.removeFilter', { filter: t('customers.filterSource'), defaultValue: `Bỏ bộ lọc {{filter}}` }),
      onRemove: () => updateQuery({ synthetic: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.emailVerified !== 'ALL') {
    activeFilterChips.push({
      key: 'emailVerified',
      label: t('customers.filterChipEmailVerified', {
        value: query.emailVerified === 'true'
          ? t('customers.emailVerified')
          : t('customers.emailNotVerified'),
      }),
      removeLabel: t('customers.removeFilter', {
        filter: t('customers.filterEmailVerified'),
      }),
      onRemove: () => updateQuery({ emailVerified: 'ALL' }, { resetPage: true }),
    })
  }

  // O4: control đổi trạng thái dùng chung cho cả bảng (desktop) và thẻ (mobile) để
  // giữ đúng năng lực chỉnh nhanh trạng thái trên mọi kích thước màn hình.
  function renderStatusSelect(c) {
    return (
      <Select
        value={c.status}
        onValueChange={(v) => handleStatusChange(c, v)}
        disabled={!!statusSaving[c.id]}
      >
        <SelectTrigger
          className="min-h-11 w-auto"
          aria-label={t('customers.colStatus')}
          aria-busy={!!statusSaving[c.id]}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent onClick={(e) => e.stopPropagation()}>
          {CUSTOMER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{t(`status.customer.${s}`, { defaultValue: t('common.unknown') })}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  const columns = [
    {
      key: 'customer',
      label: t('customers.colCustomer'),
      render: (c) => {
        const name = formatText(c.fullName, c.email)
        // Chữ cái đại diện lấy từ tên/email thật, không lấy ký tự placeholder "—".
        const initialSource = (c.fullName || c.email || '').trim()
        const initial = initialSource ? initialSource.charAt(0).toUpperCase() : '?'
        return (
          <div className="bb-product-cell">
            <span className="bb-product-thumb">{initial}</span>
            <span>
              <div>{name}</div>
              {c.fullName ? <div className="bb-cell-sub">{formatText(c.email)}</div> : null}
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
      render: (c) => (canUpdate && !c.isSynthetic && CUSTOMER_STATUSES.includes(c.status))
        ? renderStatusSelect(c)
        : <CustomerStatusBadge value={c.status} />,
    },
    { key: 'orderCount', label: t('customers.colOrders'), align: 'right', render: (c) => c.orderCount },
    { key: 'totalSpent', label: t('customers.colSpent'), align: 'right', render: (c) => <span className="font-bold">{formatCurrencyVnd(c.totalSpent)}</span> },
    { key: 'createdAt', label: t('customers.colRegistered'), render: (c) => <span className="bb-muted text-xs">{formatDateTime(c.createdAt)}</span> },
    { key: 'source', label: t('customers.colSource'), render: (c) => <StatusBadge type="source" status={c.isSynthetic} /> },
  ]

  // T7: cho phép ẩn/hiện cột trên bảng khách hàng, lưu lựa chọn theo trình duyệt.
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:customers')

  const mobileCard = (c) => ({
    title: formatText(c.fullName, c.email),
    subtitle: c.fullName ? formatText(c.email) : undefined,
    status: <CustomerStatusBadge value={c.status} />,
    meta: [
      { label: t('customers.colPhone'), value: formatText(c.phone) },
      { label: t('customers.colOrders'), value: c.orderCount },
      { label: t('customers.colSpent'), value: formatCurrencyVnd(c.totalSpent), tone: 'strong' },
      { label: t('customers.colRegistered'), value: formatDateTime(c.createdAt) },
      { label: t('customers.colSource'), value: <StatusBadge type="source" status={c.isSynthetic} /> },
    ],
    // Parity với bảng desktop: cho đổi nhanh trạng thái ngay trên thẻ mobile (đặt ở
    // hàng thao tác, nằm ngoài vùng bấm mở chi tiết để không lồng nút).
    actions: (canUpdate && !c.isSynthetic && CUSTOMER_STATUSES.includes(c.status)) ? (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('customers.colStatus')}</span>
        {renderStatusSelect(c)}
      </div>
    ) : undefined,
    onClick: () => navigate(`/admin/customers/${c.id}`),
  })
  const activeRegisteredFilter = query.status === 'ACTIVE' && query.synthetic === 'false'
  const toggleActiveRegisteredFilter = () => updateQuery(
    activeRegisteredFilter
      ? { status: 'ALL', synthetic: 'ALL' }
      : { status: 'ACTIVE', synthetic: 'false' },
    { resetPage: true },
  )

  return (
    <Screen>
      <ScreenHeader
        group="sales"
        title={t('customers.title')}
        actions={canExport ? (
            <ExportButton
              onExport={async () => {
                try {
                  await exportCustomersCsv({
                    q: query.search || undefined,
                    status: query.status !== 'ALL' ? query.status : undefined,
                    synthetic: query.synthetic !== 'ALL' ? query.synthetic : undefined,
                    emailVerified: query.emailVerified !== 'ALL' ? query.emailVerified : undefined,
                  })
                } catch {
                  throw new Error(t('export.error'))
                }
              }}
            >
              {t('common.exportCsv', { defaultValue: 'Xuất dữ liệu' })}
            </ExportButton>
        ) : null}
      />

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentCustomerItems} onSelect={(item) => navigate(`/admin/customers/${item.id}`)} />

      <Alert tone="info" size="sm" className="mb-4" role="status">
        {t('customers.historyScopeDisclosure')}
      </Alert>

      {/* Thẻ "Đang hoạt động" lọc đúng cùng tập tài khoản đăng ký như KPI:
          status=ACTIVE và synthetic=false. VIP/Mới 30 ngày chưa có bộ lọc danh sách
          tương ứng nên giữ dạng số liệu tĩnh. */}
      {summary ? (
        <div className="bb-kpi-grid bb-kpi-grid-4">
          <KpiCard
            label={t('customers.kpi.total')}
            value={summary.total.toLocaleString(i18n.language)}
            icon={<Users size={15} />}
            tone="danger"
            detail={t('customers.kpi.totalHint')}
          />
          <KpiCard
            label={t('customers.kpi.vip')}
            value={summary.vip.toLocaleString(i18n.language)}
            icon={<Crown size={15} />}
            tone="warning"
            detail={t('customers.kpi.vipHint')}
          />
          <KpiCard
            label={t('customers.kpi.new30d')}
            value={summary.newLast30Days.toLocaleString(i18n.language)}
            icon={<UserPlus size={15} />}
            tone="info"
            detail={t('customers.kpi.new30dHint')}
          />
          <KpiCard
            label={t('customers.kpi.active')}
            value={summary.active.toLocaleString(i18n.language)}
            icon={<UserCheck size={15} />}
            tone="success"
            clickable
            active={activeRegisteredFilter}
            ariaLabel={t('customers.kpi.activeFilterAria', { defaultValue: 'Đang hoạt động — lọc danh sách theo trạng thái Hoạt động' })}
            onClick={toggleActiveRegisteredFilter}
            detail={t('customers.kpi.activeHint')}
          />
        </div>
      ) : summaryError ? (
        // (a) Trước đây summary lỗi để skeleton chạy vô hạn — nay hiện trạng thái lỗi + Thử lại.
        <StatePanel
          tone="danger"
          title={t('customers.summaryError', { defaultValue: 'Không tải được số liệu tổng quan' })}
          description={t('customers.summaryErrorDesc', { defaultValue: 'Số liệu khách hàng tạm thời không tải được. Vui lòng thử lại.' })}
          actionLabel={t('common.retry')}
          onAction={() => refetchSummary()}
        />
      ) : (
        <div className="bb-kpi-grid bb-kpi-grid-4">
          {[...Array(4)].map((_, i) => (
              <ScreenSkeleton key={i} variant="cards" count={1} showHeader={false} />
          ))}
        </div>
      )}

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}
      {!canUpdate ? (
        <ReadOnlyBanner
          warning={t('customers.readOnlyHint')}
        />
      ) : null}

      <ResponsiveFilterBar
        ariaLabel={t('customers.filtersAria')}
        activeFilterCount={activeFilterChips.length}
        onReset={resetFilters}
      >
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('customers.searchPlaceholder')}
          className="min-h-11"
          wrapperClassName="min-w-48 flex-1"
        />
        <FilterSelect
          value={query.status}
          onValueChange={(v) => updateQuery({ status: v }, { resetPage: true })}
          ariaLabel={t('customers.filterStatus')}
          className="min-h-11"
          options={[
            { value: 'ALL', label: t('customers.filterStatus') },
            { value: 'ACTIVE', label: t('status.customer.ACTIVE') },
            { value: 'PENDING', label: t('status.customer.PENDING') },
            { value: 'DISABLED', label: t('status.customer.DISABLED') },
            { value: 'BLOCKED', label: t('status.customer.BLOCKED') },
          ]}
        />
        <FilterSelect
          value={query.synthetic}
          onValueChange={(v) => updateQuery({ synthetic: v }, { resetPage: true })}
          ariaLabel={t('customers.filterSource')}
          className="min-h-11"
          options={[
            { value: 'ALL', label: t('customers.filterSource') },
            { value: 'false', label: t('customers.sourceReal') },
            { value: 'true', label: t('customers.sourceSynthetic') },
          ]}
        />
        <FilterSelect
          value={query.emailVerified}
          onValueChange={(v) => updateQuery({ emailVerified: v }, { resetPage: true })}
          ariaLabel={t('customers.filterEmailVerified')}
          className="min-h-11"
          options={[
            { value: 'ALL', label: t('customers.filterEmailVerified') },
            { value: 'true', label: t('customers.emailVerified') },
            { value: 'false', label: t('customers.emailNotVerified') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
          className="min-h-11"
        />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
        {state.isFetching && state.status === 'success' ? (
          <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('customers.refreshing')}
          </span>
        ) : null}
      </ResponsiveFilterBar>

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
        <DetailSection noPadding>
            <AdminTable
              caption={t('customers.tableCaption')}
              columns={visibleColumns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={(c) => navigate(`/admin/customers/${c.id}`)}
              rowHref={(c) => `/admin/customers/${c.id}`}
              rowClassName={(customer) => customerRowAccent(customer.status)}
              mobileCard={mobileCard}
              densityKey="customers"
            />
          {state.status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              disabled={state.isFetching || Object.keys(statusSaving).length > 0}
              onPageChange={(p) => updateQuery({ page: p })}
            />
          )}
        </DetailSection>
      )}

      {reasonModal && (
        <CustomerStatusReasonModal
          title={t('customers.detail.statusConfirmTitle', { defaultValue: 'Đổi trạng thái tài khoản' })}
          description={t('customers.detail.statusConfirmBody', {
            status: t(`status.customer.${reasonModal.value}`, { defaultValue: t('common.unknown') }),
          })}
          confirmLabel={t('customers.detail.statusConfirmOk', { defaultValue: 'Đổi trạng thái' })}
          confirmVariant={reasonModal.value === 'BLOCKED' || reasonModal.value === 'DISABLED' ? 'danger' : 'default'}
          loading={!!statusSaving[reasonModal.customer.id]}
          onConfirm={async (reason) => {
            const ok = await applyStatusChange(reasonModal.customer, reasonModal.value, reason)
            if (ok) setReasonModal(null)
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </Screen>
  )
}
