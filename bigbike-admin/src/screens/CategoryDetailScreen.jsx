import { useEffect, useState } from 'react'
import { DetailField, DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchCategoryDetail } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

export function CategoryDetailScreen({ categoryId, navigate, canUpdate }) {
  const [state, setState] = useState({
    status: 'loading',
    item: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchCategoryDetail(categoryId)
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
  }, [categoryId])

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title="Loading category detail"
        description="Fetching category detail/edit shell."
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title="Failed to load category"
        description={state.error || 'Unknown category detail error.'}
        actionLabel="Back to categories"
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  if (!state.item) {
    return (
      <StatePanel
        tone="neutral"
        title="Category not found"
        description="The selected category does not exist."
        actionLabel="Back to categories"
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  const category = state.item

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Category detail/edit shell</h1>
          <p>Read-only foundation shell for category management.</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/categories')}
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
          <DetailField label="ID" value={category.id} />
          <DetailField label="Slug" value={category.slug} />
          <DetailField label="Name" value={category.name} />
          <DetailField label="Description" value={formatText(category.description)} />
          <DetailField label="Parent ID" value={formatText(category.parentId)} />
          <DetailField label="Sort order" value={String(category.sortOrder)} />
        </div>
      </DetailSection>

      <DetailSection title="Visibility and SEO">
        <div className="detail-grid">
          <DetailField
            label="Visibility"
            value={
              category.isVisible ? (
                <span className="status-badge status-success">Visible</span>
              ) : (
                <span className="status-badge status-neutral">Hidden</span>
              )
            }
          />
          <DetailField label="SEO title" value={formatText(category.seo?.title)} />
          <DetailField
            label="SEO description"
            value={formatText(category.seo?.description)}
          />
          <DetailField label="Created at" value={formatDateTime(category.createdAt)} />
          <DetailField label="Updated at" value={formatDateTime(category.updatedAt)} />
        </div>
      </DetailSection>

      <DetailSection title="Media">
        <div className="media-grid">
          <article className="media-card">
            <h3>Category image</h3>
            {category.image?.url ? (
              <img src={category.image.url} alt={category.image.alt || category.name} />
            ) : (
              <p>No image</p>
            )}
          </article>
          <article className="media-card">
            <h3>Category icon</h3>
            {category.icon?.url ? (
              <img src={category.icon.url} alt={category.icon.alt || category.name} />
            ) : (
              <p>No icon</p>
            )}
          </article>
        </div>
      </DetailSection>
    </section>
  )
}
