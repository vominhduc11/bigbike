import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { PublishStatusBadge, StockStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { ApiClientError, exportProductsCsv, fetchBrands, fetchCategoryTree, fetchProductDetail, fetchProducts, restoreProduct, softDeleteProduct } from '../lib/adminApi'

const DUPLICATE_SESSION_KEY = 'product-duplicate-payload'
import { ExportButton } from '../components/ExportButton'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

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

// Mirror of the homepage block sizes in bigbike-web/app/page.tsx — anything beyond these
// caps is fetched but not rendered by the storefront, so admin should know the surplus
// is silently dropped.
const HOMEPAGE_BLOCK_LIMITS = {
  FEATURED_GRID: 12,
  RECOMMENDED_CAROUSEL: 10,
}
const HOMEPAGE_BLOCK_LABEL_KEYS = {
  NONE: 'products.hbNone',
  FEATURED_GRID: 'products.hbFeatured',
  RECOMMENDED_CAROUSEL: 'products.hbRecommended',
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

  const handleDuplicate = useCallback(async (product) => {
    try {
      // Load full detail (list rows have only summary fields)
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
        title: t('products.emptyTrash', { defaultValue: 'No trashed products' }),
        description: t('products.emptyTrashDesc', { defaultValue: 'Try clearing filters or switch back to another publish status.' }),
      }
    : {
        title: t('products.empty'),
        description: t('products.emptyDesc'),
      }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: t('products.colProduct'),
        render: (product) => (
          <div className="product-cell">
            <div className="thumbnail-wrap">
              {product.image?.url ? (
                <img src={product.image.url} alt={product.image.alt || product.name} referrerPolicy="no-referrer" loading="lazy" />
              ) : (
                <span>IMG</span>
              )}
            </div>
            <div>
              <strong>{formatText(product.name)}</strong>
              <p>{formatText(product.sku, 'SKU TBD')}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'price',
        label: t('products.colPrice'),
        render: (product) => (
          <div className="price-cell">
            <strong>{formatCurrencyVnd(product.price?.retailPrice)}</strong>
            {product.price?.salePrice ? (
              <span>{formatCurrencyVnd(product.price.salePrice)}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'publishStatus',
        label: t('products.colPublish'),
        render: (product) => <PublishStatusBadge value={product.publishStatus} />,
      },
      {
        key: 'stockState',
        label: t('products.colStock'),
        render: (product) => <StockStatusBadge value={product.stockState} />,
      },
      {
        key: 'homepage',
        label: t('products.colHomepage'),
        render: (product) => {
          const block = product.homepageBlock
          if (!block || block === 'NONE') {
            return <span className="text-muted-foreground">—</span>
          }
          const label = block === 'FEATURED_GRID' ? t('products.homepageFeatured') : t('products.homepageRecommended')
          const orderText = Number.isFinite(product.homepageOrder)
            ? ` · #${product.homepageOrder}`
            : ''
          return (
            <span className="inline-flex flex-col gap-0.5">
              <strong className="text-xs">{label}</strong>
              {orderText && <small className="text-xs text-muted-foreground">{t('products.homepageOrderLabel')}{orderText}</small>}
            </span>
          )
        },
      },
      {
        key: 'updatedAt',
        label: t('products.colUpdated'),
        render: (product) => formatDateTime(product.updatedAt),
      },
        {
          key: 'actions',
          label: t('common.actions'),
          align: 'right',
          render: (product) => {
            const isDeleting = deletingId === product.id
            const isRestoring = restoringId === product.id
            const isTrashed = product.publishStatus === 'TRASH'
            const isBusy = isDeleting || isRestoring
            // "Sửa" stays inline as the safe primary action; secondary and
            // destructive actions move into an overflow menu so the red
            // "Xoá" button no longer sits on every row inviting misclicks.
            return (
              <div className="row-actions">
                <Button variant="outline" onClick={() => navigate(`/admin/products/${product.id}`)}>
                  {t('common.edit')}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={t('common.actions')}
                      title={t('common.actions')}
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUpdate && (
                      <DropdownMenuItem onSelect={() => handleDuplicate(product)}>
                        {t('products.duplicate')}
                      </DropdownMenuItem>
                    )}
                    {canUpdate && isTrashed && (
                      <DropdownMenuItem
                        disabled={isBusy}
                        onSelect={() => handleRestore(product)}
                      >
                        {isRestoring ? t('products.restoringLabel') : t('products.restore')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      disabled={!canUpdate || isBusy || isTrashed}
                      onSelect={() => handleDelete(product)}
                      className="text-destructive focus:text-destructive"
                    >
                      {isDeleting ? t('products.deletingLabel') : t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          },
        },
      ],
    [navigate, handleDelete, handleDuplicate, handleRestore, deletingId, restoringId, canUpdate, t],
  )

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

  // Count how many of the collapsed "advanced" filters differ from default,
  // so the trigger can show a badge — an active filter hidden in the popover
  // must never be invisible to the user.
  const activeAdvancedCount = [
    query.brandId !== INITIAL_QUERY.brandId,
    query.categoryId !== INITIAL_QUERY.categoryId,
    query.homepageBlock !== INITIAL_QUERY.homepageBlock,
    query.sort !== INITIAL_QUERY.sort,
  ].filter(Boolean).length

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('products.eyebrow')}</p>
          <h1>{t('products.title')}</h1>
          <p>{t('products.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            filename={`products_${new Date().toISOString().slice(0,10)}.csv`}
            onExport={() => exportProductsCsv({ publishStatus: query.publishStatus !== 'ALL' ? query.publishStatus : undefined })}
          />
          <Button
            onClick={() => navigate('/admin/products/new')}
            disabled={!canUpdate}
            title={!canUpdate ? t('products.requirePermission') : undefined}
          >
            {canUpdate ? t('products.create') : t('common.noPermission')}
          </Button>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}


      {/* Primary filters stay visible; the rest collapse into a popover so
          the bar — and the mobile scroll — stays short. */}
      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('products.searchPlaceholder')}
           />
        </label>

        <label>
          {t('products.filterPublish')}
          <Select
            value={query.publishStatus}
            onValueChange={(val) =>
              updateQuery({ publishStatus: val }, { resetPage: true })}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              <SelectItem value="DRAFT">{t('status.publish.DRAFT')}</SelectItem>
              <SelectItem value="PUBLISHED">{t('status.publish.PUBLISHED')}</SelectItem>
              <SelectItem value="HIDDEN">{t('status.publish.HIDDEN')}</SelectItem>
              <SelectItem value="TRASH">{t('status.publish.TRASH')}</SelectItem>
            </SelectContent></Select>
          </label>

        <label>
          {t('products.filterStock')}
          <Select
            value={query.stockState}
            onValueChange={(val) =>
              updateQuery({ stockState: val }, { resetPage: true })}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="ALL">{t('common.all')}</SelectItem>
            <SelectItem value="IN_STOCK">{t('status.stock.IN_STOCK')}</SelectItem>
            <SelectItem value="LOW_STOCK">{t('status.stock.LOW_STOCK')}</SelectItem>
            <SelectItem value="OUT_OF_STOCK">{t('status.stock.OUT_OF_STOCK')}</SelectItem>
          </SelectContent></Select>
        </label>

        <div className="flex flex-col justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2">
                <SlidersHorizontal size={15} />
                {t('products.advancedFilters')}
                {activeAdvancedCount > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {activeAdvancedCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-secondary-foreground">
                {t('products.filterBrand')}
                <Select
                  value={query.brandId || 'ALL'}
                  onValueChange={(val) => updateQuery({ brandId: val === 'ALL' ? '' : val }, { resetPage: true })}
                ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="ALL">{t('common.all')}</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent></Select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-secondary-foreground">
                {t('products.filterCategory')}
                <Select
                  value={query.categoryId || 'ALL'}
                  onValueChange={(val) => updateQuery({ categoryId: val === 'ALL' ? '' : val }, { resetPage: true })}
                ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="ALL">{t('common.all')}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent></Select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-secondary-foreground">
                {t('products.filterHomepageBlock')}
                <Select
                  value={query.homepageBlock}
                  onValueChange={(val) => updateQuery({ homepageBlock: val }, { resetPage: true })}
                ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="ALL">{t('common.all')}</SelectItem>
                  <SelectItem value="NONE">{t('products.homepageNone')}</SelectItem>
                  <SelectItem value="FEATURED_GRID">{t('products.homepageFeatured')}</SelectItem>
                  <SelectItem value="RECOMMENDED_CAROUSEL">{t('products.homepageRecommended')}</SelectItem>
                </SelectContent></Select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-secondary-foreground">
                {t('products.filterSort')}
                <Select
                  value={query.sort}
                  onValueChange={(val) =>
                    updateQuery({ sort: val }, { resetPage: true })}
                ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="updatedAt:desc">{t('sort.newestUpdated')}</SelectItem>
                  <SelectItem value="updatedAt:asc">{t('sort.oldestUpdated')}</SelectItem>
                  <SelectItem value="name:asc">{t('sort.nameAZ')}</SelectItem>
                  <SelectItem value="name:desc">{t('sort.nameZA')}</SelectItem>
                  <SelectItem value="homepageOrder:asc">{t('products.sortHomepageOrder')}</SelectItem>
                </SelectContent></Select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-secondary-foreground">
                {t('common.rowsPerPage')}
                <Select
                  value={String(query.pageSize)}
                  onValueChange={(val) =>
                    updateQuery({ pageSize: Number(val) }, { resetPage: true })}
                ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent></Select>
              </label>

              {activeAdvancedCount > 0 && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  {t('common.resetFilters')}
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </section>

      {state.status === 'success' && HOMEPAGE_BLOCK_LIMITS[query.homepageBlock] ? (
        (() => {
          const totalFlagged = state.pagination?.totalItems ?? state.items.length
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

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={emptyState.title}
          description={emptyState.description}
          actionLabel={t('common.resetFilters')}
          onAction={resetFilters}
        />
      ) : null}

      {state.status === 'loading' || (state.status === 'success' && state.items.length > 0) ? (
        <>
          <AdminTable
            caption={t('products.tableCaption')}
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(nextPage) => updateQuery({ page: nextPage })}
            />
          )}
        </>
      ) : null}
    </section>
  )
}
