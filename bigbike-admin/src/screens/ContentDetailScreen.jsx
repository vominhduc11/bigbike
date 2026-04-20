import { useEffect, useState } from 'react'
import { DetailField, DetailSection } from '../components/DetailSection'
import { PublishStatusBadge } from '../components/StatusBadge'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchContentDetail } from '../lib/adminApi'
import { formatDateTime, formatText } from '../lib/formatters'

export function ContentDetailScreen({
  contentType,
  contentId,
  navigate,
  canUpdate,
}) {
  const [state, setState] = useState({
    status: 'loading',
    item: null,
    warning: '',
  })

  useEffect(() => {
    let active = true

    fetchContentDetail(contentType.toUpperCase(), contentId)
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
  }, [contentId, contentType])

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title="Loading content detail"
        description="Fetching article/page detail shell."
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title="Failed to load content detail"
        description={state.error || 'Unknown content detail error.'}
        actionLabel="Back to content list"
        onAction={() => navigate('/admin/content')}
      />
    )
  }

  if (!state.item) {
    return (
      <StatePanel
        tone="neutral"
        title="Content not found"
        description="The selected article/page does not exist."
        actionLabel="Back to content list"
        onAction={() => navigate('/admin/content')}
      />
    )
  }

  const item = state.item

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Content detail/edit shell</h1>
          <p>Read-only foundation shell for article/page management.</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/content')}
          >
            Back to list
          </button>
          <button type="button" className="btn btn-primary" disabled>
            {canUpdate ? 'Save changes (TBD)' : 'No update permission'}
          </button>
        </div>
      </header>

      <ReadOnlyBanner warning={state.warning} />

      <DetailSection title="Core information">
        <div className="detail-grid">
          <DetailField label="ID" value={item.id} />
          <DetailField label="Type" value={item.type} />
          <DetailField label="Slug" value={item.slug} />
          <DetailField label="Title" value={item.title} />
          <DetailField label="Excerpt" value={formatText(item.excerpt)} />
          <DetailField label="Publish status" value={<PublishStatusBadge value={item.publishStatus} />} />
        </div>
      </DetailSection>

      <DetailSection title="Body and SEO">
        <div className="detail-grid">
          <DetailField label="Body" value={formatText(item.body)} />
          <DetailField label="SEO title" value={formatText(item.seo?.title)} />
          <DetailField label="SEO description" value={formatText(item.seo?.description)} />
          <DetailField label="Published at" value={formatDateTime(item.publishedAt)} />
          <DetailField label="Created at" value={formatDateTime(item.createdAt)} />
          <DetailField label="Updated at" value={formatDateTime(item.updatedAt)} />
        </div>
      </DetailSection>

      <DetailSection title="Cover image">
        <div className="media-grid">
          <article className="media-card">
            <h3>Cover image</h3>
            {item.coverImage?.url ? (
              <img src={item.coverImage.url} alt={item.coverImage.alt || item.title} />
            ) : (
              <p>No cover image</p>
            )}
          </article>
        </div>
      </DetailSection>
    </section>
  )
}
