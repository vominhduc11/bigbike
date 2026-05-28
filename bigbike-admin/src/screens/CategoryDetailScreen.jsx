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
import { Tabs } from '../components/layout'
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
    translations: { en: { name: '', description: '', seoTitle: '', seoDescription: '' } },
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
    translations: {
      en: {
        name: item.translations?.en?.name || '',
        description: item.translations?.en?.description || '',
        seoTitle: item.translations?.en?.seoTitle || '',
        seoDescription: item.translations?.en?.seoDescription || '',
      },
    },
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
  }

  payload.translations = {
    en: {
      name: form.translations?.en?.name?.trim() || null,
      description: form.translations?.en?.description?.trim() || null,
      seoTitle: form.translations?.en?.seoTitle?.trim() || null,
      seoDescription: form.translations?.en?.seoDescription?.trim() || null,
    },
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
    warning: '',
    error: fetchError?.message ?? '',
  }

  const [contentLang, setContentLang] = useState('vi')
  const isEnLang = contentLang === 'en'

  function updateTranslation(field, value) {
    setForm((previous) => ({
      ...previous,
      translations: {
        ...previous.translations,
        en: { ...(previous.translations?.en || {}), [field]: value },
      },
    }))
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
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">
            <a onClick={(e) => { e.preventDefault(); navigate('/admin/categories') }} style={{ cursor: 'pointer' }}>
              ← {t('categories.detail.backToList')}
            </a>
          </p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {isCreate ? t('categories.detail.createTitle') : t('categories.detail.editTitle')}
            {!isCreate && state.item && <StatusBadge type="visibility" status={state.item.isVisible} />}
          </h1>
          {breadcrumbPath && (
            <p className="bb-muted">
              {breadcrumbPath} / <strong>{state.item?.name}</strong>
            </p>
          )}
          {!isCreate && state.item && (
            <div className="flex items-center gap-3 mt-2" style={{ flexWrap: 'wrap' }}>
              {productsTotal > 0 && (
                <span className="bb-muted flex items-center gap-1" style={{ fontSize: 12 }}>
                  <Package size={13} aria-hidden="true" />
                  {t('categories.detail.productCount', { count: productsTotal })}
                </span>
              )}
              {state.item.updatedAt && (
                <span className="bb-muted" style={{ fontSize: 12 }} title={`${t('common.lastUpdated')} ${formatDateTime(state.item.updatedAt)}`}>
                  {t('common.lastUpdated')} {formatRelativeTime(state.item.updatedAt, t)}
                </span>
              )}
              <button
                type="button"
                className="bb-muted flex items-center gap-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                onClick={handleCopyId}
                title={t('categories.detail.copyId')}
              >
                <Hash size={12} aria-hidden="true" />
                <code className="mono">{state.item.id}</code>
                {idCopied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>
        <div className="bb-screen-actions">
          {!isCreate && state.item?.slug && (
            <a
              className="bb-btn bb-btn-secondary"
              href={`${STOREFRONT_BASE}/${state.item.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t('categories.detail.viewOnSiteTitle')}
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t('categories.detail.viewOnSite')}
            </a>
          )}
          <button type="submit" form="category-form" className="bb-btn bb-btn-primary" disabled={isReadOnly || !isDirty}>
            {isSubmitting
              ? t('common.saving')
              : isCreate ? t('categories.detail.createBtn') : t('categories.detail.saveBtn')}
          </button>
        </div>
      </div>

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
        <div
          className="flex items-start justify-between gap-3 mb-4 p-3 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-sm"
        >
          <div>
            <strong>{t('categories.detail.menuNoticeTitle')}</strong>
            <p style={{ margin: '4px 0 6px' }}>{t('categories.detail.menuNoticeDesc')}</p>
            <div className="flex gap-2">
              <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={() => navigate('/admin/menus')}>
                {t('categories.detail.menuNoticeAction')}
              </button>
              <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={handleDismissMenuNotice}>
                {t('categories.detail.menuNoticeDismiss')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="bb-icon-btn"
            aria-label={t('categories.detail.menuNoticeDismiss')}
            onClick={handleDismissMenuNotice}
          >
            <XIcon size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <form
        id="category-form"
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
            handleSubmit(e)
          }
        }}
      >
        {/* Thông tin cơ bản */}
        <div className="bb-card mb-4">
          <div className="bb-card-header">
            <div>
              <h2>{t('categories.sectionBasic')}</h2>
              <p className="sub">{t('categories.sectionBasicDesc')}</p>
            </div>
            <Tabs
              ariaLabel={t('categories.detail.contentLanguageAriaLabel', { defaultValue: 'Ngôn ngữ nội dung' })}
              value={contentLang}
              onChange={setContentLang}
              items={[{ key: 'vi', label: 'VI' }, { key: 'en', label: 'EN' }]}
            />
          </div>
          <div className="bb-card-body">
            <div className="grid-2">
              <label className="form-field" data-field="name">
                <span>
                  {t('categories.detail.name')}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('categories.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </span>
                <Input
                  name="name"
                  value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                  onChange={(e) => isEnLang ? updateTranslation('name', e.target.value) : handleNameChange(e.target.value)}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('categories.detail.namePlaceholderEn', { defaultValue: 'English name (optional)' }) : undefined}
                />
                {!isEnLang && validationErrors.name && <span className="hint text-danger">{validationErrors.name}</span>}
              </label>
              <label className="form-field">
                <span>{t('categories.detail.parentId')}</span>
                <Select
                  value={form.parentId || '__none__'}
                  onValueChange={(val) => updateField('parentId', val === '__none__' ? '' : val)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('categories.detail.parentIdNone')}</SelectItem>
                    {parentOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="hint">{t('categories.detail.parentIdHint')}</span>
                {validationErrors.parentId && <span className="hint text-danger">{validationErrors.parentId}</span>}
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.description')}</span>
                <RichTextEditor
                  key={`description-${contentLang}`}
                  value={isEnLang ? (form.translations?.en?.description ?? '') : form.description}
                  onChange={(html) => isEnLang ? updateTranslation('description', html) : updateField('description', html)}
                  placeholder={t('categories.descriptionPlaceholder')}
                  disabled={isReadOnly}
                  enableImagePicker
                />
                <span className="hint">{t('categories.descriptionHint')}</span>
                {!isEnLang && validationErrors.description && <span className="hint text-danger">{validationErrors.description}</span>}
              </div>
              <div className="form-field" data-field="imageUrl" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.imageUrl')}</span>
                <ImageUrlInput
                  value={form.imageUrl}
                  onChange={(url) => updateField('imageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.imageUrl}
                />
              </div>
              <label className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                <Checkbox
                  checked={form.visible}
                  onCheckedChange={(checked) => {
                    const nextVisible = checked === true
                    setForm((prev) => ({
                      ...prev,
                      visible: nextVisible,
                      showOnHomepage: nextVisible ? prev.showOnHomepage : false,
                    }))
                  }}
                  disabled={isReadOnly}
                />
                <span>{t('categories.detail.isVisible')}</span>
              </label>
              <label
                className="flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit"
                style={{ opacity: form.visible ? 1 : 0.5 }}
              >
                <Checkbox
                  checked={form.showOnHomepage}
                  onCheckedChange={(checked) => updateField('showOnHomepage', checked)}
                  disabled={isReadOnly || !form.visible}
                />
                <span>
                  {t('categories.detail.showOnHomepage')}
                  {!form.visible && (
                    <span className="hint" style={{ display: 'block' }}>
                      {t('categories.detail.showOnHomepageRequiresVisible')}
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Slug */}
        <div className="bb-card mb-4">
          <div className="bb-card-header"><h2>{t('categories.detail.slug')}</h2></div>
          <div className="bb-card-body">
            <label className="form-field" data-field="slug">
              <span>{t('categories.detail.slug')}</span>
              <Input
                name="slug"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                disabled={isReadOnly}
                placeholder={t('categories.slugPlaceholder')}
                style={{ fontFamily: 'var(--admin-font-mono)' }}
              />
              <span className="hint">{t('categories.detail.slugHint')}</span>
              {validationErrors.slug && <span className="hint text-danger">{validationErrors.slug}</span>}
            </label>
          </div>
        </div>

        {/* Products in category */}
        {!isCreate && state.item && (
          <div className="bb-card mb-4">
            <div className="bb-card-header">
              <div>
                <h2>{t('categories.detail.productsSectionTitle', { count: productsTotal })}</h2>
                <p className="sub">{t('categories.detail.productsSectionDesc')}</p>
              </div>
              {productsTotal > 0 && (
                <button
                  type="button"
                  className="bb-btn bb-btn-ghost bb-btn-sm"
                  onClick={() => navigate(`/admin/products?categoryId=${state.item.id}`)}
                >
                  {t('categories.detail.productsViewAll', { count: productsTotal })}
                </button>
              )}
            </div>
            <div className="bb-card-body bb-card-body--flush">
              {productsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--bb-text-muted)' }}><p>{t('categories.detail.productsEmpty')}</p></div>
              ) : (
                <div className="bb-table-wrap">
                  <table className="bb-table">
                    <tbody>
                      {productsList.map((p) => (
                        <tr key={p.id} onClick={() => navigate(`/admin/products/${p.id}`)}>
                          <td>
                            <div className="product-cell">
                              <span className="thumb">
                                {p.image?.url ? (
                                  <img src={p.image.url} alt={p.image.alt || p.name} loading="lazy" referrerPolicy="no-referrer"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : <Package size={16} />}
                              </span>
                              <div className="info">
                                <div className="name">{p.name}</div>
                                <div className="sku">{p.sku || p.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td className="col-actions"><PublishStatusBadge value={p.publishStatus} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Danger zone */}
        {!isCreate && canUpdate && (
          <div className="bb-card" style={{ borderColor: 'var(--admin-color-status-danger-border)' }}>
            <div className="bb-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <strong className="flex items-center gap-2 text-danger">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {t('categories.detail.dangerZoneTitle')}
                </strong>
                <p className="bb-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{t('categories.detail.dangerZoneDesc')}</p>
              </div>
              <button type="button" className="bb-btn bb-btn-danger" onClick={handleHardDelete} disabled={hardDeleteMutation.isPending}>
                {t('categories.detail.hardDeleteBtn')}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
