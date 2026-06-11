import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, Check, Info, Loader2, Lock, Save, Search, Trash2, Users, X } from 'lucide-react'
import {
  createContent,
  deleteContent,
  fetchContentCategories,
  fetchContentDetail,

  mapValidationErrors,
  updateContent,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { useContentLang } from '../lib/contentLang'
import { createContentSchema, zodErrors } from '../lib/schemas'
import { RichTextEditor } from '../components/RichTextEditor'
import { BlockEditor } from '../components/BlockEditor'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { StatePanel } from '../components/StatePanel'
import { Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn, generateId } from '@/lib/utils'

function findOptionById(items, id) {
  if (!id) return null
  return (items || []).find((item) => item?.id === id) || null
}

function prependSelectedOption(items, selected) {
  if (!selected?.id || findOptionById(items, selected.id)) return items
  return [selected, ...items]
}

function normalizeContentType(value) {
  return String(value || '').toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE'
}

function mutationPath(contentType) {
  return normalizeContentType(contentType) === 'PAGE' ? 'pages' : 'articles'
}

// Validation-error field prefixes per section key — single source of truth
// for derived `sectionErrors` and tab-error counts.
const SECTION_FIELD_PREFIXES = {
  basic:   ['title', 'slug', 'pageType', 'categoryId', 'excerpt'],
  body:    ['body', 'bodyBlocks'],
  media:   ['coverImageUrl', 'heroImage'],
  seo:     ['seoTitle', 'seoDescription', 'seoCanonicalUrl', 'seoOgImageUrl'],
  publish: ['publishStatus'],
}

// Group the 5 sections into 2 fixed tabs to mirror writer vs publisher workflows.
const TAB_SECTIONS = {
  content: ['basic', 'body', 'media'],
  seo:     ['seo', 'publish'],
}

function computeSectionErrorsFromMap(errors) {
  const keys = Object.keys(errors)
  const result = {}
  for (const [section, prefixes] of Object.entries(SECTION_FIELD_PREFIXES)) {
    result[section] = prefixes.some((p) => keys.some((k) => k === p || k.startsWith(p + '.')))
  }
  return result
}

function findTabForErrors(sectionErrors) {
  for (const [tab, keys] of Object.entries(TAB_SECTIONS)) {
    if (keys.some((k) => sectionErrors[k])) return tab
  }
  return null
}

// Map publishStatus → matching .bb-badge variant. Used in ScreenHeader.
function publishBadgeClass(status) {
  switch (status) {
    case 'PUBLISHED': return 'bb-badge bb-badge-success'
    case 'DRAFT':     return 'bb-badge bb-badge-neutral'
    case 'HIDDEN':    return 'bb-badge bb-badge-warning'
    case 'TRASH':     return 'bb-badge bb-badge-danger'
    default:          return 'bb-badge bb-badge-neutral'
  }
}

function ContentAssignmentBanner({ t }) {
  return (
    <div className="px-4 py-3 bg-surface-muted border-b border-border">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users size={12} />
        <span>{t('content.detail.assign.title', { defaultValue: 'Phân công bài viết' })}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {t('content.detail.assign.roleContent', { defaultValue: 'Content' })}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {t('content.detail.assign.itemsContent', { defaultValue: 'Tiêu đề · Ảnh đại diện · Nội dung chính · Tags & danh mục · Liên kết sản phẩm' })}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-status-warning-text)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {t('content.detail.assign.roleSeo', { defaultValue: 'SEO' })}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {t('content.detail.assign.itemsSeo', { defaultValue: 'Tiêu đề SEO · Meta description · Slug · OG image · Kiểm tra trước khi đăng' })}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-text-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {t('content.detail.assign.roleManager', { defaultValue: 'Quản lý' })}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {t('content.detail.assign.itemsManager', { defaultValue: 'Phê duyệt · Đăng bài · Ẩn / xóa bài' })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Section card wrapper — matches the same shape used in ProductDetailScreen.
// Required sections get a subtle red asterisk after the title instead of a loud "BẮT BUỘC" badge.
function SectionCard({ title, badge, required, children }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header">
        <h2>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-status-danger-text)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h2>
        {badge}
      </div>
      <div className="bb-card-body">{children}</div>
    </div>
  )
}

// Field shell — pass `full` to span both grid columns.
function Field({ label, hint, error, count, countWarn, full, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {(label || count != null) && (
        <div className="flex items-center justify-between">
          {label && <label className="text-sm font-medium text-foreground/80">{label}</label>}
          {count != null && (
            <span className={cn('text-xs tabular-nums text-muted-foreground', countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold')}>
              {count}
            </span>
          )}
        </div>
      )}
      {children}
      {error
        ? <span className="text-xs text-[var(--admin-color-status-danger-text)] font-semibold">{error}</span>
        : hint
          ? <span className="text-xs text-muted-foreground">{hint}</span>
          : null}
    </div>
  )
}

function buildEmptyForm(contentType) {
  return {
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    publishStatus: 'DRAFT',
    pageType: 'CUSTOM',
    categoryId: '',
    parentId: '',
    coverImageUrl: '',
    coverImageAlt: '',
    productImageUrl: '',
    productImageAlt: '',
    bodyBlocks: null,
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    heroImageUrl: '',
    heroImageAlt: '',
    heroTitle: '',
    heroDescription: '',
    heroKicker: '',
    type: normalizeContentType(contentType),
    translations: {
      en: { title: '', excerpt: '', body: '', seoTitle: '', seoDescription: '', heroTitle: '', heroDescription: '', heroKicker: '' },
    },
  }
}

function buildFormFromItem(contentType, item) {
  const fallback = buildEmptyForm(contentType)
  if (!item) return fallback
  return {
    ...fallback,
    slug: item.slug || '',
    title: item.title || '',
    excerpt: item.excerpt || '',
    body: item.body || '',
    publishStatus: item.publishStatus === 'UNKNOWN' ? 'DRAFT' : item.publishStatus,
    pageType: item.pageType || fallback.pageType,
    categoryId: item.categoryId || '',
    parentId: item.parentId || '',
    coverImageUrl: item.coverImage?.url || '',
    coverImageAlt: item.coverImage?.alt || '',
    productImageUrl: item.productImage?.url || '',
    productImageAlt: item.productImage?.alt || '',
    bodyBlocks: Array.isArray(item.bodyBlocks)
      ? item.bodyBlocks.map((b) => (b._key ? b : { ...b, _key: generateId() }))
      : null,
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    heroImageUrl: item.heroImage?.url || '',
    heroImageAlt: item.heroImage?.alt || '',
    heroTitle: item.heroTitle || '',
    heroDescription: item.heroDescription || '',
    heroKicker: item.heroKicker || '',
    type: normalizeContentType(item.type || contentType),
    translations: {
      en: {
        title: item.translations?.en?.title || '',
        excerpt: item.translations?.en?.excerpt || '',
        body: item.translations?.en?.body || '',
        seoTitle: item.translations?.en?.seoTitle || '',
        seoDescription: item.translations?.en?.seoDescription || '',
        heroTitle: item.translations?.en?.heroTitle || '',
        heroDescription: item.translations?.en?.heroDescription || '',
        heroKicker: item.translations?.en?.heroKicker || '',
      },
    },
  }
}

const AUTOSAVE_TTL_MS = 60 * 60 * 1000

function getAutosaveKey(contentType, contentId, isCreate) {
  return `content-autosave:${contentType.toLowerCase()}:${isCreate ? 'new' : contentId}`
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

// Filters out blocks that would fail Bean Validation on the backend (e.g. heading
// with empty text imported from WordPress). Keeps the save working without losing
// real content.
function isBlockValid(block) {
  if (!block || !block.type) return false
  switch (block.type) {
    case 'heading':  return Boolean(block.text && block.text.trim())
    case 'paragraph': return block.html != null
    case 'list':     return Array.isArray(block.items) && block.items.length > 0
    case 'image':    return Boolean(block.url && block.url.trim())
    case 'video':    return Boolean(block.url && block.url.trim())
    case 'callout':  return block.html != null
    default:         return true
  }
}

// P1-001: Always emit fields that can be cleared so backend can distinguish
// "omitted = keep" vs "sent = apply (possibly clear)".
function toPayload(form, isCreate) {
  const payload = {
    slug: form.slug.trim(),
    title: form.title.trim(),
    publishStatus: form.publishStatus,
    // bodyBlocks presence-flag: send when non-null so backend overwrites both body_blocks + body columns.
    // When null (new form, no blocks added yet) omit so backend leaves columns unchanged.
    bodyBlocks: form.bodyBlocks !== null
      ? form.bodyBlocks.map(({ _key: _k, ...rest }) => rest).filter(isBlockValid)
      : undefined,
  }

  if (form.type === 'ARTICLE') {
    payload.excerpt = form.excerpt.trim() || undefined

    // Always send coverImage so clearing a URL removes it on backend
    payload.coverImage = form.coverImageUrl.trim()
      ? { url: form.coverImageUrl.trim(), alt: form.coverImageAlt.trim() || undefined }
      : { url: '' }

    // Always send productImage so clearing a URL removes it on backend
    payload.productImage = form.productImageUrl.trim()
      ? { url: form.productImageUrl.trim(), alt: form.productImageAlt.trim() || undefined }
      : { url: '' }

    // Always send categoryId — empty string clears the category
    payload.categoryId = form.categoryId || ''
  }

  if (form.type === 'PAGE') {
    if (isCreate) {
      payload.pageType = form.pageType.trim()
    }
    // Always send parentId — empty string clears the parent
    payload.parentId = form.parentId || ''

    // Hero — always send so admin can clear by leaving blank.
    // Empty url is accepted by backend (@Pattern allows empty) and treated as "clear".
    payload.heroImage = form.heroImageUrl.trim()
      ? { url: form.heroImageUrl.trim(), alt: form.heroImageAlt.trim() || undefined }
      : { url: '' }
    payload.heroTitle = form.heroTitle.trim() || ''
    payload.heroDescription = form.heroDescription.trim() || ''
    payload.heroKicker = form.heroKicker.trim() || ''
  }

  // Always send seo as non-null object so backend can clear fields when all are empty
  payload.seo = {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    canonicalUrl: form.seoCanonicalUrl.trim() || null,
    ogImage: form.seoOgImageUrl.trim()
      ? { url: form.seoOgImageUrl.trim(), alt: form.seoOgImageAlt.trim() || undefined }
      : null,
  }

  payload.translations = {
    en: {
      title: form.translations?.en?.title?.trim() || null,
      excerpt: form.translations?.en?.excerpt?.trim() || null,
      body: form.translations?.en?.body?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
      heroTitle: form.translations?.en?.heroTitle?.trim() || null,
      heroDescription: form.translations?.en?.heroDescription?.trim() || null,
      heroKicker: form.translations?.en?.heroKicker?.trim() || null,
    },
  }

  return payload
}

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
              onClick={() => { setForm(draftRecovery.form); setDraftRecovery(null) }}
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
        <ContentAssignmentBanner t={t} />

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
                  <Field full label={t('content.detail.title')} error={!isEnLang ? validationErrors.title : undefined} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                    <Input
                      value={isEnLang ? (form.translations?.en?.title ?? '') : form.title}
                      onChange={(e) => isEnLang ? updateTranslation('title', e.target.value) : updateField('title', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={isEnLang ? t('content.detail.titlePlaceholderEn') : undefined}
                    />
                  </Field>

                  <Field full label={t('content.detail.slug')} error={validationErrors.slug}>
                    <Input
                      value={form.slug}
                      onChange={(e) => updateField('slug', e.target.value)}
                      disabled={isReadOnly}
                      className="font-mono"
                    />
                  </Field>

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
                          alt={form.heroImageAlt}
                          onAltChange={(alt) => updateField('heroImageAlt', alt)}
                          disabled={isReadOnly}
                          error={validationErrors['heroImage.url']}
                          recommend={IMAGE_RECO.bannerWide}
                        />
                      </Field>
                      <Field label={t('content.detail.heroKicker', { defaultValue: 'Kicker' })} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                        <Input
                          value={isEnLang ? (form.translations?.en?.heroKicker ?? '') : form.heroKicker}
                          onChange={(e) => isEnLang ? updateTranslation('heroKicker', e.target.value) : updateField('heroKicker', e.target.value)}
                          disabled={isReadOnly}
                          placeholder="vd: GIỚI THIỆU"
                          maxLength={128}
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
                      <Field full label={t('content.detail.heroDescription', { defaultValue: 'Mô tả ngắn dưới tiêu đề' })} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                        <Textarea
                          value={isEnLang ? (form.translations?.en?.heroDescription ?? '') : form.heroDescription}
                          onChange={(e) => isEnLang ? updateTranslation('heroDescription', e.target.value) : updateField('heroDescription', e.target.value)}
                          disabled={isReadOnly}
                          maxLength={1024}
                          rows={2}
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
                    <Field label={t('content.detail.parentPage', { defaultValue: 'Trang cha (parentId)' })}>
                      <Input
                        value={form.parentId}
                        onChange={(e) => updateField('parentId', e.target.value)}
                        disabled={isReadOnly}
                        placeholder={t('content.detail.parentPagePlaceholder', { defaultValue: 'Để trống nếu là trang gốc' })}
                      />
                    </Field>
                  )}
                  <Field label={t('content.detail.publishStatus')} error={validationErrors.publishStatus}>
                    <Select value={form.publishStatus} onValueChange={(val) => updateField('publishStatus', val)} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">{t('status.publish.DRAFT')}</SelectItem>
                        <SelectItem value="PUBLISHED">{t('status.publish.PUBLISHED')}</SelectItem>
                        <SelectItem value="HIDDEN">{t('status.publish.HIDDEN')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
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
      </Screen>
    </div>
  )
}
