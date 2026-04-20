import { useEffect, useState } from 'react'
import { DetailField, DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchBrandDetail } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

export function BrandDetailScreen({ brandId, navigate, canUpdate }) {
  const [state, setState] = useState({
    status: 'loading',
    item: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchBrandDetail(brandId)
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
  }, [brandId])

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title="Loading brand detail"
        description="Fetching brand detail/edit shell."
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title="Failed to load brand"
        description={state.error || 'Unknown brand detail error.'}
        actionLabel="Back to brands"
        onAction={() => navigate('/admin/brands')}
      />
    )
  }

  if (!state.item) {
    return (
      <StatePanel
        tone="neutral"
        title="Brand not found"
        description="The selected brand does not exist."
        actionLabel="Back to brands"
        onAction={() => navigate('/admin/brands')}
      />
    )
  }

  const brand = state.item

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Brand detail/edit shell</h1>
          <p>Read-only foundation shell for brand management.</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/brands')}
          >
            Back to list
          </button>
          <button type="button" className="btn btn-primary" disabled>
            {canUpdate ? 'Save changes (TBD)' : 'No update permission'}
          </button>
        </div>
      </header>

      <ReadOnlyBanner warning={state.warning} />

      <DetailSection title="Basic information">
        <div className="detail-grid">
          <DetailField label="ID" value={brand.id} />
          <DetailField label="Slug" value={brand.slug} />
          <DetailField label="Name" value={brand.name} />
          <DetailField label="Description" value={formatText(brand.description)} />
          <DetailField label="Created at" value={formatDateTime(brand.createdAt)} />
          <DetailField label="Updated at" value={formatDateTime(brand.updatedAt)} />
        </div>
      </DetailSection>

      <DetailSection title="Visibility and SEO">
        <div className="detail-grid">
          <DetailField
            label="Visibility"
            value={
              brand.isVisible ? (
                <span className="status-badge status-success">Visible</span>
              ) : (
                <span className="status-badge status-neutral">Hidden</span>
              )
            }
          />
          <DetailField label="SEO title" value={formatText(brand.seo?.title)} />
          <DetailField label="SEO description" value={formatText(brand.seo?.description)} />
        </div>
      </DetailSection>

      <DetailSection title="Brand media">
        <div className="media-grid">
          <article className="media-card">
            <h3>Logo</h3>
            {brand.logo?.url ? (
              <img src={brand.logo.url} alt={brand.logo.alt || brand.name} />
            ) : (
              <p>No logo</p>
            )}
          </article>
        </div>
      </DetailSection>
    </section>
  )
}
