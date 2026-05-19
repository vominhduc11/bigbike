import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertCircle, Check, ChevronDown, ChevronUp, Eye, FileText, Image as ImageIcon,
  Info, Loader2, Maximize2, Minimize2, Search, Trash2, X,
} from 'lucide-react'
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
import { ImageUrlInput } from '../components/ImageUrlInput'
import { StatePanel } from '../components/StatePanel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

function normalizeContentType(value) {
  return String(value || '').toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE'
}

function mutationPath(contentType) {
  return normalizeContentType(contentType) === 'PAGE' ? 'pages' : 'articles'
}

// The 5 form sections (prototype layout). Section 3 ("media") swaps between
// article gallery fields and page hero fields by content type.
const CONTENT_SECTION_DEFS = [
  { id: 'cs-basic',   icon: Info,      labelKey: 'content.detail.sectionCore',    required: true  },
  { id: 'cs-body',    icon: FileText,  labelKey: 'content.detail.body',           required: true  },
  { id: 'cs-media',   icon: ImageIcon, labelKey: 'content.detail.sectionMedia',   required: false },
  { id: 'cs-seo',     icon: Search,    labelKey: 'content.detail.sectionSeo',     required: false },
  { id: 'cs-publish', icon: Eye,       labelKey: 'content.detail.publishStatus',  required: true  },
]

// One collapsible content-form section in the prototype `pf-section` style.
function ContentSection({ def, t, open, done, hasError, onToggle, badge, children }) {
  const Icon = def.icon
  return (
    <div className="pf-section" data-section={def.id} id={def.id}>
      <button type="button" className="pf-section-head" onClick={onToggle}>
        <span className={`pf-section-icon${done ? ' done' : ''}`}>
          {done ? <Check size={14} /> : <Icon size={16} />}
        </span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="pf-section-title">
            {t(def.labelKey)}
            {def.required && !done && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--admin-color-brand-red)' }}>
                {t('products.detail.requiredTag', { defaultValue: 'BẮT BUỘC' })}
              </span>
            )}
            {!def.required && (
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--admin-color-text-muted)' }}>
                {t('products.detail.optionalTag', { defaultValue: '(tuỳ chọn)' })}
              </span>
            )}
          </div>
        </div>
        {done && (
          <span className="badge badge-success" style={{ fontSize: 10 }}>
            <Check size={10} />{t('products.detail.sectionDone', { defaultValue: 'Hoàn thành' })}
          </span>
        )}
        {hasError && <span className="badge badge-danger" style={{ fontSize: 10 }}><AlertCircle size={10} /></span>}
        {badge}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="pf-section-body">{children}</div>}
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
    body: form.body.trim(),
    publishStatus: form.publishStatus,
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
    event.preventDefault()
    if (!canUpdate) return

    const schema = createContentSchema(t, isCreate, normalizedType)
    const result = schema.safeParse(form)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(toPayload(form, isCreate))
  }

  // ── Prototype layout state — collapsible sections + TOC scroll-spy ────────
  const [openMap, setOpenMap] = useState(() => {
    const m = {}
    CONTENT_SECTION_DEFS.forEach((s, i) => { m[s.id] = isCreate ? s.required : i < 2 })
    return m
  })
  const [activeSection, setActiveSection] = useState(CONTENT_SECTION_DEFS[0].id)
  const [savedFlash, setSavedFlash] = useState(false)

  // Scroll-spy — highlight the TOC entry of the section currently in view.
  useEffect(() => {
    const pc = document.querySelector('.page-content')
    if (!pc) return undefined
    const onScroll = () => {
      const sections = pc.querySelectorAll('[data-section]')
      let current = CONTENT_SECTION_DEFS[0].id
      const containerTop = pc.getBoundingClientRect().top
      for (const sec of sections) {
        if (sec.getBoundingClientRect().top - containerTop < 180) current = sec.dataset.section
        else break
      }
      setActiveSection(current)
    }
    onScroll()
    pc.addEventListener('scroll', onScroll, { passive: true })
    return () => pc.removeEventListener('scroll', onScroll)
  }, [])

  function toggleSection(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  function setAllSections(next) {
    setOpenMap(() => {
      const m = {}
      CONTENT_SECTION_DEFS.forEach((s) => { m[s.id] = next })
      return m
    })
  }
  function jumpToSection(id) {
    setOpenMap((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
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

  // Per-section completion — drives TOC ticks + section header badges.
  const completion = {
    'cs-basic': Boolean(form.title.trim() && form.slug.trim()
      && (isArticle ? form.categoryId : form.pageType)),
    'cs-body': (form.body || '').replace(/<[^>]*>/g, '').trim().length >= 30,
    'cs-media': isArticle ? Boolean(form.coverImageUrl) : Boolean(form.heroImageUrl),
    'cs-seo': Boolean(form.seoTitle && form.seoDescription),
    'cs-publish': Boolean(form.publishStatus),
  }
  // Which sections carry a validation error.
  const errKeys = Object.keys(validationErrors)
  const inErr = (prefixes) => prefixes.some((p) => errKeys.some((k) => k === p || k.startsWith(p + '.')))
  const sectionErrors = {
    'cs-basic': inErr(['title', 'slug', 'pageType', 'categoryId', 'authorId', 'excerpt']),
    'cs-body': inErr(['body']),
    'cs-media': inErr(['coverImageUrl', 'productImageUrl', 'heroImage']),
    'cs-seo': inErr(['seoTitle', 'seoDescription', 'seoCanonicalUrl']),
    'cs-publish': inErr(['publishStatus']),
  }
  const requiredDefs = CONTENT_SECTION_DEFS.filter((s) => s.required)
  const optionalDefs = CONTENT_SECTION_DEFS.filter((s) => !s.required)
  const doneRequired = requiredDefs.filter((s) => completion[s.id]).length
  const doneOptional = optionalDefs.filter((s) => completion[s.id]).length
  const allOpen = CONTENT_SECTION_DEFS.every((s) => openMap[s.id])
  const saveDotClass = isSubmitting ? 'saving' : savedFlash ? 'saved-flash' : isDirty ? 'dirty' : 'saved'
  const saveLabel = isSubmitting
    ? t('common.saving')
    : savedFlash ? t('common.clean') : isDirty ? t('common.dirty') : t('common.clean')

  return (
    <div className="pf-screen">
      {/* Read-only banner */}
      {!canUpdate && (
        <div className="pf-readonly-banner">
          <X size={16} />
          <span>{t('content.detail.permissionDesc')}</span>
        </div>
      )}

      {/* Mock-data warning */}
      {state.warning && (
        <div className="pf-restore-banner" style={{ borderColor: 'var(--admin-color-status-warning-border)', background: 'var(--admin-color-status-warning-bg)' }}>
          <AlertCircle size={16} style={{ color: 'var(--admin-color-status-warning-text)' }} />
          <div style={{ flex: 1, fontSize: 13 }}>{state.warning}</div>
        </div>
      )}

      <div className="pf-body-wrap">
        {/* TOC sidebar */}
        <aside className="pf-toc">
          <div className="pf-toc-head">
            <div className="pf-toc-head-row">
              <div>
                <div className="pf-toc-head-title">{t('products.detail.tocProgress', { defaultValue: 'Tiến độ' })}</div>
                <div className="pf-toc-head-meta">
                  <strong>{doneRequired}/{requiredDefs.length}</strong>{' '}
                  {t('products.detail.tocRequired', { defaultValue: 'bắt buộc' })}
                  {' · '}{doneOptional}/{optionalDefs.length}{' '}
                  {t('products.detail.tocOptional', { defaultValue: 'tuỳ chọn' })}
                </div>
              </div>
              <button
                type="button"
                className="pf-toc-toggle-all"
                title={allOpen
                  ? t('products.detail.tocCollapseAll', { defaultValue: 'Đóng tất cả' })
                  : t('products.detail.tocExpandAll', { defaultValue: 'Mở tất cả' })}
                onClick={() => setAllSections(!allOpen)}
              >
                {allOpen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>
            <div className="pf-toc-progress">
              <div style={{ width: `${(doneRequired / requiredDefs.length) * 100}%` }} />
            </div>
          </div>

          <nav className="pf-toc-nav">
            {CONTENT_SECTION_DEFS.map((def) => {
              const Icon = def.icon
              const done = completion[def.id]
              const hasError = sectionErrors[def.id]
              return (
                <button
                  key={def.id}
                  type="button"
                  className={`pf-toc-item${done ? ' done' : ''}${hasError ? ' error' : ''}${activeSection === def.id ? ' active' : ''}`}
                  onClick={() => jumpToSection(def.id)}
                >
                  <span className="pf-toc-icon">
                    {hasError ? <AlertCircle size={13} /> : done ? <Check size={13} /> : <Icon size={13} />}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{t(def.labelKey)}</span>
                  {def.required && !done && !hasError && (
                    <span className="pf-toc-req" title={t('products.detail.tocRequired', { defaultValue: 'bắt buộc' })}>*</span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="pf-toc-save">
            <div className="pf-toc-save-status">
              <span className={`pf-dot ${saveDotClass}`} />
              <span>{saveLabel}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm pf-toc-primary"
              onClick={handleSubmit}
              disabled={isReadOnly || !isDirty}
            >
              {isSubmitting ? <span className="pf-spin"><Loader2 size={13} /></span> : <Check size={13} />}
              {isCreate
                ? t(isArticle ? 'content.detail.createArticleBtn' : 'content.detail.createPageBtn')
                : t('content.detail.saveBtn')}
            </button>
            <div className="pf-toc-secondary">
              {!isCreate && canUpdate && (
                <button
                  type="button"
                  className="pf-toc-icon-btn"
                  disabled={isSubmitting}
                  onClick={async () => {
                    const confirmed = await showConfirm(
                      t('content.detail.archiveConfirm'),
                      t('content.detail.archiveConfirmTitle'),
                    )
                    if (!confirmed) return
                    setIsSubmitting(true)
                    archiveMutation.mutate()
                  }}
                >
                  <Trash2 size={13} /><span>{t('content.detail.archiveBtn')}</span>
                </button>
              )}
              <button
                type="button"
                className="pf-toc-icon-btn"
                disabled={isSubmitting}
                onClick={() => navigate('/admin/content')}
              >
                <X size={13} /><span>{t('content.detail.backToList')}</span>
              </button>
            </div>
            <div className="pf-toc-kbd-hint">
              <kbd>⌘</kbd>+<kbd>↵</kbd> {t('products.detail.saveShortcutHint', { defaultValue: 'lưu nhanh' })}
            </div>
          </div>
        </aside>

        {/* Form sections */}
        <form
          ref={formRef}
          className="pf-body"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
              handleSubmit(e)
            }
          }}
        >
          {/* ── Section 1: Thông tin cơ bản ── */}
          <ContentSection
            def={CONTENT_SECTION_DEFS[0]}
            t={t}
            open={openMap['cs-basic']}
            done={completion['cs-basic']}
            hasError={sectionErrors['cs-basic']}
            onToggle={() => toggleSection('cs-basic')}
          >
            <div className="pf-grid">
              <div className="pf-field full">
                <div className="pf-field-label"><span>{t('content.detail.title')}</span></div>
                <Input value={form.title} onChange={(e) => updateField('title', e.target.value)} disabled={isReadOnly} />
                {validationErrors.title && <span className="pf-field-msg pf-field-msg-error">{validationErrors.title}</span>}
              </div>

              <div className="pf-field full">
                <div className="pf-field-label"><span>{t('content.detail.slug')}</span></div>
                <Input
                  value={form.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  disabled={isReadOnly}
                  style={{ fontFamily: 'var(--admin-font-mono)' }}
                />
                {validationErrors.slug && <span className="pf-field-msg pf-field-msg-error">{validationErrors.slug}</span>}
              </div>

              {!isArticle && (
                <div className="pf-field">
                  <div className="pf-field-label"><span>{t('content.detail.pageType')}</span></div>
                  <Input
                    value={form.pageType}
                    onChange={(e) => updateField('pageType', e.target.value)}
                    disabled={isReadOnly || !isCreate}
                  />
                  {validationErrors.pageType && <span className="pf-field-msg pf-field-msg-error">{validationErrors.pageType}</span>}
                </div>
              )}

              {isArticle && (
                <div className="pf-field">
                  <div className="pf-field-label"><span>{t('content.detail.author', { defaultValue: 'Tác giả' })}</span></div>
                  <Select value={form.authorId} onValueChange={(val) => updateField('authorId', val)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {authors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isArticle && (
                <div className="pf-field">
                  <div className="pf-field-label"><span>{t('content.detail.category', { defaultValue: 'Danh mục' })}</span></div>
                  <Select value={form.categoryId} onValueChange={(val) => updateField('categoryId', val)} disabled={isReadOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isArticle && (
                <div className="pf-field full">
                  <div className="pf-field-label"><span>{t('content.detail.excerpt')}</span></div>
                  <Textarea value={form.excerpt} onChange={(e) => updateField('excerpt', e.target.value)} disabled={isReadOnly} />
                </div>
              )}
            </div>
          </ContentSection>

          {/* ── Section 2: Nội dung ── */}
          <ContentSection
            def={CONTENT_SECTION_DEFS[1]}
            t={t}
            open={openMap['cs-body']}
            done={completion['cs-body']}
            hasError={sectionErrors['cs-body']}
            onToggle={() => toggleSection('cs-body')}
          >
            <div style={{ paddingTop: 12 }}>
              <RichTextEditor
                value={form.body}
                onChange={(html) => updateField('body', html)}
                placeholder={t('content.detail.bodyPlaceholder', { defaultValue: 'Nhập nội dung...' })}
                disabled={isReadOnly}
                hasError={Boolean(validationErrors.body)}
                enableImagePicker
              />
              {validationErrors.body && <span className="pf-field-msg pf-field-msg-error">{validationErrors.body}</span>}
            </div>
          </ContentSection>

          {/* ── Section 3: Hình ảnh — article gallery / page hero ── */}
          <ContentSection
            def={CONTENT_SECTION_DEFS[2]}
            t={t}
            open={openMap['cs-media']}
            done={completion['cs-media']}
            hasError={sectionErrors['cs-media']}
            onToggle={() => toggleSection('cs-media')}
          >
            {isArticle ? (
              <div className="pf-grid">
                <div className="pf-field full">
                  <div className="pf-field-label" style={{ marginBottom: 6 }}><span>{t('content.detail.coverImageUrl')}</span></div>
                  <ImageUrlInput
                    value={form.coverImageUrl}
                    onChange={(url) => updateField('coverImageUrl', url)}
                    alt={form.coverImageAlt}
                    onAltChange={(v) => updateField('coverImageAlt', v)}
                    disabled={isReadOnly}
                    error={validationErrors.coverImageUrl}
                  />
                </div>

                <div className="pf-field full">
                  <div className="pf-field-label" style={{ marginBottom: 6 }}><span>{t('content.detail.productImageUrl')}</span></div>
                  <ImageUrlInput
                    value={form.productImageUrl}
                    onChange={(url) => updateField('productImageUrl', url)}
                    alt={form.productImageAlt}
                    onAltChange={(v) => updateField('productImageAlt', v)}
                    disabled={isReadOnly}
                    error={validationErrors.productImageUrl}
                  />
                </div>

                <div className="pf-field full">
                  <div className="pf-field-label"><span>{t('content.detail.tags')}</span></div>
                  <Input
                    value={form.tags}
                    onChange={(e) => updateField('tags', e.target.value)}
                    disabled={isReadOnly}
                    placeholder={t('content.detail.tagsPlaceholder')}
                  />
                </div>

                <div className="pf-field full">
                  <div className="pf-field-label"><span>{t('content.detail.relatedProducts')}</span></div>
                  <span className="pf-field-msg pf-field-hint">{t('content.detail.relatedProductsHint')}</span>

                  {form.relatedProductChips.length > 0 && (
                    <div className="chip-row" style={{ marginTop: 8 }}>
                      {form.relatedProductChips.map((chip) => (
                        <span key={chip.id} className="chip">
                          {chip.imageUrl && (
                            <img src={chip.imageUrl} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 3 }} />
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
                    <div style={{ position: 'relative', marginTop: 8 }}>
                      <Input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder={t('content.detail.relatedProductsSearch')}
                      />
                      {productSearchDebounced.length >= 1 && (
                        <div
                          className="row-menu"
                          style={{ left: 0, right: 0, minWidth: 0, maxHeight: 256, overflowY: 'auto' }}
                        >
                          {isSearchingProducts ? (
                            <p className="text-sm muted" style={{ padding: '8px 10px' }}>
                              {t('content.detail.relatedProductsSearching')}
                            </p>
                          ) : productSearchItems.length === 0 ? (
                            <p className="text-sm muted" style={{ padding: '8px 10px' }}>
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
                                  style={already ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                                >
                                  {product.image?.url && (
                                    <img src={product.image.url} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4 }} />
                                  )}
                                  <span style={{ flex: 1 }}>{product.name}</span>
                                  {already && (
                                    <span className="text-xs muted">{t('content.detail.relatedProductsAdded')}</span>
                                  )}
                                </button>
                              )
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="pf-note pf-note-info">
                  <Info size={14} />
                  <span>{t('content.detail.heroHint', { defaultValue: 'Khối ảnh + tiêu đề lớn hiển thị đầu trang. Để trống ảnh nếu chưa có — trang sẽ rơi về nền mặc định.' })}</span>
                </div>
                <div className="pf-grid">
                  <div className="pf-field full">
                    <div className="pf-field-label" style={{ marginBottom: 6 }}><span>{t('content.detail.heroImage', { defaultValue: 'Ảnh hero' })}</span></div>
                    <ImageUrlInput
                      value={form.heroImageUrl}
                      onChange={(url) => updateField('heroImageUrl', url)}
                      alt={form.heroImageAlt}
                      onAltChange={(alt) => updateField('heroImageAlt', alt)}
                      disabled={isReadOnly}
                      error={validationErrors['heroImage.url']}
                    />
                  </div>
                  <div className="pf-field">
                    <div className="pf-field-label"><span>{t('content.detail.heroKicker', { defaultValue: 'Kicker' })}</span></div>
                    <Input
                      value={form.heroKicker}
                      onChange={(e) => updateField('heroKicker', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="vd: GIỚI THIỆU"
                      maxLength={128}
                    />
                  </div>
                  <div className="pf-field">
                    <div className="pf-field-label"><span>{t('content.detail.heroTitle', { defaultValue: 'Tiêu đề hero' })}</span></div>
                    <Input
                      value={form.heroTitle}
                      onChange={(e) => updateField('heroTitle', e.target.value)}
                      disabled={isReadOnly}
                      placeholder={t('content.detail.heroTitlePlaceholder', { defaultValue: 'Để trống nếu muốn dùng tên trang' })}
                      maxLength={256}
                    />
                  </div>
                  <div className="pf-field full">
                    <div className="pf-field-label"><span>{t('content.detail.heroDescription', { defaultValue: 'Mô tả ngắn dưới tiêu đề' })}</span></div>
                    <Textarea
                      value={form.heroDescription}
                      onChange={(e) => updateField('heroDescription', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={1024}
                      rows={2}
                    />
                  </div>
                </div>
              </>
            )}
          </ContentSection>

          {/* ── Section 4: SEO ── */}
          <ContentSection
            def={CONTENT_SECTION_DEFS[3]}
            t={t}
            open={openMap['cs-seo']}
            done={completion['cs-seo']}
            hasError={sectionErrors['cs-seo']}
            onToggle={() => toggleSection('cs-seo')}
          >
            {/* Live Google SERP preview */}
            <div className="pf-serp" style={{ marginTop: 12 }}>
              <div className="pf-serp-label">
                <Search size={12} /><span>{t('products.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
              </div>
              <div className="pf-serp-url">
                https://bigbike.vn
                <span className="pf-serp-slug-path"> › {isArticle ? 'tin-tuc' : 'trang'} › {form.slug || 'duong-dan'}</span>
              </div>
              <div className="pf-serp-title">
                {(form.seoTitle || form.title || t('products.detail.serpTitleFallback', { defaultValue: 'Tiêu đề trên Google' })).slice(0, 60)}
              </div>
              <div className="pf-serp-desc">
                {form.seoDescription || form.excerpt || t('products.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn sẽ hiển thị ở đây.' })}
              </div>
            </div>

            <div className="pf-grid">
              <div className="pf-field full">
                <div className="pf-field-label"><span>{t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}</span></div>
                <Input
                  value={form.seoTitle}
                  onChange={(e) => updateField('seoTitle', e.target.value)}
                  disabled={isReadOnly}
                  placeholder={form.title || t('content.detail.seoTitle', { defaultValue: 'Tiêu đề SEO' })}
                />
                {validationErrors.seoTitle && <span className="pf-field-msg pf-field-msg-error">{validationErrors.seoTitle}</span>}
              </div>
              <div className="pf-field full">
                <div className="pf-field-label"><span>{t('content.detail.seoDescription', { defaultValue: 'Mô tả SEO' })}</span></div>
                <Textarea
                  value={form.seoDescription}
                  onChange={(e) => updateField('seoDescription', e.target.value)}
                  disabled={isReadOnly}
                  rows={2}
                  className={validationErrors.seoDescription ? 'border-danger' : undefined}
                />
                {validationErrors.seoDescription && <span className="pf-field-msg pf-field-msg-error">{validationErrors.seoDescription}</span>}
              </div>
              <div className="pf-field full">
                <div className="pf-field-label"><span>{t('content.detail.seoCanonicalUrl', { defaultValue: 'URL canonical' })}</span></div>
                <Input
                  value={form.seoCanonicalUrl}
                  onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                  disabled={isReadOnly}
                  placeholder="https://bigbike.vn/..."
                  className={validationErrors.seoCanonicalUrl ? 'border-danger' : undefined}
                />
                {validationErrors.seoCanonicalUrl && <span className="pf-field-msg pf-field-msg-error">{validationErrors.seoCanonicalUrl}</span>}
              </div>
              <label className="pf-checkbox" style={{ gridColumn: '1 / -1' }}>
                <Checkbox
                  checked={form.seoNoIndex}
                  onCheckedChange={(checked) => updateField('seoNoIndex', checked)}
                  disabled={isReadOnly}
                />
                <span>{t('content.detail.seoNoIndex', { defaultValue: 'Không cho công cụ tìm kiếm lập chỉ mục (noindex)' })}</span>
              </label>
            </div>
          </ContentSection>

          {/* ── Section 5: Hiển thị ── */}
          <ContentSection
            def={CONTENT_SECTION_DEFS[4]}
            t={t}
            open={openMap['cs-publish']}
            done={completion['cs-publish']}
            hasError={sectionErrors['cs-publish']}
            onToggle={() => toggleSection('cs-publish')}
          >
            <div className="pf-grid">
              {!isArticle && form.parentId !== undefined && (
                <div className="pf-field">
                  <div className="pf-field-label"><span>{t('content.detail.parentPage', { defaultValue: 'Trang cha (parentId)' })}</span></div>
                  <Input
                    value={form.parentId}
                    onChange={(e) => updateField('parentId', e.target.value)}
                    disabled={isReadOnly}
                    placeholder={t('content.detail.parentPagePlaceholder', { defaultValue: 'Để trống nếu là trang gốc' })}
                  />
                </div>
              )}
              <div className="pf-field">
                <div className="pf-field-label"><span>{t('content.detail.publishStatus')}</span></div>
                <Select value={form.publishStatus} onValueChange={(val) => updateField('publishStatus', val)} disabled={isReadOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">{t('status.publish.DRAFT')}</SelectItem>
                    <SelectItem value="PUBLISHED">{t('status.publish.PUBLISHED')}</SelectItem>
                    <SelectItem value="HIDDEN">{t('status.publish.HIDDEN')}</SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.publishStatus && <span className="pf-field-msg pf-field-msg-error">{validationErrors.publishStatus}</span>}
              </div>
            </div>
          </ContentSection>

          {!isCreate && state.item?.updatedAt && (
            <p className="text-xs muted" style={{ textAlign: 'right' }}>
              {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
