import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createCategory,
  fetchCategories,
  fetchCategoryDetail,
  mapValidationErrors,
  softDeleteCategory,
  updateCategory,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { createCategorySchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { RichTextEditor } from '../components/RichTextEditor'

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    parentId: '',
    visible: true,
    showOnHomepage: false,
    sortOrder: '',
    imageUrl: '',
    imageAlt: '',
    iconUrl: '',
    iconAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    seoNoIndex: false,
  }
}

function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()
  return {
    slug: item.slug || '',
    name: item.name || '',
    description: item.description || '',
    parentId: item.parentId || '',
    visible: item.isVisible !== false,
    showOnHomepage: Boolean(item.showOnHomepage),
    sortOrder: item.sortOrder != null ? String(item.sortOrder) : '',
    imageUrl: item.image?.url || '',
    imageAlt: item.image?.alt || '',
    iconUrl: item.icon?.url || '',
    iconAlt: item.icon?.alt || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
  }
}

function toPayload(form) {
  const sortStr = form.sortOrder.trim()
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    parentId: form.parentId.trim(),
    visible: Boolean(form.visible),
    showOnHomepage: Boolean(form.showOnHomepage),
    sortOrder: sortStr !== '' ? parseInt(sortStr, 10) : null,
  }

  const imageUrl = form.imageUrl.trim()
  payload.image = imageUrl ? { url: imageUrl, alt: form.imageAlt.trim() || undefined } : { url: null }

  const iconUrl = form.iconUrl.trim()
  payload.icon = iconUrl ? { url: iconUrl, alt: form.iconAlt.trim() || undefined } : { url: null }

  const seoTitle = form.seoTitle.trim()
  const seoDescription = form.seoDescription.trim()
  const seoCanonicalUrl = form.seoCanonicalUrl.trim()
  const seoOgImageUrl = form.seoOgImageUrl.trim()
  const seoOgImageAlt = form.seoOgImageAlt.trim()
  payload.seo = {
    title: seoTitle || undefined,
    description: seoDescription || undefined,
    canonicalUrl: seoCanonicalUrl || undefined,
    ogImage: seoOgImageUrl
      ? { url: seoOgImageUrl, alt: seoOgImageAlt || undefined }
      : null,
    noIndex: form.seoNoIndex || undefined,
  }

  return payload
}

export function CategoryDetailScreen({ categoryId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(buildEmptyForm()))
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => fetchCategoryDetail(categoryId),
    enabled: !isCreate,
  })

  const { data: categoriesResult } = useQuery({
    queryKey: ['categories', { page: 1, pageSize: 100, sort: 'sortOrder:asc' }],
    queryFn: () => fetchCategories({ page: 1, pageSize: 100, sort: 'sortOrder:asc' }),
  })

  const currentItem = fetchResult?.item ?? null

  const breadcrumbPath = useMemo(() => {
    const items = categoriesResult?.items ?? []
    if (!currentItem?.parentId) return null
    const byId = new Map(items.map((c) => [c.id, c]))
    const parts = []
    let cur = byId.get(currentItem.parentId)
    let safety = 10
    while (cur && safety-- > 0) {
      parts.unshift(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : null
    }
    return parts.join(' / ')
  }, [categoriesResult, currentItem])

  const parentOptions = useMemo(() => {
    const items = categoriesResult?.items ?? []
    const descendants = new Set()
    if (categoryId) {
      const findDescendants = (id) => {
        items.forEach((c) => {
          if (c.parentId === id && !descendants.has(c.id)) {
            descendants.add(c.id)
            findDescendants(c.id)
          }
        })
      }
      findDescendants(categoryId)
    }
    const eligible = items.filter((c) => c.id !== categoryId && !descendants.has(c.id))
    const map = new Map(eligible.map((c) => [c.id, { ...c, children: [] }]))
    const roots = []
    eligible.forEach((c) => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId).children.push(map.get(c.id))
      } else {
        roots.push(map.get(c.id))
      }
    })
    const flattened = []
    const flatten = (nodes, depth) => {
      nodes.forEach((node) => {
        flattened.push({ id: node.id, label: (depth > 0 ? '— '.repeat(depth) : '') + node.name })
        flatten(node.children, depth + 1)
      })
    }
    flatten(roots, 0)
    return flattened
  }, [categoriesResult, categoryId])

  useEffect(() => {
    if (!fetchResult) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      const item = fetchResult.item || null
      const nextForm = buildFormFromItem(item)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setSlugManuallyEdited(true)
    })
    return () => { cancelled = true }
  }, [fetchResult])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: currentItem,
    warning: fetchResult?.mode === 'mock' ? (fetchResult?.warning ?? '') : '',
    error: fetchError?.message ?? '',
  }

  const isDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot])
  const isReadOnly = !canUpdate || isSubmitting
  const formRef = useRef(null)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate ? createCategory(payload) : updateCategory(categoryId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      if (!isCreate) queryClient.setQueryData(['category', categoryId], response)
      toast.success(isCreate ? t('categories.detail.successCreate') : t('categories.detail.successUpdate'))
      setIsSubmitting(false)
      if (isCreate && savedItem?.id) navigate(`/admin/categories/${savedItem.id}`, { replace: true })
    },
    onError: (error) => {
      setValidationErrors(mapValidationErrors(error))
      toast.error(error.message || t('common.error'))
      setIsSubmitting(false)
    },
  })

  const disableMutation = useMutation({
    mutationFn: () => softDeleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t('categories.detail.disableSuccess'))
      navigate('/admin/categories')
    },
    onError: (error) => {
      const msg = error.code === 'CONFLICT'
        ? (error.message || t('categories.detail.conflictHideError'))
        : (error.message || t('common.error'))
      toast.error(msg)
      setIsSubmitting(false)
    },
  })

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setValidationErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  function handleNameChange(value) {
    updateField('name', value)
    if (isCreate && !slugManuallyEdited) {
      updateField('slug', toSlug(value))
    }
  }

  function handleSlugChange(value) {
    setSlugManuallyEdited(true)
    updateField('slug', value)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canUpdate) return

    const schema = createCategorySchema(t)
    const result = schema.safeParse(form)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(toPayload(form))
  }

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title={t('categories.detail.loading')}
        description={t('categories.detail.loadingDesc')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('categories.detail.loadError')}
        description={state.error}
        actionLabel={t('categories.detail.backToList')}
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  if (!isCreate && !state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('categories.detail.notFound')}
        description={t('categories.detail.notFoundDesc')}
        actionLabel={t('categories.detail.backToList')}
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('categories.detail.eyebrow')}</p>
          <h1>{isCreate ? t('categories.detail.createTitle') : t('categories.detail.editTitle')}</h1>
          {breadcrumbPath && (
            <p className="cat-detail-breadcrumb">
              <span>{breadcrumbPath}</span>
              <span className="cat-detail-breadcrumb-sep"> / </span>
              <strong>{state.item?.name}</strong>
            </p>
          )}
          <p>{isCreate ? t('categories.detail.createDesc') : t('categories.detail.editDesc')}</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/categories')}
          >
            {t('categories.detail.backToList')}
          </button>
        </div>
      </header>

      {state.warning ? (
        <StatePanel tone="warning" title={t('readOnly.prefix')} description={state.warning} />
      ) : null}

      {!canUpdate ? (
        <StatePanel
          tone="warning"
          title={t('categories.detail.permissionDenied')}
          description={t('categories.detail.permissionDesc')}
        />
      ) : null}

      {!isCreate && (
        <StatePanel
          tone="info"
          title={t('categories.detail.menuNoticeTitle')}
          description={t('categories.detail.menuNoticeDesc')}
          actionLabel={t('categories.detail.menuNoticeAction')}
          onAction={() => navigate('/admin/menus')}
        />
      )}

      <form
        ref={formRef}
        className="entity-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
            handleSubmit(e)
          }
        }}
      >
        <section className="detail-section">
          <div className="detail-section-content form-grid">

            <label className="form-field">
              <span>{t('categories.detail.name')}</span>
              <input
                className="control-input"
                value={form.name}
                onChange={(event) => handleNameChange(event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.name ? (
                <small className="field-error">{validationErrors.name}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('categories.detail.slug')}</span>
              <input
                className="control-input"
                value={form.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                disabled={isReadOnly}
              />
              <small className="field-hint">{t('categories.detail.slugHint')}</small>
              {validationErrors.slug ? (
                <small className="field-error">{validationErrors.slug}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('categories.detail.parentId')}</span>
              <select
                className="control-select"
                value={form.parentId}
                onChange={(event) => updateField('parentId', event.target.value)}
                disabled={isReadOnly}
              >
                <option value="">{t('categories.detail.parentIdNone')}</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {validationErrors.parentId ? (
                <small className="field-error">{validationErrors.parentId}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('categories.detail.sortOrder')}</span>
              <input
                className="control-input"
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(event) => updateField('sortOrder', event.target.value)}
                disabled={isReadOnly}
                placeholder="0"
              />
              <small className="field-hint">{t('categories.detail.sortOrderHint')}</small>
              {validationErrors.sortOrder ? (
                <small className="field-error">{validationErrors.sortOrder}</small>
              ) : null}
            </label>

            <div className="form-field form-field-wide">
              <span>{t('categories.detail.imageUrl')}</span>
              <ImageUrlInput
                value={form.imageUrl}
                onChange={(url) => updateField('imageUrl', url)}
                alt={form.imageAlt}
                onAltChange={(alt) => updateField('imageAlt', alt)}
                disabled={isReadOnly}
                error={validationErrors.imageUrl}
              />
            </div>

            <div className="form-field form-field-wide">
              <span>{t('categories.detail.iconUrl')}</span>
              <ImageUrlInput
                value={form.iconUrl}
                onChange={(url) => updateField('iconUrl', url)}
                alt={form.iconAlt}
                onAltChange={(alt) => updateField('iconAlt', alt)}
                disabled={isReadOnly}
                error={validationErrors.iconUrl}
              />
            </div>

            <div className="form-field form-field-wide">
              <span>{t('categories.detail.description')}</span>
              <RichTextEditor
                value={form.description}
                onChange={(html) => updateField('description', html)}
                placeholder="Nhập mô tả danh mục..."
                disabled={isReadOnly}
                enableImagePicker
              />
            </div>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(event) => updateField('visible', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>{t('categories.detail.isVisible')}</span>
            </label>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.showOnHomepage}
                onChange={(event) => updateField('showOnHomepage', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>{t('categories.detail.showOnHomepage')}</span>
            </label>

          </div>
        </section>

        <section className="detail-section">
          <h2 className="detail-section-title">{t('categories.detail.seoSection')}</h2>
          <div className="detail-section-content form-grid">

            <label className="form-field">
              <span>{t('categories.detail.seoTitle')}</span>
              <input
                className="control-input"
                value={form.seoTitle}
                onChange={(event) => updateField('seoTitle', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.seoTitle ? (
                <small className="field-error">{validationErrors.seoTitle}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('categories.detail.seoCanonicalUrl')}</span>
              <input
                className="control-input"
                value={form.seoCanonicalUrl}
                onChange={(event) => updateField('seoCanonicalUrl', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.seoCanonicalUrl ? (
                <small className="field-error">{validationErrors.seoCanonicalUrl}</small>
              ) : null}
            </label>

            <label className="form-field form-field-wide">
              <span>{t('categories.detail.seoDescription')}</span>
              <textarea
                className="control-input"
                rows={3}
                value={form.seoDescription}
                onChange={(event) => updateField('seoDescription', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.seoDescription ? (
                <small className="field-error">{validationErrors.seoDescription}</small>
              ) : null}
            </label>

            <div className="form-field form-field-wide">
              <span>{t('categories.detail.seoOgImageUrl')}</span>
              <ImageUrlInput
                value={form.seoOgImageUrl}
                onChange={(url) => updateField('seoOgImageUrl', url)}
                alt={form.seoOgImageAlt}
                onAltChange={(alt) => updateField('seoOgImageAlt', alt)}
                disabled={isReadOnly}
                error={validationErrors.seoOgImageUrl}
              />
              {validationErrors.seoOgImageAlt ? (
                <small className="field-error">{validationErrors.seoOgImageAlt}</small>
              ) : null}
            </div>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.seoNoIndex}
                onChange={(event) => updateField('seoNoIndex', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>{t('categories.detail.seoNoIndex')}</span>
            </label>

          </div>
        </section>

        <div className="form-footer">
          <div className="form-status">
            {isDirty && (
              <span className="status-pill is-dirty">{t('common.dirty')}</span>
            )}
            {!isCreate && state.item?.updatedAt ? (
              <small>{t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}</small>
            ) : null}
          </div>
          <div className="screen-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isReadOnly || !isDirty}
            >
              {isSubmitting
                ? t('common.saving')
                : isCreate
                  ? t('categories.detail.createBtn')
                  : t('categories.detail.saveBtn')}
            </button>
          </div>
        </div>

        {!isCreate && canUpdate && (
          <div className="danger-zone">
            <div className="danger-zone-info">
              <strong>{t('categories.detail.disableBtn')}</strong>
              <p>{t('categories.detail.disableConfirm')}</p>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              disabled={isSubmitting}
              onClick={async () => {
                const confirmed = await showConfirm(
                  t('categories.detail.disableConfirm'),
                  t('categories.detail.disableConfirmTitle'),
                )
                if (!confirmed) return
                setIsSubmitting(true)
                disableMutation.mutate()
              }}
            >
              {isSubmitting ? t('categories.detail.disablingBtn') : t('categories.detail.disableBtn')}
            </button>
          </div>
        )}

      </form>
    </section>
  )
}
