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
import { toSlug } from '../lib/slug'
import { useContentLang, setContentLang } from '../lib/contentLang'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { AlertCircle, ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'

import { createBrandSchema, zodErrors } from '../lib/schemas'
import { toBrandPayload } from './brandPayload'
import { StatePanel } from '../components/StatePanel'
import { FormField } from '../components/layout/FormField'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { StickyActionBar } from '../components/layout'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { SeoCard } from '../components/SeoCard'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { RichTextEditor } from '../components/RichTextEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/brands`


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
  // Khi TẠO MỚI, gõ tên tự gợi ý đường dẫn (giống Danh mục) cho tới khi admin tự sửa
  // đường dẫn. Chế độ SỬA không đụng slug hiện có (tránh đổi URL đã lập chỉ mục).
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  // Gom mô tả + hình ảnh (tùy chọn) vào nhóm thu gọn, đóng sẵn để chống ngợp form;
  // tự bung khi sửa thương hiệu đã có sẵn nội dung/ảnh hoặc khi có lỗi bên trong.
  const [optionalOpen, setOptionalOpen] = useState(false)
  const enErrorRef = useRef(null)

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

  // Chế độ tiếng Việt: gõ tên tự gợi ý đường dẫn (chỉ khi tạo mới & chưa sửa tay slug).
  function handleNameChange(value) {
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
      // Đưa lỗi đang bị ẩn ra chỗ nhìn thấy: bung nhóm tùy chọn / SEO nếu lỗi nằm trong đó,
      // và cuộn cảnh báo "thiếu tên tiếng Anh" vào tầm nhìn (lỗi này nằm ở tab EN).
      if (clientErrors.description || clientErrors.logoUrl) setOptionalOpen(true)
      if (clientErrors.seoTitle || clientErrors.seoDescription || clientErrors.seoCanonicalUrl || clientErrors.seoOgImageUrl) setSeoOpen(true)
      if (clientErrors['translations.en.name'] && !isEnLang) {
        requestAnimationFrame(() => enErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      }
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
    <div>
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
          <h1>{isCreate ? t('brands.detail.createTitle') : t('brands.detail.editTitle')}</h1>
          <p className="bb-muted">{isCreate ? t('brands.detail.createDesc') : t('brands.detail.editDesc')}</p>
        </div>
        <div className="bb-screen-actions">
          {!isCreate && canUpdate && (

            <Button
              type="button"
              variant="secondary"
              className="text-danger"
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
            </Button>
          )}
        </div>
      </div>

      {/* Q1: Tên tiếng Anh là bắt buộc (schema chặn). Nếu thiếu mà đang ở tab tiếng Việt,
          lỗi sẽ nằm khuất trong tab EN — đưa ra cảnh báo rõ ở đầu trang kèm nút chuyển tab. */}
      {!isEnLang && validationErrors['translations.en.name'] && (
        <div ref={enErrorRef} className="bb-alert danger wrap center">
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          <span className="bb-alert-main">
            <strong>{t('brands.detail.enNameMissingTitle', { defaultValue: 'Thiếu tên tiếng Anh' })}</strong>
            {' · '}{validationErrors['translations.en.name']}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setContentLang('en')}>
            {t('brands.detail.switchToEnglish', { defaultValue: 'Chuyển sang tiếng Anh' })}
          </Button>
        </div>
      )}

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
              setEnSlugManuallyEdited(Boolean(draftRecovery.form?.translations?.en?.slug))
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
                label={t('brands.detail.name')}
                required
                helper={isEnLang ? t('brands.detail.nameHelperEn', { defaultValue: 'Bắt buộc — dùng cho khách xem bản tiếng Anh.' }) : undefined}
                error={isEnLang ? validationErrors['translations.en.name'] : validationErrors.name}
              >
                <Input
                  value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                  onChange={(e) => isEnLang ? handleEnNameChange(e.target.value) : handleNameChange(e.target.value)}
                  onBlur={() => handleFieldBlur(isEnLang ? 'translations.en.name' : 'name')}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.namePlaceholderEnRequired', { defaultValue: 'Nhập tên thương hiệu bằng tiếng Anh' }) : undefined}
                />
              </FormField>
              <FormField
                label={<>
                  {t('brands.detail.slug')}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 8 }}>{t('brands.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </>}
                required={!isEnLang}
                helper={isEnLang ? t('brands.detail.slugHintEn', { defaultValue: 'Để trống sẽ dùng đường dẫn tiếng Việt cho bản tiếng Anh.' }) : undefined}
                error={isEnLang ? validationErrors['translations.en.slug'] : validationErrors.slug}
              >
                <Input
                  value={isEnLang ? (form.translations?.en?.slug ?? '') : form.slug}
                  onChange={(e) => isEnLang ? handleEnSlugChange(e.target.value) : handleSlugChange(e.target.value)}
                  onBlur={() => handleFieldBlur(isEnLang ? 'translations.en.slug' : 'slug')}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('brands.detail.slugPlaceholderEn', { defaultValue: 'english-url-slug' }) : undefined}
                  style={{ fontFamily: 'var(--admin-font-mono)' }} />
              </FormField>
              <label
                className="flex items-center gap-2 p-2 border border-border text-sm cursor-pointer hover:bg-muted w-fit"
                style={{ gridColumn: '1 / -1' }}
              >
                <Checkbox checked={form.visible} onCheckedChange={(checked) => updateField('visible', checked)} disabled={isReadOnly} />
                <span>{t('brands.detail.isVisible')}</span>
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
        info={!isEnLang ? (
          <span className="text-sm bb-muted">
            {t('brands.detail.formProgress', { filled: requiredFieldsFilled, total: requiredFieldsTotal })}
          </span>
        ) : null}
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
    </div>
  )
}
