import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { showConfirm } from '../lib/confirm'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { Award, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { AdminTable } from '../components/AdminTable'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { fetchBrands, updateBrand, deleteBrand, restoreBrand, permanentDeleteBrand } from '../lib/adminApi'
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
      await permanentDeleteBrand(brand.id)
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      toast.success(t('brands.permanentDeleteSuccess', { defaultValue: 'Xóa vĩnh viễn thương hiệu thành công.' }))
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

  const columns = [
    {
      key: 'brand',
      label: t('brands.colBrand'),
      render: (brand) => (
        <div className="product-cell">
          <span className="thumb">
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
      render: (brand) => {
        const isTrashed = query.visibility === 'HIDDEN'
        return (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
            {!isTrashed && (
              <button
                type="button"
                className="bb-icon-btn"
                title={t('common.edit')}
                aria-label={t('common.edit')}
                onClick={() => navigate(`/admin/brands/${brand.id}`)}
              >
                <Pencil size={14} />
              </button>
            )}
            {canUpdate && !isTrashed && (
              <button
                type="button"
                className="bb-icon-btn danger"
                title={t('common.delete')}
                aria-label={t('common.delete')}
                onClick={() => handleSoftDelete(brand)}
              >
                <Trash2 size={14} />
              </button>
            )}
            {canUpdate && isTrashed && (
              <>
                <button
                  type="button"
                  className="bb-icon-btn"
                  title={t('products.restore')}
                  aria-label={t('products.restore')}
                  onClick={() => handleRestore(brand)}
                >
                  <Undo2 size={14} />
                </button>
                <button
                  type="button"
                  className="bb-icon-btn danger"
                  title={t('common.permanentDelete')}
                  aria-label={t('common.permanentDelete')}
                  onClick={() => handlePermanentDelete(brand)}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        )
      },
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
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            onClick={() => navigate('/admin/brands/new')}
            disabled={!canUpdate}
          >
            <Plus size={14} />{canUpdate ? t('brands.create') : t('common.noPermission')}
          </button>
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
            { value: 'HIDDEN', label: t('common.hidden', { defaultValue: 'Thùng rác' }) },
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
        actions={[
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
          description={state.error || 'Unknown brand list error.'}
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
