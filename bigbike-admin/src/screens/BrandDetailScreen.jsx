import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import {
  createBrand,
  deleteBrand,
  fetchBrandDetail,
  mapValidationErrors,
  updateBrand,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { recordRecentItem } from '../lib/useRecentItems'
import { formatDateTime } from '../lib/formatters'
import { useContentLang } from '../lib/contentLang'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { Loader2, Save } from 'lucide-react'

import { createBrandSchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { FormField } from '../components/layout/FormField'
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

// ── Autosave utilities (F9) ──────────────────────────────────────────────────
// Mirrors product-detail/constants.js + content-detail/constants.js — same
// localStorage draft mechanism, own key namespace for brands.
const AUTOSAVE_TTL_MS = 60 * 60 * 1000

function getAutosaveKey(brandId, isCreate) {
  return `brand-autosave:${isCreate ? 'new' : brandId}`
}

function saveFormToStorage(key, form) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, ts: Date.now() }))
  } catch { /* quota */ }
}

function loadFormFromStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || Date.now() - parsed.ts > AUTOSAVE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch { return null }
}

function clearFormFromStorage(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
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

  // F9: autosave / khôi phục bản nháp — cùng cơ chế localStorage với Sản phẩm/Nội dung.
  const autosaveKey = getAutosaveKey(brandId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

  const { data: fetchResult, isLoading, isError, error: fetchError, refetch } = useQuery({
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
    // F9: bản nháp autosave mới hơn lần lưu gần nhất trên server → gợi ý khôi phục.
    if (fetchResult.item?.updatedAt) {
      const draft = loadFormFromStorage(autosaveKey)
      if (draft?.form && draft.ts > new Date(fetchResult.item.updatedAt).getTime()) {
        setDraftRecovery(draft)
      }
    }
  }, [autosaveKey, fetchResult])

  // F11: Nhân bản thương hiệu — nạp bản nháp BrandListScreen ghi vào sessionStorage
  // khi bấm "Sao chép", rồi điều hướng sang màn tạo mới (cùng cơ chế duplicate của
  // Sản phẩm/Danh mục). Chỉ giữ lại slug/đường dẫn EN trống — admin phải đặt giá trị mới.
  useEffect(() => {
    if (!isCreate) return
    try {
      const raw = sessionStorage.getItem('brand-duplicate-payload')
      if (raw) {
        sessionStorage.removeItem('brand-duplicate-payload')
        const item = JSON.parse(raw)
        const base = buildFormFromItem(item)
        const duplicated = {
          ...base,
          slug: '',
          translations: { ...base.translations, en: { ...(base.translations?.en || {}), slug: '' } },
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(duplicated)
        setEnSlugManuallyEdited(false)
        toast.success(t('brands.detail.duplicateSuccess', { name: item.name || item.slug || '' }))
        return
      }
    } catch { /* ignore parse errors */ }

    // F9: chưa có bản sao chép — kiểm tra bản nháp autosave dở dang từ phiên trước.
    const draft = loadFormFromStorage(autosaveKey)
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate, t])

  // O9: ghi lại thương hiệu vừa xem để hiện trong widget "Vừa xem gần đây" ở danh sách.
  useEffect(() => {
    if (!isCreate && fetchResult?.item?.id) {
      recordRecentItem('recent:brands', {
        id: fetchResult.item.id,
        label: fetchResult.item.name || fetchResult.item.slug || fetchResult.item.id,
      })
    }
  }, [isCreate, fetchResult?.item?.id, fetchResult?.item?.name, fetchResult?.item?.slug])

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

  // F6: cảnh báo rời trang khi chưa lưu — chặn cả điều hướng nội bộ (nút quay lại,
  // sidebar) qua navigationGuard lẫn reload/đóng tab qua beforeunload.
  useUnsavedChanges(isDirty)

  // F9: autosave — lưu bản nháp vào localStorage sau 10s không thao tác khi form dirty.
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, form), 10_000)
    return () => clearTimeout(timer)
  }, [form, isDirty, autosaveKey])

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate ? createBrand(payload) : updateBrand(brandId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
      clearFormFromStorage(autosaveKey)
      setDraftRecovery(null)
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      if (!isCreate) queryClient.setQueryData(['brand', brandId], response)
      toast.success(isCreate ? t('brands.detail.successCreate') : t('brands.detail.successUpdate'))
      setIsSubmitting(false)
      if (isCreate && savedItem?.id) {
        clearNavGuard() // form vừa lưu khớp baseline, tránh hỏi nhầm khi điều hướng sang trang chi tiết
        navigate(`/admin/brands/${savedItem.id}`, { replace: true })
      }
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
      clearFormFromStorage(autosaveKey)
      clearNavGuard() // đã ẩn xong, không hỏi xác nhận khi rời trang
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

  // F3: validate sớm một field khi rời ô (onBlur). Chạy toàn schema rồi chỉ lấy
  // lỗi của field vừa rời (set nếu có, xoá nếu đã hợp lệ) để báo trước khi submit.
  function handleFieldBlur(field) {
    const result = createBrandSchema(t).safeParse(form)
    const allErrors = zodErrors(result)
    setValidationErrors((previous) => {
      const next = { ...previous }
      if (allErrors[field]) next[field] = allErrors[field]
      else delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
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
    // N5: khung xương thay cho StatePanel căn giữa — tránh giật bố cục (CLS) khi dữ liệu
    // về, vì trang thật có header + 3 bb-card (thông tin cơ bản, hình ảnh, SEO) chứ không
    // phải một panel nhỏ. Cùng kiểu dựng animate-pulse như ProductDetailScreen.
    return (
      <div className="animate-pulse" aria-hidden="true">
        <div className="bb-screen-header">
          <div className="bb-screen-title flex flex-col gap-2">
            <div className="h-3 w-28 rounded-xs bg-surface-muted" />
            <div className="h-7 w-56 max-w-full rounded-xs bg-surface-muted" />
            <div className="h-3 w-64 max-w-full rounded-xs bg-surface-muted" />
          </div>
          <div className="bb-screen-actions">
            <div className="h-9 w-28 rounded-sm bg-surface-muted" />
          </div>
        </div>

        <div className="bb-card mb-4">
          <div className="h-10 border-b border-border bg-surface-muted/60" />
          <div className="bb-card-body flex flex-col gap-3">
            <div className="h-4 w-1/3 rounded-xs bg-surface-muted" />
            <div className="h-9 w-full rounded-sm bg-surface-muted" />
            <div className="h-9 w-2/3 rounded-sm bg-surface-muted" />
            <div className="h-24 w-full rounded-sm bg-surface-muted" />
          </div>
        </div>
        <div className="bb-card mb-4">
          <div className="h-10 border-b border-border bg-surface-muted/60" />
          <div className="bb-card-body flex flex-col gap-3">
            <div className="h-4 w-1/4 rounded-xs bg-surface-muted" />
            <div className="h-9 w-full rounded-sm bg-surface-muted" />
            <div className="h-9 w-full rounded-sm bg-surface-muted" />
          </div>
        </div>
        <div className="bb-card">
          <div className="h-10 border-b border-border bg-surface-muted/60" />
          <div className="bb-card-body flex flex-col gap-3">
            <div className="h-20 w-full rounded-sm bg-surface-muted" />
            <div className="h-9 w-full rounded-sm bg-surface-muted" />
            <div className="h-16 w-full rounded-sm bg-surface-muted" />
          </div>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('brands.detail.loadError')}
        description={state.error}
        actionLabel={t('common.retry', { defaultValue: 'Thử lại' })}
        onAction={() => refetch()}
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

  // F13: tiến độ điền các mục bắt buộc (đường dẫn URL, tên) — chỉ có ý nghĩa ở bản
  // tiếng Việt, vì bản tiếng Anh không có mục nào bắt buộc (xem required={!isEnLang} ở dưới).
  const requiredFieldsTotal = 2
  const requiredFieldsFilled = [form.slug, form.name].filter((v) => Boolean(v?.trim())).length

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
          {!isEnLang && (
            <span className="bb-muted text-xs">
              {t('brands.detail.formProgress', { filled: requiredFieldsFilled, total: requiredFieldsTotal })}
            </span>
          )}
          <button
            type="submit"
            form="brand-form"
            className="bb-btn bb-btn-primary"
            disabled={isReadOnly || !isDirty}
            aria-busy={isSubmitting || undefined}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {isSubmitting
              ? t('common.saving')
              : isCreate ? t('brands.detail.createBtn') : t('brands.detail.saveBtn')}
          </button>
        </div>
      </div>

      {draftRecovery && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 mb-4 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-xs">
          <Save size={14} className="shrink-0" />
          <span className="flex-1 truncate">
            <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
            {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
          </span>
          <button
            type="button"
            className="text-xs font-semibold underline hover:no-underline"
            onClick={() => {
              setForm(draftRecovery.form)
              setDraftRecovery(null)
              setEnSlugManuallyEdited(Boolean(draftRecovery.form?.translations?.en?.slug))
            }}
          >
            {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
          </button>
          <button
            type="button"
            className="text-xs underline hover:no-underline"
            onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
          >
            {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
          </button>
        </div>
      )}

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
            {!isEnLang ? (
              <p className="text-xs text-muted-foreground mb-3">
                <span className="text-danger" aria-hidden="true">*</span>{' '}
                {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
              </p>
            ) : null}
            <div className="bb-grid-2">
              <FormField
                label={<>
                  {t('brands.detail.slug').replace(/\s*\*\s*$/, '')}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 8 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </>}
                required={!isEnLang}
                helper={isEnLang ? t('brands.detail.slugHintEn', { defaultValue: 'Để trống sẽ dùng đường dẫn tiếng Việt cho bản tiếng Anh.' }) : undefined}
                error={isEnLang ? validationErrors['translations.en.slug'] : validationErrors.slug}
              >
                <Input
                  value={isEnLang ? (form.translations?.en?.slug ?? '') : form.slug}
                  onChange={(e) => isEnLang ? handleEnSlugChange(e.target.value) : updateField('slug', e.target.value)}
                  onBlur={() => handleFieldBlur(isEnLang ? 'translations.en.slug' : 'slug')}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.slugPlaceholderEn', { defaultValue: 'english-url-slug' }) : undefined}
                  style={{ fontFamily: 'var(--admin-font-mono)' }} />
              </FormField>
              <FormField
                label={t('brands.detail.name').replace(/\s*\*\s*$/, '')}
                required
                error={isEnLang ? validationErrors['translations.en.name'] : validationErrors.name}
              >
                <Input
                  value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                  onChange={(e) => isEnLang ? handleEnNameChange(e.target.value) : updateField('name', e.target.value)}
                  onBlur={() => handleFieldBlur(isEnLang ? 'translations.en.name' : 'name')}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.namePlaceholderEn', { defaultValue: 'English name' }) : undefined}
                />
              </FormField>
              <label
                className="flex items-center gap-2 p-2 border border-border text-sm cursor-pointer hover:bg-muted w-fit"
                style={{ gridColumn: '1 / -1' }}
              >
                <Checkbox checked={form.visible} onCheckedChange={(checked) => updateField('visible', checked)} disabled={isReadOnly} />
                <span>{t('brands.detail.isVisible')}</span>
              </label>
              <div style={{ gridColumn: '1 / -1' }}>
                <FormField
                  label={t('brands.detail.description')}
                  error={!isEnLang ? validationErrors.description : undefined}
                >
                  <RichTextEditor
                    key={`description-${contentLang}`}
                    value={isEnLang ? (form.translations?.en?.description ?? '') : form.description}
                    onChange={(html) => isEnLang ? updateTranslation('description', html) : updateField('description', html)}
                    placeholder={t('brands.detail.descriptionPlaceholder', { defaultValue: 'Nhập mô tả thương hiệu...' })}
                    disabled={isReadOnly}
                    enableImagePicker
                  />
                </FormField>
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
                    {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 8 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
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
                    {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 8 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
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
              <div style={{ gridColumn: '1 / -1' }}>
                <FormField
                  label={t('brands.detail.seoCanonicalUrl', { defaultValue: 'Địa chỉ chuẩn (canonical URL)' })}
                  error={validationErrors.seoCanonicalUrl}
                >
                  <Input
                    value={form.seoCanonicalUrl}
                    onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                    onBlur={() => handleFieldBlur('seoCanonicalUrl')}
                    disabled={isReadOnly}
                    placeholder="https://bigbike.vn/..."
                  />
                </FormField>
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
