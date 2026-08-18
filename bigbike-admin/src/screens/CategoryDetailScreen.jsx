import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { AlertCircle, ArrowLeft, Check, Copy, FolderTree, Globe2, Hash, Image as ImageIcon, Link2, Package, Save, Star, X as XIcon } from 'lucide-react'

import {
  createCategory,
  fetchCatalogFacets,
  fetchCategoryDetail,
  fetchCategoryTree,
  fetchProducts,
  hardDeleteCategory,
  previewCategoryPermanentDelete,
  mapValidationErrors,
  restoreCategory,
  updateCategory,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { recordRecentItem } from '../lib/useRecentItems'
import { formatDateTime, formatRelativeTime } from '../lib/formatters'
import { useContentLang, overlayEnNames } from '../lib/contentLang'
import { createCategorySchema, zodErrors } from '../lib/schemas'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { IntroContentField } from './category-detail/IntroContentField'
import { createCategoryAiPromptBuilder } from '../lib/aiContentProfile'
import { buildCategoryTreeOrder } from './product-detail/constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  STOREFRONT_BASE,
  MENU_NOTICE_DISMISSED_KEY,
  toSlug,
  buildEmptyForm,
  buildFormFromItem,
  toPayload,
  getAutosaveKey,
  saveFormToStorage,
  loadFormFromStorage,
  clearFormFromStorage,
} from './category-detail/constants'
import { SeoCard } from '../components/SeoCard'
import { Button } from '@/components/ui/button'
import { ProductsInCategoryCard } from './category-detail/ProductsInCategoryCard'
import { DangerZoneCard } from './category-detail/DangerZoneCard'
import { DetailSection } from '../components/DetailSection'
import { FormField, Screen, ScreenHeader } from '../components/layout'

function CategoryMetricCard({ label, value, icon: Icon, tone = 'info', hint, compact = false }) {
  return (
    <div className="bb-kpi">
      <div className="bb-kpi-head">
        <span>{label}</span>
        <span className={`bb-kpi-icon ${tone}`}>
          {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        </span>
      </div>
      <div className={compact ? 'flex min-h-7 items-center text-sm font-semibold text-foreground' : 'bb-kpi-value'}>
        {value}
      </div>
      {hint ? (
        <div className="bb-kpi-foot">
          <span className="bb-kpi-foot-label">{hint}</span>
        </div>
      ) : null}
    </div>
  )
}

function SidebarInfoRow({ label, children, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {Icon ? <Icon size={15} aria-hidden="true" className="shrink-0" /> : null}
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-right text-sm font-semibold text-foreground">{children}</dd>
    </div>
  )
}

export function CategoryDetailScreen({ categoryId, isCreate = false, navigate, canUpdate, canReadProducts }) {
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
  const [seoOpen, setSeoOpen] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const [isHardDeletePreviewing, setIsHardDeletePreviewing] = useState(false)
  const [menuNoticeDismissed, setMenuNoticeDismissed] = useState(() => {
    try { return localStorage.getItem(MENU_NOTICE_DISMISSED_KEY) === '1' }
    catch { return false }
  })

  // F9: autosave / khôi phục bản nháp — cùng cơ chế localStorage với Sản phẩm/Nội dung.
  const autosaveKey = getAutosaveKey(categoryId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

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
  const {
    data: productsInCat,
    isLoading: isProductsInCatLoading,
    isError: isProductsInCatError,
    refetch: refetchProductsInCat,
  } = useQuery({
    queryKey: ['products', 'by-category', categoryId, 'top5', 'ALL_INCLUDING_TRASH', contentLang],
    queryFn: () => fetchProducts({ categoryId, pageSize: 5, page: 1, sort: 'updatedAt:desc', publishStatus: 'ALL_INCLUDING_TRASH' }),
    enabled: canReadProducts && !isCreate && Boolean(categoryId),
    staleTime: 30 * 1000,
  })
  const productsList = productsInCat?.items ?? []
  const productsTotal = productsInCat?.pagination?.totalItems ?? 0

  const currentItem = fetchResult?.item ?? null

  const getCategoryAiPrompt = () => createCategoryAiPromptBuilder({
    categoryId,
    lang: contentLang,
    form: { ...form, id: categoryId },
    currentItem,
    fetchCategoryDetail,
    fetchCategoryTree,
    fetchCatalogFacets,
    basePrompt: () => t('categories.detail.introAiBriefPrompt'),
  })()

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
    // Loại chính nó + toàn bộ cháu con trước khi build cây, tránh chọn cha thành vòng lặp.
    const eligible = items.filter((c) => c.id !== 'uncategorized' && c.id !== categoryId && !descendants.has(c.id))
    return buildCategoryTreeOrder(eligible).map((c) => ({
      id: c.id,
      label: `${'— '.repeat(c.depth)}${c.name}`,
    }))
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
      // F9: bản nháp autosave mới hơn lần lưu gần nhất trên server → gợi ý khôi phục.
      if (item?.updatedAt) {
        const draft = loadFormFromStorage(autosaveKey)
        if (draft?.form && draft.ts > new Date(item.updatedAt).getTime()) {
          setDraftRecovery(draft)
        }
      }
    })
    return () => { cancelled = true }
  }, [autosaveKey, fetchResult])

  // F11: Nhân bản danh mục — nạp bản nháp CategoryListScreen ghi vào sessionStorage
  // khi bấm "Sao chép", rồi điều hướng sang màn tạo mới (cùng cơ chế duplicate của
  // Sản phẩm). Chỉ giữ lại slug/đường dẫn EN trống — admin phải đặt giá trị mới.
  useEffect(() => {
    if (!isCreate) return
    try {
      const raw = sessionStorage.getItem('category-duplicate-payload')
      if (raw) {
        sessionStorage.removeItem('category-duplicate-payload')
        const item = JSON.parse(raw)
        const base = buildFormFromItem(item)
        const duplicated = {
          ...base,
          slug: '',
          translations: { ...base.translations, en: { ...(base.translations?.en || {}), slug: '' } },
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(duplicated)
        setSlugManuallyEdited(false)
        setEnSlugManuallyEdited(false)
        toast.success(t('categories.detail.duplicateSuccess', { name: item.name || item.slug || '' }))
        return
      }
    } catch { /* ignore parse errors */ }

    // F9: chưa có bản sao chép — kiểm tra bản nháp autosave dở dang từ phiên trước.
    const draft = loadFormFromStorage(autosaveKey)
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate, t])

  // O9: ghi lại danh mục vừa xem để hiện trong widget "Vừa xem gần đây" ở danh sách.
  useEffect(() => {
    if (!isCreate && currentItem?.id) {
      recordRecentItem('recent:categories', {
        id: currentItem.id,
        label: currentItem.name || currentItem.slug || currentItem.id,
      })
    }
  }, [isCreate, currentItem?.id, currentItem?.name, currentItem?.slug])

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
  // Danh mục hệ thống "Chưa phân loại" bị khoá: chứa sản phẩm khi danh mục gốc bị
  // xoá, nên không cho sửa hay xoá (backend cũng chặn). Khoá form + ẩn nút xoá.
  const isUncategorized = !isCreate && categoryId === 'uncategorized'
  const isDeleted = !isCreate && currentItem?.deleted === true
  const isReadOnly = !canUpdate || isSubmitting || isUncategorized || isDeleted
  const formRef = useRef(null)

  // F6: cảnh báo rời trang khi chưa lưu — chặn cả điều hướng nội bộ (sidebar/breadcrumb)
  // qua navigationGuard lẫn reload/đóng tab qua beforeunload (hook tự gắn cả hai).
  useUnsavedChanges(isDirty)

  // F9: autosave — lưu bản nháp vào localStorage sau 10s không thao tác khi form dirty.
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, form), 10_000)
    return () => clearTimeout(timer)
  }, [form, isDirty, autosaveKey])

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate ? createCategory(payload) : updateCategory(categoryId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setInitialSnapshot(JSON.stringify(nextForm))
      setEnSlugManuallyEdited(Boolean(nextForm.translations?.en?.slug))
      clearFormFromStorage(autosaveKey)
      setDraftRecovery(null)
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      if (!isCreate) queryClient.setQueryData(['category', categoryId], response)
      toast.success(isCreate ? t('categories.detail.successCreate') : t('categories.detail.successUpdate'))
      setIsSubmitting(false)
      if (isCreate && savedItem?.id) {
        clearNavGuard() // form vừa lưu khớp baseline, tránh hỏi nhầm khi điều hướng sang trang chi tiết
        navigate(`/admin/categories/${savedItem.id}`, { replace: true })
      }
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
      clearFormFromStorage(autosaveKey)
      clearNavGuard() // đã xoá xong, không hỏi xác nhận khi rời trang
      navigate('/admin/categories')
    },
    onError: (error) => {
      const msg = error?.status === 409
        ? (error.message || t('categories.detail.hardDeleteConflict'))
        : (error.message || t('common.error'))
      toast.error(msg)
    },
  })

  async function handleHardDelete() {
    const name = form.name || categoryId
    let impact
    setIsHardDeletePreviewing(true)
    try {
      impact = await previewCategoryPermanentDelete([categoryId])
    } catch (error) {
      toast.error(error.message || t('categories.permanentDeleteImpactError'))
      return
    } finally {
      setIsHardDeletePreviewing(false)
    }
    const message = t('categories.permanentDeleteImpactConfirm', {
      name,
      descendantCount: impact.descendantCategoryCount,
      affectedProductCount: impact.affectedProductCount,
      reassignedProductCount: impact.reassignedProductCount,
    })
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

  const restoreMutation = useMutation({
    mutationFn: () => restoreCategory(categoryId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] })
      queryClient.setQueryData(['category', categoryId], response)
      toast.success(t('categories.restoreSuccess'))
    },
    onError: (error) => {
      toast.error(error.message || t('common.error'))
    },
  })

  async function handleRestore() {
    const name = form.name || categoryId
    const confirmed = await showConfirm(
      t('categories.restoreConfirm', { name, defaultValue: `Bạn có chắc chắn muốn khôi phục danh mục ${name}? Các danh mục con cũng sẽ được khôi phục.` }),
      t('categories.restoreConfirmTitle', { defaultValue: 'Xác nhận khôi phục' }),
      { confirmLabel: t('products.restore'), variant: 'default' }
    )
    if (!confirmed) return
    restoreMutation.mutate()
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

  function updateImageAsset(prefix, url, media) {
    setForm((previous) => ({
      ...previous,
      [`${prefix}Url`]: url,
      [`${prefix}Width`]: media?.width ?? null,
      [`${prefix}Height`]: media?.height ?? null,
      [`${prefix}MimeType`]: media?.mimeType ?? '',
    }))
    setValidationErrors((previous) => {
      const field = `${prefix}Url`
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

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canUpdate || isUncategorized) return

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

    saveMutation.mutate(toPayload(form, { isCreate }))
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
        // F6: đã xác nhận bỏ thay đổi qua hộp thoại riêng ở trên — bỏ qua lời nhắc
        // trùng lặp của navigationGuard (useUnsavedChanges) khi navigate() chạy dưới đây.
        clearNavGuard()
      }
      navigate('/admin/categories')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDirty, isSubmitting, navigate, t])

  if (state.status === 'loading') {
    // N5: khung xương thay cho StatePanel căn giữa — tránh giật bố cục (CLS) khi dữ liệu
    // về, vì trang thật có header + nhiều bb-card (thông tin cơ bản, slug, SEO, sản phẩm)
    // chứ không phải một panel nhỏ. Cùng kiểu dựng animate-pulse như ProductDetailScreen.
    return (
      <div className="animate-pulse" aria-hidden="true">
        <div className="bb-screen-header">
          <div className="bb-screen-title flex flex-col gap-2">
            <div className="h-3 w-32 rounded-xs bg-surface-muted" />
            <div className="h-7 w-64 max-w-full rounded-xs bg-surface-muted" />
            <div className="h-3 w-48 max-w-full rounded-xs bg-surface-muted" />
          </div>
          <div className="bb-screen-actions">
            <div className="h-9 w-32 rounded-sm bg-surface-muted" />
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
          </div>
        </div>
        <div className="bb-card mb-4">
          <div className="h-10 border-b border-border bg-surface-muted/60" />
          <div className="bb-card-body flex flex-col gap-3">
            <div className="h-4 w-1/3 rounded-xs bg-surface-muted" />
            <div className="h-9 w-full rounded-sm bg-surface-muted" />
            <div className="h-16 w-full rounded-sm bg-surface-muted" />
          </div>
        </div>
        <div className="bb-card">
          <div className="h-10 border-b border-border bg-surface-muted/60" />
          <div className="bb-card-body flex flex-col gap-3">
            <div className="h-10 w-full rounded-sm bg-surface-muted" />
            <div className="h-10 w-full rounded-sm bg-surface-muted" />
          </div>
        </div>
      </div>
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/categories')}
        >
          {t('categories.detail.backToList')}
        </Button>
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

  // F13: tiến độ điền các mục bắt buộc (tên, đường dẫn URL) — chỉ có ý nghĩa ở bản
  // tiếng Việt, vì bản tiếng Anh không có mục nào bắt buộc.
  const requiredFieldsTotal = 2
  const requiredFieldsFilled = [form.name, form.slug].filter((v) => Boolean(v?.trim())).length
  const requiredProgressText = t('categories.detail.formProgress', { filled: requiredFieldsFilled, total: requiredFieldsTotal })
  const selectedParent = parentOptions.find((c) => c.id === form.parentId)
  const parentSummary = form.parentId
    ? (selectedParent?.label || t('categories.detail.parentSelected', { defaultValue: 'Danh mục con' }))
    : t('categories.detail.rootCategory', { defaultValue: 'Danh mục gốc' })
  const imageCount = [
    form.imageUrl,
    form.bannerImageUrl,
    form.mobileBannerImageUrl,
    form.heroImageUrl,
    form.menuIconUrl,
  ].filter((v) => Boolean(v?.trim())).length
  const currentSlug = isEnLang ? (form.translations?.en?.slug || form.slug) : form.slug
  const displayName = isEnLang ? (form.translations?.en?.name || form.name) : form.name

  return (
    <Screen>
      <ScreenHeader
        eyebrow={(
          <a
            href="/admin/categories"
            onClick={(e) => { e.preventDefault(); navigate('/admin/categories') }}
            className="inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bb-primary)]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t('categories.detail.backToList')}
          </a>
        )}
        title={isCreate ? t('categories.detail.createTitle') : t('categories.detail.editTitle')}
        description={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{displayName || t('categories.detail.untitledCategory', { defaultValue: 'Danh mục chưa đặt tên' })}</span>
            {currentSlug ? (
              <>
                <span aria-hidden="true">/</span>
                <code className="mono">{currentSlug}</code>
              </>
            ) : null}
            {breadcrumbPath ? (
              <>
                <span aria-hidden="true">/</span>
                <span>{breadcrumbPath}</span>
              </>
            ) : null}
          </span>
        )}
        badge={!isCreate && state.item ? <StatusBadge type="visibility" status={state.item.isVisible} /> : null}
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
            {!isEnLang && (
              <span className="inline-flex min-h-9 items-center text-xs text-muted-foreground">
                {requiredProgressText}
              </span>
            )}
            <Button type="submit" form="category-form" className="min-h-11" disabled={isReadOnly || !isDirty} loading={isSubmitting}>
              <Save size={16} aria-hidden="true" />
              {isCreate ? t('categories.detail.createBtn') : t('categories.detail.saveBtn')}
            </Button>
          </div>
        )}
      />

      {draftRecovery && (
        <div className="bb-alert info center wrap">
          <Save size={14} className="shrink-0" />
          <span className="bb-alert-main truncate">
            <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
            {' - '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
          </span>
          <Button
            variant="unstyled"
            type="button"
            className="text-xs font-semibold underline hover:no-underline"
            onClick={() => {
              setForm(draftRecovery.form)
              setDraftRecovery(null)
              setSlugManuallyEdited(true)
              setEnSlugManuallyEdited(Boolean(draftRecovery.form?.translations?.en?.slug))
            }}
          >
            {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
          </Button>
          <Button
            variant="unstyled"
            type="button"
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
          title={t('categories.detail.permissionDenied')}
          description={t('categories.detail.permissionDesc')}
        />
      ) : null}

      {isUncategorized ? (
        <StatePanel
          tone="info"
          title={t('categories.detail.systemCategoryTitle')}
          description={t('categories.detail.systemCategoryDesc')}
        />
      ) : null}

      {isDeleted ? (
        <StatePanel
          tone="warning"
          title={t('categories.detail.trashedTitle', { defaultValue: 'Danh mục đã ở thùng rác.' })}
          description={t('categories.detail.trashedDesc', { defaultValue: 'Khôi phục danh mục để tiếp tục chỉnh sửa.' })}
        />
      ) : null}

      {!isCreate && canUpdate && !menuNoticeDismissed && (
        <div className="bb-alert info wrap justify-between">
          <div>
            <strong>{t('categories.detail.menuNoticeTitle')}</strong>
            <p className="mb-1.5 mt-1">{t('categories.detail.menuNoticeDesc')}</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/admin/menus')}>
                {t('categories.detail.menuNoticeAction')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleDismissMenuNotice}>
                {t('categories.detail.menuNoticeDismiss')}
              </Button>
            </div>
          </div>
          <Button
            variant="unstyled"
            type="button"
            className="bb-icon-btn"
            aria-label={t('categories.detail.menuNoticeDismiss')}
            onClick={handleDismissMenuNotice}
          >
            <XIcon size={16} aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="bb-kpi-grid bb-kpi-grid-4">
        <CategoryMetricCard
          icon={Package}
          tone="info"
          label={t('categories.detail.productsMetric', { defaultValue: 'Sản phẩm' })}
          value={isCreate ? '0' : productsTotal.toLocaleString('vi-VN')}
          hint={isCreate
            ? t('categories.detail.productsMetricCreateHint', { defaultValue: 'Sẽ gắn sau khi tạo danh mục' })
            : t('categories.detail.productCount', { count: productsTotal })}
        />
        <CategoryMetricCard
          icon={FolderTree}
          tone="brand"
          label={t('categories.detail.parentMetric', { defaultValue: 'Vị trí' })}
          value={form.parentId
            ? t('categories.detail.childCategoryShort', { defaultValue: 'Cấp con' })
            : t('categories.detail.rootCategoryShort', { defaultValue: 'Gốc' })}
          hint={parentSummary}
        />
        <CategoryMetricCard
          icon={Star}
          tone={form.showOnHomepage ? 'warning' : 'info'}
          label={t('categories.detail.homepageMetric', { defaultValue: 'Trang chủ' })}
          value={form.showOnHomepage ? t('common.yes', { defaultValue: 'Có' }) : t('common.no', { defaultValue: 'Không' })}
          hint={t('categories.detail.showOnHomepage')}
        />
        <CategoryMetricCard
          icon={ImageIcon}
          tone={imageCount > 0 ? 'success' : 'info'}
          label={t('categories.detail.imagesMetric', { defaultValue: 'Hình ảnh' })}
          value={`${imageCount}/5`}
          hint={t('categories.detail.imagesMetricHint', { defaultValue: 'Ảnh danh mục, banner và icon' })}
        />
      </div>

      <form
        id="category-form"
        ref={formRef}
        className="grid gap-6"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
            handleSubmit(e)
          }
        }}
      >
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <div className="grid gap-6 lg:col-span-2">
            <DetailSection
              title={t('categories.sectionBasic')}
              description={t('categories.sectionBasicDesc')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div data-field={isEnLang ? 'translations.en.name' : 'name'}>
                  <FormField
                    label={t('categories.detail.name')}
                    required
                    error={isEnLang ? validationErrors['translations.en.name'] : validationErrors.name}
                    helper={isEnLang
                      ? t('categories.detail.namePlaceholderEn', { defaultValue: 'Tên danh mục bằng tiếng Anh.' })
                      : t('categories.detail.nameHelper', { defaultValue: 'Tên khách nhìn thấy trên website và trong bộ lọc sản phẩm.' })}
                  >
                    <Input
                      name={isEnLang ? 'translations.en.name' : 'name'}
                      value={isEnLang ? (form.translations?.en?.name ?? '') : form.name}
                      onChange={(e) => isEnLang ? handleEnNameChange(e.target.value) : handleNameChange(e.target.value)}
                      onBlur={() => validateFieldOnBlur(isEnLang ? 'translations.en.name' : 'name')}
                      disabled={isReadOnly}
                      placeholder={isEnLang ? t('categories.detail.namePlaceholderEn', { defaultValue: 'English name' }) : undefined}
                    />
                  </FormField>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="category-parent-select">
                    {t('categories.detail.parentId')}
                  </label>
                  <Select
                    value={form.parentId || '__none__'}
                    onValueChange={(val) => updateField('parentId', val === '__none__' ? '' : val)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger id="category-parent-select" aria-invalid={validationErrors.parentId ? true : undefined}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('categories.detail.parentIdNone')}</SelectItem>
                      {parentOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {validationErrors.parentId ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                      <AlertCircle size={13} aria-hidden="true" />{validationErrors.parentId}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('categories.detail.parentIdHint')}</span>
                  )}
                </div>

                <div className="md:col-span-2" data-field={isEnLang ? 'translations.en.slug' : 'slug'}>
                  <FormField
                    label={t('categories.detail.slug')}
                    required={!isEnLang}
                    error={isEnLang ? validationErrors['translations.en.slug'] : validationErrors.slug}
                    helper={isEnLang
                      ? t('categories.detail.slugHintEn', { defaultValue: 'Để trống sẽ dùng đường dẫn tiếng Việt cho bản tiếng Anh.' })
                      : t('categories.detail.slugHint')}
                  >
                    <Input
                      name={isEnLang ? 'translations.en.slug' : 'slug'}
                      value={isEnLang ? (form.translations?.en?.slug ?? '') : form.slug}
                      onChange={(e) => isEnLang ? handleEnSlugChange(e.target.value) : handleSlugChange(e.target.value)}
                      onBlur={() => validateFieldOnBlur(isEnLang ? 'translations.en.slug' : 'slug')}
                      disabled={isReadOnly}
                      placeholder={isEnLang ? t('categories.slugPlaceholderEn', { defaultValue: 'duong-dan-tieng-anh' }) : t('categories.slugPlaceholder')}
                      className="font-mono"
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2 flex flex-col gap-3 rounded-sm border border-border bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-foreground">{t('categories.detail.showOnHomepage')}</p>
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                      {t('categories.detail.showOnHomepageHint', { defaultValue: 'Bật khi danh mục cần xuất hiện ở khu vực nổi bật trên trang chủ.' })}
                    </p>
                  </div>
                  <Switch
                    id="category-homepage-switch"
                    checked={form.showOnHomepage}
                    onCheckedChange={(checked) => updateField('showOnHomepage', Boolean(checked))}
                    disabled={isReadOnly}
                    aria-label={t('categories.detail.showOnHomepage')}
                  />
                </div>
              </div>
            </DetailSection>

            <DetailSection
              title={t('categories.detail.introContent')}
              description={t('categories.introContentHint')}
              contentClassName="grid gap-3"
            >
              <div data-field="introContent">
                <IntroContentField
                  key={`introContent-${contentLang}`}
                  value={isEnLang ? (form.translations?.en?.introContent ?? '') : form.introContent}
                  onChange={(html) => isEnLang ? updateTranslation('introContent', html) : updateField('introContent', html)}
                  lang={contentLang}
                  getAiPrompt={getCategoryAiPrompt}
                  disabled={isReadOnly}
                />
              </div>
              {!isEnLang && validationErrors.introContent ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                  <AlertCircle size={13} aria-hidden="true" />{validationErrors.introContent}
                </span>
              ) : null}
            </DetailSection>

            <DetailSection
              title={t('categories.detail.imagesSection', { defaultValue: 'Hình ảnh trên website' })}
              description={t('categories.detail.imagesSectionDesc', { defaultValue: 'Quản lý ảnh thẻ danh mục, banner máy tính, banner điện thoại, ảnh minh hoạ và biểu tượng menu.' })}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="form-field" data-field="imageUrl">
                  <span>{t('categories.detail.imageUrl')}</span>
                  <ImageUrlInput
                    value={form.imageUrl}
                    onChange={(url, media) => updateImageAsset('image', url, media)}
                    alt={form.imageAlt}
                    onAltChange={(alt) => updateField('imageAlt', alt)}
                    previewAlt={form.imageAlt || t('categories.detail.imageAlt', { defaultValue: 'Ảnh đại diện danh mục' })}
                    disabled={isReadOnly}
                    error={validationErrors.imageUrl}
                    recommend={IMAGE_RECO.categoryImage}
                  />
                  <span className="hint">{t('categories.detail.imageUrlHint')}</span>
                </div>
                <div className="form-field" data-field="bannerImageUrl">
                  <span>{t('categories.detail.bannerImageUrl')}</span>
                  <ImageUrlInput
                    value={form.bannerImageUrl}
                    onChange={(url) => updateField('bannerImageUrl', url)}
                    alt={form.bannerImageAlt}
                    onAltChange={(alt) => updateField('bannerImageAlt', alt)}
                    previewAlt={form.bannerImageAlt || t('categories.detail.bannerAlt', { defaultValue: 'Ảnh nền hero danh mục' })}
                    disabled={isReadOnly}
                    error={validationErrors.bannerImageUrl}
                    recommend={IMAGE_RECO.bannerWide}
                  />
                  <span className="hint">{t('categories.detail.bannerImageUrlHint')}</span>
                </div>
                <div className="form-field" data-field="mobileBannerImageUrl">
                  <span>{t('categories.detail.mobileBannerImageUrl', { defaultValue: 'Ảnh banner điện thoại' })}</span>
                  <ImageUrlInput
                    value={form.mobileBannerImageUrl}
                    onChange={(url) => updateField('mobileBannerImageUrl', url)}
                    alt={form.mobileBannerImageAlt}
                    onAltChange={(alt) => updateField('mobileBannerImageAlt', alt)}
                    previewAlt={form.mobileBannerImageAlt || t('categories.detail.mobileBannerAlt', { defaultValue: 'Ảnh nền đầu trang trên điện thoại' })}
                    disabled={isReadOnly}
                    error={validationErrors.mobileBannerImageUrl}
                    recommend={IMAGE_RECO.bannerWide}
                  />
                </div>
                <div className="form-field" data-field="heroImageUrl">
                  <span>{t('categories.detail.heroImageUrl')}</span>
                  <ImageUrlInput
                    value={form.heroImageUrl}
                    onChange={(url, media) => updateImageAsset('heroImage', url, media)}
                    alt={form.heroImageAlt}
                    onAltChange={(alt) => updateField('heroImageAlt', alt)}
                    previewAlt={form.heroImageAlt || t('categories.detail.heroAlt', { defaultValue: 'Ảnh minh họa hero danh mục' })}
                    disabled={isReadOnly}
                    error={validationErrors.heroImageUrl}
                    recommend={IMAGE_RECO.illustration}
                  />
                  <span className="hint">{t('categories.detail.heroImageUrlHint')}</span>
                </div>
                <div className="form-field md:col-span-2" data-field="menuIconUrl">
                  <span>{t('categories.detail.menuIconUrl')}</span>
                  <ImageUrlInput
                    value={form.menuIconUrl}
                    onChange={(url) => updateField('menuIconUrl', url)}
                    previewAlt={t('categories.detail.menuIconAlt', { defaultValue: 'Icon menu danh mục' })}
                    disabled={isReadOnly}
                    error={validationErrors.menuIconUrl}
                  />
                  <span className="hint">{t('categories.detail.menuIconUrlHint')}</span>
                </div>
              </div>
            </DetailSection>

            <SeoCard
              form={form}
              isEnLang={isEnLang}
              isReadOnly={isReadOnly}
              validationErrors={validationErrors}
              updateField={updateField}
              updateTranslation={updateTranslation}
              onFieldBlur={validateFieldOnBlur}
              i18nPrefix="categories.detail"
              descKey="categories.sectionSeoDesc"
              previewBase={STOREFRONT_BASE}
              previewSlugDefault="duong-dan-danh-muc"
              englishReady={Boolean(
                form.translations?.en?.name?.trim()
                && (form.translations?.en?.description?.trim() || form.translations?.en?.introContent?.trim()),
              )}
              collapsible
              open={seoOpen}
              onToggle={() => setSeoOpen((v) => !v)}
            />

            {!isCreate && state.item && (
              <ProductsInCategoryCard
                item={state.item}
                productsList={productsList}
                productsTotal={productsTotal}
                navigate={navigate}
                isLoading={isProductsInCatLoading}
                isError={isProductsInCatError}
                onRetry={refetchProductsInCat}
                permissionDenied={!canReadProducts}
              />
            )}
          </div>

          <aside className="grid h-fit gap-6 lg:sticky lg:top-4">
            <DetailSection
              title={t('categories.detail.statusSection', { defaultValue: 'Tình trạng danh mục' })}
              description={t('categories.detail.statusSectionDesc', { defaultValue: 'Các thông tin giúp kiểm tra nhanh trước khi lưu.' })}
            >
              <dl className="m-0">
                <SidebarInfoRow label={t('categories.detail.visibility', { defaultValue: 'Hiển thị' })} icon={Globe2}>
                  {!isCreate && state.item ? <StatusBadge type="visibility" status={state.item.isVisible} /> : t('categories.detail.createStatusDraft', { defaultValue: 'Chưa lưu' })}
                </SidebarInfoRow>
                <SidebarInfoRow label={t('categories.detail.productsMetric', { defaultValue: 'Sản phẩm' })} icon={Package}>
                  {isCreate ? '0' : productsTotal.toLocaleString('vi-VN')}
                </SidebarInfoRow>
                <SidebarInfoRow label={t('categories.detail.parentMetric', { defaultValue: 'Vị trí' })} icon={FolderTree}>
                  <span className="break-words">{parentSummary}</span>
                </SidebarInfoRow>
                <SidebarInfoRow label={t('categories.detail.slug')} icon={Link2}>
                  {currentSlug ? <code className="mono break-all">{currentSlug}</code> : t('common.empty', { defaultValue: 'Chưa có' })}
                </SidebarInfoRow>
                {!isCreate && state.item?.updatedAt ? (
                  <SidebarInfoRow label={t('common.lastUpdated')} icon={Save}>
                    <span title={formatDateTime(state.item.updatedAt)}>
                      {formatRelativeTime(state.item.updatedAt, t)}
                    </span>
                  </SidebarInfoRow>
                ) : null}
              </dl>

              {!isCreate && state.item?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full justify-start"
                  onClick={handleCopyId}
                  title={t('categories.detail.copyId')}
                >
                  <Hash size={16} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-left font-mono">{state.item.id}</span>
                  {idCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                </Button>
              ) : null}
            </DetailSection>

            <DetailSection
              title={t('categories.detail.saveSection', { defaultValue: 'Lưu thay đổi' })}
              description={isReadOnly
                ? t('categories.detail.saveDisabledHint', { defaultValue: 'Màn hình đang ở chế độ chỉ xem hoặc bị khóa.' })
                : t('categories.detail.saveSectionDesc', { defaultValue: 'Kiểm tra mục bắt buộc rồi lưu khi đã sẵn sàng.' })}
            >
              <div className="grid gap-3">
                {!isEnLang ? (
                  <div className="rounded-sm border border-border bg-surface-muted p-3">
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm font-semibold">
                      <span>{t('categories.detail.requiredLegend', { defaultValue: 'Bắt buộc' })}</span>
                      <span>{requiredFieldsFilled}/{requiredFieldsTotal}</span>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">{requiredProgressText}</p>
                  </div>
                ) : null}
                <Button type="submit" form="category-form" className="min-h-11 w-full" disabled={isReadOnly || !isDirty} loading={isSubmitting}>
                  <Save size={16} aria-hidden="true" />
                  {isCreate ? t('categories.detail.createBtn') : t('categories.detail.saveBtn')}
                </Button>
                <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={() => navigate('/admin/categories')}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  {t('categories.detail.backToList')}
                </Button>
              </div>
            </DetailSection>

            {!isCreate && canUpdate && !isUncategorized && (
              <DangerZoneCard
                onHardDelete={handleHardDelete}
                pending={isHardDeletePreviewing || hardDeleteMutation.isPending}
                isDeleted={isDeleted}
                onRestore={handleRestore}
                restorePending={restoreMutation.isPending}
              />
            )}
          </aside>
        </div>
      </form>
    </Screen>
  )

}
