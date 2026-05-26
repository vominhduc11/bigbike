import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Download, MoreHorizontal, Package, Pencil, Plus, Search, Trash2, Undo2, Upload } from 'lucide-react'
import { PublishStatusBadge, StockStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { ApiClientError, exportProductsCsv, fetchBrands, fetchCategoryTree, fetchProductDetail, fetchProducts, restoreProduct, softDeleteProduct } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Alert } from '@/components/ui/alert'
import { PaginationControls } from '../components/PaginationControls'

const DUPLICATE_SESSION_KEY = 'product-duplicate-payload'

const INITIAL_QUERY = {
  search: '',
  publishStatus: 'ALL',
  stockState: 'ALL',
  brandId: '',
  categoryId: '',
  homepageBlock: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
}

const HOMEPAGE_BLOCK_LIMITS = {
  FEATURED_GRID: 12,
}
const HOMEPAGE_BLOCK_LABEL_KEYS = {
  NONE: 'products.hbNone',
  FEATURED_GRID: 'products.hbFeatured',
}

export function ProductListScreen({ navigate, canUpdate }) {
  const { t } = useTranslation()
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

  const state = useAdminList(['products', query], () => fetchProducts(query))

  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => fetchBrands({ pageSize: 100, sort: 'name:asc' }), staleTime: 5 * 60_000 })
  const { data: categoriesData } = useQuery({ queryKey: ['categories', 'tree'], queryFn: () => fetchCategoryTree(), staleTime: 5 * 60_000 })
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

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('products.eyebrow')}</p>
          <h1>{t('products.title')}</h1>
          <p className="bb-muted">{t('products.description')}</p>
        </div>
        <div className="bb-screen-actions">
          <button type="button" className="bb-btn bb-btn-secondary" disabled title={t('products.importHint', { defaultValue: 'Nhập CSV' })}>
            <Upload size={14} />{t('products.importCsv', { defaultValue: 'Import CSV' })}
          </button>
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={() => exportProductsCsv({ publishStatus: query.publishStatus !== 'ALL' ? query.publishStatus : undefined })}
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
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('products.searchPlaceholder')}
            className="bb-input"
            style={{ paddingLeft: 28, width: '100%' }}
          />
        </div>
        <select
          className="bb-select"
          value={query.categoryId || 'ALL'}
          onChange={(e) => updateQuery({ categoryId: e.target.value === 'ALL' ? '' : e.target.value }, { resetPage: true })}
          aria-label={t('products.filterCategory')}
        >
          <option value="ALL">{t('products.filterCategory')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="bb-select"
          value={query.brandId || 'ALL'}
          onChange={(e) => updateQuery({ brandId: e.target.value === 'ALL' ? '' : e.target.value }, { resetPage: true })}
          aria-label={t('products.filterBrand')}
        >
          <option value="ALL">{t('products.filterBrand')}</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          className="bb-select"
          value={query.publishStatus}
          onChange={(e) => updateQuery({ publishStatus: e.target.value }, { resetPage: true })}
          aria-label={t('products.filterPublish')}
        >
          <option value="ALL">{t('products.filterPublish')}</option>
          <option value="DRAFT">{t('status.publish.DRAFT')}</option>
          <option value="PUBLISHED">{t('status.publish.PUBLISHED')}</option>
          <option value="HIDDEN">{t('status.publish.HIDDEN')}</option>
          <option value="TRASH">{t('status.publish.TRASH')}</option>
        </select>
        <select
          className="bb-select"
          value={query.stockState}
          onChange={(e) => updateQuery({ stockState: e.target.value }, { resetPage: true })}
          aria-label={t('products.filterStock')}
        >
          <option value="ALL">{t('products.filterStock')}</option>
          <option value="IN_STOCK">{t('status.stock.IN_STOCK')}</option>
          <option value="LOW_STOCK">{t('status.stock.LOW_STOCK')}</option>
          <option value="OUT_OF_STOCK">{t('status.stock.OUT_OF_STOCK')}</option>
        </select>
        <select
          className="bb-select"
          value={query.sort}
          onChange={(e) => updateQuery({ sort: e.target.value }, { resetPage: true })}
          aria-label={t('products.filterSort')}
        >
          <option value="updatedAt:desc">{t('sort.newestUpdated')}</option>
          <option value="updatedAt:asc">{t('sort.oldestUpdated')}</option>
          <option value="name:asc">{t('sort.nameAZ')}</option>
          <option value="name:desc">{t('sort.nameZA')}</option>
          <option value="homepageOrder:asc">{t('products.sortHomepageOrder')}</option>
        </select>
      </div>

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
          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>{t('products.colProduct')}</th>
                  <th>SKU</th>
                  <th className="num">{t('products.colPrice')}</th>
                  <th>{t('products.colStock')}</th>
                  <th>{t('products.colHomepage')}</th>
                  <th>{t('products.colPublish')}</th>
                  <th>{t('products.colUpdated')}</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {state.status === 'loading' && items.length === 0 && (
                  [...Array(8)].map((_, i) => (
                    <tr key={`sk-${i}`}>
                      <td colSpan={8}><div className="bb-skeleton-block" style={{ height: 32 }} /></td>
                    </tr>
                  ))
                )}
                {items.map((product) => {
                  const isDeleting = deletingId === product.id
                  const isRestoring = restoringId === product.id
                  const isTrashed = product.publishStatus === 'TRASH'
                  const isBusy = isDeleting || isRestoring
                  const block = product.homepageBlock
                  return (
                    <tr key={product.id} onClick={() => navigate(`/admin/products/${product.id}`)}>
                      <td>
                        <div className="bb-product-cell">
                          <span className="bb-product-thumb" style={{ width: 40, height: 40 }}>
                            {product.image?.url ? (
                              <img
                                src={product.image.url}
                                alt={product.image.alt || product.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <Package size={22} />
                            )}
                          </span>
                          <span>{formatText(product.name)}</span>
                        </div>
                      </td>
                      <td className="mono">{formatText(product.sku, 'SKU TBD')}</td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatCurrencyVnd(product.price?.retailPrice)}
                        {product.price?.salePrice ? (
                          <div className="bb-cell-sub" style={{ textDecoration: 'line-through' }}>
                            {formatCurrencyVnd(product.price.salePrice)}
                          </div>
                        ) : null}
                      </td>
                      <td><StockStatusBadge value={product.stockState} /></td>
                      <td>
                        {!block || block === 'NONE' ? (
                          <span className="bb-muted">—</span>
                        ) : (
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {t('products.homepageFeatured')}
                            {Number.isFinite(product.homepageOrder) ? ` · #${product.homepageOrder}` : ''}
                          </span>
                        )}
                      </td>
                      <td><PublishStatusBadge value={product.publishStatus} /></td>
                      <td className="bb-muted">{formatDateTime(product.updatedAt)}</td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="bb-icon-btn"
                          title={t('common.edit')}
                          onClick={() => navigate(`/admin/products/${product.id}`)}
                        >
                          <Pencil size={14} />
                        </button>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            className="bb-icon-btn"
                            data-row-menu-trigger
                            title={t('common.actions')}
                            onClick={() => setOpenMenu(openMenu === product.id ? null : product.id)}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {openMenu === product.id && (
                            <div className="bb-row-menu">
                              <button type="button" onClick={() => { setOpenMenu(null); navigate(`/admin/products/${product.id}`) }}>
                                <Pencil size={13} />{t('common.edit')}
                              </button>
                              {canUpdate && (
                                <button type="button" onClick={() => { setOpenMenu(null); handleDuplicate(product) }}>
                                  <Copy size={13} />{t('products.duplicate')}
                                </button>
                              )}
                              {canUpdate && isTrashed && (
                                <button type="button" disabled={isBusy} onClick={() => { setOpenMenu(null); handleRestore(product) }}>
                                  <Undo2 size={13} />{isRestoring ? t('products.restoringLabel') : t('products.restore')}
                                </button>
                              )}
                              {canUpdate && !isTrashed && (
                                <>
                                  <hr />
                                  <button type="button" className="danger" disabled={isBusy} onClick={() => { setOpenMenu(null); handleDelete(product) }}>
                                    <Trash2 size={13} />{isDeleting ? t('products.deletingLabel') : t('common.delete')}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
