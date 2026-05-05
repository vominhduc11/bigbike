import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { PublishStatusBadge, StockStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { ApiClientError, exportProductsCsv, fetchBrands, fetchCategories, fetchProductDetail, fetchProducts, restoreProduct, softDeleteProduct } from '../lib/adminApi'

const DUPLICATE_SESSION_KEY = 'product-duplicate-payload'
import { ExportButton } from '../components/ExportButton'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'

const INITIAL_QUERY = {
  search: '',
  publishStatus: 'ALL',
  stockState: 'ALL',
  brandId: '',
  categoryId: '',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 20,
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
  const { data: categoriesData } = useQuery({ queryKey: ['categories-all'], queryFn: () => fetchCategories({ pageSize: 100, sort: 'name:asc' }), staleTime: 5 * 60_000 })
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
      toast.error('Không thể tải dữ liệu sản phẩm để sao chép.')
    }
  }, [navigate])

  const handleDelete = useCallback(async (product) => {
    const confirmed = await showConfirm(
      t('products.deleteConfirm', { name: product.name }),
      t('products.deleteConfirmTitle'),
    )
    if (!confirmed) return

    setDeletingId(product.id)
    try {
      await softDeleteProduct(product.id)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      toast.success(t('products.deleteSuccess', { defaultValue: 'Đã xoá sản phẩm' }))
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
      t('products.restoreConfirm', { defaultValue: `Khôi phục "${product.name}" từ thùng rác?` }),
      t('products.restoreConfirmTitle', { defaultValue: 'Khôi phục sản phẩm' }),
    )
    if (!confirmed) return

    setRestoringId(product.id)
    try {
      await restoreProduct(product.id)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      toast.success(t('products.restoreSuccess', { defaultValue: 'Đã khôi phục sản phẩm' }))
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : (error?.message || t('products.restoreError', { defaultValue: 'Không thể khôi phục sản phẩm' }))
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
            return (
              <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/admin/products/${product.id}`)}
              >
                {t('common.edit')}
              </button>
                {canUpdate && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDuplicate(product)}
                    title="Sao chép sản phẩm này sang sản phẩm mới"
                  >
                    Sao chép
                  </button>
                )}
                {canUpdate && isTrashed && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleRestore(product)}
                    disabled={isDeleting || isRestoring}
                    title={t('products.restoreConfirmTitle', { defaultValue: 'Khôi phục sản phẩm' })}
                  >
                    {isRestoring ? t('products.restoringLabel', { defaultValue: 'Đang khôi phục…' }) : t('products.restore', { defaultValue: 'Khôi phục' })}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDelete(product)}
                  disabled={!canUpdate || isDeleting || isRestoring || isTrashed}
                  title={isTrashed ? t('products.trashedTitle') : t('products.deleteConfirmTitle')}
                >
                  {isDeleting ? t('products.deletingLabel') : t('common.delete')}
                </button>
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

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('products.eyebrow')}</p>
          <h1>{t('products.title')}</h1>
          <p>{t('products.description')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExportButton
            label="Xuất CSV"
            filename={`products_${new Date().toISOString().slice(0,10)}.csv`}
            onExport={() => exportProductsCsv({ publishStatus: query.publishStatus !== 'ALL' ? query.publishStatus : undefined })}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/products/new')}
            disabled={!canUpdate}
            title={!canUpdate ? t('products.requirePermission') : undefined}
          >
            {canUpdate ? t('products.create') : t('common.noPermission')}
          </button>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}


      <section className="filter-bar">
        <label>
          {t('common.search')}
          <input
            className="control-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('products.searchPlaceholder')}
          />
        </label>

        <label>
          {t('products.filterPublish')}
          <select
            className="control-select"
            value={query.publishStatus}
            onChange={(event) =>
              updateQuery({ publishStatus: event.target.value }, { resetPage: true })
            }
            >
              <option value="ALL">{t('common.all')}</option>
              <option value="DRAFT">{t('status.publish.DRAFT')}</option>
              <option value="PUBLISHED">{t('status.publish.PUBLISHED')}</option>
              <option value="HIDDEN">{t('status.publish.HIDDEN')}</option>
              <option value="ARCHIVED">{t('status.publish.ARCHIVED')}</option>
              <option value="TRASH">{t('status.publish.TRASH')}</option>
            </select>
          </label>

        <label>
          {t('products.filterStock')}
          <select
            className="control-select"
            value={query.stockState}
            onChange={(event) =>
              updateQuery({ stockState: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">{t('common.all')}</option>
            <option value="IN_STOCK">{t('status.stock.IN_STOCK')}</option>
            <option value="LOW_STOCK">{t('status.stock.LOW_STOCK')}</option>
            <option value="OUT_OF_STOCK">{t('status.stock.OUT_OF_STOCK')}</option>
            <option value="PREORDER">{t('status.stock.PREORDER')}</option>
            <option value="CONTACT_FOR_STOCK">{t('status.stock.CONTACT_FOR_STOCK')}</option>
          </select>
        </label>

        <label>
          {t('products.filterBrand')}
          <select
            className="control-select"
            value={query.brandId}
            onChange={(event) => updateQuery({ brandId: event.target.value }, { resetPage: true })}
          >
            <option value="">{t('common.all')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>

        <label>
          {t('products.filterCategory')}
          <select
            className="control-select"
            value={query.categoryId}
            onChange={(event) => updateQuery({ categoryId: event.target.value }, { resetPage: true })}
          >
            <option value="">{t('common.all')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label>
          {t('products.filterSort')}
          <select
            className="control-select"
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value }, { resetPage: true })
            }
          >
            <option value="updatedAt:desc">{t('sort.newestUpdated')}</option>
            <option value="updatedAt:asc">{t('sort.oldestUpdated')}</option>
            <option value="name:asc">{t('sort.nameAZ')}</option>
            <option value="name:desc">{t('sort.nameZA')}</option>
          </select>
        </label>

        <label>
          {t('common.rowsPerPage')}
          <select
            className="control-select"
            value={query.pageSize}
            onChange={(event) =>
              updateQuery(
                { pageSize: Number(event.target.value) },
                { resetPage: true },
              )
            }
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </section>

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
