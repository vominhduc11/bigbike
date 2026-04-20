import { useEffect, useMemo, useState } from 'react'
import {
  createCategory,
  fetchCategoryDetail,
  mapValidationErrors,
  updateCategory,
} from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { StatePanel } from '../components/StatePanel'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    parentId: '',
    sortOrder: '',
    visible: true,
    imageUrl: '',
    imageAlt: '',
    iconUrl: '',
    iconAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoNoIndex: false,
  }
}

function buildFormFromItem(item) {
  if (!item) {
    return buildEmptyForm()
  }
  return {
    slug: item.slug || '',
    name: item.name || '',
    description: item.description || '',
    parentId: item.parentId || '',
    sortOrder: Number.isInteger(item.sortOrder) ? String(item.sortOrder) : '',
    visible: item.isVisible !== false,
    imageUrl: item.image?.url || '',
    imageAlt: item.image?.alt || '',
    iconUrl: item.icon?.url || '',
    iconAlt: item.icon?.alt || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
  }
}

function toIntegerOrUndefined(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return undefined
  }
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) {
    return Number.NaN
  }
  return parsed
}

function validateForm(form) {
  const errors = {}
  if (!form.slug.trim()) {
    errors.slug = 'Slug is required.'
  } else if (!SLUG_REGEX.test(form.slug.trim())) {
    errors.slug = 'Slug can only contain lowercase letters, numbers and hyphens.'
  }

  if (!form.name.trim()) {
    errors.name = 'Category name is required.'
  }

  const sortOrder = toIntegerOrUndefined(form.sortOrder)
  if (Number.isNaN(sortOrder)) {
    errors.sortOrder = 'Sort order must be an integer.'
  }

  if (form.imageUrl.trim() && !/^https?:\/\//.test(form.imageUrl.trim())) {
    errors.imageUrl = 'Image URL must start with http:// or https://.'
  }
  if (form.iconUrl.trim() && !/^https?:\/\//.test(form.iconUrl.trim())) {
    errors.iconUrl = 'Icon URL must start with http:// or https://.'
  }

  return errors
}

function toPayload(form) {
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    parentId: form.parentId.trim() || undefined,
    sortOrder: toIntegerOrUndefined(form.sortOrder),
    visible: Boolean(form.visible),
  }

  if (form.imageUrl.trim()) {
    payload.image = {
      url: form.imageUrl.trim(),
      alt: form.imageAlt.trim() || undefined,
    }
  }

  if (form.iconUrl.trim()) {
    payload.icon = {
      url: form.iconUrl.trim(),
      alt: form.iconAlt.trim() || undefined,
    }
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
      payload.seo.ogImage = { url: form.seoOgImageUrl.trim() }
    }
  }

  return payload
}

export function CategoryDetailScreen({
  categoryId,
  isCreate = false,
  navigate,
  canUpdate,
}) {
  const [state, setState] = useState({
    status: isCreate ? 'success' : 'loading',
    item: null,
    warning: '',
    error: '',
  })
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(
    JSON.stringify(buildEmptyForm()),
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

    fetchCategoryDetail(categoryId)
      .then((response) => {
        if (!active) {
          return
        }
        const item = response.item || null
        const nextForm = buildFormFromItem(item)
        setForm(nextForm)
        setInitialSnapshot(JSON.stringify(nextForm))
        setState({
          status: 'success',
          item,
          warning: response.mode === 'mock' ? response.warning : '',
          error: '',
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
          error: error.message || 'Unknown category detail error.',
        })
      })

    return () => {
      active = false
    }
  }, [categoryId, isCreate])

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

    const clientErrors = validateForm(form)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      setSubmitState({ status: 'idle', message: '' })
      return
    }

    setSubmitState({ status: 'submitting', message: '' })
    setValidationErrors({})

    try {
      const payload = toPayload(form)
      const response = isCreate
        ? await createCategory(payload)
        : await updateCategory(categoryId, payload)

      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setState((previous) => ({
        ...previous,
        item: savedItem,
      }))
      setSubmitState({
        status: 'success',
        message: isCreate
          ? 'Category created successfully.'
          : 'Category updated successfully.',
      })

      if (isCreate && savedItem?.id) {
        navigate(`/admin/categories/${savedItem.id}`, { replace: true })
      }
    } catch (error) {
      setValidationErrors(mapValidationErrors(error))
      setSubmitState({
        status: 'error',
        message: error.message || 'Failed to save category.',
      })
    }
  }

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title="Loading category form"
        description="Fetching category detail for edit mode."
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title="Failed to load category"
        description={state.error}
        actionLabel="Back to categories"
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  if (!isCreate && !state.item) {
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

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>{isCreate ? 'Create category' : 'Edit category'}</h1>
          <p>
            {isCreate
              ? 'Create a new category record.'
              : 'Update category details and visibility.'}
          </p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/categories')}
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
          description="You can view this category, but catalog.update is required to save changes."
        />
      ) : null}

      <form className="entity-form" onSubmit={handleSubmit}>
        <section className="detail-section">
          <header className="detail-section-header">
            <h2>Basic information</h2>
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
              <span>Name *</span>
              <input
                className="control-input"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.name ? (
                <small className="field-error">{validationErrors.name}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>Parent ID</span>
              <input
                className="control-input"
                value={form.parentId}
                onChange={(event) => updateField('parentId', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.parentId ? (
                <small className="field-error">{validationErrors.parentId}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>Sort order</span>
              <input
                className="control-input"
                value={form.sortOrder}
                onChange={(event) => updateField('sortOrder', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.sortOrder ? (
                <small className="field-error">{validationErrors.sortOrder}</small>
              ) : null}
            </label>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(event) => updateField('visible', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>Visible</span>
            </label>

            <label className="form-field form-field-wide">
              <span>Description</span>
              <textarea
                className="control-input control-textarea"
                value={form.description}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
                disabled={isReadOnly}
              />
            </label>
          </div>
        </section>

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>Media and SEO</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field form-field-wide">
              <span>Image URL</span>
              <input
                className="control-input"
                value={form.imageUrl}
                onChange={(event) => updateField('imageUrl', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.imageUrl ? (
                <small className="field-error">{validationErrors.imageUrl}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>Image alt</span>
              <input
                className="control-input"
                value={form.imageAlt}
                onChange={(event) => updateField('imageAlt', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>Icon URL</span>
              <input
                className="control-input"
                value={form.iconUrl}
                onChange={(event) => updateField('iconUrl', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.iconUrl ? (
                <small className="field-error">{validationErrors.iconUrl}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>Icon alt</span>
              <input
                className="control-input"
                value={form.iconAlt}
                onChange={(event) => updateField('iconAlt', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

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
                  ? 'Create category'
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
