import { useEffect, useMemo, useState } from 'react'
import {
  createContent,
  fetchContentDetail,
  mapValidationErrors,
  updateContent,
} from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { StatePanel } from '../components/StatePanel'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeContentType(value) {
  return String(value || '').toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE'
}

function mutationPath(contentType) {
  return normalizeContentType(contentType) === 'PAGE' ? 'pages' : 'articles'
}

function buildEmptyForm(contentType) {
  return {
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    publishStatus: 'DRAFT',
    pageType: 'CUSTOM',
    coverImageUrl: '',
    coverImageAlt: '',
    tags: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoNoIndex: false,
    type: normalizeContentType(contentType),
  }
}

function buildFormFromItem(contentType, item) {
  const fallback = buildEmptyForm(contentType)
  if (!item) {
    return fallback
  }

  return {
    ...fallback,
    slug: item.slug || '',
    title: item.title || '',
    excerpt: item.excerpt || '',
    body: item.body || '',
    publishStatus: item.publishStatus === 'UNKNOWN' ? 'DRAFT' : item.publishStatus,
    coverImageUrl: item.coverImage?.url || '',
    coverImageAlt: item.coverImage?.alt || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
    type: normalizeContentType(item.type || contentType),
  }
}

function normalizeTagsInput(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function validateForm(form, isCreate) {
  const errors = {}
  if (!form.slug.trim()) {
    errors.slug = 'Slug is required.'
  } else if (!SLUG_REGEX.test(form.slug.trim())) {
    errors.slug = 'Slug can only contain lowercase letters, numbers and hyphens.'
  }
  if (!form.title.trim()) {
    errors.title = 'Title is required.'
  }
  if (!form.body.trim()) {
    errors.body = 'Body is required.'
  }
  if (!form.publishStatus) {
    errors.publishStatus = 'Publish status is required.'
  }
  if (form.type === 'PAGE' && isCreate && !form.pageType.trim()) {
    errors.pageType = 'Page type is required.'
  }
  if (
    form.coverImageUrl.trim() &&
    !/^https?:\/\//.test(form.coverImageUrl.trim())
  ) {
    errors.coverImageUrl = 'Cover image URL must start with http:// or https://.'
  }
  if (
    form.seoCanonicalUrl.trim() &&
    !/^https?:\/\//.test(form.seoCanonicalUrl.trim())
  ) {
    errors.seoCanonicalUrl = 'Canonical URL must start with http:// or https://.'
  }
  if (
    form.seoOgImageUrl.trim() &&
    !/^https?:\/\//.test(form.seoOgImageUrl.trim())
  ) {
    errors.seoOgImageUrl = 'SEO OG image URL must start with http:// or https://.'
  }
  return errors
}

function toPayload(form, isCreate) {
  const payload = {
    slug: form.slug.trim(),
    title: form.title.trim(),
    body: form.body.trim(),
    publishStatus: form.publishStatus,
  }

  if (form.type === 'ARTICLE') {
    payload.excerpt = form.excerpt.trim() || undefined
    if (form.coverImageUrl.trim()) {
      payload.coverImage = {
        url: form.coverImageUrl.trim(),
        alt: form.coverImageAlt.trim() || undefined,
      }
    }
    const tags = normalizeTagsInput(form.tags)
    if (tags.length > 0) {
      payload.tags = tags
    }
  }

  if (form.type === 'PAGE' && isCreate) {
    payload.pageType = form.pageType.trim()
  }

  if (
    form.seoTitle.trim() ||
    form.seoDescription.trim() ||
    form.seoCanonicalUrl.trim() ||
    form.seoOgImageUrl.trim() ||
    form.seoNoIndex
  ) {
    payload.seo = {
      title: form.seoTitle.trim() || undefined,
      description: form.seoDescription.trim() || undefined,
      canonicalUrl: form.seoCanonicalUrl.trim() || undefined,
      noIndex: Boolean(form.seoNoIndex),
    }

    if (form.seoOgImageUrl.trim()) {
      payload.seo.ogImage = {
        url: form.seoOgImageUrl.trim(),
      }
    }
  }

  return payload
}

export function ContentDetailScreen({
  contentType,
  contentId,
  isCreate = false,
  navigate,
  canUpdate,
}) {
  const normalizedType = normalizeContentType(contentType)
  const [state, setState] = useState({
    status: isCreate ? 'success' : 'loading',
    item: null,
    warning: '',
    error: '',
  })
  const [form, setForm] = useState(() => buildEmptyForm(normalizedType))
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify(buildEmptyForm(normalizedType)),
  )
  const [validationErrors, setValidationErrors] = useState({})
  const [submitState, setSubmitState] = useState({
    status: 'idle',
    message: '',
  })

  useEffect(() => {
    if (isCreate) {
      return
    }

    let active = true

    fetchContentDetail(normalizedType, contentId)
      .then((response) => {
        if (!active) {
          return
        }

        setState({
          status: 'success',
          item: response.item || null,
          warning: response.mode === 'mock' ? response.warning : '',
          error: '',
        })

        const nextForm = buildFormFromItem(normalizedType, response.item)
        setForm(nextForm)
        setInitialSnapshot(JSON.stringify(nextForm))
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState({
          status: 'error',
          item: null,
          warning: '',
          error: error.message || 'Unknown content detail error.',
        })
      })

    return () => {
      active = false
    }
  }, [contentId, isCreate, normalizedType])

  const isSubmitting = submitState.status === 'submitting'
  const isDirty = useMemo(
    () => JSON.stringify(form) !== initialSnapshot,
    [form, initialSnapshot],
  )
  const isReadOnly = !canUpdate || isSubmitting

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setSubmitState({ status: 'idle', message: '' })
    setValidationErrors((previous) => {
      if (!previous[field]) {
        return previous
      }
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canUpdate) {
      return
    }

    const clientErrors = validateForm(form, isCreate)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      setSubmitState({ status: 'idle', message: '' })
      return
    }

    setSubmitState({ status: 'submitting', message: '' })
    setValidationErrors({})

    try {
      const payload = toPayload(form, isCreate)
      const response = isCreate
        ? await createContent(normalizedType, payload)
        : await updateContent(normalizedType, contentId, payload)

      const savedItem = response.item || null
      const nextForm = buildFormFromItem(normalizedType, savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setState((previous) => ({
        ...previous,
        item: savedItem,
      }))
      setSubmitState({
        status: 'success',
        message: isCreate
          ? `${normalizedType === 'ARTICLE' ? 'Article' : 'Page'} created successfully.`
          : `${normalizedType === 'ARTICLE' ? 'Article' : 'Page'} updated successfully.`,
      })

      if (isCreate && savedItem?.id) {
        navigate(`/admin/content/${mutationPath(normalizedType)}/${savedItem.id}`, {
          replace: true,
        })
      }
    } catch (error) {
      setValidationErrors(mapValidationErrors(error))
      setSubmitState({
        status: 'error',
        message: error.message || 'Failed to save content.',
      })
    }
  }

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
        description={state.error}
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

  const contentLabel = normalizedType === 'ARTICLE' ? 'article' : 'page'

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>
            {isCreate
              ? `Create ${contentLabel}`
              : `Edit ${contentLabel}`}
          </h1>
          <p>
            {isCreate
              ? `Create a new ${contentLabel} record.`
              : `Update ${contentLabel} metadata, publish status and SEO.`}
          </p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/content')}
          >
            Back to list
          </button>
        </div>
      </header>

      {state.warning ? (
        <StatePanel
          tone="warning"
          title="Read data is currently mock"
          description={state.warning}
        />
      ) : null}

      {!canUpdate ? (
        <StatePanel
          tone="warning"
          title="Permission denied"
          description="You can view this content, but content.update is required to save changes."
        />
      ) : null}

      <form className="entity-form" onSubmit={handleSubmit}>
        <section className="detail-section">
          <header className="detail-section-header">
            <h2>Core information</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field">
              <span>Slug *</span>
              <input
                className="control-input"
                value={form.slug}
                onChange={(event) => updateField('slug', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.slug ? (
                <small className="field-error">{validationErrors.slug}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>Title *</span>
              <input
                className="control-input"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.title ? (
                <small className="field-error">{validationErrors.title}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>Publish status *</span>
              <select
                className="control-select"
                value={form.publishStatus}
                onChange={(event) =>
                  updateField('publishStatus', event.target.value)
                }
                disabled={isReadOnly}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
              {validationErrors.publishStatus ? (
                <small className="field-error">
                  {validationErrors.publishStatus}
                </small>
              ) : null}
            </label>

            {normalizedType === 'PAGE' ? (
              <label className="form-field">
                <span>Page type *</span>
                <input
                  className="control-input"
                  value={form.pageType}
                  onChange={(event) => updateField('pageType', event.target.value)}
                  disabled={isReadOnly || !isCreate}
                />
                {validationErrors.pageType ? (
                  <small className="field-error">{validationErrors.pageType}</small>
                ) : null}
              </label>
            ) : null}

            {normalizedType === 'ARTICLE' ? (
              <label className="form-field form-field-wide">
                <span>Excerpt</span>
                <textarea
                  className="control-input control-textarea"
                  value={form.excerpt}
                  onChange={(event) => updateField('excerpt', event.target.value)}
                  disabled={isReadOnly}
                />
              </label>
            ) : null}

            <label className="form-field form-field-wide">
              <span>Body *</span>
              <textarea
                className="control-input control-textarea control-textarea-lg"
                value={form.body}
                onChange={(event) => updateField('body', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.body ? (
                <small className="field-error">{validationErrors.body}</small>
              ) : null}
            </label>
          </div>
        </section>

        {normalizedType === 'ARTICLE' ? (
          <section className="detail-section">
            <header className="detail-section-header">
              <h2>Article media and tags</h2>
            </header>
            <div className="detail-section-content form-grid">
              <label className="form-field form-field-wide">
                <span>Cover image URL</span>
                <input
                  className="control-input"
                  value={form.coverImageUrl}
                  onChange={(event) =>
                    updateField('coverImageUrl', event.target.value)
                  }
                  disabled={isReadOnly}
                  placeholder="https://..."
                />
                {validationErrors.coverImageUrl ? (
                  <small className="field-error">{validationErrors.coverImageUrl}</small>
                ) : null}
              </label>

              <label className="form-field">
                <span>Cover image alt</span>
                <input
                  className="control-input"
                  value={form.coverImageAlt}
                  onChange={(event) =>
                    updateField('coverImageAlt', event.target.value)
                  }
                  disabled={isReadOnly}
                />
              </label>

              <label className="form-field form-field-wide">
                <span>Tags (comma separated)</span>
                <input
                  className="control-input"
                  value={form.tags}
                  onChange={(event) => updateField('tags', event.target.value)}
                  disabled={isReadOnly}
                  placeholder="touring, helmets, safety"
                />
              </label>
            </div>
          </section>
        ) : null}

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>SEO</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field form-field-wide">
              <span>SEO title</span>
              <input
                className="control-input"
                value={form.seoTitle}
                onChange={(event) => updateField('seoTitle', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>SEO description</span>
              <textarea
                className="control-input control-textarea"
                value={form.seoDescription}
                onChange={(event) =>
                  updateField('seoDescription', event.target.value)
                }
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>SEO canonical URL</span>
              <input
                className="control-input"
                value={form.seoCanonicalUrl}
                onChange={(event) =>
                  updateField('seoCanonicalUrl', event.target.value)
                }
                disabled={isReadOnly}
              />
              {validationErrors.seoCanonicalUrl ? (
                <small className="field-error">
                  {validationErrors.seoCanonicalUrl}
                </small>
              ) : null}
            </label>

            <label className="form-field form-field-wide">
              <span>SEO OG image URL</span>
              <input
                className="control-input"
                value={form.seoOgImageUrl}
                onChange={(event) =>
                  updateField('seoOgImageUrl', event.target.value)
                }
                disabled={isReadOnly}
              />
              {validationErrors.seoOgImageUrl ? (
                <small className="field-error">{validationErrors.seoOgImageUrl}</small>
              ) : null}
            </label>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.seoNoIndex}
                onChange={(event) => updateField('seoNoIndex', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>SEO noIndex</span>
            </label>
          </div>
        </section>

        <div className="form-footer">
          <div className="form-status">
            <span className={`status-pill ${isDirty ? 'is-dirty' : 'is-clean'}`}>
              {isDirty ? 'Dirty changes' : 'No unsaved changes'}
            </span>
            {!isCreate && state.item?.updatedAt ? (
              <small>Last updated: {formatDateTime(state.item.updatedAt)}</small>
            ) : null}
          </div>
          <div className="screen-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isReadOnly || !isDirty}
            >
              {isSubmitting
                ? 'Saving...'
                : isCreate
                  ? `Create ${contentLabel}`
                  : 'Save changes'}
            </button>
          </div>
        </div>

        {submitState.status === 'success' ? (
          <p className="inline-feedback inline-feedback-success">
            {submitState.message}
          </p>
        ) : null}
        {submitState.status === 'error' ? (
          <p className="inline-feedback inline-feedback-danger">
            {submitState.message}
          </p>
        ) : null}
      </form>
    </section>
  )
}
