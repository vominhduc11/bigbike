import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Check, Copy, ExternalLink, FolderOpen, Hash, Package, X as XIcon } from 'lucide-react'
import {
  createCategory,
  fetchCategoryDetail,
  fetchCategoryTree,
  fetchProducts,
  hardDeleteCategory,
  mapValidationErrors,
  updateCategory,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime, formatRelativeTime } from '../lib/formatters'
import { createCategorySchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { PublishStatusBadge, StatusBadge } from '../components/StatusBadge'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { RichTextEditor } from '../components/RichTextEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const STOREFRONT_BASE = `${import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'}/danh-muc-san-pham`
const MENU_NOTICE_DISMISSED_KEY = 'bigbike-admin-cat-menu-notice-dismissed'

function countDescendants(rootId, allCategories) {
  let count = 0
  const queue = [rootId]
  while (queue.length > 0) {
    const parentId = queue.shift()
    const children = allCategories.filter((c) => c.parentId === parentId)
    count += children.length
    children.forEach((c) => queue.push(c.id))
  }
  return count
}

function toSlug(text) {
  return text
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
    parentId: '',
    visible: true,
    showOnHomepage: false,
    sortOrder: '',
    imageUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoNoIndex: false,
  }
}

function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()
  return {
    slug: item.slug || '',
    name: item.name || '',
    description: item.description || '',
    parentId: item.parentId || '',
    visible: item.isVisible !== false,
    showOnHomepage: Boolean(item.showOnHomepage),
    sortOrder: item.sortOrder != null ? String(item.sortOrder) : '',
    imageUrl: item.image?.url || '',
    seoTitle: item.seo?.title || '',
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
  }
}

function toPayload(form) {
  const sortStr = form.sortOrder.trim()
  const payload = {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    parentId: form.parentId.trim(),
    visible: Boolean(form.visible),
    showOnHomepage: Boolean(form.showOnHomepage),
    sortOrder: sortStr !== '' ? parseInt(sortStr, 10) : null,
  }

  const imageUrl = form.imageUrl.trim()
  payload.image = imageUrl ? { url: imageUrl, alt: form.name.trim() || undefined } : { url: null }

  const seoTitle = form.seoTitle.trim()
  const seoDescription = form.seoDescription.trim()
  const seoCanonicalUrl = form.seoCanonicalUrl.trim()
  payload.seo = {
    title: seoTitle || undefined,
    description: seoDescription || undefined,
    canonicalUrl: seoCanonicalUrl || undefined,
    noIndex: Boolean(form.seoNoIndex),
  }

  return payload
}

export function CategoryDetailScreen({ categoryId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(buildEmptyForm()))
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const [menuNoticeDismissed, setMenuNoticeDismissed] = useState(() => {
    try { return localStorage.getItem(MENU_NOTICE_DISMISSED_KEY) === '1' }
    catch { return false }
  })

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => fetchCategoryDetail(categoryId),
    enabled: !isCreate,
  })

  const { data: categoriesResult } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => fetchCategoryTree(),
  })

  // Top products in this category — surfaced in a sidebar so editors know
  // who depends on the category before they hide / re-parent it.
  const { data: productsInCat } = useQuery({
    queryKey: ['products', 'by-category', categoryId, 'top5'],
    queryFn: () => fetchProducts({ categoryId, pageSize: 5, page: 1, sort: 'updatedAt:desc' }),
    enabled: !isCreate && Boolean(categoryId),
    staleTime: 30 * 1000,
  })
  const productsList = productsInCat?.items ?? []
  const productsTotal = productsInCat?.pagination?.totalItems ?? 0

  const currentItem = fetchResult?.item ?? null

  const breadcrumbPath = useMemo(() => {
    const items = categoriesResult?.items ?? []
    if (!currentItem?.parentId) return null
    const byId = new Map(items.map((c) => [c.id, c]))
    const parts = []
    let cur = byId.get(currentItem.parentId)
    let safety = 10
    while (cur && safety-- > 0) {
      parts.unshift(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : null
    }
    return parts.join(' / ')
  }, [categoriesResult, currentItem])

  const parentOptions = useMemo(() => {
    const items = categoriesResult?.items ?? []
    const descendants = new Set()
    if (categoryId) {
      const findDescendants = (id) => {
        items.forEach((c) => {
          if (c.parentId === id && !descendants.has(c.id)) {
            descendants.add(c.id)
            findDescendants(c.id)
          }
        })
      }
      findDescendants(categoryId)
    }
    const eligible = items.filter((c) => c.id !== categoryId && !descendants.has(c.id))
    const map = new Map(eligible.map((c) => [c.id, { ...c, children: [] }]))
    const roots = []
    eligible.forEach((c) => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId).children.push(map.get(c.id))
      } else {
        roots.push(map.get(c.id))
      }
    })
    const flattened = []
    const flatten = (nodes, depth) => {
      nodes.forEach((node) => {
        flattened.push({ id: node.id, label: (depth > 0 ? '— '.repeat(depth) : '') + node.name })
        flatten(node.children, depth + 1)
      })
    }
    flatten(roots, 0)
    return flattened
  }, [categoriesResult, categoryId])

  useEffect(() => {
    if (!fetchResult) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      const item = fetchResult.item || null
      const nextForm = buildFormFromItem(item)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setSlugManuallyEdited(true)
    })
    return () => { cancelled = true }
  }, [fetchResult])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: currentItem,
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
    mutationFn: (payload) => isCreate ? createCategory(payload) : updateCategory(categoryId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      if (!isCreate) queryClient.setQueryData(['category', categoryId], response)
      toast.success(isCreate ? t('categories.detail.successCreate') : t('categories.detail.successUpdate'))
      setIsSubmitting(false)
      if (isCreate && savedItem?.id) navigate(`/admin/categories/${savedItem.id}`, { replace: true })
    },
    onError: (error) => {
      const errs = mapValidationErrors(error)
      setValidationErrors(errs)
      toast.error(error.message || t('common.error'))
      setIsSubmitting(false)
    },
  })

  const hardDeleteMutation = useMutation({
    mutationFn: () => hardDeleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success(t('categories.detail.hardDeleteSuccess'))
      navigate('/admin/categories')
    },
    onError: (error) => {
      const msg = error?.status === 409
        ? t('categories.detail.hardDeleteConflict')
        : (error.message || t('common.error'))
      toast.error(msg)
    },
  })

  async function handleHardDelete() {
    const name = form.name || categoryId
    const allCategories = categoriesResult?.items ?? []
    const descendantCount = countDescendants(categoryId, allCategories)
    const message = descendantCount > 0
      ? t('categories.detail.hardDeleteConfirmWithChildren', { name, count: descendantCount })
      : t('categories.detail.hardDeleteConfirm', { name })
    const confirmed = await showConfirm(message, t('categories.detail.hardDeleteConfirmTitle'))
    if (!confirmed) return
    hardDeleteMutation.mutate()
  }

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setValidationErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  function handleNameChange(value) {
    updateField('name', value)
    if (isCreate && !slugManuallyEdited) {
      updateField('slug', toSlug(value))
    }
  }

  function handleSlugChange(value) {
    setSlugManuallyEdited(true)
    updateField('slug', value)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canUpdate) return

    const schema = createCategorySchema(t)
    const result = schema.safeParse(form)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      // Scroll the first error into view + focus its control. Without this,
      // submitting from the bottom of a long form leaves the user staring at
      // a frozen Save button while the actual error is offscreen above.
      requestAnimationFrame(() => {
        const firstField = Object.keys(clientErrors)[0]
        if (!firstField || !formRef.current) return
        const target = formRef.current.querySelector(`[name="${firstField}"], [data-field="${firstField}"]`)
          || formRef.current.querySelector('.field-error')?.closest('label, .form-field')
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          const focusable = target.querySelector('input, select, textarea, [contenteditable="true"]')
          focusable?.focus({ preventScroll: true })
        }
      })
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(toPayload(form))
  }

  function handleDismissMenuNotice() {
    try { localStorage.setItem(MENU_NOTICE_DISMISSED_KEY, '1') } catch { /* storage may be unavailable */ }
    setMenuNoticeDismissed(true)
  }

  function handleDiscardChanges() {
    if (!isDirty) return
    const item = fetchResult?.item || null
    const nextForm = buildFormFromItem(item)
    setForm(nextForm)
    setValidationErrors({})
  }

  function handleCopyId() {
    if (!state.item?.id) return
    const id = state.item.id
    const ok = () => { setIdCopied(true); setTimeout(() => setIdCopied(false), 1500) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(id).then(ok).catch(() => {})
    } else {
      // Older browsers / non-secure contexts — fall back to execCommand.
      const ta = document.createElement('textarea')
      ta.value = id; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); ok() } catch { /* ignore */ }
      ta.remove()
    }
  }

  // Esc → back to list. Confirms when the form is dirty.
  useEffect(() => {
    const handler = async (e) => {
      if (e.key !== 'Escape' || isSubmitting) return
      // Don't hijack Esc when the user is dismissing a menu/select/dialog.
      const target = e.target
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (target?.isContentEditable) return
      if (isDirty) {
        const ok = await showConfirm(
          t('categories.detail.discardConfirm'),
          t('categories.detail.discardConfirmTitle'),
        )
        if (!ok) return
      }
      navigate('/admin/categories')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDirty, isSubmitting, navigate, t])

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title={t('categories.detail.loading')}
        description={t('categories.detail.loadingDesc')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('categories.detail.loadError')}
        description={state.error}
        actionLabel={t('categories.detail.backToList')}
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  if (!isCreate && !state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('categories.detail.notFound')}
        description={t('categories.detail.notFoundDesc')}
        actionLabel={t('categories.detail.backToList')}
        onAction={() => navigate('/admin/categories')}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('categories.detail.eyebrow')}</p>
          <h1>{isCreate ? t('categories.detail.createTitle') : t('categories.detail.editTitle')}</h1>
          {breadcrumbPath && (
            <p className="cat-detail-breadcrumb">
              <span>{breadcrumbPath}</span>
              <span className="cat-detail-breadcrumb-sep"> / </span>
              <strong>{state.item?.name}</strong>
            </p>
          )}
          {!isCreate && state.item && (
            <div className="cat-detail-meta">
              <StatusBadge type="visibility" status={state.item.isVisible} />
              {productsTotal > 0 && (
                <span className="cat-detail-meta-item" title={t('categories.detail.productCountTitle')}>
                  <Package size={13} aria-hidden="true" />
                  {t('categories.detail.productCount', { count: productsTotal })}
                </span>
              )}
              {state.item.updatedAt && (
                <span
                  className="cat-detail-meta-item"
                  title={`${t('common.lastUpdated')} ${formatDateTime(state.item.updatedAt)}`}
                >
                  {t('common.lastUpdated')} {formatRelativeTime(state.item.updatedAt, t)}
                </span>
              )}
              <button
                type="button"
                className="cat-detail-meta-item cat-detail-id"
                onClick={handleCopyId}
                title={t('categories.detail.copyId')}
              >
                <Hash size={12} aria-hidden="true" />
                <code>{state.item.id}</code>
                {idCopied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              </button>
            </div>
          )}
          <p>{isCreate ? t('categories.detail.createDesc') : t('categories.detail.editDesc')}</p>
        </div>
        <div className="screen-actions">
          {!isCreate && state.item?.slug && (
            <Button asChild variant="ghost">
              <a
                href={`${STOREFRONT_BASE}/${state.item.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t('categories.detail.viewOnSiteTitle')}
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>{t('categories.detail.viewOnSite')}</span>
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/admin/categories')}>
            {t('categories.detail.backToList')}
          </Button>
        </div>
      </header>

      {state.warning ? (
        <StatePanel tone="warning" title={t('readOnly.prefix')} description={state.warning} />
      ) : null}

      {!canUpdate ? (
        <StatePanel
          tone="warning"
          title={t('categories.detail.permissionDenied')}
          description={t('categories.detail.permissionDesc')}
        />
      ) : null}

      {!isCreate && canUpdate && !menuNoticeDismissed && (
        <div className="dismissible-banner dismissible-banner--info">
          <div className="dismissible-banner-body">
            <strong>{t('categories.detail.menuNoticeTitle')}</strong>
            <p>{t('categories.detail.menuNoticeDesc')}</p>
            <div className="dismissible-banner-actions">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin/menus')}>
                {t('categories.detail.menuNoticeAction')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDismissMenuNotice}>
                {t('categories.detail.menuNoticeDismiss')}
              </Button>
            </div>
          </div>
          <button
            type="button"
            className="dismissible-banner-close"
            aria-label={t('categories.detail.menuNoticeDismiss')}
            onClick={handleDismissMenuNotice}
          >
            <XIcon size={16} aria-hidden="true" />
          </button>
        </div>
      )}

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
            <h2>
              <FolderOpen size={16} aria-hidden="true" className="detail-section-icon" />
              {t('categories.sectionBasic')}
            </h2>
            <p className="detail-section-desc">{t('categories.sectionBasicDesc')}</p>
          </header>
          <div className="detail-section-content form-grid">

            <label className="form-field" data-field="name">
              <span>{t('categories.detail.name')}</span>
              <Input
                name="name"
                value={form.name}
                onChange={(event) => handleNameChange(event.target.value)}
                disabled={isReadOnly}
               />
              {validationErrors.name ? (
                <small className="field-error">{validationErrors.name}</small>
              ) : null}
            </label>

            <label className="form-field">
              <span>{t('categories.detail.parentId')}</span>
              <Select
                value={form.parentId || '__none__'}
                onValueChange={(val) => updateField('parentId', val === '__none__' ? '' : val)}
                disabled={isReadOnly}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="__none__">{t('categories.detail.parentIdNone')}</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent></Select>
              <small className="field-hint">{t('categories.detail.parentIdHint')}</small>
              {validationErrors.parentId ? (
                <small className="field-error">{validationErrors.parentId}</small>
              ) : null}
            </label>


            <div className="form-field form-field-wide">
              <span>{t('categories.detail.description')}</span>
              <RichTextEditor
                value={form.description}
                onChange={(html) => updateField('description', html)}
                placeholder={t('categories.descriptionPlaceholder')}
                disabled={isReadOnly}
                enableImagePicker
              />
              <small className="field-hint">{t('categories.descriptionHint')}</small>
              {validationErrors.description ? (
                <small className="field-error">{validationErrors.description}</small>
              ) : null}
            </div>

            <div className="form-field form-field-wide form-media-pair">
              <div className="form-field" data-field="imageUrl">
                <span>{t('categories.detail.imageUrl')}</span>
                <ImageUrlInput
                  value={form.imageUrl}
                  onChange={(url) => updateField('imageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.imageUrl}
                />
              </div>

            </div>

            <div className="form-checkbox-group">
              <label className="form-checkbox">
                <Checkbox
                  checked={form.visible}
                  onChange={(event) => {
                    const nextVisible = event.target.checked
                    setForm((prev) => ({
                      ...prev,
                      visible: nextVisible,
                      // showOnHomepage requires the category to be visible —
                      // hidden categories are excluded from the public site,
                      // so a homepage flag would be silently ignored.
                      showOnHomepage: nextVisible ? prev.showOnHomepage : false,
                    }))
                  }}
                  disabled={isReadOnly}
                 />
                <span>{t('categories.detail.isVisible')}</span>
              </label>

              <label className={`form-checkbox${!form.visible ? ' is-disabled' : ''}`}>
                <Checkbox
                  checked={form.showOnHomepage}
                  onCheckedChange={(checked) => updateField('showOnHomepage', checked)}
                  disabled={isReadOnly || !form.visible}
                 />
                <span>
                  {t('categories.detail.showOnHomepage')}
                  {!form.visible && (
                    <small className="form-checkbox-hint">{t('categories.detail.showOnHomepageRequiresVisible')}</small>
                  )}
                </span>
              </label>
            </div>

          </div>
        </section>

        <section className="detail-section">
          <header className="detail-section-header">
            <h2>{t('categories.detail.slug')}</h2>
          </header>
          <div className="detail-section-content form-grid">
            <label className="form-field" data-field="slug">
              <span>{t('categories.detail.slug')}</span>
              <Input
                name="slug"
                value={form.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                disabled={isReadOnly}
                placeholder={t('categories.slugPlaceholder')}
               />
              <small className="field-hint">{t('categories.detail.slugHint')}</small>
              {validationErrors.slug ? (
                <small className="field-error">{validationErrors.slug}</small>
              ) : null}
            </label>
          </div>
        </section>

        {!isCreate && state.item && (
          <section className="detail-section">
            <header className="detail-section-header">
              <div>
                <h2>
                  <Package size={16} aria-hidden="true" className="detail-section-icon" />
                  {t('categories.detail.productsSectionTitle', { count: productsTotal })}
                </h2>
                <p className="detail-section-desc">{t('categories.detail.productsSectionDesc')}</p>
              </div>
              {productsTotal > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/products?categoryId=${state.item.id}`)}>
                  {t('categories.detail.productsViewAll', { count: productsTotal })}
                </Button>
              )}
            </header>
            <div className="detail-section-content">
              {productsList.length === 0 ? (
                <p className="cat-products-empty">{t('categories.detail.productsEmpty')}</p>
              ) : (
                <ul className="cat-products-list">
                  {productsList.map((p) => (
                    <li key={p.id} className="cat-products-item">
                      <button
                        type="button"
                        className="cat-products-item-link"
                        onClick={() => navigate(`/admin/products/${p.id}`)}
                      >
                        <div className="cat-products-thumb">
                          {p.image?.url ? (
                            <img src={p.image.url} alt={p.image.alt || p.name} loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <span aria-hidden="true">—</span>
                          )}
                        </div>
                        <div className="cat-products-meta">
                          <strong>{p.name}</strong>
                          <span className="cat-products-sku">{p.sku || p.slug}</span>
                        </div>
                        <PublishStatusBadge value={p.publishStatus} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}


        {/* The base .form-footer is already sticky-bottom across the admin
            (see ProductDetailScreen). Keep this as the last element of
            the form so it doesn't overlap the danger zone above it. */}
        <div className={`form-footer${isDirty ? ' form-footer--dirty' : ''}`}>
          <div className="form-status">
            {isDirty && (
              <span className="status-pill is-dirty">{t('categories.dirtyHint')}</span>
            )}
            {!isCreate && state.item?.updatedAt ? (
              <small title={formatDateTime(state.item.updatedAt)}>
                {t('common.lastUpdated')} {formatRelativeTime(state.item.updatedAt, t)}
              </small>
            ) : null}
          </div>
          <div className="screen-actions">
            <small className="form-shortcut-hint" aria-hidden="true">
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
            </small>
            {isDirty && !isReadOnly && (
              <Button variant="ghost" onClick={handleDiscardChanges} disabled={isSubmitting}>
                {t('categories.detail.discardChanges')}
              </Button>
            )}
            <Button type="submit" loading={isSubmitting} disabled={isReadOnly || !isDirty}>
              {isCreate
                ? t('categories.detail.createBtn')
                : t('categories.detail.saveBtn')}
            </Button>
          </div>
        </div>

      </form>

      {!isCreate && canUpdate && (
        <div className="danger-zone">
          <div className="danger-zone-info">
            <strong>
              <AlertTriangle size={13} aria-hidden="true" className="align-middle mr-1.5" />
              {t('categories.detail.dangerZoneTitle')}
            </strong>
            <p>{t('categories.detail.dangerZoneDesc')}</p>
          </div>
          <Button variant="danger" onClick={handleHardDelete} loading={hardDeleteMutation.isPending}>
            {t('categories.detail.hardDeleteBtn')}
          </Button>
        </div>
      )}
    </section>
  )
}
