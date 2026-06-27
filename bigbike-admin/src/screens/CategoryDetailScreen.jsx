import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { AlertCircle, Check, Copy, ExternalLink, Hash, Loader2, Package, X as XIcon } from 'lucide-react'
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
import { useContentLang, overlayEnNames } from '../lib/contentLang'
import { createCategorySchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { IntroContentField } from './category-detail/IntroContentField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  STOREFRONT_BASE,
  MENU_NOTICE_DISMISSED_KEY,
  countDescendants,
  toSlug,
  buildEmptyForm,
  buildFormFromItem,
  toPayload,
} from './category-detail/constants'
import { SeoCard } from './category-detail/SeoCard'
import { ProductsInCategoryCard } from './category-detail/ProductsInCategoryCard'
import { DangerZoneCard } from './category-detail/DangerZoneCard'

export function CategoryDetailScreen({ categoryId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const isEnLang = contentLang === 'en'
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(buildEmptyForm()))
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [enSlugManuallyEdited, setEnSlugManuallyEdited] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const [menuNoticeDismissed, setMenuNoticeDismissed] = useState(() => {
    try { return localStorage.getItem(MENU_NOTICE_DISMISSED_KEY) === '1' }
    catch { return false }
  })

  const { data: fetchResult, isLoading, isError, error: fetchError, refetch } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => fetchCategoryDetail(categoryId),
    enabled: !isCreate,
  })

  // Cây danh mục cho breadcrumb + ô chọn danh mục cha: luôn lấy TOÀN BỘ (lang='vi',
  // không strict) để ở chế độ EN vẫn chọn/giữ được cha là danh mục chưa dịch.
  const { data: categoriesResultVi } = useQuery({
    queryKey: ['categories', 'tree', 'picker'],
    queryFn: () => fetchCategoryTree('vi'),
  })

  // Ở chế độ EN: nạp thêm cây tiếng Anh (backend ẩn mục chưa dịch) để phủ tên Anh
  // lên danh sách đầy đủ phía trên — mục đã dịch hiện tên Anh, mục chưa dịch giữ tên Việt.
  const { data: categoriesResultEn } = useQuery({
    queryKey: ['categories', 'tree', 'picker', 'en'],
    queryFn: () => fetchCategoryTree('en'),
    enabled: isEnLang,
  })

  // Danh sách dùng cho picker + breadcrumb: đầy đủ từ cây VI, overlay tên EN khi có.
  const categoriesResult = useMemo(() => {
    if (!isEnLang || !categoriesResultVi) return categoriesResultVi
    return { ...categoriesResultVi, items: overlayEnNames(categoriesResultVi.items, categoriesResultEn?.items) }
  }, [categoriesResultVi, categoriesResultEn, isEnLang])

  // Top products in this category — surfaced in a sidebar so editors know
  // who depends on the category before they hide / re-parent it.
  const { data: productsInCat } = useQuery({
    queryKey: ['products', 'by-category', categoryId, 'top5', 'ALL_INCLUDING_TRASH', contentLang],
    queryFn: () => fetchProducts({ categoryId, pageSize: 5, page: 1, sort: 'updatedAt:desc', publishStatus: 'ALL_INCLUDING_TRASH' }),
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
      // Danh mục đã có slug tiếng Anh → coi như đã chỉnh tay, không auto-ghi đè khi sửa tên EN;
      // chưa có → để auto-gợi ý từ tên tiếng Anh.
      setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
    })
    return () => { cancelled = true }
  }, [fetchResult])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: currentItem,
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

  const isDirty = useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot])
  const isReadOnly = !canUpdate || isSubmitting
  const formRef = useRef(null)

  // Dấu * đỏ (glyph, không chỉ màu) cho nhãn ô bắt buộc — giúp admin biết ô nào
  // phải điền trước khi bấm Lưu, không cần đợi báo lỗi (tiêu chí F2).
  const requiredMark = (
    <span
      className="ml-0.5 text-[var(--admin-color-status-danger-text)]"
      aria-label={t('common.required', { defaultValue: 'bắt buộc' })}
      title={t('common.required', { defaultValue: 'Bắt buộc' })}
    >*</span>
  )

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
      setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
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
    // Nút xác nhận phải nêu rõ hành động (Xoá vĩnh viễn) thay vì "Xác nhận"
    // chung chung, để người dùng biết chính xác việc sắp làm (tiêu chí 7.5).
    const confirmed = await showConfirm(message, t('categories.detail.hardDeleteConfirmTitle'), {
      variant: 'danger',
      confirmLabel: t('categories.detail.hardDeleteBtn'),
      cancelLabel: t('common.cancel'),
    })
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

  // Validate cục bộ MỘT ô khi rời (onBlur) — chạy lại schema trên form hiện tại rồi
  // chỉ cập nhật lỗi của đúng field đó, để lỗi định dạng (slug có dấu cách/chữ hoa,
  // URL sai, vượt độ dài SEO) hiện ngay tại chỗ thay vì đợi bấm Lưu (tiêu chí F3).
  function validateFieldOnBlur(fieldKey) {
    const result = createCategorySchema(t).safeParse(form)
    const allErrors = zodErrors(result)
    setValidationErrors((previous) => {
      const next = { ...previous }
      if (allErrors[fieldKey]) next[fieldKey] = allErrors[fieldKey]
      else delete next[fieldKey]
      return next
    })
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
      <div className="flex flex-col items-center gap-3">
        <StatePanel
          tone="danger"
          title={t('categories.detail.loadError')}
          description={state.error}
          actionLabel={t('common.retry', { defaultValue: 'Thử lại' })}
          onAction={() => refetch()}
        />
        <button
          type="button"
          className="bb-btn bb-btn-ghost bb-btn-sm focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => navigate('/admin/categories')}
        >
          {t('categories.detail.backToList')}
        </button>
      </div>
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
            <a
              href="/admin/categories"
              onClick={(e) => { e.preventDefault(); navigate('/admin/categories') }}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bb-primary)]"
              style={{ cursor: 'pointer' }}
            >
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
          <button type="submit" form="category-form" className="bb-btn bb-btn-primary" disabled={isReadOnly || !isDirty} aria-busy={isSubmitting || undefined}>
            {isSubmitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
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
          </div>
          <div className="bb-card-body">
            {!isEnLang && (
              <p className="hint mb-3">
                <span className="text-[var(--admin-color-status-danger-text)]" aria-hidden="true">*</span>
                {' '}{t('categories.detail.requiredLegend', { defaultValue: 'Bắt buộc' })}
              </p>
            )}
            <div className="bb-grid-2">
              <label className="form-field" data-field="name">
                <span>
                  {t('categories.detail.name')}
                  {!isEnLang && requiredMark}
                  {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('categories.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
                </span>
                <Input
                  name="name"
                  value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                  onChange={(e) => isEnLang ? handleEnNameChange(e.target.value) : handleNameChange(e.target.value)}
                  disabled={isReadOnly}
                  placeholder={isEnLang ? t('categories.detail.namePlaceholderEn', { defaultValue: 'English name (optional)' }) : undefined}
                />
                {!isEnLang && validationErrors.name && (
                  <span className="hint text-danger flex items-center gap-1">
                    <AlertCircle size={13} aria-hidden="true" />{validationErrors.name}
                  </span>
                )}
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
                {validationErrors.parentId && (
                  <span className="hint text-danger flex items-center gap-1">
                    <AlertCircle size={13} aria-hidden="true" />{validationErrors.parentId}
                  </span>
                )}
              </label>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.introContent')}</span>
                <IntroContentField
                  key={`introContent-${contentLang}`}
                  value={isEnLang ? (form.translations?.en?.introContent ?? '') : form.introContent}
                  onChange={(html) => isEnLang ? updateTranslation('introContent', html) : updateField('introContent', html)}
                  lang={contentLang}
                  disabled={isReadOnly}
                />
                <span className="hint">{t('categories.introContentHint')}</span>
                {!isEnLang && validationErrors.introContent && <span className="hint text-danger">{validationErrors.introContent}</span>}
              </div>
              <div className="form-field" data-field="imageUrl" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.imageUrl')}</span>
                <ImageUrlInput
                  value={form.imageUrl}
                  onChange={(url) => updateField('imageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.imageUrl}
                  recommend={IMAGE_RECO.categoryImage}
                />
                <span className="hint">{t('categories.detail.imageUrlHint')}</span>
              </div>
              <div className="form-field" data-field="bannerImageUrl" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.bannerImageUrl')}</span>
                <ImageUrlInput
                  value={form.bannerImageUrl}
                  onChange={(url) => updateField('bannerImageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.bannerImageUrl}
                  recommend={IMAGE_RECO.bannerWide}
                />
                <span className="hint">{t('categories.detail.bannerImageUrlHint')}</span>
              </div>
              <div className="form-field" data-field="heroImageUrl" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.heroImageUrl')}</span>
                <ImageUrlInput
                  value={form.heroImageUrl}
                  onChange={(url) => updateField('heroImageUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.heroImageUrl}
                />
                <span className="hint">{t('categories.detail.heroImageUrlHint')}</span>
              </div>
              <div className="form-field" data-field="menuIconUrl" style={{ gridColumn: '1 / -1' }}>
                <span>{t('categories.detail.menuIconUrl')}</span>
                <ImageUrlInput
                  value={form.menuIconUrl}
                  onChange={(url) => updateField('menuIconUrl', url)}
                  disabled={isReadOnly}
                  error={validationErrors.menuIconUrl}
                />
                <span className="hint">{t('categories.detail.menuIconUrlHint')}</span>
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
            <label className="form-field" data-field={isEnLang ? 'translations.en.slug' : 'slug'}>
              <span>
                {t('categories.detail.slug')}
                {!isEnLang && requiredMark}
                {isEnLang && <span className="hint" style={{ display: 'inline', marginLeft: 6 }}>{t('categories.detail.enFieldHint', { defaultValue: '(tiếng Anh — tùy chọn)' })}</span>}
              </span>
              <Input
                name={isEnLang ? 'translations.en.slug' : 'slug'}
                value={isEnLang ? (form.translations?.en?.slug ?? '') : form.slug}
                onChange={(e) => isEnLang ? handleEnSlugChange(e.target.value) : handleSlugChange(e.target.value)}
                onBlur={() => validateFieldOnBlur(isEnLang ? 'translations.en.slug' : 'slug')}
                disabled={isReadOnly}
                placeholder={isEnLang ? t('categories.slugPlaceholderEn', { defaultValue: 'english-url-slug' }) : t('categories.slugPlaceholder')}
                style={{ fontFamily: 'var(--admin-font-mono)' }}
              />
              <span className="hint">{isEnLang ? t('categories.detail.slugHintEn', { defaultValue: 'Để trống sẽ dùng đường dẫn tiếng Việt cho bản tiếng Anh.' }) : t('categories.detail.slugHint')}</span>
              {isEnLang
                ? validationErrors['translations.en.slug'] && (
                  <span className="hint text-danger flex items-center gap-1">
                    <AlertCircle size={13} aria-hidden="true" />{validationErrors['translations.en.slug']}
                  </span>
                )
                : validationErrors.slug && (
                  <span className="hint text-danger flex items-center gap-1">
                    <AlertCircle size={13} aria-hidden="true" />{validationErrors.slug}
                  </span>
                )}
            </label>
          </div>
        </div>

        {/* SEO — hiển thị trên Google & mạng xã hội */}
        <SeoCard
          form={form}
          isEnLang={isEnLang}
          isReadOnly={isReadOnly}
          validationErrors={validationErrors}
          updateField={updateField}
          updateTranslation={updateTranslation}
          onFieldBlur={validateFieldOnBlur}
        />

        {/* Products in category */}
        {!isCreate && state.item && (
          <ProductsInCategoryCard
            item={state.item}
            productsList={productsList}
            productsTotal={productsTotal}
            navigate={navigate}
          />
        )}

        {/* Danger zone */}
        {!isCreate && canUpdate && (
          <DangerZoneCard onHardDelete={handleHardDelete} pending={hardDeleteMutation.isPending} />
        )}
      </form>
    </div>
  )
}
