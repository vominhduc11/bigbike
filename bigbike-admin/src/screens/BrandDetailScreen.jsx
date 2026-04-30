import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createBrand,
  deleteBrand,
  fetchBrandDetail,
  mapValidationErrors,
  updateBrand,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { createBrandSchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { RichTextEditor } from '../components/RichTextEditor'

function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    visible: true,
    logoUrl: '',
    logoAlt: '',
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
    visible: item.isVisible !== false,
    logoUrl: item.logo?.url || '',
    logoAlt: item.logo?.alt || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
  }
}


function toPayload(form) {
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    visible: Boolean(form.visible),
  }

  payload.logo = form.logoUrl.trim()
    ? { url: form.logoUrl.trim(), alt: form.logoAlt.trim() || undefined }
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

export function BrandDetailScreen({ brandId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(buildEmptyForm()))
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: () => fetchBrandDetail(brandId),
    enabled: !isCreate,
  })

  useEffect(() => {
    if (!fetchResult) return
    const nextForm = buildFormFromItem(fetchResult.item)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm)
    setInitialSnapshot(JSON.stringify(nextForm))
  }, [fetchResult])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
    warning: fetchResult?.mode === 'mock' ? (fetchResult?.warning ?? '') : '',
    error: fetchError?.message ?? '',
  }

  const formRef = useRef(null)
  const isDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot])
  const isReadOnly = !canUpdate || isSubmitting

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate ? createBrand(payload) : updateBrand(brandId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      if (!isCreate) queryClient.setQueryData(['brand', brandId], response)
      toast.success(isCreate ? t('brands.detail.successCreate') : t('brands.detail.successUpdate'))
      setIsSubmitting(false)
      if (isCreate && savedItem?.id) navigate(`/admin/brands/${savedItem.id}`, { replace: true })
    },
    onError: (error) => {
      setValidationErrors(mapValidationErrors(error))
      toast.error(error.message || t('brands.detail.errSaveFailed'))
      setIsSubmitting(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBrand(brandId),
    onSuccess: () => {
      toast.success(t('brands.detail.successDelete'))
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      navigate('/admin/brands')
    },
    onError: (error) => {
      toast.error(error.message || t('brands.detail.errDeleteFailed'))
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

    const schema = createBrandSchema(t)
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
        title={t('brands.detail.loading')}
        description={t('brands.detail.loadingDesc')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('brands.detail.loadError')}
        description={state.error}
        actionLabel={t('brands.detail.backToList')}
        onAction={() => navigate('/admin/brands')}
      />
    )
  }

  if (!isCreate && !state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('brands.detail.notFound')}
        description={t('brands.detail.notFoundDesc')}
        actionLabel={t('brands.detail.backToList')}
        onAction={() => navigate('/admin/brands')}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('brands.detail.eyebrow')}</p>
          <h1>{isCreate ? t('brands.detail.createTitle') : t('brands.detail.editTitle')}</h1>
          <p>{isCreate ? t('brands.detail.createDesc') : t('brands.detail.editDesc')}</p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/brands')}
          >
            {t('brands.detail.backToList')}
          </button>
          {!isCreate && canUpdate && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={isSubmitting}
              onClick={async () => {
                const confirmed = await showConfirm(
                  t('brands.detail.hideConfirm').replace('{slug}', form.slug || state.item?.slug || '…'),
                  t('brands.detail.hideConfirmTitle'),
                )
                if (!confirmed) return
                setIsSubmitting(true)
                deleteMutation.mutate()
              }}
            >
              {isSubmitting ? t('brands.detail.hidingBtn') : t('brands.detail.hideBtn')}
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
          title={t('brands.detail.permissionDenied')}
          description={t('brands.detail.permissionDesc')}
        />
      ) : null}

      <form
        className="entity-form"
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            if (!isReadOnly && isDirty) handleSubmit(e)
          }
        }}
      >
        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('brands.detail.sectionBasic')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field">
              <span>{t('brands.detail.slug')}</span>
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
              <span>{t('brands.detail.name')}</span>
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

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(event) => updateField('visible', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>{t('brands.detail.isVisible')}</span>
            </label>

            <div className="form-field form-field-wide">
              <span>{t('brands.detail.description')}</span>
              <RichTextEditor
                value={form.description}
                onChange={(html) => updateField('description', html)}
                placeholder="Nhập mô tả thương hiệu..."
                disabled={isReadOnly}
                enableImagePicker
              />
              {validationErrors.description ? (
                <small className="field-error">{validationErrors.description}</small>
              ) : null}
            </div>
          </div>
        </section>

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('brands.detail.sectionMedia')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <div className="form-field form-field-wide">
              <span>{t('brands.detail.logoUrl')}</span>
              <ImageUrlInput
                value={form.logoUrl}
                onChange={(url) => updateField('logoUrl', url)}
                disabled={isReadOnly}
                error={validationErrors.logoUrl}
              />
            </div>

            <label className="form-field">
              <span>{t('brands.detail.logoAlt')}</span>
              <input
                className="control-input"
                value={form.logoAlt}
                onChange={(event) => updateField('logoAlt', event.target.value)}
                disabled={isReadOnly}
              />
            </label>
          </div>
        </section>

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('brands.detail.sectionSeo')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field form-field-wide">
              <span>{t('brands.detail.seoTitle')}</span>
              <input
                className="control-input"
                value={form.seoTitle}
                onChange={(event) => updateField('seoTitle', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>{t('brands.detail.seoDescription')}</span>
              <textarea
                className="control-input control-textarea"
                value={form.seoDescription}
                onChange={(event) => updateField('seoDescription', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>{t('brands.detail.seoCanonicalUrl')}</span>
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
              <span>{t('brands.detail.seoOgImageUrl')}</span>
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
              <span>{t('brands.detail.seoNoIndex')}</span>
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
                  ? t('brands.detail.createBtn')
                  : t('brands.detail.saveBtn')}
            </button>
          </div>
        </div>

      </form>
    </section>
  )
}
