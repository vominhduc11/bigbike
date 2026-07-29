import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { Check, Eye, Loader2, Lock, Save, Search, Trash2, X } from 'lucide-react'

import {
  createContent,
  deleteContent,
  fetchContentDetail,
  mapValidationErrors,
  permanentDeleteContent,
  previewArticle,
  restoreContent,
  updateContent,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '../lib/useUnsavedChanges'
import { clearNavGuard } from '../lib/navigationGuard'
import { formatDateTime } from '../lib/formatters'
import { setContentLang, useContentLang } from '../lib/contentLang'
import { recordRecentItem } from '../lib/useRecentItems'
import { createContentSchema, zodErrors } from '../lib/schemas'
import { allowedPublishOptions } from '../lib/contentPublishTransitions'
import { RichTextEditor } from '../components/RichTextEditor'
import { BlockEditor } from '../components/BlockEditor'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { StatePanel } from '../components/StatePanel'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { LivePreview } from '../components/LivePreview'
import { useAutoHideSidebar } from '../components/AdminShell'
import { Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  buildEmptyForm,
  buildFormFromItem,
  clearFormFromStorage,
  computeSectionErrorsFromMap,
  findTabForErrors,
  getAutosaveKey,
  loadFormFromStorage,
  mutationPath,
  normalizeContentType,
  publishBadgeClass,
  saveFormToStorage,
  TAB_SECTIONS,
  toPayload,
  toSlug,
} from './content-detail/constants'
import { ContentAssignmentBanner } from './content-detail/ContentAssignmentBanner'
import { SectionCard } from '../components/SectionCard'
import { FormField as Field } from '../components/layout/FormField'

// Module chỉ còn quản lý BÀI VIẾT (ARTICLE). Trang thông tin tĩnh + trình dựng /huong-dan đã gỡ
// khỏi admin (owner 2026-06-24) — nội dung đóng cứng trong web.
export function ContentDetailScreen({ contentType, contentId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const normalizedType = normalizeContentType(contentType)
  const [form, setForm] = useState(() => buildEmptyForm(normalizedType))
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify(buildEmptyForm(normalizedType)),
  )
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // BÀI VIẾT: gõ tiêu đề EN tự gợi ý slug EN khi chưa sửa tay; xoá để sửa tự do.
  const [enSlugManuallyEdited, setEnSlugManuallyEdited] = useState(false)
  // F12: BÀI VIẾT MỚI, tiếng Việt: gõ tiêu đề tự gợi ý đường dẫn khi chưa sửa tay.
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const restoreConfirmingRef = useRef(false)
  const [isRestoreConfirming, setIsRestoreConfirming] = useState(false)

  // ── Live preview (xem trước storefront — chỉ bài viết) ───────────────────────
  // Pane nhúng iframe bigbike-web /preview/article; debounce form rồi gọi dry-run
  // (KHÔNG lưu) lấy public Article và đẩy sang iframe. Reuse VITE_STOREFRONT_BASE_URL.
  // Docs: API_CONTRACT "Article preview" + WORKFLOW_OVERVIEW.
  const storefrontOrigin = (import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn').replace(/\/$/, '')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLang, setPreviewLang] = useState('vi')
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [previewData, setPreviewData] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Mở panel Xem trước → tự ẩn sidebar bên trái, nhường chỗ cho form (màn hình vốn đã
  // chật vì có thêm panel 520px). Đóng preview hoặc rời trang → sidebar hiện lại.
  useAutoHideSidebar(previewOpen && canUpdate)

  useEffect(() => {
    if (!previewOpen || !canUpdate) return
    let cancelled = false
    const handle = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const article = await previewArticle(toPayload(form, isCreate), previewLang)
        if (!cancelled) {
          setPreviewData(article)
          setPreviewError(null)
        }
      } catch (err) {
        if (!cancelled) setPreviewError(err)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [canUpdate, previewOpen, previewLang, form, isCreate])

  const autosaveKey = getAutosaveKey(normalizedType, contentId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

  const { data: fetchResult, isLoading, isError, error: fetchError, refetch } = useQuery({
    queryKey: ['content', normalizedType, contentId],
    queryFn: () => fetchContentDetail(normalizedType, contentId),
    enabled: !isCreate,
  })

  useEffect(() => {
    if (!fetchResult) return
    const nextForm = buildFormFromItem(normalizedType, fetchResult.item)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm)
    setInitialSnapshot(JSON.stringify(nextForm))
    setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
    if (!isCreate && fetchResult.item?.updatedAt) {
      const draft = loadFormFromStorage(autosaveKey)
      if (draft?.form && draft.ts > new Date(fetchResult.item.updatedAt).getTime()) {
        setDraftRecovery(draft)
      }
    }
  }, [autosaveKey, fetchResult, isCreate, normalizedType])

  // O9: ghi lại bài viết vừa xem để hiện trong widget "Vừa xem/sửa" ở danh sách.
  useEffect(() => {
    if (!isCreate && fetchResult?.item?.id) {
      recordRecentItem('recent:content', {
        id: fetchResult.item.id,
        label: fetchResult.item.title || t('content.articleFallbackTitle', { defaultValue: 'Bài viết' }),
      })
    }
  }, [isCreate, fetchResult?.item?.id, fetchResult?.item?.title, t])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
    warning: '',
    error: fetchError?.message ?? '',
  }

  const isDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot])
  const isReadOnly = !canUpdate || isSubmitting
  const persistedTrash = !isCreate && state.item?.publishStatus === 'TRASH'
  // Publish targets limited to what the backend accepts from the persisted state.
  // On create there is no persisted state, so all standard targets are offered.
  const publishOptions = useMemo(
    () => persistedTrash
      ? ['TRASH']
      : allowedPublishOptions(isCreate ? null : state.item?.publishStatus),
    [isCreate, persistedTrash, state.item?.publishStatus],
  )
  const formRef = useRef(null)

  // F6: cảnh báo khi rời trang lúc còn thay đổi chưa lưu — phủ CẢ điều hướng nội bộ
  // (sidebar/breadcrumb qua navigationGuard) lẫn reload/đóng tab (beforeunload); trước đây
  // chỉ tự gắn beforeunload nên đi sidebar không hỏi. Message giống hộp thoại của handleClose.
  useUnsavedChanges(isDirty, t('content.detail.unsavedChangesConfirm'))

  useEffect(() => {
    if (!isCreate) return
    const draft = loadFormFromStorage(autosaveKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate])

  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, form), 10_000)
    return () => clearTimeout(timer)
  }, [form, isDirty, autosaveKey])

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate
      ? createContent(normalizedType, payload)
      : updateContent(normalizedType, contentId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(normalizedType, savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
      clearFormFromStorage(autosaveKey)
      setDraftRecovery(null)
      queryClient.invalidateQueries({ queryKey: ['content'] })
      if (!isCreate) queryClient.setQueryData(['content', normalizedType, contentId], response)
      const successKey = isCreate
        ? 'content.detail.successCreateArticle'
        : 'content.detail.successUpdateArticle'
      toast.success(t(successKey))
      setIsSubmitting(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
      // Lưu xong rồi điều hướng (tạo mới -> trang chi tiết): gỡ nav guard trước khi
      // navigate để không bị hỏi "rời trang?" nhầm (F6) — form vừa lưu khớp baseline.
      if (isCreate && savedItem?.id) {
        clearNavGuard()
        navigate(`/admin/content/${mutationPath(normalizedType)}/${savedItem.id}`, { replace: true })
      }
    },
    onError: (error) => {
      const serverErrors = mapValidationErrors(error)
      setValidationErrors(serverErrors)
      revealValidationErrors(serverErrors)
      toast.error(error.message || t('content.detail.errSaveFailed'))
      setIsSubmitting(false)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => deleteContent(normalizedType, contentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      toast.success(t('content.detail.archiveSuccess'))
      navigate('/admin/content')
    },
    onError: (error) => {
      toast.error(error.message || t('content.detail.errArchiveFailed'))
      setIsSubmitting(false)
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: () => permanentDeleteContent(normalizedType, contentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
      clearFormFromStorage(autosaveKey)
      clearNavGuard()
      toast.success(t('content.permanentDeleteSuccess'))
      navigate('/admin/content')
    },
    onError: (error) => {
      toast.error(error?.message || t('content.detail.errPermanentDeleteFailed'))
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

  function updateImageAsset(prefix, url, media) {
    setForm((previous) => {
      const changed = url !== previous[`${prefix}Url`]
      return {
        ...previous,
        [`${prefix}Url`]: url,
        [`${prefix}Width`]: media?.width ?? (changed ? null : previous[`${prefix}Width`]),
        [`${prefix}Height`]: media?.height ?? (changed ? null : previous[`${prefix}Height`]),
        [`${prefix}MimeType`]: media?.mimeType ?? (changed ? '' : previous[`${prefix}MimeType`]),
      }
    })
    setValidationErrors((previous) => {
      if (!previous[`${prefix}Url`]) return previous
      const next = { ...previous }
      delete next[`${prefix}Url`]
      return next
    })
  }

  // F3: validate ngay khi rời ô bắt buộc (tiêu đề/đường dẫn) thay vì chờ bấm Lưu.
  // Chạy schema trên toàn form (như khi submit) rồi chỉ lấy lỗi của đúng field vừa
  // rời — tái dùng nguồn lỗi/khóa giống handleSubmit nên không lệch nhau.
  function validateFieldOnBlur(fieldKey) {
    const schema = createContentSchema(t, isCreate, normalizedType)
    const fieldError = zodErrors(schema.safeParse(form))[fieldKey]
    setValidationErrors((previous) => {
      if (fieldError) {
        if (previous[fieldKey] === fieldError) return previous
        return { ...previous, [fieldKey]: fieldError }
      }
      if (!previous[fieldKey]) return previous
      const next = { ...previous }
      delete next[fieldKey]
      return next
    })
  }

  function revealValidationErrors(errors) {
    const keys = Object.keys(errors)
    if (keys.some((key) => key.startsWith('translations.en.'))) {
      setContentLang('en')
    } else if (keys.length > 0) {
      setContentLang('vi')
    }
    const failedTab = findTabForErrors(computeSectionErrorsFromMap(errors))
    if (failedTab) setActiveTab(failedTab)
    window.setTimeout(() => {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
    }, 0)
  }

  function validateCandidate(candidate) {
    const schema = createContentSchema(t, isCreate, normalizedType)
    const clientErrors = zodErrors(schema.safeParse(candidate))
    if (Object.keys(clientErrors).length === 0) return true
    setValidationErrors(clientErrors)
    revealValidationErrors(clientErrors)
    return false
  }

  async function saveCandidate(candidate) {
    if (!validateCandidate(candidate)) return false
    setIsSubmitting(true)
    setValidationErrors({})
    try {
      await saveMutation.mutateAsync(toPayload(candidate, isCreate))
      return true
    } catch {
      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePrimarySave() {
    if (!persistedTrash) {
      await saveCandidate(form)
      return
    }
    if (restoreConfirmingRef.current) return
    const candidate = { ...form, publishStatus: 'DRAFT' }
    const validationCandidate = {
      ...candidate,
      // Soft delete appends the article id to persisted slugs. Those server-generated
      // tombstone values are replaced by the restored slugs before the update call.
      slug: form.slug === state.item?.slug ? 'restoring-article' : form.slug,
      translations: {
        ...candidate.translations,
        en: {
          ...candidate.translations?.en,
          slug: form.translations?.en?.slug === state.item?.slugEn
            ? ''
            : form.translations?.en?.slug,
        },
      },
    }
    if (!validateCandidate(validationCandidate)) return

    restoreConfirmingRef.current = true
    setIsRestoreConfirming(true)
    try {
      const confirmed = await showConfirm(
        t('content.detail.restoreAndSaveConfirm'),
        t('content.detail.restoreAndSaveConfirmTitle'),
        { variant: 'default', confirmLabel: t('content.detail.restoreAndSave') },
      )
      if (!confirmed) return

      setIsSubmitting(true)
      let restored = false
      try {
        const response = await restoreContent(normalizedType, contentId)
        restored = true
        const restoredItem = response?.item
        const finalCandidate = {
          ...candidate,
          slug: form.slug === state.item?.slug ? (restoredItem?.slug || form.slug) : form.slug,
          translations: {
            ...candidate.translations,
            en: {
              ...candidate.translations?.en,
              slug: form.translations?.en?.slug === state.item?.slugEn
                ? (restoredItem?.slugEn || '')
                : form.translations?.en?.slug,
            },
          },
        }
        await saveMutation.mutateAsync(toPayload(finalCandidate, false))
      } catch (error) {
        if (!restored) {
          const errors = mapValidationErrors(error)
          setValidationErrors(errors)
          revealValidationErrors(errors)
          toast.error(error?.message || t('content.detail.errRestoreFailed'))
        } else {
          await refetch()
        }
      } finally {
        setIsSubmitting(false)
      }
    } finally {
      restoreConfirmingRef.current = false
      setIsRestoreConfirming(false)
    }
  }


  // ── Tab navigation state (replaces TOC sidebar) ───────────────────────────
  const [activeTab, setActiveTab] = useState('content')
  const [savedFlash, setSavedFlash] = useState(false)

  const isEnLang = contentLang === 'en'

  function langValue(field) {
    return isEnLang ? (form.translations?.en?.[field] ?? '') : (form[field] ?? '')
  }

  function updateTranslation(field, value) {
    setForm((previous) => ({
      ...previous,
      translations: {
        ...previous.translations,
        en: { ...previous.translations?.en, [field]: value },
      },
    }))
  }

  // F12: BÀI VIẾT MỚI, tiếng Việt: gõ tiêu đề tự gợi ý đường dẫn (khi chưa sửa tay). Chỉ áp
  // dụng lúc TẠO MỚI — bài đã có không tự đổi slug theo tiêu đề (tránh vỡ URL đang chạy).
  function handleTitleChange(value) {
    updateField('title', value)
    if (isCreate && !slugManuallyEdited) {
      updateField('slug', toSlug(value))
    }
  }

  function handleSlugChange(value) {
    setSlugManuallyEdited(true)
    updateField('slug', value)
  }

  // BÀI VIẾT, chế độ tiếng Anh: gõ tiêu đề EN tự gợi ý slug EN (khi chưa sửa tay).
  function handleEnTitleChange(value) {
    setForm((previous) => {
      const en = { ...(previous.translations?.en || {}), title: value }
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

  if (state.status === 'loading') {
    // N5: khung xương thay cho StatePanel căn giữa — tránh giật bố cục (CLS) khi dữ liệu về,
    // vì trang thật có header + tab (Nội dung/SEO & xuất bản) + nhiều SectionCard (Thông tin
    // chính, Nội dung chính, Hình ảnh) chứ không phải một panel nhỏ. Cùng kiểu dựng
    // animate-pulse như ProductDetailScreen/CategoryDetailScreen, khớp bố cục riêng của màn này.
    return (
        <Screen>
          <div className="animate-pulse" aria-hidden="true">
            <header className="bb-screen-header">
              <div className="bb-screen-title flex flex-col gap-2">
                <div className="h-3 w-28 rounded-xs bg-surface-muted" />
                <div className="h-7 w-72 max-w-full rounded-xs bg-surface-muted" />
                <div className="h-3 w-56 max-w-full rounded-xs bg-surface-muted" />
              </div>
              <div className="bb-screen-actions">
                <div className="h-9 w-9 rounded-sm bg-surface-muted" />
              </div>
            </header>

            <div className="mb-4 flex flex-wrap gap-2">
              <div className="h-9 w-28 rounded-sm bg-surface-muted" />
              <div className="h-9 w-24 rounded-sm bg-surface-muted" />
            </div>

            <div className="flex flex-col gap-6">
              <div className="bb-card">
                <div className="h-10 border-b border-border bg-surface-muted/60" />
                <div className="bb-card-body flex flex-col gap-3">
                  <div className="h-4 w-1/3 rounded-xs bg-surface-muted" />
                  <div className="h-9 w-full rounded-sm bg-surface-muted" />
                  <div className="h-9 w-full rounded-sm bg-surface-muted" />
                </div>
              </div>
              <div className="bb-card">
                <div className="h-10 border-b border-border bg-surface-muted/60" />
                <div className="bb-card-body flex flex-col gap-3">
                  <div className="h-4 w-1/4 rounded-xs bg-surface-muted" />
                  <div className="h-60 w-full rounded-sm bg-surface-muted" />
                </div>
              </div>
              <div className="bb-card">
                <div className="h-10 border-b border-border bg-surface-muted/60" />
                <div className="bb-card-body flex flex-col gap-3">
                  <div className="h-4 w-1/3 rounded-xs bg-surface-muted" />
                  <div className="h-9 w-full rounded-sm bg-surface-muted" />
                  <div className="h-9 w-full rounded-sm bg-surface-muted" />
                </div>
              </div>
            </div>
          </div>
        </Screen>
    )
  }

  if (state.status === 'error') {
    if (fetchError?.status === 404) {
      return (
        <StatePanel
          tone="neutral"
          title={t('content.detail.notFound')}
          description={t('content.detail.notFoundDesc')}
          actionLabel={t('content.detail.backToList')}
          onAction={() => navigate('/admin/content')}
        />
      )
    }
    return (
      <div className="flex flex-col items-center gap-3">
        <StatePanel
          tone="danger"
          title={t('content.detail.loadError')}
          description={state.error}
          actionLabel={t('common.retry', { defaultValue: 'Thử lại' })}
          onAction={() => refetch()}
        />
        <Button variant="ghost"
          type="button"
          onClick={() => navigate('/admin/content')}
          className="min-h-11"
        >
          {t('content.detail.backToList')}
        </Button>
      </div>
    )
  }

  if (!isCreate && !state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('content.detail.notFound')}
        description={t('content.detail.notFoundDesc')}
        actionLabel={t('content.detail.backToList')}
        onAction={() => navigate('/admin/content')}
      />
    )
  }

  const sectionErrors = computeSectionErrorsFromMap(validationErrors)
  const tabCounts = Object.fromEntries(
    Object.entries(TAB_SECTIONS).map(([tab, keys]) => [tab, keys.filter((k) => sectionErrors[k]).length]),
  )

  const seoTitleVal = langValue('seoTitle')
  const seoDescVal = langValue('seoDescription')
  const seoChecks = [
    { ok: seoTitleVal.length >= 30 && seoTitleVal.length <= 60, hint: seoTitleVal.length, label: t('content.detail.seoCheckTitle', { defaultValue: 'SEO title 30–60 ký tự' }) },
    { ok: seoDescVal.length >= 140 && seoDescVal.length <= 160, hint: seoDescVal.length, label: t('content.detail.seoCheckDesc', { defaultValue: 'SEO description 140–160 ký tự' }) },
    { ok: !!form.slug && /^[a-z0-9-]+$/.test(form.slug), label: t('content.detail.seoCheckSlug', { defaultValue: 'Slug chữ thường, không dấu, dùng "-"' }) },
    { ok: !!form.coverImageUrl?.trim() && !!form.coverImageAlt?.trim(), label: t('content.detail.seoCheckImageAlt') },
    { ok: !!form.seoOgImageUrl?.trim(), label: t('content.detail.seoCheckOg', { defaultValue: 'OG image cho chia sẻ MXH' }) },
  ]
  const seoPassed = seoChecks.filter((c) => c.ok).length

  const saveDotState = isSubmitting ? 'saving' : savedFlash ? 'saved' : isDirty ? 'dirty' : 'saved'
  const saveDotClass =
    saveDotState === 'saving' ? 'bg-info animate-pulse'
    : saveDotState === 'dirty' ? 'bg-warning animate-pulse'
    :                            'bg-success'
  const saveLabel = isSubmitting
    ? t('content.detail.savingShort', { defaultValue: 'Đang lưu...' })
    : isDirty
      ? t('content.detail.saveDirty', { defaultValue: 'Có thay đổi chưa lưu' })
      : t('content.detail.saveClean', { defaultValue: 'Đã lưu' })

  const screenTitle = isCreate
    ? t('content.detail.createArticleTitle')
    : (form.title || t('content.detail.editArticleTitle'))

  const primaryLabel = persistedTrash
    ? t('content.detail.restoreAndSave')
    : isCreate
      ? t('content.detail.createArticleBtn')
      : t('content.detail.saveBtn')

  async function handleClose() {
    if (isDirty) {
      const confirmed = await showConfirm(
        t('content.detail.unsavedChangesConfirm'),
        t('content.detail.unsavedChangesTitle'),
      )
      if (!confirmed) return
      // F6: đã xác nhận qua hộp thoại riêng ở trên — bỏ qua lời nhắc trùng lặp của
      // navigationGuard (useUnsavedChanges) khi navigate() chạy dưới đây.
      clearNavGuard()
    }
    navigate('/admin/content')
  }

  async function handleArchive() {
    const confirmed = await showConfirm(
      t('content.detail.archiveConfirm'),
      t('content.detail.archiveConfirmTitle'),
    )
    if (!confirmed) return
    setIsSubmitting(true)
    archiveMutation.mutate()
  }

  async function handlePermanentDelete() {
    const confirmed = await showConfirm(
      t('content.permanentDeleteConfirm', { title: form.title }),
      t('content.permanentDeleteConfirmTitle'),
      { variant: 'danger', confirmLabel: t('common.permanentDelete') },
    )
    if (!confirmed) return
    setIsSubmitting(true)
    permanentDeleteMutation.mutate()
  }

  return (
    <div className="flex w-full min-w-0 items-start gap-6">
    {/* @container: lưới trong form co theo bề rộng cột này (xem ProductDetailScreen) —
        kéo khung xem trước rộng ra làm cột hẹp thì lưới tự về 1 cột, không chật. */}
    <div className="@container min-w-0 flex-1 basis-0">
      <Screen>
        <ScreenHeader
          eyebrow={t('content.detail.eyebrow')}
          title={screenTitle}
          description={
            !isCreate && state.item?.updatedAt ? (
              <span className="text-xs">
                {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
              </span>
            ) : null
          }
          badge={
            <span className="inline-flex items-center gap-2">
              <span className={publishBadgeClass(form.publishStatus)}>
                {t(`status.publish.${form.publishStatus}`, { defaultValue: form.publishStatus })}
              </span>
              {!canUpdate && (
                <span className="bb-badge bb-badge-warning">
                  <Lock size={11} aria-hidden="true" />
                  {t('content.detail.readOnlyBadge')}
                </span>
              )}
            </span>
          }
          actions={
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={handleClose}
              aria-label={t('content.detail.backToList')}
              data-screen-close="true"
            >
              <X size={18} aria-hidden="true" />
            </Button>
          }
        />

        {/* Banners — read-only */}
        {!canUpdate ? <ReadOnlyBanner warning={t('content.detail.permissionDesc')} /> : null}

        {state.warning ? <Alert tone="warning">{state.warning}</Alert> : null}

        {persistedTrash ? (
          <Alert tone="warning">
            <strong>{t('content.detail.trashWarningTitle')}</strong>{' '}
            {t('content.detail.trashWarningDesc')}
          </Alert>
        ) : null}

        {draftRecovery && (
          <Alert tone="info" icon={Save}>
            <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate">
              <strong>{t('content.detail.draftFoundShort')}</strong>
              {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
            </span>
            <Button variant="ghost"
              size="sm"
              type="button"
              onClick={() => { setForm(draftRecovery.form); setEnSlugManuallyEdited(Boolean(draftRecovery.form?.translations?.en?.slug)); setDraftRecovery(null) }}
            >
              {t('content.detail.draftRestore')}
            </Button>
            <Button variant="ghost"
              size="sm"
              type="button"
              onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
            >
              {t('content.detail.draftDiscard')}
            </Button>
            </div>
          </Alert>
        )}

        {/* Assignment banner — always visible */}
        <ContentAssignmentBanner />

        <Tabs
          ariaLabel={t('content.detail.tabsAriaLabel', { defaultValue: 'Phần của nội dung' })}
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'content', label: t('content.detail.tabContent'),     count: tabCounts.content || undefined },
            { key: 'seo',     label: t('content.detail.tabSeoPublish'),  count: tabCounts.seo     || undefined },
          ]}
        />

        {/* F2: chú thích dấu * cho ô/thẻ bắt buộc — đặt đầu form, dùng token muted */}
        <p className="text-xs text-muted-foreground">
          <span className="text-danger" aria-hidden="true">*</span>
          {' '}
          {t('common.requiredLegend', { defaultValue: 'Trường bắt buộc' })}
        </p>

        <form
          ref={formRef}
          className="flex flex-col gap-6 pb-4"
          onSubmit={(event) => {
            event.preventDefault()
            handlePrimarySave()
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
              e.preventDefault()
              handlePrimarySave()
            }
          }}
        >
          {activeTab === 'content' && (
            <>
              {/* ── Card: Thông tin chính ── */}
              <SectionCard
                title={t('content.detail.sectionCore')}
                required
              >
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
                  <Field
                    full
                    required
                    label={t('content.detail.title')}
                    count={`${langValue('title').length} / 255`}
                    countWarn={langValue('title').length > 240}
                    error={isEnLang ? validationErrors['translations.en.title'] : validationErrors.title}
                  >
                    <Input
                      value={isEnLang ? (form.translations?.en?.title ?? '') : form.title}
                      onChange={(e) => isEnLang ? handleEnTitleChange(e.target.value) : handleTitleChange(e.target.value)}
                      onBlur={() => validateFieldOnBlur(isEnLang ? 'translations.en.title' : 'title')}
                      disabled={isReadOnly}
                      placeholder={isEnLang ? t('content.detail.titlePlaceholderEn') : undefined}
                      maxLength={255}
                    />
                  </Field>

                  {/* Đường dẫn URL theo ngôn ngữ — slug tiếng Anh cho BÀI VIẾT (ARTICLE_RULE_003). */}
                  {isEnLang ? (
                    <Field
                      full
                      label={t('content.detail.slug')}
                      error={validationErrors['translations.en.slug']}
                      helper={t('content.detail.slugHintEn', { defaultValue: 'Đường dẫn tiếng Anh (tùy chọn) — để trống sẽ dùng đường dẫn tiếng Việt.' })}
                    >
                      <Input
                        value={form.translations?.en?.slug ?? ''}
                        onChange={(e) => handleEnSlugChange(e.target.value)}
                        onBlur={() => validateFieldOnBlur('translations.en.slug')}
                        disabled={isReadOnly}
                        placeholder={t('content.detail.slugPlaceholderEn', { defaultValue: 'english-url-slug' })}
                        className="font-mono"
                      />
                    </Field>
                  ) : (
                    <Field full required label={t('content.detail.slug')} error={validationErrors.slug}>
                      <Input
                        value={form.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        onBlur={() => validateFieldOnBlur('slug')}
                        disabled={isReadOnly}
                        className="font-mono"
                      />
                    </Field>
                  )}

                  {/* Ô "Danh mục" đã gỡ: sau khi gộp nhóm bài viết còn 1 "Tin tức" (V275),
                      backend tự gán mọi bài vào nhóm này nên không cần cho admin chọn. */}

                    <Field
                      full
                      label={t('content.detail.excerpt')}
                      count={`${langValue('excerpt').length} / 5000`}
                      countWarn={langValue('excerpt').length > 4500}
                      error={isEnLang ? validationErrors['translations.en.excerpt'] : validationErrors.excerpt}
                      helper={isEnLang ? t('content.detail.enFieldHint') : undefined}
                    >
                      <Textarea
                        value={isEnLang ? (form.translations?.en?.excerpt ?? '') : form.excerpt}
                        onChange={(e) => isEnLang ? updateTranslation('excerpt', e.target.value) : updateField('excerpt', e.target.value)}
                        disabled={isReadOnly}
                        maxLength={5000}
                      />
                    </Field>
                </div>
              </SectionCard>

              {/* ── Card: Nội dung chính ── */}
              <SectionCard title={t('content.detail.sectionBody')} required={!isEnLang}>
                <Field
                  full
                  required={!isEnLang}
                  label={t('content.detail.body')}
                  error={isEnLang ? validationErrors['translations.en.body'] : validationErrors.bodyBlocks}
                  helper={isEnLang ? t('content.detail.enBodyOptionalHint') : undefined}
                >
                  <div role="group">
                    {isEnLang ? (
                      <RichTextEditor
                        key={`body-${contentLang}`}
                        value={form.translations?.en?.body ?? ''}
                        onChange={(html) => updateTranslation('body', html)}
                        placeholder={t('content.detail.bodyPlaceholder')}
                        disabled={isReadOnly}
                        enableImagePicker
                      />
                    ) : (
                      <BlockEditor
                        key={`bodyBlocks-${contentLang}`}
                        value={form.bodyBlocks}
                        onChange={(blocks) => updateField('bodyBlocks', blocks)}
                        disabled={isReadOnly}
                        hasError={Boolean(validationErrors.bodyBlocks)}
                        fallbackHtml={form.body}
                      />
                    )}
                  </div>
                </Field>
              </SectionCard>

              {/* ── Card: Hình ảnh — article gallery / page hero ── */}
              <SectionCard title={t('content.detail.sectionMedia')}>
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('content.detail.coverImageUrl')}
                    helper={t('content.detail.coverImageUrlHint')}
                    error={validationErrors.coverImageUrl || validationErrors.coverImageAlt}
                  >
                    <ImageUrlInput
                      value={form.coverImageUrl}
                      onChange={(url, media) => updateImageAsset('coverImage', url, media)}
                      alt={form.coverImageAlt}
                      onAltChange={(v) => updateField('coverImageAlt', v)}
                      disabled={isReadOnly}
                      error={validationErrors.coverImageUrl}
                      recommend={IMAGE_RECO.cover}
                    />
                  </Field>
                  {form.homeExperience && (
                    <Field full label={t('content.detail.productImageUrl', { defaultValue: 'Ảnh sản phẩm (overlay carousel)' })} helper={t('content.detail.productImageUrlHint', { defaultValue: 'Ảnh PNG nền trong hiển thị chồng lên ảnh bìa trong carousel Góc Trải Nghiệm ở trang chủ.' })}>
                      <ImageUrlInput
                        value={form.productImageUrl}
                        onChange={(url) => updateField('productImageUrl', url)}
                        alt={form.productImageAlt}
                        onAltChange={(v) => updateField('productImageAlt', v)}
                        disabled={isReadOnly}
                        error={validationErrors.productImageUrl}
                        recommend={IMAGE_RECO.squareMedium}
                      />
                    </Field>
                  )}
                </div>
              </SectionCard>

              {/* ── Card: Hiển thị ── */}
              <SectionCard title={t('content.detail.sectionPublish', { defaultValue: 'Hiển thị' })} required>
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
                  <Field required label={t('content.detail.publishStatus')} error={validationErrors.publishStatus}>
                    <Select
                      value={form.publishStatus}
                      onValueChange={(val) => updateField('publishStatus', val)}
                      disabled={isReadOnly || persistedTrash}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {publishOptions.map((status) => (
                          <SelectItem key={status} value={status}>{t(`status.publish.${status}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                    <div className="@xl:col-span-2 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                        <Checkbox
                          checked={form.featured}
                          onCheckedChange={(checked) => updateField('featured', checked === true)}
                          disabled={isReadOnly}
                        />
                        <span>{t('content.detail.featured')}</span>
                      </label>
                      <span className="text-xs text-muted-foreground">{t('content.detail.featuredHint')}</span>
                      <label className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                        <Checkbox
                          checked={form.homeExperience}
                          onCheckedChange={(checked) => updateField('homeExperience', checked === true)}
                          disabled={isReadOnly}
                        />
                        <span>{t('content.detail.homeExperience', { defaultValue: 'Hiển thị ở "Góc trải nghiệm" trang chủ' })}</span>
                      </label>
                      <span className="text-xs text-muted-foreground">{t('content.detail.homeExperienceHint', { defaultValue: 'Bật để chọn bài này vào băng chuyền "Góc trải nghiệm cùng BigBike" ở trang chủ. Hiển thị tối đa 3 bài được chọn (mới nhất trước). Nếu không chọn bài nào, trang chủ tự lấy 3 bài Reviews mới nhất.' })}</span>
                    </div>
                </div>
              </SectionCard>
            </>
          )}

          {activeTab === 'seo' && (
            <>
              {/* ── Card: SEO ── */}
              <SectionCard title={t('content.detail.sectionSeo')}>
                {/* Live Google SERP preview */}
                <div className="mb-4 rte-canvas-frame">
                  <div className="p-3 border border-border bg-white">
                    <div className="flex items-center gap-1 text-xs text-google-url mb-1">
                      <Search size={12} aria-hidden="true" />
                      <span>{t('content.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
                    </div>
                    <div className="text-xs text-google-url break-all mb-1">
                      {isEnLang
                        ? (form.translations?.en?.slug
                            ? `${storefrontOrigin}/news/${form.translations.en.slug}/`
                            : t('content.detail.serpNoEnglishUrl', { defaultValue: 'Chưa có trang tiếng Anh' }))
                        : `${storefrontOrigin}/tin-tuc/${form.slug || 'duong-dan'}/`}
                    </div>
                    <div className="text-lg leading-snug text-google-title break-words mb-1">
                      {(langValue('seoTitle') || langValue('title') || t('content.detail.serpTitleFallback', { defaultValue: 'Tiêu đề trên Google' })).slice(0, 60)}
                    </div>
                    <div className="text-sm leading-relaxed text-google-description break-words">
                      {langValue('seoDescription') || langValue('excerpt') || t('content.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn sẽ hiển thị ở đây.' })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}
                    count={`${langValue('seoTitle').length} / 60`}
                    countWarn={langValue('seoTitle').length > 60}
                    error={isEnLang ? validationErrors['translations.en.seoTitle'] : validationErrors.seoTitle}
                    helper={isEnLang ? t('content.detail.enFieldHint') : undefined}
                  >
                    <Input
                      value={isEnLang ? (form.translations?.en?.seoTitle ?? '') : form.seoTitle}
                      onChange={(e) => isEnLang ? updateTranslation('seoTitle', e.target.value) : updateField('seoTitle', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}
                      maxLength={255}
                    />
                  </Field>

                  <Field
                    full
                    label={t('content.detail.seoDescription', { defaultValue: 'Mô tả SEO' })}
                    count={`${langValue('seoDescription').length} / 155`}
                    countWarn={langValue('seoDescription').length > 155}
                    error={isEnLang ? validationErrors['translations.en.seoDescription'] : validationErrors.seoDescription}
                    helper={isEnLang ? t('content.detail.enFieldHint') : undefined}
                  >
                    <Textarea
                      value={isEnLang ? (form.translations?.en?.seoDescription ?? '') : form.seoDescription}
                      onChange={(e) => isEnLang ? updateTranslation('seoDescription', e.target.value) : updateField('seoDescription', e.target.value)}
                      disabled={isReadOnly}
                      rows={3}
                      maxLength={5000}
                      placeholder={t('content.detail.seoDescription', { defaultValue: 'Mô tả SEO' })}
                    />
                  </Field>

                  <Field
                    full
                    label={t('content.detail.seoOgImageUrl', { defaultValue: 'SEO OG image URL' })}
                    helper={t('content.detail.seoOgImageUrlHint', { defaultValue: 'Ảnh chia sẻ MXH, 1200×630px.' })}
                    error={validationErrors.seoOgImageUrl || validationErrors.seoOgImageAlt}
                  >
                    <ImageUrlInput
                      value={form.seoOgImageUrl}
                      onChange={(url, media) => updateImageAsset('seoOgImage', url, media)}
                      alt={form.seoOgImageAlt}
                      onAltChange={(alt) => updateField('seoOgImageAlt', alt)}
                      disabled={isReadOnly}
                      error={validationErrors.seoOgImageUrl}
                      recommend={IMAGE_RECO.cover}
                    />
                  </Field>
                </div>

                {/* SEO checklist */}
                <div className="mt-4 p-3 border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Check size={14} aria-hidden="true" />
                      {t('content.detail.seoChecklist', { defaultValue: 'Checklist SEO' })}
                    </span>
                    <span className="font-mono text-sm font-bold text-success">
                      {seoPassed} / {seoChecks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 @xl:grid-cols-2 gap-y-1 gap-x-3">
                    {seoChecks.map((c, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-xs', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                        <span className={cn(
                          'w-4 h-4 flex items-center justify-center',
                          c.ok
                            ? 'bg-success-bg text-success'
                            : 'bg-muted',
                        )}>
                          {c.ok ? <Check size={11} aria-hidden="true" /> : null}
                        </span>
                        <span>
                          {c.label}
                          {c.hint != null && (
                            <span className="ml-1 font-mono text-muted-foreground">({c.hint})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </form>

        <StickyActionBar
          ariaLabel={t('common.actionBarLabel', { defaultValue: 'Thanh thao tác' })}
          info={
            <span className="flex items-center gap-2 text-sm">
              <span className={cn('w-2 h-2 rounded-full', saveDotClass)} />
              <span className="font-medium">{saveLabel}</span>
            </span>
          }
        >

          {canUpdate && (
            <Button
              variant="outline"
              type="button"
              className="min-h-11"
              disabled={isSubmitting}
              onClick={() => setPreviewOpen(true)}
              title={t('content.detail.preview.title', { defaultValue: 'Xem trước bài viết' })}
            >
              <Eye size={14} className="mr-1.5" aria-hidden="true" />
              {t('content.detail.preview.open', { defaultValue: 'Xem trước' })}
            </Button>
          )}
          {!isCreate && canUpdate && !persistedTrash && (
            <Button
              variant="outline"
              type="button"
              className="min-h-11 text-destructive hover:text-destructive"
              disabled={isSubmitting}
              onClick={handleArchive}
            >
              <Trash2 size={14} className="mr-1.5" aria-hidden="true" />
              {t('content.detail.archiveBtn')}
            </Button>
          )}
          {canUpdate && persistedTrash ? (
            <Button
              variant="outline"
              type="button"
              className="min-h-11 text-destructive hover:text-destructive"
              disabled={isSubmitting}
              onClick={handlePermanentDelete}
            >
              <Trash2 size={14} className="mr-1.5" aria-hidden="true" />
              {t('common.permanentDelete')}
            </Button>
          ) : null}
          <Button
            type="button"
            className="min-h-11"
            disabled={!canUpdate || isSubmitting || isRestoreConfirming || (!isCreate && !isDirty && !persistedTrash)}
            onClick={handlePrimarySave}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" />}
            {primaryLabel}
          </Button>
        </StickyActionBar>
      </Screen>
    </div>
        {canUpdate && (
          <LivePreview
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            data={previewData}
            error={previewError}
            loading={previewLoading}
            lang={previewLang}
            onLangChange={setPreviewLang}
            device={previewDevice}
            onDeviceChange={setPreviewDevice}
            webOrigin={storefrontOrigin}
            previewPath="/preview/article/"
            i18nPrefix="content.detail.preview"
            t={t}
          />
        )}
    </div>
  )
}
