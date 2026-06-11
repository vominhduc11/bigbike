import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Download, MoreHorizontal, Package, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'
import { PublishStatusBadge, StockStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { BulkActionBar } from '../components/BulkActionBar'
import { FilterSelect } from '../components/FilterSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { showConfirm } from '../lib/confirm'
import { ApiClientError, exportProductsCsv, fetchBrands, fetchCategoryTree, fetchProductDetail, fetchProducts, restoreProduct, softDeleteProduct } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Alert } from '@/components/ui/alert'
import { PaginationControls } from '../components/PaginationControls'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'

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

// Stock cell: prominent on-hand quantity (the number a shop manager actually
// scans for) plus the colour-coded state badge. Falls back to "—" when the
// product does not track inventory (stockQuantity === null).
function StockCell({ quantity, state }) {
  const { t } = useTranslation()
  const hasQty = Number.isFinite(quantity)
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="font-semibold tabular-nums"
        style={{ minWidth: 26, textAlign: 'right' }}
        title={hasQty ? undefined : t('products.stockNotTracked')}
      >
        {hasQty ? quantity : '—'}
      </span>
      <StockStatusBadge value={state} />
    </span>
  )
}

function categoryLabel(product) {
  const category = product.category
  return category && category.id !== 'uncategorized' ? category.name : null
}

export function ProductListScreen({ navigate, canUpdate }) {
  const { t, i18n } = useTranslation()
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

  const state = useAdminList(['products', query, i18n.language], () => fetchProducts(query))

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
                {items.map((product) => {
                  const isDeleting = deletingId === product.id
                  const isRestoring = restoringId === product.id
                  const isTrashed = product.publishStatus === 'TRASH'
                  const isBusy = isDeleting || isRestoring
                  const block = product.homepageBlock
                  const checked = selected.has(product.id)
                  const catName = categoryLabel(product)
                  return (
                    <tr key={product.id} className={checked ? 'selected' : ''} onClick={() => navigate(`/admin/products/${product.id}`)}>
                      <td className="col-check" onClick={(e) => { e.stopPropagation(); toggle(product.id) }}>
                        <span className={`bb-cb${checked ? ' checked' : ''}`} role="checkbox" aria-checked={checked}>
                          {checked && <Check size={11} />}
                        </span>
                      </td>
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
                      <td className="mono hidden lg:table-cell">{formatText(product.sku, 'SKU TBD')}</td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatCurrencyVnd(product.price?.retailPrice)}
                        {product.price?.salePrice ? (
                          <div className="bb-cell-sub" style={{ textDecoration: 'line-through' }}>
                            {formatCurrencyVnd(product.price.salePrice)}
                          </div>
                        ) : null}
                      </td>
                      <td><StockCell quantity={product.stockQuantity} state={product.stockState} /></td>
                      <td className="hidden xl:table-cell">
                        {catName ? formatText(catName) : <span className="bb-muted">—</span>}
                      </td>
                      <td className="hidden 2xl:table-cell">
                        {product.brand?.name ? formatText(product.brand.name) : <span className="bb-muted">—</span>}
                      </td>
                      <td className="hidden xl:table-cell">
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
                      <td className="bb-muted hidden lg:table-cell">{formatDateTime(product.updatedAt)}</td>
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
          </div>
          <MobileCardList>
            {items.map((product) => {
              const isDeleting = deletingId === product.id
              const isRestoring = restoringId === product.id
              const isTrashed = product.publishStatus === 'TRASH'
              const isBusy = isDeleting || isRestoring
              const block = product.homepageBlock
              return (
                <MobileCard
                  key={product.id}
                  title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="bb-product-thumb" style={{ width: 32, height: 32, flexShrink: 0 }}>
                        {product.image?.url ? (
                          <img
                            src={product.image.url}
                            alt={product.image.alt || product.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Package size={18} />
                        )}
                      </span>
                      {formatText(product.name)}
                    </span>
                  )}
                  subtitle={formatText(product.sku, 'SKU TBD')}
                  status={<PublishStatusBadge value={product.publishStatus} />}
                  meta={[
                    {
                      label: t('products.colPrice'),
                      value: product.price?.salePrice ? (
                        <span>
                          {formatCurrencyVnd(product.price?.retailPrice)}
                          <span style={{ textDecoration: 'line-through', marginLeft: 6 }}>
                            {formatCurrencyVnd(product.price.salePrice)}
                          </span>
                        </span>
                      ) : (
                        formatCurrencyVnd(product.price?.retailPrice)
                      ),
                      tone: 'strong',
                    },
                    { label: t('products.colStock'), value: <StockCell quantity={product.stockQuantity} state={product.stockState} /> },
                    { label: t('products.colCategory'), value: categoryLabel(product) ? formatText(categoryLabel(product)) : <span className="bb-muted">—</span> },
                    { label: t('products.colBrand'), value: product.brand?.name ? formatText(product.brand.name) : <span className="bb-muted">—</span> },
                    {
                      label: t('products.colHomepage'),
                      value: (!block || block === 'NONE') ? (
                        <span className="bb-muted">—</span>
                      ) : (
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                          {t('products.homepageFeatured')}
                          {Number.isFinite(product.homepageOrder) ? ` · #${product.homepageOrder}` : ''}
                        </span>
                      ),
                    },
                    { label: t('products.colUpdated'), value: formatDateTime(product.updatedAt) },
                  ]}
                  actions={(
                    <div onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="bb-icon-btn"
                        title={t('common.edit')}
                        onClick={() => navigate(`/admin/products/${product.id}`)}
                      >
                        <Pencil size={14} />
                      </button>
                      {canUpdate && (
                        <button
                          type="button"
                          className="bb-icon-btn"
                          title={t('products.duplicate')}
                          onClick={() => handleDuplicate(product)}
                        >
                          <Copy size={14} />
                        </button>
                      )}
                      {canUpdate && isTrashed && (
                        <button
                          type="button"
                          className="bb-icon-btn"
                          disabled={isBusy}
                          title={isRestoring ? t('products.restoringLabel') : t('products.restore')}
                          onClick={() => handleRestore(product)}
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                      {canUpdate && !isTrashed && (
                        <button
                          type="button"
                          className="bb-icon-btn"
                          disabled={isBusy}
                          title={isDeleting ? t('products.deletingLabel') : t('common.delete')}
                          onClick={() => handleDelete(product)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  onClick={() => navigate(`/admin/products/${product.id}`)}
                />
              )
            })}
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
