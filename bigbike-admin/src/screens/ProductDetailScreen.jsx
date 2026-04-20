import { useEffect, useState } from 'react'
import { DetailField, DetailSection } from '../components/DetailSection'
import { PublishStatusBadge, StockStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchProductDetail } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

export function ProductDetailScreen({ productId, navigate, canUpdate }) {
  const [state, setState] = useState({
    status: 'loading',
    item: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchProductDetail(productId)
      .then((response) => {
        if (!active) {
          return
        }

        setState({
          status: 'success',
          item: response.item || null,
          warning: response.mode === 'mock' ? response.warning : '',
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState({
          status: 'error',
          item: null,
          warning: '',
          error: error.message,
        })
      })

    return () => {
      active = false
    }
  }, [productId])

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title="Loading product detail"
        description="Fetching product detail/edit shell data."
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title="Failed to load product detail"
        description={state.error || 'Unknown error while loading product.'}
        actionLabel="Back to products"
        onAction={() => navigate('/admin/products')}
      />
    )
  }

  if (!state.item) {
    return (
      <StatePanel
        tone="neutral"
        title="Product not found"
        description="The selected product does not exist or is unavailable."
        actionLabel="Back to products"
        onAction={() => navigate('/admin/products')}
      />
    )
  }

  const product = state.item

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Product detail/edit shell</h1>
          <p>Read-only shell for phase foundation. Mutation flow is intentionally deferred.</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/products')}
          >
            Back to list
          </button>
          <button type="button" className="btn btn-primary" disabled>
            {canUpdate ? 'Save changes (TBD)' : 'No update permission'}
          </button>
        </div>
      </header>

      <ReadOnlyBanner warning={state.warning} />

      <DetailSection title="Basic information" description="Core product identity fields.">
        <div className="detail-grid">
          <DetailField label="ID" value={product.id} />
          <DetailField label="SKU" value={formatText(product.sku)} />
          <DetailField label="Slug" value={product.slug} />
          <DetailField label="Name" value={product.name} />
          <DetailField label="Short description" value={formatText(product.shortDescription)} />
          <DetailField label="Description" value={formatText(product.description)} />
        </div>
      </DetailSection>

      <DetailSection title="Pricing and stock" description="Money values are integer VND by contract.">
        <div className="detail-grid">
          <DetailField label="Retail price" value={formatCurrencyVnd(product.price.retailPrice)} />
          <DetailField
            label="Compare-at price"
            value={formatCurrencyVnd(product.price.compareAtPrice)}
          />
          <DetailField label="Sale price" value={formatCurrencyVnd(product.price.salePrice)} />
          <DetailField label="Currency" value={product.price.currency} />
          <DetailField label="Publish status" value={<PublishStatusBadge value={product.publishStatus} />} />
          <DetailField label="Stock state" value={<StockStatusBadge value={product.stockState} />} />
        </div>
      </DetailSection>

      <DetailSection title="Media contract" description="Canonical media shape: image.url, gallery[], videos[].">
        <div className="media-grid">
          <article className="media-card">
            <h3>Cover image</h3>
            {product.image?.url ? (
              <img src={product.image.url} alt={product.image.alt || product.name} />
            ) : (
              <p>No cover image</p>
            )}
          </article>
          <article className="media-card">
            <h3>Gallery ({product.gallery.length})</h3>
            {product.gallery.length ? (
              <ul className="compact-list">
                {product.gallery.map((item, index) => (
                  <li key={`${item.url}:${index}`}>{formatText(item.url)}</li>
                ))}
              </ul>
            ) : (
              <p>Gallery is empty.</p>
            )}
          </article>
          <article className="media-card">
            <h3>Videos ({product.videos.length})</h3>
            {product.videos.length ? (
              <ul className="compact-list">
                {product.videos.map((item, index) => (
                  <li key={`${item.url}:${index}`}>{formatText(item.url)}</li>
                ))}
              </ul>
            ) : (
              <p>Videos are empty.</p>
            )}
          </article>
        </div>
      </DetailSection>

      <DetailSection title="Catalog relation">
        <div className="detail-grid">
          <DetailField label="Brand" value={formatText(product.brand?.name)} />
          <DetailField label="Category" value={formatText(product.category?.name)} />
          <DetailField label="Featured" value={product.isFeatured ? 'Yes' : 'No'} />
          <DetailField label="Homepage slot" value={product.showOnHomepage ? 'Yes' : 'No'} />
          <DetailField label="Created at" value={formatDateTime(product.createdAt)} />
          <DetailField label="Updated at" value={formatDateTime(product.updatedAt)} />
        </div>
      </DetailSection>

      {!canUpdate ? (
        <StatePanel
          tone="warning"
          title="Permission note"
          description="You can view product detail because products.read is granted, but products.update is required for mutation."
        />
      ) : null}
    </section>
  )
}
