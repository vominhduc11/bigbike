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

function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    parentId: '',
    sortOrder: '',
    visible: true,
    showOnHomepage: false,
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
  if (!item) return buildEmptyForm()
  return {
    slug: item.slug || '',
    name: item.name || '',
    description: item.description || '',
    parentId: item.parentId || '',
    sortOrder: Number.isInteger(item.sortOrder) ? String(item.sortOrder) : '',
    visible: item.isVisible !== false,
    showOnHomepage: Boolean(item.showOnHomepage),
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
  if (!normalized) return undefined
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) return Number.NaN
  return parsed
}


function toPayload(form) {
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    parentId: form.parentId.trim() || undefined,
    sortOrder: toIntegerOrUndefined(form.sortOrder),
    visible: Boolean(form.visible),
    showOnHomepage: Boolean(form.showOnHomepage),
  }

  payload.image = form.imageUrl.trim()
    ? { url: form.imageUrl.trim(), alt: form.imageAlt.trim() || undefined }
    : { url: '' }
  payload.icon = form.iconUrl.trim()
    ? { url: form.iconUrl.trim(), alt: form.iconAlt.trim() || undefined }
    : { url: '' }

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

export function CategoryDetailScreen({ categoryId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(buildEmptyForm()))
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => fetchCategoryDetail(categoryId),
    enabled: !isCreate,
  })

  const { data: categoriesResult } = useQuery({
    queryKey: ['categories', { page: 1, pageSize: 200, sort: 'sortOrder:asc' }],
    queryFn: () => fetchCategories({ page: 1, pageSize: 200, sort: 'sortOrder:asc' }),
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
    const item = fetchResult.item || null
    const nextForm = buildFormFromItem(item)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm)
    setInitialSnapshot(JSON.stringify(nextForm))
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
      toast.error(error.message || t('common.error'))
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
          {!isCreate && canUpdate && (
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
          )}
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

      <StatePanel
        tone="info"
        title={t('categories.detail.menuNoticeTitle')}
        description={t('categories.detail.menuNoticeDesc')}
        actionLabel={t('categories.detail.menuNoticeAction')}
        onAction={() => navigate('/admin/menus')}
      />

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
          <header className="detail-section-header">
            <h2>{t('categories.detail.sectionBasic')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field">
              <span>{t('categories.detail.slug')}</span>
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
              <span>{t('categories.detail.name')}</span>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.sortOrder}
                onChange={(event) => updateField('sortOrder', event.target.value.replace(/\D/g, ''))}
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
          </div>
        </section>

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('categories.detail.sectionMedia')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <div className="form-field form-field-wide">
              <span>{t('categories.detail.imageUrl')}</span>
              <ImageUrlInput
                value={form.imageUrl}
                onChange={(url) => updateField('imageUrl', url)}
                disabled={isReadOnly}
                error={validationErrors.imageUrl}
              />
            </div>

            <label className="form-field">
              <span>{t('categories.detail.imageAlt')}</span>
              <input
                className="control-input"
                value={form.imageAlt}
                onChange={(event) => updateField('imageAlt', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <div className="form-field form-field-wide">
              <span>{t('categories.detail.iconUrl')}</span>
              <ImageUrlInput
                value={form.iconUrl}
                onChange={(url) => updateField('iconUrl', url)}
                disabled={isReadOnly}
                error={validationErrors.iconUrl}
              />
            </div>

            <label className="form-field">
              <span>{t('categories.detail.iconAlt')}</span>
              <input
                className="control-input"
                value={form.iconAlt}
                onChange={(event) => updateField('iconAlt', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

          </div>
        </section>

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('categories.detail.sectionSeo')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field form-field-wide">
              <span>{t('categories.detail.seoTitle')}</span>
              <input
                className="control-input"
                value={form.seoTitle}
                onChange={(event) => updateField('seoTitle', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>{t('categories.detail.seoDescription')}</span>
              <textarea
                className="control-input control-textarea"
                value={form.seoDescription}
                onChange={(event) => updateField('seoDescription', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
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
              <span>{t('categories.detail.seoOgImageUrl')}</span>
              <input
                className="control-input"
                value={form.seoOgImageUrl}
                onChange={(event) => updateField('seoOgImageUrl', event.target.value)}
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
              <span>{t('categories.detail.seoNoIndex')}</span>
            </label>
          </div>
        </section>

        <div className="form-footer">
          <div className="form-status">
            <span className={`status-pill ${isDirty ? 'is-dirty' : 'is-clean'}`}>
              {isDirty ? t('common.dirty') : t('common.clean')}
            </span>
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

      </form>
    </section>
  )
}
