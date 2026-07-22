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
import { formatDateTime, formatText } from '../lib/formatters'
import { toSlug } from '../lib/slug'
import { useContentLang } from '../lib/contentLang'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'

import { createBrandSchema, zodErrors } from '../lib/schemas'
import { getBrandRequiredProgress, toBrandPayload } from './brandPayload'
import { StatePanel } from '../components/StatePanel'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatusBadge } from '../components/StatusBadge'
import { FormField } from '../components/layout/FormField'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { Screen, StickyActionBar } from '../components/layout'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { SeoCard } from '../components/SeoCard'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { RichTextEditor } from '../components/RichTextEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/brands`
const SYSTEM_BRAND_SLUG = 'uncategorized-brand'


function buildEmptyForm() {
  return {
    slug: '',
    name: '',
    description: '',
    showOnHomepage: true,
    logoUrl: '',
    logoAlt: '',
    bannerUrl: '',
    bannerAlt: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    translations: { en: { description: '', seoTitle: '', seoDescription: '' } },
  }
}

function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()
  return {
    slug: item.slug || '',
    name: item.name || '',
    description: item.description || '',
    showOnHomepage: item.showOnHomepage !== false,
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
        description: item.translations?.en?.description || '',
        seoTitle: item.translations?.en?.seoTitle || '',
        seoDescription: item.translations?.en?.seoDescription || '',
      },
    },
  }
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
  // Khi TẠO MỚI, gõ tên tự gợi ý đường dẫn (giống Danh mục) cho tới khi admin tự sửa
  // đường dẫn. Chế độ SỬA không đụng slug hiện có (tránh đổi URL đã lập chỉ mục).
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  // Gom mô tả + hình ảnh (tùy chọn) vào nhóm thu gọn, đóng sẵn để chống ngợp form;
  // tự bung khi sửa thương hiệu đã có sẵn nội dung/ảnh hoặc khi có lỗi bên trong.
  const [optionalOpen, setOptionalOpen] = useState(false)

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
    // Thương hiệu đã có mô tả/logo/banner → mở sẵn nhóm tùy chọn để admin thấy ngay.
    if (nextForm.description || nextForm.logoUrl || nextForm.bannerUrl) setOptionalOpen(true)
    // F9: bản nháp autosave mới hơn lần lưu gần nhất trên server → gợi ý khôi phục.
    if (fetchResult.item?.updatedAt) {
      const draft = loadFormFromStorage(autosaveKey)
      if (draft?.form && draft.ts > new Date(fetchResult.item.updatedAt).getTime()) {
        setDraftRecovery(draft)
      }
    }
  }, [autosaveKey, fetchResult])

  useEffect(() => {
    if (!isCreate) return
    const draft = loadFormFromStorage(autosaveKey)
    if (!draft?.form) return undefined
    const timer = setTimeout(() => setDraftRecovery(draft), 0)
    return () => clearTimeout(timer)
  }, [autosaveKey, isCreate])

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
  const isSystemBrand = state.item?.slug === SYSTEM_BRAND_SLUG
  const isReadOnly = !canUpdate || isSubmitting || isSystemBrand

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

  // Brand name/slug are shared across VI/EN; typing the name suggests the shared slug on create.
  function handleSharedNameChange(value) {
    setForm((previous) => {
      const next = { ...previous, name: value }
      if (isCreate && !slugManuallyEdited) next.slug = toSlug(value)
      return next
    })
    setValidationErrors((previous) => {
      if (!previous.name && !previous.slug) return previous
      const next = { ...previous }
      delete next.name
      delete next.slug
      return next
    })
  }

  function handleSlugChange(value) {
    setSlugManuallyEdited(true)
    updateField('slug', value)
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
    if (isReadOnly) return

    const schema = createBrandSchema(t)
    const result = schema.safeParse(form)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      // Đưa lỗi đang bị ẩn ra chỗ nhìn thấy: bung nhóm tùy chọn / SEO nếu lỗi nằm trong đó.
      if (clientErrors.description || clientErrors.logoUrl) setOptionalOpen(true)
      if (clientErrors.seoTitle || clientErrors.seoDescription || clientErrors.seoCanonicalUrl || clientErrors.seoOgImageUrl) setSeoOpen(true)
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})

    saveMutation.mutate(toBrandPayload(form))
  }


  if (state.status === 'loading') {
    // N5: khung xương thay cho StatePanel căn giữa — tránh giật bố cục (CLS) khi dữ liệu
    // về, vì trang thật có header + 3 bb-card (thông tin cơ bản, hình ảnh, SEO) chứ không
    // phải một panel nhỏ. Cùng kiểu dựng animate-pulse như ProductDetailScreen.
    return (
      <Screen>
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
      </Screen>
    )
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <StatePanel
          tone="danger"
          title={t('brands.detail.loadError')}
          description={state.error}
          actionLabel={t('common.retry', { defaultValue: 'Thử lại' })}
          onAction={() => refetch()}
        />
      </Screen>
    )
  }

  if (!isCreate && !state.item) {
    return (
      <Screen>
        <StatePanel
          tone="neutral"
          title={t('brands.detail.notFound')}
          description={t('brands.detail.notFoundDesc')}
          actionLabel={t('brands.detail.backToList')}
          onAction={() => navigate('/admin/brands')}
        />
      </Screen>
    )
  }

  const requiredProgress = getBrandRequiredProgress(form)

  // Có dữ liệu SEO nào đang nhập không — dùng để hiện nút "Xóa thông tin SEO".
  const hasSeoData = Boolean(
    form.seoTitle?.trim() || form.seoDescription?.trim() || form.seoCanonicalUrl?.trim() ||
    form.seoOgImageUrl?.trim() || form.seoOgImageAlt?.trim() ||
    form.translations?.en?.seoTitle?.trim() || form.translations?.en?.seoDescription?.trim()
  )

  // Xóa toàn bộ SEO là hành động dễ nhầm (mất công đã nhập) — hỏi xác nhận trước khi dọn.
  async function handleClearSeo() {
    const ok = await showConfirm(
      t('brands.detail.clearSeoConfirm', { defaultValue: 'Xóa toàn bộ thông tin SEO đã nhập (tiêu đề, mô tả, canonical, ảnh chia sẻ)? Hệ thống sẽ tự dùng tên và mô tả của thương hiệu.' }),
      t('brands.detail.clearSeoTitle', { defaultValue: 'Xóa thông tin SEO?' }),
      { variant: 'danger', confirmLabel: t('brands.detail.clearSeoBtn', { defaultValue: 'Xóa thông tin SEO' }), cancelLabel: t('common.cancel', { defaultValue: 'Hủy' }) },
    )
    if (!ok) return
    setForm((prev) => ({
      ...prev,
      seoTitle: '', seoDescription: '', seoCanonicalUrl: '', seoOgImageUrl: '', seoOgImageAlt: '',
      translations: { ...prev.translations, en: { ...(prev.translations?.en || {}), seoTitle: '', seoDescription: '' } },
    }))
    toast.success(t('brands.detail.clearSeoDone', { defaultValue: 'Đã xóa thông tin SEO.' }))
  }

  return (
    <Screen>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">
            <a
              href="/admin/brands"
              onClick={(e) => { e.preventDefault(); navigate('/admin/brands') }}
              className="inline-flex items-center gap-1"
            >
              <ArrowLeft size={14} aria-hidden="true" /> {t('brands.detail.backToList')}
            </a>
          </p>
          <h1>{isCreate ? t('brands.detail.createTitle') : isSystemBrand ? t('brands.detail.systemTitle', { defaultValue: 'Thương hiệu hệ thống' }) : t('brands.detail.editTitle')}</h1>
          <p className="bb-muted">{isCreate ? t('brands.detail.createDesc') : isSystemBrand ? t('brands.detail.systemDesc', { defaultValue: 'Thương hiệu này được hệ thống dùng để nhận sản phẩm chưa được phân loại và không thể thay đổi.' }) : t('brands.detail.editDesc')}</p>
        </div>
        <div className="bb-screen-actions">
          {!isCreate && canUpdate && !isSystemBrand && (

            <Button
              type="button"
              variant="secondary"
              className="min-h-11 text-danger"
              disabled={isReadOnly}
              aria-busy={isSubmitting || undefined}
              onClick={async () => {
                const confirmed = await showConfirm(
                  t('brands.detail.hideConfirm', { name: formatText(form.name || state.item?.name) }),
                  t('brands.detail.hideConfirmTitle'),
                  { variant: 'danger', confirmLabel: t('brands.detail.hideBtn') },
                )
                if (!confirmed) return
                setIsSubmitting(true)
                deleteMutation.mutate()
              }}
            >
              {t('brands.detail.hideBtn')}
            </Button>
          )}
        </div>
      </div>

      {!isCreate ? (
        <dl className="mb-4 grid gap-3 rounded-md border border-border bg-surface p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t('brands.detail.name')}</dt>
            <dd className="mt-1 font-medium text-foreground">{formatText(state.item?.name)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('brands.detail.slug')}</dt>
            <dd className="mt-1 font-mono text-foreground">/{formatText(state.item?.slug)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('brands.detail.isVisible')}</dt>
            <dd className="mt-1"><StatusBadge type="visibility" status={state.item?.isVisible} /></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('brands.detail.showOnHomepage')}</dt>
            <dd className="mt-1 text-foreground">
              {state.item?.showOnHomepage === true
                ? t('common.yes', { defaultValue: 'Có' })
                : state.item?.showOnHomepage === false
                  ? t('common.no', { defaultValue: 'Không' })
                  : t('common.unknown', { defaultValue: 'Không xác định' })}
            </dd>
          </div>
          {state.item?.createdAt ? (
            <div>
              <dt className="text-muted-foreground">{t('common.createdAt', { defaultValue: 'Tạo lúc' })}</dt>
              <dd className="mt-1 text-foreground">{formatDateTime(state.item.createdAt)}</dd>
            </div>
          ) : null}
          {state.item?.updatedAt ? (
            <div>
              <dt className="text-muted-foreground">{t('common.lastUpdated')}</dt>
              <dd className="mt-1 text-foreground">{formatDateTime(state.item.updatedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {draftRecovery && (
        <div className="bb-alert info center wrap">
          <Save size={14} className="shrink-0" />
          <span className="bb-alert-main truncate">
            <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
            {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
          </span>
          <Button
            variant="unstyled"
            className="text-xs font-semibold underline hover:no-underline"
            onClick={() => {
              setForm(draftRecovery.form)
              setDraftRecovery(null)
            }}
          >
            {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
          </Button>
          <Button
            variant="unstyled"
            className="text-xs underline hover:no-underline"
            onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
          >
            {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
          </Button>
        </div>
      )}

      {state.warning ? (
        <ReadOnlyBanner warning={state.warning} />
      ) : null}

      {!canUpdate ? (
        <ReadOnlyBanner warning={t('brands.detail.permissionDesc')} />
      ) : null}

      {isSystemBrand ? (
        <StatePanel
          tone="warning"
          title={t('brands.detail.systemTitle', { defaultValue: 'Thương hiệu hệ thống' })}
          description={t('brands.detail.systemDesc', { defaultValue: 'Thương hiệu này được hệ thống dùng để nhận sản phẩm chưa được phân loại và không thể thay đổi.' })}
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
                label={t('brands.detail.name')}
                required
                helper={isEnLang ? t('brands.detail.nameHelperEn', { defaultValue: 'Tên thương hiệu dùng chung cho cả tiếng Việt và tiếng Anh.' }) : undefined}
                error={validationErrors.name}
              >
                <Input
                  value={form.name}
                  onChange={(e) => handleSharedNameChange(e.target.value)}
                  onBlur={() => handleFieldBlur('name')}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.namePlaceholderEnRequired', { defaultValue: 'Tên thương hiệu dùng chung' }) : undefined}
                />
              </FormField>
              <FormField
                label={t('brands.detail.slug')}
                required
                helper={isEnLang ? t('brands.detail.slugHelperEn', { defaultValue: 'Slug thương hiệu dùng chung cho cả tiếng Việt và tiếng Anh.' }) : undefined}
                error={validationErrors.slug}
              >
                <Input
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => handleFieldBlur('slug')}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.slugPlaceholderEn', { defaultValue: 'slug-dung-chung' }) : undefined}
                  className="font-mono" />
              </FormField>
              <label className="col-span-full flex w-fit cursor-pointer items-center gap-2 border border-border p-2 text-sm hover:bg-muted">
                <Checkbox checked={form.showOnHomepage} onCheckedChange={(checked) => updateField('showOnHomepage', checked)} disabled={isReadOnly} />
                <span>{t('brands.detail.showOnHomepage')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Mô tả & hình ảnh (tùy chọn) — gom vào nhóm thu gọn, đóng sẵn để form gọn (chống ngợp). */}
        <div className="mb-4">
          <CollapsibleSection
            title={t('brands.detail.optionalSection', { defaultValue: 'Mô tả & hình ảnh' })}
            hint={t('brands.detail.optionalSectionHint', { defaultValue: 'Tùy chọn — mô tả, logo, ảnh banner' })}
            open={optionalOpen}
            onToggle={() => setOptionalOpen((v) => !v)}
            keepMounted
          >
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
            <div className="form-field">
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
            <div className="form-field">
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
          </CollapsibleSection>
          {!isCreate && state.item?.updatedAt && (
            <p className="mt-2 text-xs bb-muted">
              {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
            </p>
          )}
        </div>

        {/* SEO — thẻ dùng chung, thu gọn sẵn (tùy chọn, chống ngợp form) */}
        <SeoCard
          form={form}
          isEnLang={isEnLang}
          isReadOnly={isReadOnly}
          validationErrors={validationErrors}
          updateField={updateField}
          updateTranslation={updateTranslation}
          onFieldBlur={handleFieldBlur}
          i18nPrefix="brands.detail"
          descKey="brands.detail.sectionSeoDesc"
          previewBase={STOREFRONT_BASE}
          previewSlugDefault="duong-dan-thuong-hieu"
          collapsible
          open={seoOpen}
          onToggle={() => setSeoOpen((v) => !v)}
        />

        {/* Xóa SEO có xác nhận — tránh mất nhầm nội dung đã nhập; chỉ hiện khi SEO đang mở & có dữ liệu. */}
        {seoOpen && !isReadOnly && hasSeoData && (
          <div className="mb-4 flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleClearSeo}>
              <Trash2 size={14} aria-hidden="true" />
              {t('brands.detail.clearSeoBtn', { defaultValue: 'Xóa thông tin SEO' })}
            </Button>
          </div>
        )}
      </form>

      {/* Thanh Lưu dính đáy — luôn thấy khi cuộn form dài (trước đây chỉ có nút Lưu ở đầu trang). */}
      <StickyActionBar
        ariaLabel={t('common.actionBarLabel', { defaultValue: 'Thanh thao tác' })}
        info={(
          <span className="text-sm bb-muted">
            {t('brands.detail.formProgress', { filled: requiredProgress.filled, total: requiredProgress.total })}
          </span>
        )}
      >
        <Button
          type="submit"
          form="brand-form"
          disabled={isReadOnly || !isDirty}
          aria-busy={isSubmitting || undefined}
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {isSubmitting
            ? t('common.saving')
            : isCreate ? t('brands.detail.createBtn') : t('brands.detail.saveBtn')}
        </Button>
      </StickyActionBar>
    </Screen>
  )
}
