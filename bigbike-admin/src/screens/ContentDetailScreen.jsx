import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, Info, Loader2, Lock, Search, Trash2, X } from 'lucide-react'
import {
  createContent,
  deleteContent,
  fetchContentAuthors,
  fetchContentCategories,
  fetchContentDetail,
  fetchProducts,
  mapValidationErrors,
  updateContent,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { createContentSchema, zodErrors } from '../lib/schemas'
import { RichTextEditor } from '../components/RichTextEditor'
import { BlockEditor } from '../components/BlockEditor'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { StatePanel } from '../components/StatePanel'
import { Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function normalizeContentType(value) {
  return String(value || '').toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE'
}

function mutationPath(contentType) {
  return normalizeContentType(contentType) === 'PAGE' ? 'pages' : 'articles'
}

// Validation-error field prefixes per section key — single source of truth
// for derived `sectionErrors` and tab-error counts.
const SECTION_FIELD_PREFIXES = {
  basic:   ['title', 'slug', 'pageType', 'categoryId', 'authorId', 'excerpt'],
  body:    ['body', 'bodyBlocks'],
  media:   ['coverImageUrl', 'productImageUrl', 'heroImage'],
  seo:     ['seoTitle', 'seoDescription', 'seoCanonicalUrl'],
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

// Map publishStatus → matching .badge variant. Used in ScreenHeader.
function publishBadgeClass(status) {
  switch (status) {
    case 'PUBLISHED': return 'badge badge-success'
    case 'DRAFT':     return 'badge badge-neutral'
    case 'HIDDEN':    return 'badge badge-orange'
    case 'TRASH':     return 'badge badge-danger'
    default:          return 'badge badge-neutral'
  }
}

// Section card wrapper — matches the same shape used in ProductDetailScreen.
// Required sections get a subtle red asterisk after the title instead of a loud "BẮT BUỘC" badge.
function SectionCard({ title, badge, required, children }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-brand-red)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h2>
        {badge}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}

// Field shell — pass `full` to span both grid columns.
function Field({ label, hint, error, full, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {label && (
        <label className="text-sm font-medium text-foreground/80">{label}</label>
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
    authorId: '',
    categoryId: '',
    parentId: '',
    coverImageUrl: '',
    coverImageAlt: '',
    productImageUrl: '',
    productImageAlt: '',
    tags: '',
    bodyBlocks: null,
    relatedProductIds: [],
    relatedProductChips: [],
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoNoIndex: false,
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
    authorId: item.authorId || '',
    categoryId: item.categoryId || '',
    parentId: item.parentId || '',
    coverImageUrl: item.coverImage?.url || '',
    coverImageAlt: item.coverImage?.alt || '',
    productImageUrl: item.productImage?.url || '',
    productImageAlt: item.productImage?.alt || '',
    bodyBlocks: Array.isArray(item.bodyBlocks)
      ? item.bodyBlocks.map((b) => (b._key ? b : { ...b, _key: crypto.randomUUID() }))
      : null,
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    relatedProductIds: Array.isArray(item.relatedProducts)
      ? item.relatedProducts.map((p) => p.id).filter(Boolean)
      : [],
    relatedProductChips: Array.isArray(item.relatedProducts)
      ? item.relatedProducts
          .filter((p) => p && p.id)
          .map((p) => ({ id: p.id, name: p.name || p.id, slug: p.slug || '', imageUrl: p.imageUrl || '' }))
      : [],
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
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

function normalizeTagsInput(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
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
      ? form.bodyBlocks.map(({ _key: _k, ...rest }) => rest)
      : undefined,
  }

  if (form.type === 'ARTICLE') {
    payload.excerpt = form.excerpt.trim() || undefined

    // Always send coverImage so clearing a URL removes it on backend
    payload.coverImage = form.coverImageUrl.trim()
      ? { url: form.coverImageUrl.trim(), alt: form.coverImageAlt.trim() || undefined }
      : { url: '' }

    // Always send productImage — empty url explicitly clears it
    payload.productImage = form.productImageUrl.trim()
      ? { url: form.productImageUrl.trim(), alt: form.productImageAlt.trim() || undefined }
      : { url: '' }

    // Always send tags — empty array explicitly clears all tags
    payload.tags = normalizeTagsInput(form.tags)

    // Always send productIds — empty array explicitly clears all linked products
    payload.productIds = Array.isArray(form.relatedProductIds) ? form.relatedProductIds : []

    // Always send authorId — empty string clears the author
    payload.authorId = form.authorId || ''

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
    noIndex: Boolean(form.seoNoIndex),
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
  const queryClient = useQueryClient()
  const normalizedType = normalizeContentType(contentType)
  const [form, setForm] = useState(() => buildEmptyForm(normalizedType))
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify(buildEmptyForm(normalizedType)),
  )
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['content', normalizedType, contentId],
    queryFn: () => fetchContentDetail(normalizedType, contentId),
    enabled: !isCreate,
  })

  // P1-002: Fetch reference data for dropdowns
  const { data: authors = [] } = useQuery({
    queryKey: ['content-reference', 'authors'],
    queryFn: fetchContentAuthors,
    staleTime: 5 * 60 * 1000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['content-reference', 'categories'],
    queryFn: fetchContentCategories,
    staleTime: 5 * 60 * 1000,
  })

  // Product picker for the "Sản phẩm liên quan" field (articles only).
  const [productSearch, setProductSearch] = useState('')
  const [productSearchDebounced, setProductSearchDebounced] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => setProductSearchDebounced(productSearch.trim()), 300)
    return () => clearTimeout(handle)
  }, [productSearch])

  const { data: productSearchResult, isFetching: isSearchingProducts } = useQuery({
    queryKey: ['content-product-search', productSearchDebounced],
    queryFn: () => fetchProducts({ q: productSearchDebounced, pageSize: 8 }),
    enabled: normalizedType === 'ARTICLE' && productSearchDebounced.length >= 1,
    staleTime: 60 * 1000,
  })
  const productSearchItems = productSearchResult?.items ?? []

  useEffect(() => {
    if (!fetchResult) return
    const nextForm = buildFormFromItem(normalizedType, fetchResult.item)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm)
    setInitialSnapshot(JSON.stringify(nextForm))
  }, [fetchResult, normalizedType])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
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
    mutationFn: (payload) => isCreate
      ? createContent(normalizedType, payload)
      : updateContent(normalizedType, contentId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(normalizedType, savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
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

  function addRelatedProduct(product) {
    if (!product?.id) return
    setForm((previous) => {
      if (previous.relatedProductIds.includes(product.id)) return previous
      return {
        ...previous,
        relatedProductIds: [...previous.relatedProductIds, product.id],
        relatedProductChips: [
          ...previous.relatedProductChips,
          {
            id: product.id,
            name: product.name || product.id,
            slug: product.slug || '',
            imageUrl: product.image?.url || product.imageUrl || '',
          },
        ],
      }
    })
    setProductSearch('')
    setProductSearchDebounced('')
  }

  function removeRelatedProduct(productId) {
    setForm((previous) => ({
      ...previous,
      relatedProductIds: previous.relatedProductIds.filter((id) => id !== productId),
      relatedProductChips: previous.relatedProductChips.filter((chip) => chip.id !== productId),
    }))
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

  // ── Content language toggle (VI / EN) ─────────────────────────────────────
  const [contentLang, setContentLang] = useState('vi')
  const isEnLang = contentLang === 'en'

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
                <span className="badge badge-warn">
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

        {/* Banners — read-only + mock-warning */}
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
                badge={
                  <Tabs
                    ariaLabel={t('content.detail.contentLanguageAriaLabel')}
                    value={contentLang}
                    onChange={setContentLang}
                    items={[{ key: 'vi', label: 'VI' }, { key: 'en', label: 'EN' }]}
                  />
                }
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
                    <Field label={t('content.detail.author', { defaultValue: 'Tác giả' })}>
                      <Select value={form.authorId} onValueChange={(val) => updateField('authorId', val)} disabled={isReadOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {authors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {isArticle && (
                    <Field label={t('content.detail.category', { defaultValue: 'Danh mục' })}>
                      <Select value={form.categoryId} onValueChange={(val) => updateField('categoryId', val)} disabled={isReadOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                    <Field full label={t('content.detail.coverImageUrl')}>
                      <ImageUrlInput
                        value={form.coverImageUrl}
                        onChange={(url) => updateField('coverImageUrl', url)}
                        alt={form.coverImageAlt}
                        onAltChange={(v) => updateField('coverImageAlt', v)}
                        disabled={isReadOnly}
                        error={validationErrors.coverImageUrl}
                      />
                    </Field>

                    <Field full label={t('content.detail.productImageUrl')}>
                      <ImageUrlInput
                        value={form.productImageUrl}
                        onChange={(url) => updateField('productImageUrl', url)}
                        alt={form.productImageAlt}
                        onAltChange={(v) => updateField('productImageAlt', v)}
                        disabled={isReadOnly}
                        error={validationErrors.productImageUrl}
                      />
                    </Field>

                    <Field full label={t('content.detail.tags')}>
                      <Input
                        value={form.tags}
                        onChange={(e) => updateField('tags', e.target.value)}
                        disabled={isReadOnly}
                        placeholder={t('content.detail.tagsPlaceholder')}
                      />
                    </Field>

                    <Field full label={t('content.detail.relatedProducts')} hint={t('content.detail.relatedProductsHint')}>
                      {form.relatedProductChips.length > 0 && (
                        <div className="chip-row mt-2">
                          {form.relatedProductChips.map((chip) => (
                            <span key={chip.id} className="chip">
                              {chip.imageUrl && (
                                <img src={chip.imageUrl} alt="" className="w-5 h-5 object-cover" />
                              )}
                              <strong>{chip.name}</strong>
                              {!isReadOnly && (
                                <span
                                  className="x"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => removeRelatedProduct(chip.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') removeRelatedProduct(chip.id) }}
                                  aria-label={t('content.detail.relatedProductsRemove', { name: chip.name })}
                                >×</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {!isReadOnly && (
                        <div className="relative mt-2">
                          <Input
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder={t('content.detail.relatedProductsSearch')}
                          />
                          {productSearchDebounced.length >= 1 && (
                            <div className="row-menu left-0 right-0 min-w-0 max-h-64 overflow-y-auto">
                              {isSearchingProducts ? (
                                <p className="text-sm text-muted-foreground px-2.5 py-2">
                                  {t('content.detail.relatedProductsSearching')}
                                </p>
                              ) : productSearchItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground px-2.5 py-2">
                                  {t('content.detail.relatedProductsEmpty')}
                                </p>
                              ) : (
                                productSearchItems.map((product) => {
                                  const already = form.relatedProductIds.includes(product.id)
                                  return (
                                    <button
                                      key={product.id}
                                      type="button"
                                      disabled={already}
                                      onClick={() => addRelatedProduct(product)}
                                      className={already ? 'opacity-50 cursor-not-allowed' : undefined}
                                    >
                                      {product.image?.url && (
                                        <img src={product.image.url} alt="" className="w-6 h-6 object-cover" />
                                      )}
                                      <span className="flex-1">{product.name}</span>
                                      {already && (
                                        <span className="text-xs text-muted-foreground">{t('content.detail.relatedProductsAdded')}</span>
                                      )}
                                    </button>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}
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
                    <span>{t('products.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
                  </div>
                  <div className="text-xs text-[#5f6368] break-all mb-1">
                    https://bigbike.vn
                    <span className="text-[#70757a]"> › {isArticle ? 'tin-tuc' : 'trang'} › {form.slug || 'duong-dan'}</span>
                  </div>
                  <div className="text-lg leading-snug text-[#1a0dab] break-words mb-1">
                    {(form.seoTitle || form.title || t('products.detail.serpTitleFallback', { defaultValue: 'Tiêu đề trên Google' })).slice(0, 60)}
                  </div>
                  <div className="text-sm leading-relaxed text-[#4d5156] break-words">
                    {form.seoDescription || form.excerpt || t('products.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn sẽ hiển thị ở đây.' })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field full label={t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })} error={!isEnLang ? validationErrors.seoTitle : undefined} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                    <Input
                      value={isEnLang ? (form.translations?.en?.seoTitle ?? '') : form.seoTitle}
                      onChange={(e) => isEnLang ? updateTranslation('seoTitle', e.target.value) : updateField('seoTitle', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={form.title || t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}
                    />
                  </Field>

                  <Field full label={t('content.detail.seoDescription', { defaultValue: 'Mô tả SEO' })} error={!isEnLang ? validationErrors.seoDescription : undefined} hint={isEnLang ? t('content.detail.enFieldHint') : undefined}>
                    <Textarea
                      value={isEnLang ? (form.translations?.en?.seoDescription ?? '') : form.seoDescription}
                      onChange={(e) => isEnLang ? updateTranslation('seoDescription', e.target.value) : updateField('seoDescription', e.target.value)}
                      disabled={isReadOnly}
                      rows={2}
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

                  <label className="md:col-span-2 flex items-start gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={form.seoNoIndex}
                      onCheckedChange={(checked) => updateField('seoNoIndex', checked)}
                      disabled={isReadOnly}
                    />
                    <span>{t('content.detail.seoNoIndex', { defaultValue: 'Không cho công cụ tìm kiếm lập chỉ mục (noindex)' })}</span>
                  </label>
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
