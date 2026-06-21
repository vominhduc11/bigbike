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
import { useContentLang } from '../lib/contentLang'
import { createBrandSchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { RichTextEditor } from '../components/RichTextEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/brands`

// Slugify cho gợi ý đường dẫn tiếng Anh (bỏ dấu, kebab-case). Khớp toSlug của CategoryDetailScreen.
function toSlug(text) {
  return String(text || '')
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
    visible: true,
    logoUrl: '',
    logoAlt: '',
    bannerUrl: '',
    bannerAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    translations: { en: { slug: '', name: '', description: '', seoTitle: '', seoDescription: '' } },
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
    seoOgImageUrl: item.seo?.ogImage?.rawUrl || item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    translations: {
      en: {
        // slug tiếng Anh nằm ở field top-level `slugEn` của response, không trong translations.en
        slug: item.slugEn || '',
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
    form.seoCanonicalUrl.trim() ||
    form.seoOgImageUrl.trim()
  ) {
    payload.seo = {
      title: form.seoTitle.trim() || undefined,
      description: form.seoDescription.trim() || undefined,
      canonicalUrl: form.seoCanonicalUrl.trim() || undefined,
      ogImage: form.seoOgImageUrl.trim()
        ? { url: form.seoOgImageUrl.trim(), alt: form.seoOgImageAlt.trim() || undefined }
        : null,
    }
  }

  payload.translations = {
    en: {
      slug: form.translations?.en?.slug?.trim() || null,
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
  const contentLang = useContentLang()
  const isEnLang = contentLang === 'en'
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(buildEmptyForm()))
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enSlugManuallyEdited, setEnSlugManuallyEdited] = useState(false)

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
    setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
  }, [fetchResult])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
    warning: '',
    error: fetchError?.message ?? '',
  }

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
      setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
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

  // Chế độ tiếng Anh: gõ tên EN tự gợi ý slug EN (khi chưa sửa tay); xoá để sửa tự do.
  function handleEnNameChange(value) {
    setForm((previous) => {
      const en = { ...(previous.translations?.en || {}), name: value }
      if (!enSlugManuallyEdited) en.slug = toSlug(value)
      return { ...previous, translations: { ...previous.translations, en } }
    })
  }

  function handleEnSlugChange(value) {
    setEnSlugManuallyEdited(true)
    updateTranslation('slug', value)
    setValidationErrors((previous) => {
      if (!previous['translations.en.slug']) return previous
      const next = { ...previous }
      delete next['translations.en.slug']
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
            <a
              href="/admin/brands"
              onClick={(e) => { e.preventDefault(); navigate('/admin/brands') }}
            >
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
                  { variant: 'danger', confirmLabel: t('brands.detail.hideBtn') },
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
          </div>
          <div className="bb-card-body">
            <div className="bb-grid-2">
              <label className="form-field" data-field={isEnLang ? 'translations.en.slug' : 'slug'}>
                <span>
                  {t('brands.detail.slug')}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </span>
                <Input
                  value={isEnLang ? (form.translations?.en?.slug ?? '') : form.slug}
                  onChange={(e) => isEnLang ? handleEnSlugChange(e.target.value) : updateField('slug', e.target.value)}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.slugPlaceholderEn', { defaultValue: 'english-url-slug' }) : undefined}
                  style={{ fontFamily: 'var(--admin-font-mono)' }} />
                {isEnLang
                  ? <span className="hint">{t('brands.detail.slugHintEn', { defaultValue: 'Để trống sẽ dùng đường dẫn tiếng Việt cho bản tiếng Anh.' })}</span>
                  : null}
                {isEnLang
                  ? validationErrors['translations.en.slug'] && <span className="hint text-danger">{validationErrors['translations.en.slug']}</span>
                  : validationErrors.slug && <span className="hint text-danger">{validationErrors.slug}</span>}
              </label>
              <label className="form-field">
                <span>
                  {t('brands.detail.name')}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </span>
                <Input
                  value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                  onChange={(e) => isEnLang ? handleEnNameChange(e.target.value) : updateField('name', e.target.value)}
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
            <div className="bb-grid-2">
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.logoUrl')}</span>
                <ImageUrlInput
                  value={form.logoUrl}
                  onChange={(url) => updateField('logoUrl', url)}
                  alt={form.logoAlt}
                  onAltChange={(v) => updateField('logoAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.logoUrl}
                  recommend={IMAGE_RECO.logo}
                />
                <span className="hint">{t('brands.detail.logoUrlHint')}</span>
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.bannerUrl')}</span>
                <ImageUrlInput
                  value={form.bannerUrl}
                  onChange={(url) => updateField('bannerUrl', url)}
                  alt={form.bannerAlt}
                  onAltChange={(v) => updateField('bannerAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.bannerUrl}
                  recommend={IMAGE_RECO.bannerWide}
                />
                <span className="hint">{t('brands.detail.bannerUrlHint')}</span>
              </div>
            </div>
          </div>
          {!isCreate && state.item?.updatedAt && (
            <div className="px-4 py-2.5 border-t border-border text-xs bb-muted">
              {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
            </div>
          )}
        </div>

        {/* SEO — hiển thị trên Google & mạng xã hội */}
        {(() => {
          const seoTitleVal = isEnLang ? (form.translations?.en?.seoTitle ?? '') : form.seoTitle
          const seoDescVal = isEnLang ? (form.translations?.en?.seoDescription ?? '') : form.seoDescription
          const nameVal = isEnLang ? (form.translations?.en?.name ?? '') : form.name
          const previewSlug = (isEnLang ? (form.translations?.en?.slug || form.slug) : form.slug) || 'duong-dan-thuong-hieu'
          const previewUrl = form.seoCanonicalUrl.trim() || `${STOREFRONT_BASE}/${previewSlug}`
          return (
        <div className="bb-card">
          <div className="bb-card-header">
            <div>
              <h2>{t('brands.detail.sectionSeo', { defaultValue: 'Hiển thị trên Google & mạng xã hội' })}</h2>
              <p className="sub">{t('brands.detail.sectionSeoDesc', { defaultValue: 'Tinh chỉnh tiêu đề, mô tả và ảnh khi thương hiệu được tìm kiếm hoặc chia sẻ.' })}</p>
            </div>
          </div>
          <div className="bb-card-body">
            {/* Xem trước trên Google */}
            <div className="mb-4 p-3 border border-border bg-white">
              <div className="text-xs text-muted-foreground mb-1">{t('brands.detail.seoPreviewLabel', { defaultValue: 'Xem thử trên Google' })}</div>
              <div className="text-xs text-[#5f6368] break-all mb-1">{previewUrl}</div>
              <div className="text-lg leading-snug text-[#1a0dab] break-words mb-1">
                {(seoTitleVal || nameVal || t('brands.detail.seoPreviewFallbackTitle', { defaultValue: 'Tiêu đề thương hiệu' })).slice(0, 60)}
              </div>
              <div className="text-sm leading-relaxed text-[#4d5156] break-words">
                {seoDescVal || t('brands.detail.seoPreviewFallbackDesc', { defaultValue: 'Mô tả ngắn về thương hiệu sẽ hiển thị ở đây.' })}
              </div>
            </div>

            <div className="bb-grid-2">
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span className="flex items-center justify-between">
                  <span>
                    {t('brands.detail.seoTitle', { defaultValue: 'Tiêu đề khi xuất hiện trên Google' })}
                    {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                  </span>
                  <span className={`hint ${seoTitleVal.length > 60 ? 'text-danger' : ''}`}>{seoTitleVal.length} / 60</span>
                </span>
                <Input
                  value={seoTitleVal}
                  onChange={(e) => isEnLang ? updateTranslation('seoTitle', e.target.value) : updateField('seoTitle', e.target.value)}
                  disabled={isReadOnly}
                  maxLength={255}
                  placeholder={t('brands.detail.seoTitlePlaceholder', { defaultValue: 'Để trống sẽ tự dùng tên thương hiệu' })}
                />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span className="flex items-center justify-between">
                  <span>
                    {t('brands.detail.seoDescription', { defaultValue: 'Mô tả khi xuất hiện trên Google' })}
                    {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                  </span>
                  <span className={`hint ${seoDescVal.length > 160 ? 'text-danger' : ''}`}>{seoDescVal.length} / 160</span>
                </span>
                <Textarea
                  rows={3}
                  value={seoDescVal}
                  onChange={(e) => isEnLang ? updateTranslation('seoDescription', e.target.value) : updateField('seoDescription', e.target.value)}
                  disabled={isReadOnly}
                  placeholder={t('brands.detail.seoDescriptionPlaceholder', { defaultValue: 'Mô tả ngắn hiển thị dưới tiêu đề trên Google' })}
                />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.seoCanonicalUrl', { defaultValue: 'Địa chỉ chuẩn (canonical URL)' })}</span>
                <Input
                  value={form.seoCanonicalUrl}
                  onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                  disabled={isReadOnly}
                  placeholder="https://bigbike.vn/..."
                />
                {validationErrors.seoCanonicalUrl && <span className="hint text-danger">{validationErrors.seoCanonicalUrl}</span>}
              </div>
              {/* Ảnh chia sẻ mạng xã hội (OG image) — dùng chung cho cả hai ngôn ngữ */}
              <div className="form-field" data-field="seoOgImageUrl" style={{ gridColumn: '1 / -1' }}>
                <span>{t('brands.detail.seoOgImageUrl', { defaultValue: 'Ảnh hiển thị khi chia sẻ trên mạng xã hội' })}</span>
                <ImageUrlInput
                  value={form.seoOgImageUrl}
                  onChange={(url) => updateField('seoOgImageUrl', url)}
                  alt={form.seoOgImageAlt}
                  onAltChange={(v) => updateField('seoOgImageAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.seoOgImageUrl}
                  recommend={IMAGE_RECO.cover}
                />
                <span className="hint">{t('brands.detail.seoOgImageUrlHint', { defaultValue: 'Ảnh chia sẻ lên Facebook/Zalo, kích thước 1200×630px.' })}</span>
              </div>
            </div>
          </div>
        </div>
          )
        })()}
      </form>
    </div>
  )
}
