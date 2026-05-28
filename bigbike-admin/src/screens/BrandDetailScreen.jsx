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
import { Tabs } from '../components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    visible: true,
    logoUrl: '',
    logoAlt: '',
    bannerUrl: '',
    bannerAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    translations: { en: { name: '', description: '', seoTitle: '', seoDescription: '' } },
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
    bannerUrl: item.bannerImage?.url || '',
    bannerAlt: item.bannerImage?.alt || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    translations: {
      en: {
        name: item.translations?.en?.name || '',
        description: item.translations?.en?.description || '',
        seoTitle: item.translations?.en?.seoTitle || '',
        seoDescription: item.translations?.en?.seoDescription || '',
      },
    },
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

  payload.banner = form.bannerUrl.trim()
    ? { url: form.bannerUrl.trim(), alt: form.bannerAlt.trim() || undefined }
    : { url: '' }

  if (
    form.seoTitle.trim() ||
    form.seoDescription.trim() ||
    form.seoCanonicalUrl.trim()
  ) {
    payload.seo = {
      title: form.seoTitle.trim() || undefined,
      description: form.seoDescription.trim() || undefined,
      canonicalUrl: form.seoCanonicalUrl.trim() || undefined,
    }
  }

  payload.translations = {
    en: {
      name: form.translations?.en?.name?.trim() || null,
      description: form.translations?.en?.description?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
    },
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
    warning: '',
    error: fetchError?.message ?? '',
  }

  const [contentLang, setContentLang] = useState('vi')
  const isEnLang = contentLang === 'en'

  function updateTranslation(field, value) {
    setForm((previous) => ({
      ...previous,
      translations: {
        ...previous.translations,
        en: { ...(previous.translations?.en || {}), [field]: value },
      },
    }))
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
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">
            <a onClick={(e) => { e.preventDefault(); navigate('/admin/brands') }} style={{ cursor: 'pointer' }}>
              ← {t('brands.detail.backToList')}
            </a>
          </p>
          <h1>{isCreate ? t('brands.detail.createTitle') : t('brands.detail.editTitle')}</h1>
          <p className="bb-muted">{isCreate ? t('brands.detail.createDesc') : t('brands.detail.editDesc')}</p>
        </div>
        <div className="bb-screen-actions">
          {!isCreate && canUpdate && (
            <button
              type="button"
              className="bb-btn bb-btn-secondary"
              style={{ color: 'var(--bb-danger)' }}
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
              {t('brands.detail.hideBtn')}
            </button>
          )}
          <button
            type="submit"
            form="brand-form"
            className="bb-btn bb-btn-primary"
            disabled={isReadOnly || !isDirty}
          >
            {isSubmitting
              ? t('common.saving')
              : isCreate ? t('brands.detail.createBtn') : t('brands.detail.saveBtn')}
          </button>
        </div>
      </div>

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
        id="brand-form"
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            if (!isReadOnly && isDirty) handleSubmit(e)
          }
        }}
      >
        {/* Thông tin cơ bản */}
        <div className="bb-card mb-4">
          <div className="bb-card-header">
            <h2>{t('brands.detail.sectionBasic')}</h2>
            <Tabs
              ariaLabel={t('brands.detail.contentLanguageAriaLabel', { defaultValue: 'Ngôn ngữ nội dung' })}
              value={contentLang}
              onChange={setContentLang}
              items={[{ key: 'vi', label: 'VI' }, { key: 'en', label: 'EN' }]}
            />
          </div>
          <div className="bb-card-body">
            <div className="grid-2">
              <label className="form-field">
                <span>{t('brands.detail.slug')}</span>
                <Input value={form.slug} onChange={(e) => updateField('slug', e.target.value)} disabled={isReadOnly}
                  style={{ fontFamily: 'var(--admin-font-mono)' }} />
                {validationErrors.slug && <span className="hint text-danger">{validationErrors.slug}</span>}
              </label>
              <label className="form-field">
                <span>
                  {t('brands.detail.name')}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </span>
                <Input
                  value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                  onChange={(e) => isEnLang ? updateTranslation('name', e.target.value) : updateField('name', e.target.value)}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.namePlaceholderEn', { defaultValue: 'English name (optional)' }) : undefined}
                />
                {!isEnLang && validationErrors.name && <span className="hint text-danger">{validationErrors.name}</span>}
              </label>
              <label
                className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit"
                style={{ gridColumn: '1 / -1' }}
              >
                <Checkbox checked={form.visible} onCheckedChange={(checked) => updateField('visible', checked)} disabled={isReadOnly} />
                <span>{t('brands.detail.isVisible')}</span>
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.description')}</span>
                <RichTextEditor
                  key={`description-${contentLang}`}
                  value={isEnLang ? (form.translations?.en?.description ?? '') : form.description}
                  onChange={(html) => isEnLang ? updateTranslation('description', html) : updateField('description', html)}
                  placeholder={t('brands.detail.descriptionPlaceholder', { defaultValue: 'Nhập mô tả thương hiệu...' })}
                  disabled={isReadOnly}
                  enableImagePicker
                />
                {!isEnLang && validationErrors.description && <span className="hint text-danger">{validationErrors.description}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Hình ảnh */}
        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('brands.detail.sectionMedia')}</h2></div>
          <div className="bb-card-body">
            <div className="grid-2">
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.logoUrl')}</span>
                <ImageUrlInput
                  value={form.logoUrl}
                  onChange={(url) => updateField('logoUrl', url)}
                  alt={form.logoAlt}
                  onAltChange={(v) => updateField('logoAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.logoUrl}
                />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.bannerUrl', { defaultValue: 'Ảnh banner thương hiệu' })}</span>
                <ImageUrlInput
                  value={form.bannerUrl}
                  onChange={(url) => updateField('bannerUrl', url)}
                  alt={form.bannerAlt}
                  onAltChange={(v) => updateField('bannerAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.bannerUrl}
                />
              </div>
            </div>
          </div>
          {!isCreate && state.item?.updatedAt && (
            <div className="px-4 py-2.5 border-t border-border text-xs bb-muted">
              {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
