import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Download, Plus } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { showConfirm } from '../lib/confirm'
import { ApiClientError, exportProductsCsv, fetchBrands, fetchCategoryTree, fetchProductDetail, fetchProducts, restoreProduct, softDeleteProduct } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { useContentLang } from '../lib/contentLang'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Alert } from '@/components/ui/alert'
import { PaginationControls } from '../components/PaginationControls'
import { MobileCardList } from '../components/layout/MobileCardList'
import { DUPLICATE_SESSION_KEY, HOMEPAGE_BLOCK_LABEL_KEYS, HOMEPAGE_BLOCK_LIMITS, INITIAL_QUERY } from './product-list/constants'
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
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearchRender = useRef(true)
  const [deletingId, setDeletingId] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const state = useAdminList(['products', query, contentLang], () => fetchProducts(query))

  // Bộ lọc trên màn duyệt = strict-EN theo PRODUCT_RULE_004 (ẩn mục chưa dịch để
  // biết cái nào còn thiếu bản tiếng Anh) — khác với selector trong form (full).
  const { data: brandsData } = useQuery({ queryKey: ['brands-all', contentLang], queryFn: () => fetchBrands({ pageSize: 100, sort: 'name:asc' }), staleTime: 5 * 60_000 })
  const { data: categoriesData } = useQuery({ queryKey: ['categories', 'tree', contentLang], queryFn: () => fetchCategoryTree(), staleTime: 5 * 60_000 })
  const brands = brandsData?.items ?? []
  const categories = categoriesData?.items ?? []

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

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('products.eyebrow')}</p>
          <h1>{t('products.title')}</h1>
          <p className="bb-muted">{t('products.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={async () => {
              try {
                const r = await exportProductsCsv({ publishStatus: query.publishStatus !== 'ALL' ? query.publishStatus : undefined })
                if (r?.truncated) toast.warning(t('export.truncated', { max: r.maxRows }))
              } catch {
                toast.error(t('export.error'))
              }
            }}
          >
            <Download size={14} />{t('common.exportCsv', { defaultValue: 'Xuất CSV' })}
          </button>
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

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

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
            ...categories.map((c) => ({ value: c.id, label: c.name })),
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
            { value: 'LOW_STOCK', label: t('status.stock.LOW_STOCK') },
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
      </div>

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
            <table className="bb-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <span
                      className={`bb-cb${allChecked ? ' checked' : ''}`}
                      role="checkbox"
                      aria-checked={allChecked}
                      tabIndex={0}
                      onClick={toggleAll}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAll() } }}
                    >
                      {allChecked && <Check size={11} />}
                    </span>
                  </th>
                  <th>{t('products.colProduct')}</th>
                  <th className="hidden lg:table-cell">SKU</th>
                  <th className="num">{t('products.colPrice')}</th>
                  <th>{t('products.colStock')}</th>
                  <th className="hidden xl:table-cell">{t('products.colCategory')}</th>
                  <th className="hidden 2xl:table-cell">{t('products.colBrand')}</th>
                  <th className="hidden xl:table-cell">{t('products.colHomepage')}</th>
                  <th>{t('products.colPublish')}</th>
                  <th className="hidden lg:table-cell">{t('products.colUpdated')}</th>
                  <th className="col-actions" />
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
                    isMenuOpen={openMenu === product.id}
                    onToggleSelect={toggle}
                    onToggleMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
                    onCloseMenu={() => setOpenMenu(null)}
                    onDuplicate={handleDuplicate}
                    onRestore={handleRestore}
                    onDelete={handleDelete}
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
