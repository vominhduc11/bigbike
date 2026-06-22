import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { AlertCircle, Check, Eye, Info, Loader2, Lock, Save, Search, Trash2, X } from 'lucide-react'
import {
  createContent,
  deleteContent,
  fetchContentCategories,
  fetchContentDetail,
  fetchContentPageRefs,

  mapValidationErrors,
  previewArticle,
  updateContent,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { useContentLang } from '../lib/contentLang'
import { createContentSchema, zodErrors } from '../lib/schemas'
import { allowedPublishOptions } from '../lib/contentPublishTransitions'
import { RichTextEditor } from '../components/RichTextEditor'
import { BlockEditor } from '../components/BlockEditor'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { StatePanel } from '../components/StatePanel'
import { LivePreview } from '../components/LivePreview'
import { Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildEmptyForm,
  buildFormFromItem,
  clearFormFromStorage,
  computeSectionErrorsFromMap,
  findOptionById,
  findTabForErrors,
  getAutosaveKey,
  loadFormFromStorage,
  mutationPath,
  normalizeContentType,
  prependSelectedOption,
  publishBadgeClass,
  saveFormToStorage,
  TAB_SECTIONS,
  toPayload,
  toSlug,
} from './content-detail/constants'
import { ContentAssignmentBanner } from './content-detail/ContentAssignmentBanner'
import { SectionCard } from './content-detail/SectionCard'
import { Field } from './content-detail/Field'

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

  useEffect(() => {
    if (!previewOpen) return
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
  }, [previewOpen, previewLang, form, isCreate])

  const autosaveKey = getAutosaveKey(normalizedType, contentId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['content', normalizedType, contentId],
    queryFn: () => fetchContentDetail(normalizedType, contentId),
    enabled: !isCreate,
  })

  // P1-002: Fetch reference data for dropdowns
  const { data: categories = [] } = useQuery({
    queryKey: ['content-reference', 'categories'],
    queryFn: fetchContentCategories,
    staleTime: 5 * 60 * 1000,
  })

  // Parent-page picker — only PAGE content can have a parent. Loaded lazily.
  const { data: pageRefs = [] } = useQuery({
    queryKey: ['content-reference', 'pages'],
    queryFn: fetchContentPageRefs,
    staleTime: 5 * 60 * 1000,
    enabled: normalizedType === 'PAGE',
  })

  // Exclude self to avoid a page being its own parent. Keep the current parent
  // visible even before refs finish loading so the Select trigger isn't blank.
  const parentPageOptions = useMemo(() => {
    const opts = (pageRefs || []).filter((p) => p.id && p.id !== contentId)
    if (form.parentId && !opts.some((p) => p.id === form.parentId)) {
      opts.unshift({ id: form.parentId, slug: '', title: form.parentId })
    }
    return opts
  }, [pageRefs, contentId, form.parentId])

  const loadedItem = fetchResult?.item ?? null
  const selectedCategoryRef = findOptionById(
    [loadedItem?.category, ...(Array.isArray(loadedItem?.categories) ? loadedItem.categories : [])].filter(Boolean),
    form.categoryId,
  )
  const categoryOptions = prependSelectedOption(categories, selectedCategoryRef)
  const selectedCategoryLabel =
    findOptionById(categoryOptions, form.categoryId)?.name ||
    (form.categoryId ? form.categoryId : undefined)

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

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
    warning: '',
    error: fetchError?.message ?? '',
  }

  const isDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot])
  const isReadOnly = !canUpdate || isSubmitting
  // Publish targets limited to what the backend accepts from the persisted state.
  // On create there is no persisted state, so all standard targets are offered.
  const publishOptions = useMemo(
    () => allowedPublishOptions(isCreate ? null : state.item?.publishStatus),
    [isCreate, state.item?.publishStatus],
  )
  const formRef = useRef(null)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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
        ? (normalizedType === 'ARTICLE' ? 'content.detail.successCreateArticle' : 'content.detail.successCreatePage')
        : (normalizedType === 'ARTICLE' ? 'content.detail.successUpdateArticle' : 'content.detail.successUpdatePage')
      toast.success(t(successKey))
      setIsSubmitting(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
      if (isCreate && savedItem?.id) navigate(`/admin/content/${mutationPath(normalizedType)}/${savedItem.id}`, { replace: true })
    },
    onError: (error) => {
      setValidationErrors(mapValidationErrors(error))
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
    if (event && typeof event.preventDefault === 'function') event.preventDefault()
    if (!canUpdate) return

    const schema = createContentSchema(t, isCreate, normalizedType)
    const result = schema.safeParse(form)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      const failedTab = findTabForErrors(computeSectionErrorsFromMap(clientErrors))
      if (failedTab && failedTab !== activeTab) setActiveTab(failedTab)
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(toPayload(form, isCreate))
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
    return (
      <StatePanel
        tone="info"
        title={t('content.detail.loading')}
        description={t('content.detail.loadingDesc')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('content.detail.loadError')}
        description={state.error}
        actionLabel={t('content.detail.backToList')}
        onAction={() => navigate('/admin/content')}
      />
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

  const isArticle = normalizedType === 'ARTICLE'

  // Nhãn cho ô bắt buộc — gắn dấu * đỏ ngay sau tên ô (cùng kiểu với SectionCard)
  // để admin biết chính xác ô nào trong thẻ "bắt buộc" phải điền (tiêu chí 7.8).
  const requiredLabel = (text) => (
    <>
      {text}
      <span
        className="ml-0.5 text-[var(--admin-color-status-danger-text)]"
        aria-label={t('common.required', { defaultValue: 'bắt buộc' })}
        title={t('common.required', { defaultValue: 'Bắt buộc' })}
      >*</span>
    </>
  )

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
    ...(isArticle ? [{ ok: !!form.coverImageUrl?.trim() && !!form.coverImageAlt?.trim(), label: t('content.detail.seoCheckImageAlt', { defaultValue: 'Ảnh bìa có alt text' }) }] : []),
    { ok: !!form.seoOgImageUrl?.trim(), label: t('content.detail.seoCheckOg', { defaultValue: 'OG image cho chia sẻ MXH' }) },
  ]
  const seoPassed = seoChecks.filter((c) => c.ok).length

  const saveDotState = isSubmitting ? 'saving' : savedFlash ? 'saved' : isDirty ? 'dirty' : 'saved'
  const saveDotClass =
    saveDotState === 'saving' ? 'bg-[var(--admin-color-status-info-text)] animate-pulse'
    : saveDotState === 'dirty' ? 'bg-[var(--admin-color-status-warning-text)] animate-pulse'
    :                            'bg-[var(--admin-color-status-success-text)]'
  const saveLabel = isSubmitting
    ? t('content.detail.savingShort', { defaultValue: 'Đang lưu...' })
    : isDirty
      ? t('content.detail.saveDirty', { defaultValue: 'Có thay đổi chưa lưu' })
      : t('content.detail.saveClean', { defaultValue: 'Đã lưu' })

  const screenTitle = isCreate
    ? t(isArticle ? 'content.detail.createArticleTitle' : 'content.detail.createPageTitle')
    : (form.title || t(isArticle ? 'content.detail.editArticleTitle' : 'content.detail.editPageTitle'))

  const primaryLabel = isCreate
    ? t(isArticle ? 'content.detail.createArticleBtn' : 'content.detail.createPageBtn')
    : t('content.detail.saveBtn')

  async function handleClose() {
    if (isDirty) {
      const confirmed = await showConfirm(
        t('products.detail.unsavedChangesConfirm', { defaultValue: 'Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất những thay đổi đó. Tiếp tục?' }),
        t('products.detail.unsavedChangesTitle', { defaultValue: 'Có thay đổi chưa lưu' }),
      )
      if (!confirmed) return
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

  return (
    <div className="bb-proto">
      <Screen maxWidth="1200px">
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
              {isReadOnly && (
                <span className="bb-badge bb-badge-warning">
                  <Lock size={11} />
                  {t('content.detail.readOnlyBadge', { defaultValue: 'Chỉ đọc' })}
                </span>
              )}
            </span>
          }
          actions={
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label={t('content.detail.backToList')}
              data-screen-close="true"
            >
              <X size={18} />
            </Button>
          }
        />

        {/* Banners — read-only */}
        {!canUpdate && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-color-status-warning-bg)] border border-[var(--admin-color-status-warning-border)] text-[var(--admin-color-status-warning-text)] text-sm">
            <Lock size={16} />
            <span>{t('content.detail.permissionDesc')}</span>
          </div>
        )}

        {state.warning && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-color-status-warning-bg)] border border-[var(--admin-color-status-warning-border)] text-[var(--admin-color-status-warning-text)] text-sm">
            <AlertCircle size={16} />
            <div className="flex-1">{state.warning}</div>
          </div>
        )}

        {draftRecovery && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-xs">
            <Save size={14} className="shrink-0" />
            <span className="flex-1 truncate">
              <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
              {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
            </span>
            <button
              type="button"
              className="text-xs font-semibold underline hover:no-underline"
              onClick={() => { setForm(draftRecovery.form); setEnSlugManuallyEdited(Boolean(draftRecovery.form?.translations?.en?.slug)); setDraftRecovery(null) }}
            >
              {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
            </button>
            <button
              type="button"
              className="text-xs opacity-70 hover:opacity-100"
              onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
            >
              {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
            </button>
          </div>
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

        <form
          ref={formRef}
          className="flex flex-col gap-6 pb-4"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
              handleSubmit(e)
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field full label={isEnLang ? t('content.detail.title') : requiredLabel(t('content.detail.title'))} error={!isEnLang ? validationErrors.title : undefined} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                    <Input
                      value={isEnLang ? (form.translations?.en?.title ?? '') : form.title}
                      onChange={(e) => isEnLang ? (isArticle ? handleEnTitleChange(e.target.value) : updateTranslation('title', e.target.value)) : updateField('title', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={isEnLang ? t('content.detail.titlePlaceholderEn') : undefined}
                    />
                  </Field>

                  {/* Đường dẫn URL theo ngôn ngữ — slug tiếng Anh CHỈ cho BÀI VIẾT (ARTICLE_RULE_003);
                      trang tĩnh giữ slug cố định (PAGE_RULE_003) nên luôn hiện slug tiếng Việt. */}
                  {isEnLang && isArticle ? (
                    <Field
                      full
                      label={t('content.detail.slug')}
                      error={validationErrors['translations.en.slug']}
                      hint={t('content.detail.slugHintEn', { defaultValue: 'Đường dẫn tiếng Anh (tùy chọn) — để trống sẽ dùng đường dẫn tiếng Việt.' })}
                    >
                      <Input
                        value={form.translations?.en?.slug ?? ''}
                        onChange={(e) => handleEnSlugChange(e.target.value)}
                        disabled={isReadOnly}
                        placeholder={t('content.detail.slugPlaceholderEn', { defaultValue: 'english-url-slug' })}
                        className="font-mono"
                      />
                    </Field>
                  ) : (
                    <Field full label={requiredLabel(t('content.detail.slug'))} error={validationErrors.slug}>
                      <Input
                        value={form.slug}
                        onChange={(e) => updateField('slug', e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono"
                      />
                    </Field>
                  )}

                  {!isArticle && (
                    <Field label={t('content.detail.pageType')} error={validationErrors.pageType}>
                      <Input
                        value={form.pageType}
                        onChange={(e) => updateField('pageType', e.target.value)}
                        disabled={isReadOnly || !isCreate}
                      />
                    </Field>
                  )}

                  {isArticle && (
                    <Field label={t('content.detail.category', { defaultValue: 'Danh mục' })}>
                      {/* Radix Select emits a spurious onValueChange('') while its async option
                          list settles on load, which would wipe a pre-selected category. Ignore
                          empty fires — this dropdown has no "clear" item, so '' is never a real pick. */}
                      <Select value={form.categoryId} onValueChange={(val) => { if (val) updateField('categoryId', val) }} disabled={isReadOnly}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('content.detail.categoryPlaceholder', { defaultValue: 'Chọn danh mục...' })}>
                            {selectedCategoryLabel}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {isArticle && (
                    <Field full label={t('content.detail.excerpt')} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                      <Textarea
                        value={isEnLang ? (form.translations?.en?.excerpt ?? '') : form.excerpt}
                        onChange={(e) => isEnLang ? updateTranslation('excerpt', e.target.value) : updateField('excerpt', e.target.value)}
                        disabled={isReadOnly}
                      />
                    </Field>
                  )}
                </div>
              </SectionCard>

              {/* ── Card: Nội dung chính ── */}
              <SectionCard title={t('content.detail.sectionBody', { defaultValue: 'Nội dung chính' })} required>
                {isEnLang ? (
                  <RichTextEditor
                    key={`body-${contentLang}`}
                    value={form.translations?.en?.body ?? ''}
                    onChange={(html) => updateTranslation('body', html)}
                    placeholder={t('content.detail.bodyPlaceholder', { defaultValue: 'Nhập nội dung...' })}
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
                {!isEnLang && validationErrors.bodyBlocks && (
                  <span className="text-xs text-[var(--admin-color-status-danger-text)] font-semibold mt-2 block">
                    {validationErrors.bodyBlocks}
                  </span>
                )}
              </SectionCard>

              {/* ── Card: Hình ảnh — article gallery / page hero ── */}
              <SectionCard title={t('content.detail.sectionMedia')}>
                {isArticle ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field full label={t('content.detail.coverImageUrl')} hint={t('content.detail.coverImageUrlHint')}>
                      <ImageUrlInput
                        value={form.coverImageUrl}
                        onChange={(url) => updateField('coverImageUrl', url)}
                        alt={form.coverImageAlt}
                        onAltChange={(v) => updateField('coverImageAlt', v)}
                        disabled={isReadOnly}
                        error={validationErrors.coverImageUrl}
                        recommend={IMAGE_RECO.cover}
                      />
                    </Field>
                    <Field full label={t('content.detail.productImageUrl', { defaultValue: 'Ảnh sản phẩm (overlay carousel)' })} hint={t('content.detail.productImageUrlHint', { defaultValue: 'Ảnh PNG nền trong hiển thị chồng lên ảnh bìa trong carousel Góc Trải Nghiệm ở trang chủ.' })}>
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
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2 mb-4 p-3 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-sm">
                      <Info size={14} className="mt-0.5 shrink-0" />
                      <span>{t('content.detail.heroHint', { defaultValue: 'Khối ảnh + tiêu đề lớn hiển thị đầu trang. Để trống ảnh nếu chưa có — trang sẽ rơi về nền mặc định.' })}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field full label={t('content.detail.heroImage', { defaultValue: 'Ảnh hero' })}>
                        <ImageUrlInput
                          value={form.heroImageUrl}
                          onChange={(url) => updateField('heroImageUrl', url)}
                          disabled={isReadOnly}
                          error={validationErrors['heroImage.url']}
                          recommend={IMAGE_RECO.bannerWide}
                        />
                      </Field>
                      <Field label={t('content.detail.heroTitle', { defaultValue: 'Tiêu đề hero' })} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                        <Input
                          value={isEnLang ? (form.translations?.en?.heroTitle ?? '') : form.heroTitle}
                          onChange={(e) => isEnLang ? updateTranslation('heroTitle', e.target.value) : updateField('heroTitle', e.target.value)}
                          disabled={isReadOnly}
                          placeholder={t('content.detail.heroTitlePlaceholder', { defaultValue: 'Để trống nếu muốn dùng tên trang' })}
                          maxLength={256}
                        />
                      </Field>
                    </div>
                  </>
                )}
              </SectionCard>
            </>
          )}

          {activeTab === 'seo' && (
            <>
              {/* ── Card: SEO ── */}
              <SectionCard title={t('content.detail.sectionSeo')}>
                {/* Live Google SERP preview */}
                <div className="mb-4 p-3 border border-border bg-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Search size={12} />
                    <span>{t('content.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
                  </div>
                  <div className="text-xs text-[#5f6368] break-all mb-1">
                    {(() => {
                      const canonical = form.seoCanonicalUrl?.trim()
                      if (!canonical) {
                        return <>https://bigbike.vn<span className="text-[#70757a]"> › {isArticle ? 'tin-tuc' : 'trang'} › {form.slug || 'duong-dan'}</span></>
                      }
                      try {
                        const u = new URL(canonical)
                        const parts = u.pathname.split('/').filter(Boolean)
                        return <>{u.hostname}{parts.length > 0 && <span className="text-[#70757a]">{' › ' + parts.join(' › ')}</span>}</>
                      } catch {
                        return <>{canonical}</>
                      }
                    })()}
                  </div>
                  <div className="text-lg leading-snug text-[#1a0dab] break-words mb-1">
                    {(langValue('seoTitle') || form.title || t('content.detail.serpTitleFallback', { defaultValue: 'Tiêu đề trên Google' })).slice(0, 60)}
                  </div>
                  <div className="text-sm leading-relaxed text-[#4d5156] break-words">
                    {langValue('seoDescription') || form.excerpt || t('content.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn sẽ hiển thị ở đây.' })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}
                    count={`${langValue('seoTitle').length} / 255`}
                    countWarn={langValue('seoTitle').length > 230}
                    error={!isEnLang ? validationErrors.seoTitle : undefined}
                    hint={isEnLang ? t('content.detail.enFieldHint') : undefined}
                  >
                    <Input
                      value={isEnLang ? (form.translations?.en?.seoTitle ?? '') : form.seoTitle}
                      onChange={(e) => isEnLang ? updateTranslation('seoTitle', e.target.value) : updateField('seoTitle', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={form.title || t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}
                    />
                  </Field>

                  <Field
                    full
                    label={t('content.detail.seoDescription', { defaultValue: 'Mô tả SEO' })}
                    count={`${langValue('seoDescription').length} / 5000`}
                    countWarn={langValue('seoDescription').length > 4500}
                    error={!isEnLang ? validationErrors.seoDescription : undefined}
                    hint={isEnLang ? t('content.detail.enFieldHint') : undefined}
                  >
                    <Textarea
                      value={isEnLang ? (form.translations?.en?.seoDescription ?? '') : form.seoDescription}
                      onChange={(e) => isEnLang ? updateTranslation('seoDescription', e.target.value) : updateField('seoDescription', e.target.value)}
                      disabled={isReadOnly}
                      rows={3}
                      className={!isEnLang && validationErrors.seoDescription ? 'border-danger' : undefined}
                    />
                  </Field>

                  <Field full label={t('content.detail.seoCanonicalUrl', { defaultValue: 'URL canonical' })} error={validationErrors.seoCanonicalUrl}>
                    <Input
                      value={form.seoCanonicalUrl}
                      onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="https://bigbike.vn/..."
                      className={validationErrors.seoCanonicalUrl ? 'border-danger' : undefined}
                    />
                  </Field>

                  <Field
                    full
                    label={t('content.detail.seoOgImageUrl', { defaultValue: 'SEO OG image URL' })}
                    hint={t('content.detail.seoOgImageUrlHint', { defaultValue: 'Ảnh chia sẻ MXH, 1200×630px.' })}
                    error={validationErrors.seoOgImageUrl}
                  >
                    <ImageUrlInput
                      value={form.seoOgImageUrl}
                      onChange={(url) => updateField('seoOgImageUrl', url)}
                      alt={form.seoOgImageAlt}
                      onAltChange={(alt) => updateField('seoOgImageAlt', alt)}
                      disabled={isReadOnly}
                      error={validationErrors['seoOgImageUrl']}
                      recommend={IMAGE_RECO.cover}
                    />
                  </Field>
                </div>

                {/* noindex toggle — chỉ bài viết */}
                {isArticle && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    <label className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                      <Checkbox
                        checked={form.seoNoIndex}
                        onCheckedChange={(checked) => updateField('seoNoIndex', checked === true)}
                        disabled={isReadOnly}
                      />
                      <span>{t('content.detail.seoNoIndex')}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">{t('content.detail.seoNoIndexHint')}</span>
                  </div>
                )}

                {/* SEO checklist */}
                <div className="mt-4 p-3 border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Check size={14} />
                      {t('content.detail.seoChecklist', { defaultValue: 'Checklist SEO' })}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--admin-color-status-success-text)]">
                      {seoPassed} / {seoChecks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-3">
                    {seoChecks.map((c, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-xs', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                        <span className={cn(
                          'w-4 h-4 flex items-center justify-center',
                          c.ok
                            ? 'bg-[var(--admin-color-status-success-bg)] text-[var(--admin-color-status-success-text)]'
                            : 'bg-muted',
                        )}>
                          {c.ok ? <Check size={11} /> : null}
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

              {/* ── Card: Hiển thị ── */}
              <SectionCard title={t('content.detail.sectionPublish', { defaultValue: 'Hiển thị' })} required>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!isArticle && form.parentId !== undefined && (
                    <Field label={t('content.detail.parentPage')}>
                      <Select
                        value={form.parentId ? form.parentId : '__none__'}
                        onValueChange={(val) => updateField('parentId', val === '__none__' ? '' : val)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('content.detail.parentPageNone')}</SelectItem>
                          {parentPageOptions.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.title || `/${p.slug}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  <Field label={t('content.detail.publishStatus')} error={validationErrors.publishStatus}>
                    <Select value={form.publishStatus} onValueChange={(val) => updateField('publishStatus', val)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {publishOptions.map((status) => (
                          <SelectItem key={status} value={status}>{t(`status.publish.${status}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {isArticle && (
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                        <Checkbox
                          checked={form.featured}
                          onCheckedChange={(checked) => updateField('featured', checked === true)}
                          disabled={isReadOnly}
                        />
                        <span>{t('content.detail.featured')}</span>
                      </label>
                      <span className="text-xs text-muted-foreground">{t('content.detail.featuredHint')}</span>
                    </div>
                  )}
                </div>
              </SectionCard>
            </>
          )}
        </form>

        <StickyActionBar
          info={
            <span className="flex items-center gap-2 text-sm">
              <span className={cn('w-2 h-2 rounded-full', saveDotClass)} />
              <span className="font-medium">{saveLabel}</span>
            </span>
          }
        >
          {isArticle && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setPreviewOpen(true)}
              title={t('content.detail.preview.title', { defaultValue: 'Xem trước bài viết' })}
            >
              <Eye size={14} className="mr-1.5" />
              {t('content.detail.preview.open', { defaultValue: 'Xem trước' })}
            </Button>
          )}
          {!isCreate && canUpdate && (
            <Button
              variant="outline"
              type="button"
              disabled={isSubmitting}
              onClick={handleArchive}
              className="text-[var(--admin-color-status-danger-text)]"
            >
              <Trash2 size={14} className="mr-1.5" />
              {t('content.detail.archiveBtn')}
            </Button>
          )}
          <Button
            type="button"
            disabled={isReadOnly || (!isCreate && !isDirty)}
            onClick={handleSubmit}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {primaryLabel}
          </Button>
        </StickyActionBar>

        {isArticle && (
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
      </Screen>
    </div>
  )
}
