import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { Check, ChevronDown, ChevronsUpDown, ChevronUp, Plus } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { ExportButton } from '@/components/ExportButton'
import { StatePanel } from '../components/StatePanel'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterChips } from '../components/FilterChips'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { ColumnVisibilityToggle } from '../components/ColumnVisibilityToggle'
import { RecentItemsChips } from '../components/RecentItemsChips'
import { showConfirm } from '../lib/confirm'
import { ApiClientError, exportProductsCsv, fetchBrands, fetchCategoryTree, fetchProductDetail, fetchProducts, publishProduct, restoreProduct, softDeleteProduct, permanentDeleteProduct } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { useColumnVisibility } from '../lib/useColumnVisibility'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { useRecentItems } from '../lib/useRecentItems'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PaginationControls } from '../components/PaginationControls'
import { MobileCardList } from '../components/layout/MobileCardList'
import { DUPLICATE_SESSION_KEY, HOMEPAGE_BLOCK_LABEL_KEYS, HOMEPAGE_BLOCK_LIMITS, INITIAL_QUERY, buildCategoryTreeOrder, categoryLabel } from './product-list/constants'
import { ProductRow } from './product-list/ProductRow'
import { ProductMobileCard } from './product-list/ProductMobileCard'

export function ProductListScreen({ navigate, canUpdate }) {
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
  const [deletingId, setDeletingId] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const [togglingPublishId, setTogglingPublishId] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const state = useAdminList(['products', query, contentLang], () => fetchProducts(query))

  // O9: sản phẩm vừa mở gần đây (ghi lại từ ProductDetailScreen khi mount).
  const recentProductItems = useRecentItems('recent:products')

  // T7: cho phép ẩn/hiện các cột phụ trên bảng sản phẩm, lưu lựa chọn theo trình duyệt.
  const { hiddenKeys: hiddenColumnKeys, toggle: toggleColumn, allColumns: allColumnDefs } = useColumnVisibility(
    [
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: t('products.colCategory') },
      { key: 'brand', label: t('products.colBrand') },
      { key: 'homepage', label: t('products.colHomepage') },
      { key: 'updatedAt', label: t('products.colUpdated') },
    ],
    'columns:products',
  )

  // Bộ lọc trên màn duyệt = strict-EN theo PRODUCT_RULE_004 (ẩn mục chưa dịch để
  // biết cái nào còn thiếu bản tiếng Anh) — khác với selector trong form (full).
  const { data: brandsData } = useQuery({ queryKey: ['brands-all', contentLang], queryFn: () => fetchBrands({ pageSize: 100, sort: 'name:asc' }), staleTime: 5 * 60_000 })
  const { data: categoriesData } = useQuery({ queryKey: ['categories', 'tree', contentLang], queryFn: () => fetchCategoryTree(), staleTime: 5 * 60_000 })
  const brands = useMemo(() => brandsData?.items ?? [], [brandsData])
  const categories = useMemo(() => categoriesData?.items ?? [], [categoriesData])
  // Depth-annotated (parent-first, child indented) order for the category filter dropdown —
  // categories is already flattened parent-before-children, this just adds `depth` per item.
  const categoryTreeOptions = useMemo(() => buildCategoryTreeOrder(categories), [categories])

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
    if (!openMenu) return
    const onClick = (e) => {
      if (!e.target.closest('.bb-row-menu') && !e.target.closest('[data-row-menu-trigger]')) setOpenMenu(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [openMenu])

  // Functional update (not reading `openMenu` from closure) + useCallback([]) so this
  // handler's identity stays stable across renders — passing a fresh arrow function to
  // every ProductRow on each openMenu change broke prop-identity memoization for rows
  // that didn't change, forcing the whole visible list to re-render on any menu toggle.
  const handleToggleMenu = useCallback((id) => {
    setOpenMenu((prev) => (prev === id ? null : id))
  }, [])
  const handleCloseMenu = useCallback(() => setOpenMenu(null), [])

  const handleDuplicate = useCallback(async (product) => {
    try {
      const result = await fetchProductDetail(product.id)
      const item = result?.item
      if (!item) return
      try {
        sessionStorage.setItem(DUPLICATE_SESSION_KEY, JSON.stringify(item))
      } catch { /* quota */ }
      navigate('/admin/products/new')
    } catch {
      toast.error(t('products.dupLoadError'))
    }
  }, [navigate, t])

  const handleDelete = useCallback(async (product) => {
    const confirmed = await showConfirm(
      t('products.deleteConfirm', { name: product.name }),
      t('products.deleteConfirmTitle'),
      { confirmLabel: t('products.deleteConfirmTitle') },
    )
    if (!confirmed) return

    setDeletingId(product.id)
    try {
      await softDeleteProduct(product.id)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      toast.success(t('products.deleteSuccess'))
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : (error?.message || t('products.deleteError'))
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }, [queryClient, t])

  const handleRestore = useCallback(async (product) => {
    const confirmed = await showConfirm(
      t('products.restoreConfirm', { name: product.name }),
      t('products.restoreConfirmTitle'),
      { variant: 'default', confirmLabel: t('products.restore') },
    )
    if (!confirmed) return

    setRestoringId(product.id)
    try {
      await restoreProduct(product.id)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      toast.success(t('products.restoreSuccess'))
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : (error?.message || t('products.restoreError'))
      toast.error(message)
    } finally {
      setRestoringId(null)
    }
  }, [queryClient, t])

  const handlePermanentDelete = useCallback(async (product) => {
    const confirmed = await showConfirm(
      t('products.permanentDeleteConfirm', { name: product.name, defaultValue: `Bạn có chắc chắn muốn xóa vĩnh viễn sản phẩm ${product.name}? Thao tác này không thể hoàn tác.` }),
      t('products.permanentDeleteConfirmTitle', { defaultValue: 'Xác nhận xóa vĩnh viễn' }),
      { confirmLabel: t('products.permanentDelete', { defaultValue: 'Xóa vĩnh viễn' }), variant: 'danger' },
    )
    if (!confirmed) return

    setDeletingId(product.id)
    try {
      await permanentDeleteProduct(product.id)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      toast.success(t('products.permanentDeleteSuccess', { defaultValue: 'Xóa vĩnh viễn sản phẩm thành công.' }))
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : (error?.message || t('products.permanentDeleteError', { defaultValue: 'Không thể xóa vĩnh viễn sản phẩm.' }))
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }, [queryClient, t])

  // O4/N7: toggle nhanh Xuất bản/Ẩn ngay trên bảng, không cần mở trang chi tiết —
  // cùng ý tưởng handleToggleVisibility đã có cho Danh mục (CategoryListScreen).
  // N7: cập nhật lạc quan (onMutate + rollback) — badge đổi ngay khi bấm thay vì
  // chỉ sau khi request thành công, mượn đúng mẫu của toggleVisibilityMutation
  // bên CategoryListScreen thay vì await xong mới invalidate như trước.
  const togglePublishMutation = useMutation({
    mutationFn: ({ id, nextStatus }) => publishProduct(id, nextStatus),
    onMutate: async ({ id, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['products'] })
      const previousQueries = queryClient.getQueriesData({ queryKey: ['products'] })
      queryClient.setQueriesData({ queryKey: ['products'] }, (old) => {
        if (!old?.items) return old
        return { ...old, items: old.items.map((p) => (p.id === id ? { ...p, publishStatus: nextStatus } : p)) }
      })
      return { previousQueries }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
      toast.success(t('products.publishToggleSuccess', { defaultValue: 'Đã đổi trạng thái xuất bản.' }))
      setTogglingPublishId(null)
    },
    onError: (error, _variables, context) => {
      context?.previousQueries?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      const message = error instanceof ApiClientError
        ? error.message
        : (error?.message || t('common.error'))
      toast.error(message)
      setTogglingPublishId(null)
    },
  })

  const handleTogglePublish = useCallback((product) => {
    if (!canUpdate) return
    const nextStatus = product.publishStatus === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED'
    if (nextStatus === 'PUBLISHED') {
      const hasName = !!product.name
      const hasBrand = !!product.brand?.name
      const hasCategory = !!categoryLabel(product)
      const hasImage = !!product.image?.url
      const hasPrice = product.price?.retailPrice > 0

      if (!hasName || !hasBrand || !hasCategory || !hasImage || !hasPrice) {
        toast.error(t('products.publishMissingFields', {
          defaultValue: 'Cần đủ Tên/Thương hiệu/Danh mục/Ảnh/Giá trước khi đăng. Mở trang chi tiết để bổ sung.'
        }))
        return
      }
    }
    setTogglingPublishId(product.id)
    togglePublishMutation.mutate({ id: product.id, nextStatus })
  }, [canUpdate, togglePublishMutation, t])

  const emptyState = query.publishStatus === 'TRASH'
    ? {
        title: t('products.emptyTrash', { defaultValue: 'Không có sản phẩm trong thùng rác' }),
        description: t('products.emptyTrashDesc', { defaultValue: 'Xoá bộ lọc hoặc chuyển sang trạng thái khác.' }),
      }
    : {
        title: t('products.empty'),
        description: t('products.emptyDesc'),
      }

  function updateQuery(partial, options = { resetPage: false }) {
    setSelected(new Set())
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

  const items = useMemo(() => state.items || [], [state.items])
  const pagination = state.pagination

  const isTrashView = query.publishStatus === 'TRASH'

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])
  const toggleAll = useCallback(() => {
    setSelected((prev) => (
      prev.size === items.length ? new Set() : new Set(items.map((p) => p.id))
    ))
  }, [items])
  const allChecked = items.length > 0 && selected.size === items.length

  // In-header sort: maps a column to query.sort (định dạng "field:dir" như endpoint
  // sản phẩm đang dùng). Click đảo chiều; cột đang sort hiện chevron + aria-sort.
  const [sortField, sortDir] = (query.sort || '').split(':')
  const handleHeaderSort = useCallback((field) => {
    const nextDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc'
    updateQuery({ sort: `${field}:${nextDir}` }, { resetPage: true })
  }, [sortField, sortDir])

  const totalItems = pagination?.totalItems ?? items.length

  const runBulk = useCallback(async ({ confirmKey, titleKey, confirmLabel, variant, action, successKey }) => {
    const ids = [...selected]
    if (ids.length === 0) return
    const confirmed = await showConfirm(
      t(confirmKey, { count: ids.length }),
      t(titleKey),
      { confirmLabel: t(confirmLabel), variant },
    )
    if (!confirmed) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(ids.map((id) => action(id)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelected(new Set())
      if (fail === 0) toast.success(t(successKey, { count: ok }))
      else toast.error(t('products.bulkPartial', { ok, fail }))
    } finally {
      setBulkBusy(false)
    }
  }, [selected, queryClient, t])

  const handleBulkDelete = useCallback(() => runBulk({
    confirmKey: 'products.bulkDeleteConfirm',
    titleKey: 'products.deleteConfirmTitle',
    confirmLabel: 'products.deleteConfirmTitle',
    variant: 'danger',
    action: softDeleteProduct,
    successKey: 'products.bulkDeleteSuccess',
  }), [runBulk])

  const handleBulkRestore = useCallback(() => runBulk({
    confirmKey: 'products.bulkRestoreConfirm',
    titleKey: 'products.restoreConfirmTitle',
    confirmLabel: 'products.restore',
    variant: 'default',
    action: restoreProduct,
    successKey: 'products.bulkRestoreSuccess',
  }), [runBulk])

  const bulkActions = canUpdate
    ? (isTrashView
        ? [{ label: t('products.bulkRestore'), onClick: handleBulkRestore, disabled: bulkBusy }]
        : [{ label: t('products.bulkDelete'), onClick: handleBulkDelete, tone: 'danger', disabled: bulkBusy }])
    : []

  // Chip bộ lọc đang bật (ngoài mặc định) — mỗi chip có nút X để gỡ riêng.
  const filterChips = useMemo(() => {
    const chips = []
    if (query.search) {
      chips.push({
        key: 'search',
        label: `${t('common.search', { defaultValue: 'Tìm kiếm' })}: ${query.search}`,
        onRemove: () => { setSearchInput(INITIAL_QUERY.search) },
      })
    }
    if (query.categoryId) {
      const cat = categories.find((c) => c.id === query.categoryId)
      chips.push({
        key: 'category',
        label: `${t('products.filterCategory')}: ${cat?.name || query.categoryId}`,
        onRemove: () => updateQuery({ categoryId: '' }, { resetPage: true }),
      })
    }
    if (query.brandId) {
      const br = brands.find((b) => b.id === query.brandId)
      chips.push({
        key: 'brand',
        label: `${t('products.filterBrand')}: ${br?.name || query.brandId}`,
        onRemove: () => updateQuery({ brandId: '' }, { resetPage: true }),
      })
    }
    if (query.publishStatus !== 'ALL') {
      chips.push({
        key: 'publish',
        label: `${t('products.filterPublish')}: ${t(`status.publish.${query.publishStatus}`, { defaultValue: query.publishStatus })}`,
        onRemove: () => updateQuery({ publishStatus: 'ALL' }, { resetPage: true }),
      })
    }
    if (query.stockState !== 'ALL') {
      chips.push({
        key: 'stock',
        label: `${t('products.filterStock')}: ${t(`status.stock.${query.stockState}`, { defaultValue: query.stockState })}`,
        onRemove: () => updateQuery({ stockState: 'ALL' }, { resetPage: true }),
      })
    }
    return chips
  }, [query.search, query.categoryId, query.brandId, query.publishStatus, query.stockState, categories, brands, t])

  // Mô tả cột có thể sort trong header để dựng <th> đồng nhất (label + chevron + aria-sort).
  const sortableHeader = (field, label, extraClass = '') => {
    const active = sortField === field
    const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
    return (
      <th
        scope="col"
        className={`sortable${active ? ' sorted' : ''}${extraClass ? ` ${extraClass}` : ''}`}
        aria-sort={ariaSort}
        tabIndex={0}
        role="button"
        onClick={() => handleHeaderSort(field)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleHeaderSort(field) } }}
      >
        {label}
        <span className="sort-ind" aria-hidden="true">
          {active
            ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
            : <ChevronsUpDown size={12} />}
        </span>
      </th>
    )
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('products.eyebrow')}</p>
          <h1>{t('products.title')}</h1>
          <p className="bb-muted">{t('products.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <ExportButton
            onExport={async () => {
              let r
              try {
                r = await exportProductsCsv({ publishStatus: query.publishStatus !== 'ALL' ? query.publishStatus : undefined })
              } catch {
                throw new Error(t('export.error'))
              }
              if (r?.truncated) toast.warning(t('export.truncated', { max: r.maxRows }))
              else toast.success(t('export.success'))
            }}
          >
            {t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </ExportButton>
          <button
            type="button"
            className="bb-btn bb-btn-primary"
            onClick={() => navigate('/admin/products/new')}
            disabled={!canUpdate}
            title={!canUpdate ? t('products.requirePermission') : undefined}
          >
            <Plus size={14} />{canUpdate ? t('products.create') : t('common.noPermission')}
          </button>
        </div>
      </div>

      {/* O9 — Vừa xem gần đây */}
      <RecentItemsChips items={recentProductItems} onSelect={(item) => navigate(`/admin/products/${item.id}`)} />

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {/* O5: preset lọc nhanh 1-click cho các view thường dùng nhất, thay vì phải
          mở dropdown FilterSelect rồi chọn giá trị. */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          type="button"
          variant={query.stockState === 'OUT_OF_STOCK' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateQuery(
            { stockState: query.stockState === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK' },
            { resetPage: true },
          )}
        >
          {t('products.presetOutOfStock', { defaultValue: 'Hết hàng' })}
        </Button>
        <Button
          type="button"
          variant={query.publishStatus === 'DRAFT' ? 'default' : 'outline'}
          size="sm"
          onClick={() => updateQuery(
            { publishStatus: query.publishStatus === 'DRAFT' ? 'ALL' : 'DRAFT' },
            { resetPage: true },
          )}
        >
          {t('products.presetDraft', { defaultValue: 'Chưa xuất bản' })}
        </Button>
      </div>

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('products.searchPlaceholder')}
          wrapperClassName="flex-1 min-w-[200px]"
        />
        <FilterSelect
          value={query.categoryId || 'ALL'}
          onValueChange={(v) => updateQuery({ categoryId: v === 'ALL' ? '' : v }, { resetPage: true })}
          ariaLabel={t('products.filterCategory')}
          options={[
            { value: 'ALL', label: t('products.filterCategory') },
            ...categoryTreeOptions.map((c) => ({
              value: c.id,
              label: <span style={{ paddingInlineStart: `${c.depth * 16}px` }}>{c.name}</span>,
            })),
          ]}
        />
        <FilterSelect
          value={query.brandId || 'ALL'}
          onValueChange={(v) => updateQuery({ brandId: v === 'ALL' ? '' : v }, { resetPage: true })}
          ariaLabel={t('products.filterBrand')}
          options={[
            { value: 'ALL', label: t('products.filterBrand') },
            ...brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <FilterSelect
          value={query.publishStatus}
          onValueChange={(v) => updateQuery({ publishStatus: v }, { resetPage: true })}
          ariaLabel={t('products.filterPublish')}
          options={[
            { value: 'ALL', label: t('products.filterPublish') },
            { value: 'DRAFT', label: t('status.publish.DRAFT') },
            { value: 'PUBLISHED', label: t('status.publish.PUBLISHED') },
            { value: 'HIDDEN', label: t('status.publish.HIDDEN') },
            { value: 'TRASH', label: t('status.publish.TRASH') },
          ]}
        />
        <FilterSelect
          value={query.stockState}
          onValueChange={(v) => updateQuery({ stockState: v }, { resetPage: true })}
          ariaLabel={t('products.filterStock')}
          options={[
            { value: 'ALL', label: t('products.filterStock') },
            { value: 'IN_STOCK', label: t('status.stock.IN_STOCK') },
            { value: 'OUT_OF_STOCK', label: t('status.stock.OUT_OF_STOCK') },
          ]}
        />
        <FilterSelect
          value={query.sort}
          onValueChange={(v) => updateQuery({ sort: v }, { resetPage: true })}
          ariaLabel={t('products.filterSort')}
          options={[
            { value: 'updatedAt:desc', label: t('sort.newestUpdated') },
            { value: 'updatedAt:asc', label: t('sort.oldestUpdated') },
            { value: 'name:asc', label: t('sort.nameAZ') },
            { value: 'name:desc', label: t('sort.nameZA') },
            { value: 'homepageOrder:asc', label: t('products.sortHomepageOrder') },
          ]}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => updateQuery({ pageSize: n }, { resetPage: true })}
        />
        <ColumnVisibilityToggle allColumns={allColumnDefs} hiddenKeys={hiddenColumnKeys} onToggle={toggleColumn} />
      </div>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? resetFilters : undefined}
        clearAllLabel={t('common.resetFilters')}
        removeChipLabel={t('common.resetFilters')}
        ariaLabel={t('products.activeFilters', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {/* Vùng thông báo cho trình đọc màn hình: báo số kết quả sau khi lọc/sắp xếp. */}
      <span className="sr-only" role="status" aria-live="polite">
        {state.status === 'success'
          ? t('products.resultsAnnounce', { count: totalItems, defaultValue: `Đã lọc: ${totalItems} sản phẩm` })
          : ''}
      </span>

      <BulkActionBar
        selectedCount={selected.size}
        onClear={() => setSelected(new Set())}
        actions={bulkActions}
      />

      {state.status === 'success' && HOMEPAGE_BLOCK_LIMITS[query.homepageBlock] ? (
        (() => {
          const totalFlagged = pagination?.totalItems ?? items.length
          const limit = HOMEPAGE_BLOCK_LIMITS[query.homepageBlock]
          const blockLabel = t(HOMEPAGE_BLOCK_LABEL_KEYS[query.homepageBlock] ?? query.homepageBlock)
          if (totalFlagged <= limit) return null
          return (
            <Alert tone="warning" role="status" className="my-3">
              <strong>{t('products.homepageWarnCount', { count: totalFlagged })}</strong>{' '}
              {t('products.homepageWarnDetail', { limit, block: blockLabel })}
            </Alert>
          )
        })()
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title={t('products.loadError')}
          description={state.error || 'Unknown error while loading products.'}
          actionLabel={t('common.retry')}
          onAction={() => state.refetch()}
        />
      ) : null}

      {state.status === 'success' && items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={emptyState.title}
          description={emptyState.description}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      ) : null}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="hide-on-mobile">
          <div className="bb-table-wrap">
            <table className="bb-table" aria-label={t('products.title')}>
              <thead>
                <tr>
                  <th scope="col" className="col-check">
                    <span
                      className={`bb-cb${allChecked ? ' checked' : ''}`}
                      role="checkbox"
                      aria-checked={allChecked}
                      aria-label={t('common.selectAll', { defaultValue: 'Chọn tất cả' })}
                      tabIndex={0}
                      onClick={toggleAll}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAll() } }}
                    >
                      {allChecked && <Check size={11} />}
                    </span>
                  </th>
                  {sortableHeader('name', t('products.colProduct'))}
                  {!hiddenColumnKeys.includes('sku') && <th scope="col" className="hidden lg:table-cell">SKU</th>}
                  {sortableHeader('price', t('products.colPrice'), 'num')}
                  <th scope="col">{t('products.colStock')}</th>
                  {!hiddenColumnKeys.includes('category') && <th scope="col" className="hidden xl:table-cell">{t('products.colCategory')}</th>}
                  {!hiddenColumnKeys.includes('brand') && <th scope="col" className="hidden 2xl:table-cell">{t('products.colBrand')}</th>}
                  {!hiddenColumnKeys.includes('homepage') && <th scope="col" className="hidden xl:table-cell">{t('products.colHomepage')}</th>}
                  <th scope="col">{t('products.colPublish')}</th>
                  {!hiddenColumnKeys.includes('updatedAt') && sortableHeader('updatedAt', t('products.colUpdated'), 'hidden lg:table-cell')}
                  <th scope="col" className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {state.status === 'loading' && items.length === 0 && (
                  [...Array(8)].map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td colSpan={11}><div className="bb-skeleton-block" style={{ height: 32 }} /></td>
                    </tr>
                  ))
                )}
                {items.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    navigate={navigate}
                    canUpdate={canUpdate}
                    checked={selected.has(product.id)}
                    isDeleting={deletingId === product.id}
                    isRestoring={restoringId === product.id}
                    isTogglingPublish={togglingPublishId === product.id}
                    isMenuOpen={openMenu === product.id}
                    hiddenColumns={hiddenColumnKeys}
                    onToggleSelect={toggle}
                    onToggleMenu={handleToggleMenu}
                    onCloseMenu={handleCloseMenu}
                    onDuplicate={handleDuplicate}
                    onRestore={handleRestore}
                    onPermanentDelete={handlePermanentDelete}
                    onDelete={handleDelete}
                    onTogglePublish={handleTogglePublish}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </div>
          <MobileCardList>
            {items.map((product) => (
              <ProductMobileCard
                key={product.id}
                product={product}
                navigate={navigate}
                canUpdate={canUpdate}
                isDeleting={deletingId === product.id}
                isRestoring={restoringId === product.id}
                onDuplicate={handleDuplicate}
                onRestore={handleRestore}
                onPermanentDelete={handlePermanentDelete}
                onDelete={handleDelete}
              />
            ))}
          </MobileCardList>
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
