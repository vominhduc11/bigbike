import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createContent,
  deleteContent,
  fetchContentAuthors,
  fetchContentCategories,
  fetchContentDetail,
  fetchContentPageRefs,
  mapValidationErrors,
  updateContent,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { createContentSchema, zodErrors } from '../lib/schemas'
import { RichTextEditor } from '../components/RichTextEditor'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { StatePanel } from '../components/StatePanel'

function normalizeContentType(value) {
  return String(value || '').toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE'
}

function mutationPath(contentType) {
  return normalizeContentType(contentType) === 'PAGE' ? 'pages' : 'articles'
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
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoNoIndex: false,
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
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.url || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
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
  }

  // Always send seo as non-null object so backend can clear fields when all are empty
  payload.seo = {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    canonicalUrl: form.seoCanonicalUrl.trim() || null,
    noIndex: Boolean(form.seoNoIndex),
    ogImage: form.seoOgImageUrl.trim() ? { url: form.seoOgImageUrl.trim() } : null,
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

  const { data: pageRefs = [] } = useQuery({
    queryKey: ['content-reference', 'pages'],
    queryFn: fetchContentPageRefs,
    staleTime: 5 * 60 * 1000,
    enabled: normalizedType === 'PAGE',
  })

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

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('content.detail.eyebrow')}</p>
          <h1>
            {isCreate
              ? t(isArticle ? 'content.detail.createArticleTitle' : 'content.detail.createPageTitle')
              : t(isArticle ? 'content.detail.editArticleTitle' : 'content.detail.editPageTitle')}
          </h1>
          <p>
            {isCreate
              ? t(isArticle ? 'content.detail.createArticleDesc' : 'content.detail.createPageDesc')
              : t(isArticle ? 'content.detail.editArticleDesc' : 'content.detail.editPageDesc')}
          </p>
        </div>
        <div className="screen-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/admin/content')}
          >
            {t('content.detail.backToList')}
          </button>
          {!isCreate && canUpdate && (
            <button
              type="button"
              className="btn btn-danger"
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
              {t('content.detail.archiveBtn')}
            </button>
          )}
        </div>
      </header>

      {state.warning ? (
        <StatePanel tone="warning" title={t('readOnly.prefix')} description={state.warning} />
      ) : null}

      {!canUpdate ? (
        <StatePanel
          tone="warning"
          title={t('content.detail.permissionDenied')}
          description={t('content.detail.permissionDesc')}
        />
      ) : null}

      <form
        ref={formRef}
        className="entity-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
            handleSubmit(e)
          }
        }}
      >
        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('content.detail.sectionCore')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field">
              <span>{t('content.detail.slug')}</span>
              <input
                className="control-input"
                value={form.slug}
                onChange={(event) => updateField('slug', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.slug ? (
                <small className="field-error">{validationErrors.slug}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('content.detail.title')}</span>
              <input
                className="control-input"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.title ? (
                <small className="field-error">{validationErrors.title}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('content.detail.publishStatus')}</span>
              <select
                className="control-select"
                value={form.publishStatus}
                onChange={(event) => updateField('publishStatus', event.target.value)}
                disabled={isReadOnly}
              >
                <option value="DRAFT">{t('status.publish.DRAFT')}</option>
                <option value="PUBLISHED">{t('status.publish.PUBLISHED')}</option>
                <option value="HIDDEN">{t('status.publish.HIDDEN')}</option>
                <option value="ARCHIVED">{t('status.publish.ARCHIVED')}</option>
              </select>
              {validationErrors.publishStatus ? (
                <small className="field-error">{validationErrors.publishStatus}</small>
              ) : null}
            </label>

            {!isArticle ? (
              <label className="form-field">
                <span>{t('content.detail.pageType')}</span>
                <input
                  className="control-input"
                  value={form.pageType}
                  onChange={(event) => updateField('pageType', event.target.value)}
                  disabled={isReadOnly || !isCreate}
                />
                {validationErrors.pageType ? (
                  <small className="field-error">{validationErrors.pageType}</small>
                ) : null}
              </label>
            ) : null}

            {/* P1-002: Author selector for articles */}
            {isArticle ? (
              <label className="form-field">
                <span>{t('content.detail.author', { defaultValue: 'Tác giả' })}</span>
                <select
                  className="control-select"
                  value={form.authorId}
                  onChange={(event) => updateField('authorId', event.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="">{t('content.detail.authorNone', { defaultValue: '— Không chọn —' })}</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {/* P1-002: Category selector for articles */}
            {isArticle ? (
              <label className="form-field">
                <span>{t('content.detail.category', { defaultValue: 'Danh mục' })}</span>
                <select
                  className="control-select"
                  value={form.categoryId}
                  onChange={(event) => updateField('categoryId', event.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="">{t('content.detail.categoryNone', { defaultValue: '— Không chọn —' })}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {/* P1-002: Parent page selector for pages */}
            {!isArticle ? (
              <label className="form-field">
                <span>{t('content.detail.parentPage', { defaultValue: 'Trang cha' })}</span>
                <select
                  className="control-select"
                  value={form.parentId}
                  onChange={(event) => updateField('parentId', event.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="">{t('content.detail.parentNone', { defaultValue: '— Không có trang cha —' })}</option>
                  {pageRefs
                    .filter((p) => p.id !== contentId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.title || p.slug}</option>
                    ))}
                </select>
              </label>
            ) : null}

            {isArticle ? (
              <label className="form-field form-field-wide">
                <span>{t('content.detail.excerpt')}</span>
                <textarea
                  className="control-input control-textarea"
                  value={form.excerpt}
                  onChange={(event) => updateField('excerpt', event.target.value)}
                  disabled={isReadOnly}
                />
              </label>
            ) : null}

            <div className="form-field form-field-wide">
              <span style={{ fontSize: 'var(--admin-text-sm)', fontWeight: 500, color: 'var(--admin-color-text-secondary)' }}>
                {t('content.detail.body')}
              </span>
              <RichTextEditor
                value={form.body}
                onChange={(html) => updateField('body', html)}
                placeholder={t('content.detail.bodyPlaceholder', { defaultValue: 'Nhập nội dung...' })}
                disabled={isReadOnly}
                hasError={Boolean(validationErrors.body)}
              />
              {validationErrors.body ? (
                <small className="field-error">{validationErrors.body}</small>
              ) : null}
            </div>
          </div>
        </section>

        {isArticle ? (
          <section className="detail-section">
            <header className="detail-section-header">
              <h2>{t('content.detail.sectionMedia')}</h2>
            </header>
            <div className="detail-section-content form-grid">
              <div className="form-field form-field-wide">
                <span>{t('content.detail.coverImageUrl')}</span>
                <ImageUrlInput
                  value={form.coverImageUrl}
                  onChange={(url) => updateField('coverImageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.coverImageUrl}
                />
              </div>

              <label className="form-field">
                <span>{t('content.detail.coverImageAlt')}</span>
                <input
                  className="control-input"
                  value={form.coverImageAlt}
                  onChange={(event) => updateField('coverImageAlt', event.target.value)}
                  disabled={isReadOnly}
                />
              </label>

              <div className="form-field form-field-wide">
                <span>{t('content.detail.productImageUrl')}</span>
                <ImageUrlInput
                  value={form.productImageUrl}
                  onChange={(url) => updateField('productImageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.productImageUrl}
                />
              </div>

              <label className="form-field">
                <span>{t('content.detail.productImageAlt')}</span>
                <input
                  className="control-input"
                  value={form.productImageAlt}
                  onChange={(event) => updateField('productImageAlt', event.target.value)}
                  disabled={isReadOnly}
                />
              </label>

              <label className="form-field form-field-wide">
                <span>{t('content.detail.tags')}</span>
                <input
                  className="control-input"
                  value={form.tags}
                  onChange={(event) => updateField('tags', event.target.value)}
                  disabled={isReadOnly}
                  placeholder={t('content.detail.tagsPlaceholder')}
                />
              </label>
            </div>
          </section>
        ) : null}

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('content.detail.sectionSeo')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field form-field-wide">
              <span>{t('content.detail.seoTitle')}</span>
              <input
                className="control-input"
                value={form.seoTitle}
                onChange={(event) => updateField('seoTitle', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>{t('content.detail.seoDescription')}</span>
              <textarea
                className="control-input control-textarea"
                value={form.seoDescription}
                onChange={(event) => updateField('seoDescription', event.target.value)}
                disabled={isReadOnly}
              />
            </label>

            <label className="form-field form-field-wide">
              <span>{t('content.detail.seoCanonicalUrl')}</span>
              <input
                className="control-input"
                value={form.seoCanonicalUrl}
                onChange={(event) => updateField('seoCanonicalUrl', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.seoCanonicalUrl ? (
                <small className="field-error">{validationErrors.seoCanonicalUrl}</small>
              ) : null}
            </label>

            <label className="form-field form-field-wide">
              <span>{t('content.detail.seoOgImageUrl')}</span>
              <input
                className="control-input"
                value={form.seoOgImageUrl}
                onChange={(event) => updateField('seoOgImageUrl', event.target.value)}
                disabled={isReadOnly}
              />
              {validationErrors.seoOgImageUrl ? (
                <small className="field-error">{validationErrors.seoOgImageUrl}</small>
              ) : null}
            </label>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.seoNoIndex}
                onChange={(event) => updateField('seoNoIndex', event.target.checked)}
                disabled={isReadOnly}
              />
              <span>{t('content.detail.seoNoIndex')}</span>
            </label>
          </div>
        </section>

        <div className="form-footer">
          <div className="form-status">
            <span className={`status-pill ${isDirty ? 'is-dirty' : 'is-clean'}`}>
              {isDirty ? t('common.dirty') : t('common.clean')}
            </span>
            {!isCreate && state.item?.updatedAt ? (
              <small>{t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}</small>
            ) : null}
          </div>
          <div className="screen-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isReadOnly || !isDirty}
            >
              {isSubmitting
                ? t('common.saving')
                : isCreate
                  ? t(isArticle ? 'content.detail.createArticleBtn' : 'content.detail.createPageBtn')
                  : t('content.detail.saveBtn')}
            </button>
          </div>
        </div>

      </form>
    </section>
  )
}
