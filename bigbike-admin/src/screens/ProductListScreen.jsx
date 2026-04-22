import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { PublishStatusBadge, StockStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ApiClientError, fetchProducts, softDeleteProduct } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const INITIAL_QUERY = {
  search: '',
  publishStatus: 'ALL',
  stockState: 'ALL',
  sort: 'updatedAt:desc',
  page: 1,
  pageSize: 8,
}

export function ProductListScreen({ navigate, canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    pagination: null,
    warning: '',
  })
  const [deleteState, setDeleteState] = useState({ id: null, error: '' })

  useEffect(() => {
    let active = true

    fetchProducts(query)
      .then((response) => {
        if (!active) {
          return
        }

        setState({
          status: 'success',
          items: response.items,
          pagination: response.pagination,
          warning: response.mode === 'mock' ? response.warning : '',
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState({
          status: 'error',
          items: [],
          pagination: null,
          warning: '',
          error: error.message,
        })
      })

    return () => {
      active = false
    }
  }, [query])

  const refreshList = useCallback(() => {
    setState((previous) => ({ ...previous, status: 'loading' }))
    setQuery((previous) => ({ ...previous }))
  }, [])

  const handleDelete = useCallback(async (product) => {
    const confirmed = window.confirm(
      `Chuyển sản phẩm "${product.name}" vào thùng rác?\n` +
      `Trạng thái xuất bản sẽ chuyển sang TRASH và sản phẩm sẽ ẩn khỏi website.`,
    )
    if (!confirmed) return

    setDeleteState({ id: product.id, error: '' })
    try {
      await softDeleteProduct(product.id)
      setDeleteState({ id: null, error: '' })
      refreshList()
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : (error?.message || 'Không thể xóa sản phẩm.')
      setDeleteState({ id: null, error: message })
    }
  }, [refreshList])

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Product',
        render: (product) => (
          <div className="product-cell">
            <div className="thumbnail-wrap">
              {product.image?.url ? (
                <img src={product.image.url} alt={product.image.alt || product.name} />
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
        label: 'Price',
        render: (product) => (
          <div className="price-cell">
            <strong>{formatCurrencyVnd(product.price.retailPrice)}</strong>
            {product.price.salePrice ? (
              <span>{formatCurrencyVnd(product.price.salePrice)}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'publishStatus',
        label: 'Publish',
        render: (product) => <PublishStatusBadge value={product.publishStatus} />,
      },
      {
        key: 'stockState',
        label: 'Stock',
        render: (product) => <StockStatusBadge value={product.stockState} />,
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        render: (product) => formatDateTime(product.updatedAt),
      },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        render: (product) => {
          const isDeleting = deleteState.id === product.id
          const isTrashed = product.publishStatus === 'TRASH'
          return (
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/admin/products/${product.id}`)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(product)}
                disabled={!canUpdate || isDeleting || isTrashed}
                title={isTrashed ? 'Sản phẩm đã ở thùng rác.' : 'Chuyển vào thùng rác'}
              >
                {isDeleting ? 'Đang xóa…' : 'Xóa'}
              </button>
            </div>
          )
        },
      },
    ],
    [navigate, handleDelete, deleteState.id, canUpdate],
  )

  function updateQuery(partial, options = { resetPage: false }) {
    setState((previous) => ({ ...previous, status: 'loading' }))
    setQuery((previous) => ({
      ...previous,
      ...partial,
      page: options.resetPage ? 1 : previous.page,
    }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Products</h1>
          <p>Manage product catalog records with real create/update mutation APIs.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/admin/products/new')}
          disabled={!canUpdate}
        >
          {canUpdate ? 'Create product' : 'No update permission'}
        </button>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      {deleteState.error ? (
        <StatePanel tone="danger" title="Không thể xóa sản phẩm" description={deleteState.error} />
      ) : null}

      <section className="filter-bar">
        <label>
          Search
          <input
            className="control-input"
            type="search"
            value={query.search}
            onChange={(event) =>
              updateQuery({ search: event.target.value }, { resetPage: true })
            }
            placeholder="Search by product name, SKU, slug"
          />
        </label>

        <label>
          Publish status
          <select
            className="control-select"
            value={query.publishStatus}
            onChange={(event) =>
              updateQuery({ publishStatus: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>

        <label>
          Stock state
          <select
            className="control-select"
            value={query.stockState}
            onChange={(event) =>
              updateQuery({ stockState: event.target.value }, { resetPage: true })
            }
          >
            <option value="ALL">All</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="PREORDER">Preorder</option>
            <option value="CONTACT_FOR_STOCK">Contact for stock</option>
          </select>
        </label>

        <label>
          Sort
          <select
            className="control-select"
            value={query.sort}
            onChange={(event) =>
              updateQuery({ sort: event.target.value }, { resetPage: true })
            }
          >
            <option value="updatedAt:desc">Updated (newest)</option>
            <option value="updatedAt:asc">Updated (oldest)</option>
            <option value="name:asc">Name (A-Z)</option>
            <option value="name:desc">Name (Z-A)</option>
          </select>
        </label>

        <label>
          Page size
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
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={20}>20</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' ? (
        <StatePanel
          tone="info"
          title="Loading products"
          description="Fetching product list and table states."
        />
      ) : null}

      {state.status === 'error' ? (
        <StatePanel
          tone="danger"
          title="Failed to load products"
          description={state.error || 'Unknown error while loading products.'}
          actionLabel="Retry"
          onAction={() => {
            setState((previous) => ({ ...previous, status: 'loading' }))
            setQuery((previous) => ({ ...previous }))
          }}
        />
      ) : null}

      {state.status === 'success' && state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title="No products found"
          description="Try changing search/filter criteria or create the first product."
          actionLabel="Reset filters"
          onAction={() => setQuery(INITIAL_QUERY)}
        />
      ) : null}

      {state.status === 'success' && state.items.length > 0 ? (
        <>
          <AdminTable
            caption="Product list"
            columns={columns}
            rows={state.items}
          />
          <PaginationControls
            pagination={state.pagination}
            onPageChange={(nextPage) => updateQuery({ page: nextPage })}
          />
        </>
      ) : null}
    </section>
  )
}
