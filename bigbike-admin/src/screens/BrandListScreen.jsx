import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { showConfirm } from '../lib/confirm'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { Award, Copy, Eye, EyeOff, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { AdminTable } from '../components/AdminTable'
import { Button } from '@/components/ui/button'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { fetchBrandDetail, fetchBrands, updateBrand, deleteBrand, restoreBrand, permanentDeleteBrand } from '../lib/adminApi'
import { formatDateTime, formatText, stripHtml } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = {
  search: '',
  visibility: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
}

// F11: khoá sessionStorage dùng để chuyển bản nháp "Nhân bản" sang màn tạo mới
// (BrandDetailScreen đọc — cùng cơ chế DUPLICATE_SESSION_KEY của Sản phẩm/Danh mục).
const DUPLICATE_SESSION_KEY = 'brand-duplicate-payload'

const SORT_LABEL_KEY = {
  'updatedAt:desc': 'newestUpdated',
  'updatedAt:asc': 'oldestUpdated',
  'name:asc': 'nameAZ',
}

export function BrandListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || INITIAL_QUERY.search
  })
  const debouncedSearch = useDebounce(searchInput, 300)
  const isFirstSearchRender = useRef(true)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkProgress, setBulkProgress] = useState(null) // {done,total} or null
  const [togglingVisibilityId, setTogglingVisibilityId] = useState(null)

  // O9: thương hiệu vừa mở gần đây (ghi lại từ BrandDetailScreen khi mount).
  const recentBrandItems = useRecentItems('recent:brands')

  const state = useAdminList(['brands', query, contentLang], () => fetchBrands(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
    // Selections refer to ids that may leave the visible page after a filter
    // or page change; clear so the bulk bar never shows hidden items.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds([])
  }, [query])

  useEffect(() => {
    if (isFirstSearchRender.current) { isFirstSearchRender.current = false; return }
    setQuery((prev) => ({ ...prev, search: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function updateQuery(partial, options = { resetPage: false }) {
    setQuery((previous) => {
      const next = { ...previous, ...partial }
      if (options.resetPage) next.page = 1
      return next
    })
  }

  function resetFilters() {
    setSearchInput(INITIAL_QUERY.search)
    setQuery(INITIAL_QUERY)
  }

  const items = state.items || []
  const pagination = state.pagination
  const isFiltered = !!query.search || query.visibility !== 'ALL' || query.sort !== INITIAL_QUERY.sort

  // O4: toggle nhanh Hiển thị/Ẩn ngay trên bảng — mượn đúng mẫu cập nhật lạc
  // quan (onMutate + rollback) đã dùng cho Danh mục (CategoryListScreen),
  // thay vì await xong mới invalidate như trước.
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, visible }) => updateBrand(id, { visible }),
    onMutate: async ({ id, visible }) => {
      await queryClient.cancelQueries({ queryKey: ['brands'] })
      const previousQueries = queryClient.getQueriesData({ queryKey: ['brands'] })
      queryClient.setQueriesData({ queryKey: ['brands'] }, (old) => {
        if (!old?.items) return old
        return { ...old, items: old.items.map((b) => (b.id === id ? { ...b, isVisible: visible } : b)) }
      })
      return { previousQueries }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success(t('brands.toggleSuccess', { defaultValue: 'Đã đổi trạng thái hiển thị.' }))
      setTogglingVisibilityId(null)
    },
    onError: (err, _variables, context) => {
      context?.previousQueries?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(err.message || t('common.error'))
      setTogglingVisibilityId(null)
    },
  })

  async function handleToggleVisibility(brand) {
    if (!canUpdate || toggleVisibilityMutation.isPending || bulkProgress) return
    // Đối xứng với Xóa (vốn đã có confirm): ẩn một thương hiệu khỏi web cũng là hành
    // động khiến khách không còn thấy — hỏi xác nhận trước. Hiện lại thì không cần hỏi.
    if (brand.isVisible) {
      const ok = await showConfirm(
        t('brands.hideRowConfirm', { name: brand.name, defaultValue: `Ẩn thương hiệu "{{name}}" khỏi website? Khách sẽ không còn thấy thương hiệu này. Bạn có thể hiện lại bất cứ lúc nào.` }),
        t('brands.hideRowTitle', { defaultValue: 'Ẩn thương hiệu khỏi website?' }),
        { confirmLabel: t('brands.hideAction'), variant: 'danger' },
      )
      if (!ok) return
    }
    setTogglingVisibilityId(brand.id)
    toggleVisibilityMutation.mutate({ id: brand.id, visible: !brand.isVisible })
  }

  // F11: Nhân bản thương hiệu — tải chi tiết đầy đủ, ghi tạm vào sessionStorage
  // rồi điều hướng sang màn tạo mới; BrandDetailScreen đọc bản nháp đó khi mount
  // (cùng cơ chế "Sao chép" đã có ở Sản phẩm/Danh mục).
  const handleDuplicate = async (brand) => {
    try {
      const result = await fetchBrandDetail(brand.id)
      const item = result?.item
      if (!item) return
      try {
        sessionStorage.setItem(DUPLICATE_SESSION_KEY, JSON.stringify(item))
      } catch { /* quota */ }
      navigate('/admin/brands/new')
    } catch {
      toast.error(t('brands.dupLoadError', { defaultValue: 'Không thể tải dữ liệu thương hiệu để sao chép.' }))
    }
  }

  // ── Bulk hiển thị/ẩn nhiều thương hiệu ──────────────────────────────
  async function runBulkVisibility(targetVisible) {
    if (!canUpdate || bulkProgress) return
    const byId = new Map(items.map((b) => [b.id, b]))
    const ids = selectedIds.filter((id) => byId.has(id))
    if (ids.length === 0) return

    // Ẩn hàng loạt là hành động làm thương hiệu biến mất khỏi web công khai
    // (destructive) — bắt buộc xác nhận trước khi chạy các lệnh cập nhật.
    if (targetVisible === false) {
      const ok = await showConfirm(
        t('brands.bulkHideConfirm', { count: ids.length, defaultValue: `Ẩn {{count}} thương hiệu đã chọn? Các trang /brands/{slug} tương ứng sẽ trả về 404 trên web. Có thể hiện lại sau.` }),
        t('brands.bulkHideTitle', { defaultValue: 'Ẩn các thương hiệu đã chọn?' }),
        { variant: 'danger' },
      )
      if (!ok) return
    }

    // Runs in parallel (Promise.allSettled) — unlike categories, brands have no
    // parent/child hide-order constraint, so there is no reason to serialize these.
    setBulkProgress({ done: 0, total: ids.length })
    let success = 0
    let failed = 0
    await Promise.allSettled(
      ids.map((id) =>
        updateBrand(id, { visible: targetVisible })
          .then(() => { success += 1 })
          .catch((err) => {
            failed += 1
            const brand = byId.get(id)
            toast.error(`${brand?.name || id}: ${err.message || t('common.error')}`)
          })
          .finally(() => {
            setBulkProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: ids.length }))
          })
      )
    )
    setBulkProgress(null)
    setSelectedIds([])
    queryClient.invalidateQueries({ queryKey: ['brands'] })
    const summary = t('brands.bulkResult', {
      success,
      failed,
      defaultValue: `Đã cập nhật {{success}} thương hiệu, {{failed}} lỗi.`,
    })
    if (failed === 0) toast.success(summary)
    else if (success === 0) toast.error(summary)
    else toast.warning(summary)
  }

  // ── Bulk khôi phục / xóa vĩnh viễn (khi đang xem Thùng rác) ─────────────
  // Bọc API single-item sẵn có (restoreBrand / permanentDeleteBrand) qua
  // Promise.allSettled — cùng khuôn với runBulkVisibility, không đổi backend.
  async function runBulkTrash(action) {
    if (!canUpdate || bulkProgress) return
    const byId = new Map(items.map((b) => [b.id, b]))
    const ids = selectedIds.filter((id) => byId.has(id))
    if (ids.length === 0) return

    if (action === 'permanentDelete') {
      const ok = await showConfirm(
        t('brands.bulkPermanentDeleteConfirm', { count: ids.length, defaultValue: `Xóa vĩnh viễn {{count}} thương hiệu đã chọn? Thao tác này không thể hoàn tác.` }),
        t('brands.bulkPermanentDeleteTitle', { defaultValue: 'Xóa vĩnh viễn các thương hiệu đã chọn?' }),
        { variant: 'danger', confirmLabel: t('common.permanentDelete') },
      )
      if (!ok) return
    }

    const apiFn = action === 'restore' ? restoreBrand : permanentDeleteBrand
    setBulkProgress({ done: 0, total: ids.length })
    let success = 0
    let failed = 0
    await Promise.allSettled(
      ids.map((id) =>
        apiFn(id)
          .then(() => { success += 1 })
          .catch((err) => {
            failed += 1
            const brand = byId.get(id)
            toast.error(`${brand?.name || id}: ${err.message || t('common.error')}`)
          })
          .finally(() => {
            setBulkProgress((prev) => ({ done: (prev?.done ?? 0) + 1, total: ids.length }))
          })
      )
    )
    setBulkProgress(null)
    setSelectedIds([])
    queryClient.invalidateQueries({ queryKey: ['brands'] })
    if (action === 'permanentDelete') queryClient.invalidateQueries({ queryKey: ['products'] })
    const summary = t('brands.bulkResult', { success, failed, defaultValue: `Đã cập nhật {{success}} thương hiệu, {{failed}} lỗi.` })
    if (failed === 0) toast.success(summary)
    else if (success === 0) toast.error(summary)
    else toast.warning(summary)
  }

  const handleSoftDelete = async (brand) => {
    const confirmed = await showConfirm(
      t('brands.deleteConfirm', { name: brand.name, defaultValue: `Bạn có chắc chắn muốn xóa thương hiệu ${brand.name}? Các sản phẩm của thương hiệu này sẽ bị hủy liên kết.` }),
      t('brands.deleteConfirmTitle', { defaultValue: 'Xác nhận xóa' }),
      { confirmLabel: t('common.delete'), variant: 'danger' }
    )
    if (!confirmed) return

    try {
      await deleteBrand(brand.id)
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success(t('brands.deleteSuccess', { defaultValue: 'Đã chuyển thương hiệu vào Thùng rác.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const handleRestore = async (brand) => {
    const confirmed = await showConfirm(
      t('brands.restoreConfirm', { name: brand.name, defaultValue: `Bạn có chắc chắn muốn khôi phục thương hiệu ${brand.name}?` }),
      t('brands.restoreConfirmTitle', { defaultValue: 'Xác nhận khôi phục' }),
      { confirmLabel: t('products.restore'), variant: 'default' }
    )
    if (!confirmed) return

    try {
      await restoreBrand(brand.id)
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success(t('brands.restoreSuccess', { defaultValue: 'Khôi phục thương hiệu thành công.' }))
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const handlePermanentDelete = async (brand) => {
    const confirmed = await showConfirm(
      t('brands.permanentDeleteConfirm', { name: brand.name, defaultValue: `Bạn có chắc chắn muốn xóa vĩnh viễn thương hiệu ${brand.name}? Thao tác này không thể hoàn tác.` }),
      t('brands.permanentDeleteConfirmTitle', { defaultValue: 'Xác nhận xóa vĩnh viễn' }),
      { confirmLabel: t('common.permanentDelete'), variant: 'danger' }
    )
    if (!confirmed) return

    try {
      const { reassignedProductCount } = await permanentDeleteBrand(brand.id)
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(
        reassignedProductCount > 0
          ? t('brands.permanentDeleteSuccessWithProducts', {
              count: reassignedProductCount,
              defaultValue: `Đã xóa vĩnh viễn thương hiệu. {{count}} sản phẩm bên trong đã được chuyển sang "Chưa phân loại".`,
            })
          : t('brands.permanentDeleteSuccess', { defaultValue: 'Xóa vĩnh viễn thương hiệu thành công.' })
      )
    } catch (error) {
      toast.error(error.message || t('common.error'))
    }
  }

  const sortLabelKey = SORT_LABEL_KEY[query.sort] || 'newestUpdated'

  const activeFilterChips = []
  if (query.search) {
    activeFilterChips.push({
      key: 'search',
      label: t('brands.filterChipSearch', { value: query.search, defaultValue: `Tìm: "{{value}}"` }),
      removeLabel: t('brands.removeFilter', { filter: t('common.search'), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => {
        setSearchInput('')
        updateQuery({ search: '' }, { resetPage: true })
      },
    })
  }
  if (query.visibility !== 'ALL') {
    activeFilterChips.push({
      key: 'visibility',
      label: t('brands.filterChipVisibility', {
        value: query.visibility === 'VISIBLE' ? t('common.visible') : t('common.hidden'),
        defaultValue: `Trạng thái: {{value}}`,
      }),
      removeLabel: t('brands.removeFilter', { filter: t('brands.filterVisibility'), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => updateQuery({ visibility: 'ALL' }, { resetPage: true }),
    })
  }
  if (query.sort !== INITIAL_QUERY.sort) {
    activeFilterChips.push({
      key: 'sort',
      label: t('brands.filterChipSort', { value: t(`sort.${sortLabelKey}`), defaultValue: `Sắp xếp: {{value}}` }),
      removeLabel: t('brands.removeFilter', { filter: t('brands.filterSort'), defaultValue: `Bỏ lọc {{filter}}` }),
      onRemove: () => updateQuery({ sort: INITIAL_QUERY.sort }, { resetPage: true }),
    })
  }

  // Nút thao tác dòng — dùng chung cho cột "actions" (desktop) và thẻ mobile,
  // để điện thoại có đủ hành động nhanh như bảng (P2-2).
  const renderRowActions = (brand) => {
    const isTrashed = !brand.isVisible
    return (
      <>
        {!isTrashed && (
          <Button variant="ghost" size="icon" title={t('common.edit')} aria-label={t('common.edit')} onClick={() => navigate(`/admin/brands/${brand.id}`)}>
            <Pencil size={14} aria-hidden="true" />
          </Button>
        )}
        {canUpdate && !isTrashed && (
          <Button variant="ghost" size="icon" title={t('brands.duplicate')} aria-label={t('brands.duplicate')} onClick={() => handleDuplicate(brand)}>
            <Copy size={14} aria-hidden="true" />
          </Button>
        )}
        {canUpdate && !isTrashed && (
          <Button variant="ghost" size="icon" title={brand.isVisible ? t('brands.hideAction') : t('brands.showAction')} aria-label={brand.isVisible ? t('brands.hideAction') : t('brands.showAction')} disabled={toggleVisibilityMutation.isPending && togglingVisibilityId === brand.id} onClick={() => handleToggleVisibility(brand)}>
            {brand.isVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          </Button>
        )}
        {canUpdate && !isTrashed && (
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => handleSoftDelete(brand)}>
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        )}
        {canUpdate && isTrashed && (
          <>
            <Button variant="ghost" size="icon" title={t('products.restore')} aria-label={t('products.restore')} onClick={() => handleRestore(brand)}>
              <Undo2 size={14} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={t('common.permanentDelete')} aria-label={t('common.permanentDelete')} onClick={() => handlePermanentDelete(brand)}>
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </>
        )}
      </>
    )
  }

  const columns = [
    {
      key: 'brand',
      label: t('brands.colBrand'),
      render: (brand) => (
        <div className="product-cell">
          <span className="bb-product-thumb">
            {brand.logo?.url ? (
              <img
                src={brand.logo.url}
                alt={brand.logo.alt || brand.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : <Award size={18} />}
          </span>
          <div className="info">
            <div className="name">{formatText(brand.name)}</div>
            <div className="sku">/{brand.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      label: t('brands.colDescription'),
      render: (brand) => {
        const desc = stripHtml(brand.description)
        return desc ? <span className="bb-muted">{desc}</span> : <span className="cell-empty">—</span>
      },
    },
    {
      key: 'visibility',
      label: t('brands.colVisibility'),
      render: (brand) => <StatusBadge type="visibility" status={brand.isVisible} />,
    },
    {
      key: 'updatedAt',
      label: t('brands.colUpdated'),
      align: 'right',
      render: (brand) => <span className="bb-muted text-xs">{formatDateTime(brand.updatedAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (brand) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          {renderRowActions(brand)}
        </div>
      ),
    },
  ]

  // T7: cho phép ẩn/hiện cột Mô tả/Cập nhật trên bảng thương hiệu, lưu theo trình duyệt.
  const { visibleColumns, hiddenKeys, toggle: toggleColumn, allColumns } = useColumnVisibility(columns, 'columns:brands')

  const mobileCard = (brand) => ({
    title: formatText(brand.name),
    subtitle: `/${brand.slug}`,
    status: <StatusBadge type="visibility" status={brand.isVisible} />,
    meta: [
      { label: t('brands.colDescription'), value: stripHtml(brand.description) || '—' },
      { label: t('brands.colUpdated'), value: formatDateTime(brand.updatedAt) },
    ],
    onClick: () => navigate(`/admin/brands/${brand.id}`),
    // P2-2: hành động nhanh trên thẻ mobile (edit không cần canUpdate; nút trash cần canUpdate).
    actions: (brand.isVisible || canUpdate) ? renderRowActions(brand) : undefined,
  })

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('brands.eyebrow')}</p>
          <h1>{t('brands.title')}</h1>
          <p className="bb-muted">{t('brands.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <Button
            type="button"
            onClick={() => navigate('/admin/brands/new')}
            disabled={!canUpdate}
          >
            <Plus size={14} />{canUpdate ? t('brands.create') : t('common.noPermission')}
          </Button>
        </div>
      </div>

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentBrandItems} onSelect={(item) => navigate(`/admin/brands/${item.id}`)} />

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('brands.searchPlaceholder')}
        />
        <FilterSelect
          value={query.visibility}
          onValueChange={(v) => updateQuery({ visibility: v }, { resetPage: true })}
          ariaLabel={t('brands.filterVisibility')}
          options={[
            { value: 'ALL', label: t('brands.filterVisibilityAll', { defaultValue: 'Tất cả trạng thái' }) },
            { value: 'VISIBLE', label: t('common.visible', { defaultValue: 'Đang hiển thị' }) },
            { value: 'HIDDEN', label: t('brands.filterVisibilityHidden', { defaultValue: 'Đã ẩn' }) },
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('brands.filterSort')}
          options={[
            { value: 'updatedAt:desc', label: t('sort.newestUpdated') },
            { value: 'updatedAt:asc', label: t('sort.oldestUpdated') },
            { value: 'name:asc', label: t('sort.nameAZ') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
        <ColumnVisibilityToggle allColumns={allColumns} hiddenKeys={hiddenKeys} onToggle={toggleColumn} />
      </div>

      {/* Filter chips — chỉ báo gọn đang lọc gì + gỡ từng filter. */}
      <FilterChips
        chips={activeFilterChips}
        onClearAll={resetFilters}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.clear')}
        ariaLabel={t('brands.activeFiltersAria', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {/* Thanh hành động hàng loạt — ẩn/hiện nhiều thương hiệu. */}
      <BulkActionBar
        selectedCount={canUpdate && selectedIds.length > 0
          ? (bulkProgress
            ? t('brands.bulkProcessing', { done: bulkProgress.done, total: bulkProgress.total, defaultValue: `Đang xử lý {{done}}/{{total}}...` })
            : t('brands.bulkSelectedCount', { count: selectedIds.length, defaultValue: `Đã chọn {{count}} thương hiệu` }))
          : null}
        onClear={() => setSelectedIds([])}
        closeLabel={t('common.deselect', { defaultValue: 'Bỏ chọn' })}
        actions={query.visibility === 'HIDDEN'
          ? [
            {
              label: t('products.restore'),
              onClick: () => runBulkTrash('restore'),
              disabled: Boolean(bulkProgress),
            },
            {
              label: t('common.permanentDelete'),
              tone: 'danger',
              onClick: () => runBulkTrash('permanentDelete'),
              disabled: Boolean(bulkProgress),
            },
          ]
          : [
            {
              label: t('brands.bulkShow', { defaultValue: 'Hiện các thương hiệu đã chọn' }),
              onClick: () => runBulkVisibility(true),
              disabled: Boolean(bulkProgress),
            },
            {
              label: t('brands.bulkHide', { defaultValue: 'Ẩn các thương hiệu đã chọn' }),
              tone: 'danger',
              onClick: () => runBulkVisibility(false),
              disabled: Boolean(bulkProgress),
            },
          ]}
      />

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('brands.loadError')}
          description={state.error || t('brands.loadErrorDesc', { defaultValue: 'Không thể tải danh sách thương hiệu. Vui lòng thử lại.' })}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={isFiltered ? t('brands.emptyFiltered', { defaultValue: t('brands.empty') }) : t('brands.empty')}
          description={isFiltered ? t('brands.emptyFilteredDesc', { defaultValue: t('brands.emptyDesc') }) : t('brands.emptyDesc')}
          actionLabel={isFiltered ? t('common.resetFilters') : undefined}
          onAction={isFiltered ? resetFilters : undefined}
        />
      ) : null}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={visibleColumns}
              rows={items}
              caption={t('brands.tableCaption')}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              selectable={canUpdate}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onRowClick={(brand) => navigate(`/admin/brands/${brand.id}`)}
              rowHref={(brand) => `/admin/brands/${brand.id}`}
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
