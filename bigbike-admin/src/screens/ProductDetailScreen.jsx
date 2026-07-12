import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import {
  AlertCircle, Check, Download, Eye, Info, Loader2, Lock, Save, Search as PfSearch, X,
} from 'lucide-react'

import {
  createProduct,
  exportProductJson,
  fetchBrands,
  fetchCategoryTree,
  fetchProductAssignment,
  fetchProductDetail,
  mapValidationErrors,
  previewProduct,
  updateProduct,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { recordRecentItem } from '../lib/useRecentItems'
import { formatDateTime } from '../lib/formatters'
import { useContentLang, overlayEnNames } from '../lib/contentLang'
import { createProductSchema, zodErrors, normalizeVariantToken, isColorAttributeName } from '../lib/schemas'
import { Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { useProductPicker } from '../lib/useProductPicker'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { parseSpecsFromHtml } from '../lib/specSheet'
import { parseSpecStatsFromHtml } from '../lib/specStatsBlock'
import { parseTrustBadgesFromHtml } from '../lib/trustBadgesBlock'
import { RichTextEditorWithSource } from '../components/RichTextEditorWithSource'
import { BlockEditor } from '../components/BlockEditor'
import { SuitabilityBlockEditor, SizeGuideBlockEditor } from '../components/block-editor/blocks'
import { createBlock } from '../components/block-editor/constants'
import { SortableList } from '../components/Sortable'
import { LivePreview } from '../components/LivePreview'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn, generateId } from '@/lib/utils'

import {
  slugify,
  getAllowedPublishStatuses,
  formatPrice,
  getAutosaveKey,
  saveFormToStorage,
  loadFormFromStorage,
  clearFormFromStorage,
  buildEmptyForm,
  findOptionById,
  prependSelectedOption,
  buildCategoryPathMap,
  buildCategoryTreeOrder,
  buildFormFromItem,
  toPayload,
  canonicalUrlFromSlug,
  TAB_SECTIONS,
  computeSectionErrorsFromMap,
  findTabForErrors,
  findGroupForErrors,
  computeAttrSetWarning,
  PRODUCT_GROUPS,
  publishBadgeClass,
  RELATED_PRODUCTS_MAX,
  SPEC_STAT_MAX,
  VARIANTS_FILTER_THRESHOLD,
} from './product-detail/constants'

// ── Sub-components ─────────────────────────────────────────────────────────────

import {
  GalleryEditor,
  VideoEditor,
  SpecificationsEditor,
  HighlightsEditor,
  FaqEditor,
} from './product-detail/ContentEditors'

// Trình soạn khối "Phù hợp với ai" (V240): danh sách thẻ tư vấn, thêm/bớt/đảo thứ tự. Mỗi thẻ
// gồm Đối tượng (in đậm) + Lời khuyên + Link gợi ý tùy chọn. Đối tượng/lời khuyên/nhãn-link song
// ngữ theo contentLang; ĐƯỜNG DẪN link (linkUrl) dùng chung cả VI/EN (không dịch). Mirror FaqEditor.
// (V246) SuitabilityEditor đã gỡ — "Phù hợp với ai" giờ nhập qua KHỐI suitability trong trình dựng mô tả.

import {
  CommitmentEditor,
  SpecStatEditor,
  TrustBadgesEditor,
} from './product-detail/RowEditors'

import {
  VariantsEditor,
  VariantMatrixWizard,
} from './product-detail/VariantEditors'
import { PublishChecklistModal } from './product-detail/Modals'
// ── Prototype form layout ───────────────────────────────────────────────────────

import {
  RelatedProductRow,
  RoleBadge,
  CollapsibleGroup,
  AssignmentBanner,
} from './product-detail/Layout'
import { SectionCard } from '../components/SectionCard'
import { FormField as Field } from '../components/layout/FormField'
import { AssignmentConfigContext } from './product-detail/constants'

// "Phù hợp với ai" (suitability) và "Bảng size" (sizeGuide) có card riêng NGOÀI trình dựng mô tả, và
// (V327/V328) dữ liệu của chúng giờ cũng lưu ở 2 field riêng (form.suitabilitySection/sizeGuideSection)
// — không còn embedded trong descriptionBlocks, không cần helper lọc/ghép nữa.
// Nhãn hiển thị cho giới tính khi contentLang='en' — value lưu DB vẫn luôn "Nam"/"Nữ" (DATA_CONTRACT.md).
const GENDER_LABEL_EN = { Nam: 'Male', 'Nữ': 'Female' }

// ── Main screen ────────────────────────────────────────────────────────────────

export function ProductDetailScreen({ productId, isCreate = false, navigate, canUpdate }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(buildEmptyForm)
  // Dirty tracking via boolean flag (set true on any field update, reset on
  // load/save). JSON.stringify(form) was the previous strategy but ran on
  // every render and grew O(N) with variants count — dropped sharply when
  // some sản phẩm lên tới 100+ biến thể.
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExportingJson, setIsExportingJson] = useState(false)
  const slugEditedByUser = useRef(false)
  const enSlugEditedByUser = useRef(false)
  const [originalPublishStatus, setOriginalPublishStatus] = useState(null)

  // ── Live preview (xem trước storefront) ──────────────────────────────────────
  // Pane nhúng iframe bigbike-web /preview/product; debounce form rồi gọi dry-run
  // (KHÔNG lưu) lấy public Product và đẩy sang iframe. Reuse VITE_STOREFRONT_BASE_URL
  // (origin web đã dùng cho link admin→storefront). Docs: API_CONTRACT "Product
  // preview" + WORKFLOW_OVERVIEW "Product Authoring & Live Preview".
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
        const product = await previewProduct(toPayload(form), previewLang)
        if (!cancelled) {
          setPreviewData(product)
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
  }, [previewOpen, previewLang, form])

  // Autosave / draft recovery
  const autosaveKey = getAutosaveKey(productId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

  // Publish checklist
  const [showPublishChecklist, setShowPublishChecklist] = useState(false)
  const [pendingPublish, setPendingPublish] = useState(null)

  // Variant matrix wizard
  const [showMatrixWizard, setShowMatrixWizard] = useState(false)

  // Discount helper for salePrice
  const [showDiscountHelper, setShowDiscountHelper] = useState(false)
  const [discountPct, setDiscountPct] = useState('')

  const { data: fetchResult, isLoading, isError, error: fetchError, refetch } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductDetail(productId),
    enabled: !isCreate,
  })

  // Ô gán Danh mục / Thương hiệu phải liệt kê ĐẦY ĐỦ để gán được cả mục chưa dịch.
  // Lấy danh sách 'vi' đầy đủ; ở EN nạp thêm danh sách 'en' để phủ tên Anh khi có.
  const isEn = contentLang === 'en'
  const { data: categoriesResultVi } = useQuery({
    queryKey: ['categories', 'tree', 'vi'],
    queryFn: () => fetchCategoryTree('vi'),
    staleTime: 5 * 60 * 1000,
  })
  const { data: categoriesResultEn } = useQuery({
    queryKey: ['categories', 'tree', 'en'],
    queryFn: () => fetchCategoryTree('en'),
    enabled: isEn,
    staleTime: 5 * 60 * 1000,
  })
  const { data: brandsResultVi } = useQuery({
    queryKey: ['brands-all', 'vi'],
    queryFn: () => fetchBrands({ pageSize: 100, lang: 'vi' }),
    staleTime: 5 * 60 * 1000,
  })
  const { data: brandsResultEn } = useQuery({
    queryKey: ['brands-all', 'en'],
    queryFn: () => fetchBrands({ pageSize: 100, lang: 'en' }),
    enabled: isEn,
    staleTime: 5 * 60 * 1000,
  })
  const categoriesResult = useMemo(
    () => (isEn ? { items: overlayEnNames(categoriesResultVi?.items, categoriesResultEn?.items) } : categoriesResultVi),
    [isEn, categoriesResultVi, categoriesResultEn],
  )
  const brandsResult = useMemo(
    () => (isEn ? { items: overlayEnNames(brandsResultVi?.items, brandsResultEn?.items) } : brandsResultVi),
    [isEn, brandsResultVi, brandsResultEn],
  )
  // Editable "Phân công" banner text (role names + task lists). Read-only here
  // (products.read); SUPER_ADMIN edits it in Cài đặt → Phân công sản phẩm.
  const { data: assignmentConfig } = useQuery({
    queryKey: ['product-assignment'],
    queryFn: () => fetchProductAssignment(),
    staleTime: 5 * 60 * 1000,
  })
  const categories = categoriesResult?.items ?? []
  const brands = brandsResult?.items ?? []
  const loadedProduct = fetchResult?.item ?? null
  const selectedCategoryRef = findOptionById(
    [
      loadedProduct?.category,
      ...(Array.isArray(loadedProduct?.categories) ? loadedProduct.categories : []),
    ].filter(Boolean),
    form.categoryId,
  )
  const selectedBrandRef = findOptionById([loadedProduct?.brand].filter(Boolean), form.brandId)
  const categoryOptions = prependSelectedOption(categories, selectedCategoryRef)
  const brandOptions = prependSelectedOption(brands, selectedBrandRef)
  // Nhãn "Cha › Con › Cháu" để phân biệt cha/con khi cây danh mục có nhiều cấp.
  const categoryPathById = useMemo(() => buildCategoryPathMap(categoryOptions), [categoryOptions])
  // Thứ tự cây + độ sâu để thụt lề con dưới cha trong ô chọn danh mục.
  const categoryTree = useMemo(() => buildCategoryTreeOrder(categoryOptions), [categoryOptions])
  const selectedCategoryLabel =
    categoryPathById.get(form.categoryId) ||
    findOptionById(categoryOptions, form.categoryId)?.name ||
    (form.categoryId ? t('products.detail.optionNotFound', { id: form.categoryId }) : undefined)
  const selectedBrandLabel =
    findOptionById(brandOptions, form.brandId)?.name ||
    (form.brandId ? t('products.detail.optionNotFound', { id: form.brandId }) : undefined)

  // Product picker for the "Sản phẩm liên quan" section — debounced search,
  // self excluded so a product can't be added to its own related list.
  const {
    search: relatedSearch,
    setSearch: setRelatedSearch,
    debouncedSearch: relatedSearchDebounced,
    items: relatedSearchItemsRaw,
    isFetching: isSearchingRelated,
    reset: resetRelatedSearch,
  } = useProductPicker({
    queryKey: 'product-related-search',
    contentLang,
    params: { pageSize: 8 },
    staleTime: 60 * 1000,
  })
  const relatedSearchItems = relatedSearchItemsRaw.filter((p) => p.id !== productId)
  const relatedAtMax = form.relatedProductIds.length >= RELATED_PRODUCTS_MAX

  // Product picker for the "Phụ kiện" section — debounced search, self excluded so a
  // product can't be added to its own accessory list. Mirrors the related-products picker.
  const {
    search: accessorySearch,
    setSearch: setAccessorySearch,
    debouncedSearch: accessorySearchDebounced,
    items: accessorySearchItemsRaw,
    isFetching: isSearchingAccessory,
    reset: resetAccessorySearch,
  } = useProductPicker({
    queryKey: 'product-accessory-search',
    contentLang,
    params: { pageSize: 8 },
    staleTime: 60 * 1000,
  })
  const accessorySearchItems = accessorySearchItemsRaw.filter((p) => p.id !== productId)
  const accessoryAtMax = form.accessoryProductIds.length >= RELATED_PRODUCTS_MAX

  useEffect(() => {
    if (!fetchResult) return
    const item = fetchResult.item || null
    const nextForm = buildFormFromItem(item)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm)
    setIsDirty(false)
    slugEditedByUser.current = Boolean(nextForm.slug)
    enSlugEditedByUser.current = Boolean(nextForm.translations?.en?.slug)
    setOriginalPublishStatus(nextForm.publishStatus)

    // Check autosave newer than server updatedAt
    if (!isCreate && item?.updatedAt) {
      const draft = loadFormFromStorage(autosaveKey)
      if (draft?.form && draft.ts > new Date(item.updatedAt).getTime()) {
        setDraftRecovery(draft)
      }
    }
  }, [autosaveKey, fetchResult, isCreate])

  // O9: ghi lại sản phẩm vừa xem để hiện trong widget "Vừa xem gần đây" ở danh sách.
  useEffect(() => {
    if (!isCreate && fetchResult?.item?.id) {
      recordRecentItem('recent:products', {
        id: fetchResult.item.id,
        label: fetchResult.item.name || t('products.detail.productFallbackName'),
      })
    }
  }, [isCreate, fetchResult?.item?.id, fetchResult?.item?.name, t])

  // Check autosave on mount for create mode; also handle product duplicate payload
  useEffect(() => {
    if (!isCreate) return

    // Duplicate product: pre-fill form from sessionStorage payload
    try {
      const raw = sessionStorage.getItem('product-duplicate-payload')
      if (raw) {
        sessionStorage.removeItem('product-duplicate-payload')
        const item = JSON.parse(raw)
        const base = buildFormFromItem(item)
        const duplicated = {
          ...base,
          // Clear identity fields — user must set unique values
          slug: '',
          // English slug is also identity — clear it so the copy doesn't collide.
          translations: { ...base.translations, en: { ...(base.translations?.en || {}), slug: '' } },
          sku: base.sku ? `${base.sku}-COPY` : '',
          publishStatus: 'DRAFT',
          // Clear variants IDs so they create as new
          variants: base.variants.map((v) => ({ ...v, _key: generateId(), id: '' })),
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(duplicated)
        setIsDirty(true)
        slugEditedByUser.current = false
        enSlugEditedByUser.current = false
        toast.success(t('products.detail.duplicateSuccess', { name: item.name || t('products.detail.productFallbackName') }))
        return
      }
    } catch { /* ignore parse errors */ }

    const draft = loadFormFromStorage(autosaveKey)
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate, t])

  // Autosave when dirty
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, form), 10_000)
    return () => clearTimeout(timer)
  }, [form, isDirty, autosaveKey])

  const state = {
    status: isCreate ? 'success' : isLoading ? 'loading' : isError ? 'error' : 'success',
    item: fetchResult?.item ?? null,
    warning: '',
    error: fetchError?.message ?? '',
  }

  const isReadOnly = !canUpdate || isSubmitting
  const formRef = useRef(null)
  const allowedPublishStatuses = getAllowedPublishStatuses(isCreate ? null : originalPublishStatus)

  // F6: cảnh báo khi rời trang lúc còn thay đổi chưa lưu — phủ CẢ điều hướng nội
  // bộ (sidebar/breadcrumb qua navigationGuard) lẫn reload/đóng tab (beforeunload).
  // Trước đây chỉ tự gắn beforeunload nên đi sidebar không hỏi.
  useUnsavedChanges(isDirty, t('products.detail.unsavedChangesConfirm'))

  function updateField(field, value) {
    setForm((previous) => {
      const next = { ...previous, [field]: value }
      // Auto-sync name → seoTitle while admin hasn't manually edited seoTitle
      if (field === 'name' && !previous.seoTitleManuallyEdited) {
        next.seoTitle = value
      }
      if (field === 'seoTitle') {
        next.seoTitleManuallyEdited = true
      }
      return next
    })
    setIsDirty(true)
    setValidationErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  // Write one English product-level field (V136). Vietnamese stays on form[field].
  function updateTranslation(field, value) {
    setForm((previous) => ({
      ...previous,
      translations: {
        ...previous.translations,
        en: { ...(previous.translations?.en || {}), [field]: value },
      },
    }))
    setIsDirty(true)
  }

  const isEnLang = contentLang === 'en'
  // PRODUCT_RULE_005 — sản phẩm có biến thể khi có ≥1 dòng biến thể thật (đã đặt tên qua
  // thuộc tính). Dùng để quyết định SKU/giá cấp sản phẩm có bắt buộc hay không (mirror schemas.js).
  const hasVariants = form.variants.some((v) => v.name?.trim())

  // "Phù hợp với ai" / "Bảng size" — nhập ở 2 card riêng (bên dưới), lưu vào form.suitabilitySection/
  // form.sizeGuideSection (V327/V328, tách khỏi descriptionBlocks). Khối rỗng mặc định có _key ổn định
  // (useMemo) để editor không reseed giữa các lần render; `key` của editor kèm productId + ngôn ngữ nên
  // VẪN reseed đúng khi đổi sản phẩm / đổi ngôn ngữ.
  const suitabilityDefault = useMemo(() => createBlock('suitability'), [])
  const sizeGuideDefault = useMemo(() => createBlock('sizeGuide'), [])
  const suitabilitySection = form.suitabilitySection ?? suitabilityDefault
  const sizeGuideSection = form.sizeGuideSection ?? sizeGuideDefault
  // Tiếng Việt quyết định có khối hay không; tab EN chỉ được dịch khối đã tồn tại, không được tự tạo mới.
  const suitabilityCreateLockedInEn = isEnLang && !form.suitabilitySection
  const sizeGuideCreateLockedInEn = isEnLang && !form.sizeGuideSection

  // Value of a translatable product-level text field for the active language.
  function langValue(field) {
    return isEnLang ? (form.translations?.en?.[field] ?? '') : (form[field] ?? '')
  }

  // Write a translatable product-level text field into the active language.
  function langChange(field, value) {
    if (isEnLang) updateTranslation(field, value)
    else updateField(field, value)
  }

  function addRelatedProduct(product) {
    if (!product?.id) return
    if (form.relatedProductIds.length >= RELATED_PRODUCTS_MAX) {
      toast.error(t('products.detail.relatedLimitReached', { max: RELATED_PRODUCTS_MAX }))
      return
    }
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
            imageUrl: product.image?.url || '',
          },
        ],
      }
    })
    setIsDirty(true)
    resetRelatedSearch()
  }

  async function removeRelatedProduct(removeId) {
    const chip = form.relatedProductChips.find((c) => c.id === removeId)
    const confirmed = await showConfirm(
      t('products.detail.removeProductConfirmMessage', { name: chip?.name || '' }),
      t('products.detail.removeRowConfirmTitle'),
    )
    if (!confirmed) return
    setForm((previous) => ({
      ...previous,
      relatedProductIds: previous.relatedProductIds.filter((id) => id !== removeId),
      relatedProductChips: previous.relatedProductChips.filter((chip) => chip.id !== removeId),
    }))
    setIsDirty(true)
  }

  // Drag-to-reorder: reorder the rendered chips, then mirror the new order into
  // relatedProductIds (what the upsert payload sends — sort_order is significant).
  function reorderRelatedProducts(chips) {
    setForm((previous) => ({
      ...previous,
      relatedProductChips: chips,
      relatedProductIds: chips.map((c) => c.id),
    }))
    setIsDirty(true)
  }

  // Accessories ("Phụ kiện") — same curation handlers as related products.
  function addAccessoryProduct(product) {
    if (!product?.id) return
    if (form.accessoryProductIds.length >= RELATED_PRODUCTS_MAX) {
      toast.error(t('products.detail.accessoryLimitReached', { max: RELATED_PRODUCTS_MAX }))
      return
    }
    setForm((previous) => {
      if (previous.accessoryProductIds.includes(product.id)) return previous
      return {
        ...previous,
        accessoryProductIds: [...previous.accessoryProductIds, product.id],
        accessoryProductChips: [
          ...previous.accessoryProductChips,
          {
            id: product.id,
            name: product.name || product.id,
            slug: product.slug || '',
            imageUrl: product.image?.url || '',
          },
        ],
      }
    })
    setIsDirty(true)
    resetAccessorySearch()
  }

  async function removeAccessoryProduct(removeId) {
    const chip = form.accessoryProductChips.find((c) => c.id === removeId)
    const confirmed = await showConfirm(
      t('products.detail.removeProductConfirmMessage', { name: chip?.name || '' }),
      t('products.detail.removeRowConfirmTitle'),
    )
    if (!confirmed) return
    setForm((previous) => ({
      ...previous,
      accessoryProductIds: previous.accessoryProductIds.filter((id) => id !== removeId),
      accessoryProductChips: previous.accessoryProductChips.filter((chip) => chip.id !== removeId),
    }))
    setIsDirty(true)
  }

  function reorderAccessoryProducts(chips) {
    setForm((previous) => ({
      ...previous,
      accessoryProductChips: chips,
      accessoryProductIds: chips.map((c) => c.id),
    }))
    setIsDirty(true)
  }

  function handleNameChange(value) {
    updateField('name', value)
    if (!slugEditedByUser.current) {
      updateField('slug', slugify(value))
    }
  }

  function handleSlugChange(value) {
    // Release auto-sync lock when user clears the field completely.
    if (!value.trim()) {
      slugEditedByUser.current = false
    } else {
      slugEditedByUser.current = true
    }
    updateField('slug', value)
  }

  function handleSlugBlur(value) {
    const sanitized = slugify(value)
    if (sanitized !== value) {
      updateField('slug', sanitized)
    }
  }

  // English URL slug (V214): gõ tên EN tự gợi ý slug EN khi chưa sửa tay; xoá để sửa tự do.
  function handleEnNameChange(value) {
    setForm((previous) => {
      const en = { ...(previous.translations?.en || {}), name: value }
      if (!enSlugEditedByUser.current) en.slug = slugify(value)
      return { ...previous, translations: { ...previous.translations, en } }
    })
    setIsDirty(true)
  }

  function handleEnSlugChange(value) {
    enSlugEditedByUser.current = Boolean(value.trim())
    updateTranslation('slug', value)
    setValidationErrors((previous) => {
      if (!previous['translations.en.slug']) return previous
      const next = { ...previous }
      delete next['translations.en.slug']
      return next
    })
  }

  function handleEnSlugBlur(value) {
    const sanitized = slugify(value)
    if (sanitized !== value) updateTranslation('slug', sanitized)
  }

  // F3: validate sớm 1 trường khi rời ô (on-blur). Chạy schema cho cả form rồi chỉ
  // lấy lỗi của đúng khoá trường đang blur — hiện ngay dưới ô thay vì đợi bấm Lưu.
  // Lỗi chỉ xuất hiện sau khi người dùng rời ô (đã "chạm"); khoá nào sạch thì xoá
  // lỗi cũ của nó (tránh kẹt lỗi đã sửa xong).
  function validateFieldOnBlur(fieldKey) {
    const result = createProductSchema(t, isCreate).safeParse(form)
    const fieldErrors = zodErrors(result)
    setValidationErrors((prev) => {
      const message = fieldErrors[fieldKey]
      if (message) {
        if (prev[fieldKey] === message) return prev
        return { ...prev, [fieldKey]: message }
      }
      if (!prev[fieldKey]) return prev
      const next = { ...prev }
      delete next[fieldKey]
      return next
    })
  }

  const saveMutation = useMutation({
    mutationFn: (payload) => isCreate ? createProduct(payload) : updateProduct(productId, payload),
    onSuccess: (response) => {
      const savedItem = response.item || null
      const nextForm = buildFormFromItem(savedItem)
      setForm(nextForm)
      setOriginalPublishStatus(nextForm.publishStatus)
      slugEditedByUser.current = Boolean(nextForm.slug)
      enSlugEditedByUser.current = Boolean(nextForm.translations?.en?.slug)
      setIsDirty(false)
      clearFormFromStorage(autosaveKey)
      setDraftRecovery(null)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (!isCreate) queryClient.setQueryData(['product', productId], response)
      toast.success(isCreate ? t('products.detail.successCreate') : t('products.detail.successUpdate'))
      setIsSubmitting(false)
      // Briefly flash the "saved" dot in the TOC save bar.
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
      // Lưu xong rồi điều hướng (tạo mới -> trang chi tiết): gỡ nav guard trước khi
      // navigate để không bị hỏi "rời trang?" nhầm (F6).
      if (isCreate && savedItem?.id) {
        clearNavGuard()
        navigate(`/admin/products/${savedItem.id}`, { replace: true })
      }
    },
    onError: (error) => {
      const fieldErrors = mapValidationErrors(error)
      setValidationErrors(fieldErrors)
      // N2: lỗi lưu kèm nút "Thử lại" (lưu lại) — chỉ khi KHÔNG phải lỗi ràng buộc
      // theo trường (lỗi field thì hiện ngay dưới ô, bấm lưu lại cũng vô ích cho tới
      // khi sửa). Toast lỗi đã không tự tắt (facade toast đặt duration Infinity).
      const hasFieldErrors = Object.keys(fieldErrors).length > 0
      toast.error(
        error.message || t('products.detail.errSaveFailed'),
        hasFieldErrors
          ? undefined
          : { action: { label: t('common.retry', { defaultValue: 'Thử lại' }), onClick: () => handleSave() } },
      )
      setIsSubmitting(false)
    },
  })

  function focusFirstError() {
    // Use double-rAF so we run AFTER React's commit phase, including the
    // adjust-state-during-render pass that auto-expands a variant card.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const errorEl = formRef.current?.querySelector('.field-error')
      if (!errorEl) return
      const container = errorEl.closest('label, .form-field')
      // Try native focusable inputs first, then fall back to combobox (shadcn
      // Select) or contenteditable (RichTextEditor) — both of which querySelector
      // 'input, select, textarea' misses.
      const focusTarget =
        container?.querySelector('input, textarea, [contenteditable="true"], [role="combobox"]') ??
        errorEl
      if (typeof focusTarget.focus === 'function') {
        focusTarget.focus()
      } else {
        errorEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }))
  }

  async function handleExportJson() {
    if (!canUpdate || isExportingJson) return
    setIsExportingJson(true)
    try {
      await exportProductJson(productId)
      toast.success(t('export.success'))
    } catch {
      toast.error(t('export.error'))
    } finally {
      setIsExportingJson(false)
    }
  }

  async function handleSave(overridePublishStatus) {
    if (!canUpdate) return

    let formToSave = overridePublishStatus
      ? { ...form, publishStatus: overridePublishStatus }
      : form

    const schema = createProductSchema(t, isCreate)
    const result = schema.safeParse(formToSave)
    const clientErrors = zodErrors(result)

    // Chặn lưu khi các biến thể không cùng bộ thuộc tính: web gộp tất cả thuộc tính
    // của mọi biến thể rồi bắt khách chọn đủ, nên biến thể lệch sẽ không bán được.
    // Gắn lỗi theo từng biến thể lệch (khoá variants.<idx>.options) để tự chuyển tab
    // + bung đúng thẻ, kèm thông báo.
    const attrWarn = computeAttrSetWarning(formToSave.variants ?? [], t)
    if (attrWarn) {
      for (const o of attrWarn.offenders) {
        clientErrors[`variants.${o.index - 1}.options`] =
          t('products.detail.variant.attrSetErrorField', { missing: o.missing })
      }
    }

    if (Object.keys(clientErrors).length > 0) {
      if (attrWarn) toast.error(t('products.detail.variant.attrSetErrorToast'))
      setValidationErrors(clientErrors)
      // Switch to the first tab containing an error so the user sees the field
      // we're about to focus. computeSectionErrorsFromMap reuses the same
      // prefix logic used by sectionErrors below.
      const failedSections = computeSectionErrorsFromMap(clientErrors)
      const failedTab = findTabForErrors(failedSections)
      if (failedTab && failedTab !== activeTab) setActiveTab(failedTab)
      // Auto-expand the collapsible group holding the first failing field so the user
      // actually sees the error we're about to focus.
      const failedGroup = findGroupForErrors(failedSections)
      if (failedGroup) setOpenGroups((prev) => ({ ...prev, [failedGroup]: true }))
      focusFirstError()
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})

    // Show quality checklist whenever the resulting status would be PUBLISHED
    // but the saved-on-server status is not — covers both the "Save & Publish"
    // button path AND the dropdown-then-save path.
    if (originalPublishStatus !== 'PUBLISHED' && formToSave.publishStatus === 'PUBLISHED') {
      setPendingPublish({ formToSave, payload: toPayload(formToSave) })
      setShowPublishChecklist(true)
      setIsSubmitting(false)
      return
    }

    saveMutation.mutate(toPayload(formToSave))
  }


  function confirmPublish() {
    if (!pendingPublish) return
    setShowPublishChecklist(false)
    setIsSubmitting(true)
    setValidationErrors({})
    saveMutation.mutate(pendingPublish.payload)
    setPendingPublish(null)
  }



  // ── Tab navigation state (replaces the old TOC sidebar) ─────────────────────
  // Two tabs ("product" + "seo"). Inside the product tab, collapsible groups — only
  // `buyArea` (required core: thông tin, ảnh, giá, biến thể) opens by default; `enhance`
  // (tùy chọn nâng cao), `body` (thân trang) and `closing` (cuối trang) start collapsed
  // so the form opens short (audit P0-1: chống ngợp field).
  const [activeTab, setActiveTab] = useState('product')
  const [openGroups, setOpenGroups] = useState({ buyArea: true, enhance: false, body: false, closing: false })
  const toggleGroup = (group) => setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  const [savedFlash, setSavedFlash] = useState(false)

  if (state.status === 'loading') {
    // N5: khung xương thay cho StatePanel căn giữa — tránh giật bố cục (CLS) khi dữ liệu
    // về, vì trang thật có header + tabs + nhiều SectionCard chứ không phải một panel nhỏ.
    // ScreenSkeleton.jsx (dùng cho Suspense route-level) có hình dạng bảng/danh sách, không
    // khớp trang chi tiết có tab — nên dựng khung riêng bằng div thuần + animate-pulse.
    return (
      <Screen maxWidth="1440px">
        <div className="animate-pulse" aria-hidden="true">
          <header className="bb-screen-header">
            <div className="bb-screen-title flex flex-col gap-2">
              <div className="h-3 w-28 rounded-xs bg-surface-muted" />
              <div className="h-7 w-72 max-w-full rounded-xs bg-surface-muted" />
              <div className="h-3 w-56 max-w-full rounded-xs bg-surface-muted" />
            </div>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            <div className="h-9 w-28 rounded-sm bg-surface-muted" />
            <div className="h-9 w-20 rounded-sm bg-surface-muted" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="bb-card">
              <div className="h-10 border-b border-border bg-surface-muted/60" />
              <div className="bb-card-body flex flex-col gap-3">
                <div className="h-4 w-1/3 rounded-xs bg-surface-muted" />
                <div className="h-9 w-full rounded-sm bg-surface-muted" />
                <div className="h-9 w-2/3 rounded-sm bg-surface-muted" />
              </div>
            </div>
            <div className="bb-card">
              <div className="h-10 border-b border-border bg-surface-muted/60" />
              <div className="bb-card-body flex flex-col gap-3">
                <div className="h-4 w-1/4 rounded-xs bg-surface-muted" />
                <div className="h-32 w-full rounded-sm bg-surface-muted" />
              </div>
            </div>
            <div className="bb-card">
              <div className="h-10 border-b border-border bg-surface-muted/60" />
              <div className="bb-card-body flex flex-col gap-3">
                <div className="h-4 w-1/3 rounded-xs bg-surface-muted" />
                <div className="h-20 w-full rounded-sm bg-surface-muted" />
              </div>
            </div>
          </div>
        </div>
      </Screen>
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('products.detail.loadError')}
        description={state.error}
        actionLabel={t('common.retry', { defaultValue: 'Thử lại' })}
        onAction={() => refetch()}
      />
    )
  }

  if (!isCreate && !state.item) {
    return (
      <StatePanel
        tone="neutral"
        title={t('products.detail.notFound')}
        description={t('products.detail.notFoundDesc')}
        actionLabel={t('products.detail.backToList')}
        onAction={() => navigate('/admin/products')}
      />
    )
  }

  const sectionErrors = computeSectionErrorsFromMap(validationErrors)
  const tabCounts = Object.fromEntries(
    Object.entries(TAB_SECTIONS).map(([tab, keys]) => [tab, keys.filter((k) => sectionErrors[k]).length]),
  )
  const groupCounts = Object.fromEntries(
    Object.entries(PRODUCT_GROUPS).map(([group, keys]) => [group, keys.filter((k) => sectionErrors[k]).length]),
  )
  // Badge số lỗi cho từng tab: tô màu cảnh báo (danger token) + nhãn ẩn cho trình
  // đọc màn hình để phân biệt với badge đếm thông thường ("N lỗi" thay vì số trơ).
  function tabErrorBadge(count) {
    if (!count) return undefined
    return (
      <span className="font-bold text-danger">
        <span aria-hidden="true">{count}</span>
        <span className="sr-only">
          {t('products.detail.errorsInTab', { count, defaultValue: '{{count}} lỗi' })}
        </span>
      </span>
    )
  }

  // SEO checklist — chấm theo NGÔN NGỮ đang sửa. seoTitle / seoDescription là
  // song ngữ (theo tab VI/EN); slug, alt ảnh và OG image dùng chung nên giữ ở
  // field base. `hint` hiển thị số ký tự hiện tại để trạng thái ✓/✗ tự giải thích.
  const seoTitleVal = langValue('seoTitle')
  const seoDescVal = langValue('seoDescription')
  const seoChecks = [
    { ok: seoTitleVal.length >= 30 && seoTitleVal.length <= 60, hint: seoTitleVal.length, label: t('products.detail.seoCheckTitle', { defaultValue: 'SEO title 30–60 ký tự' }) },
    { ok: seoDescVal.length >= 140 && seoDescVal.length <= 160, hint: seoDescVal.length, label: t('products.detail.seoCheckDesc', { defaultValue: 'SEO description 140–160 ký tự' }) },
    { ok: !!form.slug && /^[a-z0-9-]+$/.test(form.slug), label: t('products.detail.seoCheckSlug', { defaultValue: 'Slug chữ thường, không dấu, dùng "-"' }) },
    { ok: !!form.imageUrl?.trim() && !!form.imageAlt?.trim(), label: t('products.detail.seoCheckImageAlt', { defaultValue: 'Ảnh đại diện có alt text' }) },
    { ok: !!form.seoOgImageUrl, label: t('products.detail.seoCheckOg', { defaultValue: 'OG image cho chia sẻ MXH' }) },
    { ok: !!form.imageUrl?.trim() && Number(form.retailPrice) > 0, label: t('products.detail.seoCheckSchema', { defaultValue: 'Schema Product (đủ ảnh + giá)' }) },
  ]
  const seoPassed = seoChecks.filter((c) => c.ok).length

  // ── Save-bar derivations ────────────────────────────────────────────────────
  const saveDotState = isSubmitting ? 'saving' : savedFlash ? 'saved-flash' : isDirty ? 'dirty' : 'saved'
  const saveDotClass =
    saveDotState === 'saving'      ? 'bg-info animate-pulse'
    : saveDotState === 'dirty'     ? 'bg-warning animate-pulse'
    :                                'bg-success'
  const saveLabel = isSubmitting
    ? t('products.detail.savingShort', { defaultValue: 'Đang lưu...' })
    : isDirty
      ? t('products.detail.saveDirty', { defaultValue: 'Có thay đổi chưa lưu' })
      : t('products.detail.saveClean', { defaultValue: 'Đã lưu' })

  const isPublished = form.publishStatus === 'PUBLISHED'
  const primaryLabel = isPublished
    ? t('products.detail.saveBtn')
    : (isCreate ? t('products.detail.createAndPublish') : t('products.detail.saveAndPublish'))

  async function handleClose() {
    if (isDirty) {
      const confirmed = await showConfirm(
        t('products.detail.unsavedChangesConfirm'),
        t('products.detail.unsavedChangesTitle'),
      )
      if (!confirmed) return
    }
    navigate('/admin/products')
  }

  return (
    <AssignmentConfigContext.Provider value={assignmentConfig ?? null}>
    <Screen maxWidth="1440px">
        <ScreenHeader
          eyebrow={t('products.detail.eyebrow')}
          title={isCreate
            ? t('products.detail.createTitle')
            : (langValue('name') || form.name || t('products.detail.editTitle'))}
          description={
            !isCreate && state.item?.updatedAt ? (
              <span className="text-xs">
                {t('common.lastUpdated')} {formatDateTime(state.item.updatedAt)}
                {isEnLang && (
                  <>
                    {' · '}
                    {t('products.detail.langEnHint', {
                      defaultValue: 'Bản tiếng Anh không bắt buộc',
                    })}
                  </>
                )}
              </span>
            ) : isEnLang ? (
              <span className="text-xs">
                {t('products.detail.langEnHint', {
                  defaultValue: 'Bản tiếng Anh không bắt buộc',
                })}
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
                  {t('products.detail.readOnlyBadge', { defaultValue: 'Chỉ đọc' })}
                </span>
              )}
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                aria-label={t('common.cancel')}
                data-screen-close="true"
              >
                <X size={18} />
              </Button>
            </div>
          }
        />

        {/* Banners — read-only / draft-recovery */}
        {!canUpdate && (
          <div className="bb-alert warning tight center">
            <Lock size={16} className="shrink-0" />
            <span>{t('products.detail.permissionDesc')}</span>
          </div>
        )}

        {state.warning && (
          <div className="bb-alert warning tight">
            <AlertCircle size={16} className="shrink-0" />
            <div className="bb-alert-main">{state.warning}</div>
          </div>
        )}

        {draftRecovery && (
          <div className="bb-alert info tight center wrap">
            <Save size={14} className="shrink-0" />
            <span className="bb-alert-main truncate">
              <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
              {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 py-0 text-xs font-semibold"
              onClick={() => {
                setForm(draftRecovery.form)
                setIsDirty(true)
                setDraftRecovery(null)
                slugEditedByUser.current = Boolean(draftRecovery.form.slug)
                enSlugEditedByUser.current = Boolean(draftRecovery.form.translations?.en?.slug)
              }}
            >
              {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 py-0 text-xs font-normal"
              onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
            >
              {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
            </Button>
          </div>
        )}

        {/* Assignment banner — always visible */}
        <AssignmentBanner t={t} />

        <Tabs
          ariaLabel={t('products.detail.tabsAriaLabel', { defaultValue: 'Phần của sản phẩm' })}
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'product', label: t('products.detail.tabProduct', { defaultValue: 'Sản phẩm' }), count: tabErrorBadge(tabCounts.product) },
            { key: 'seo',     label: t('products.detail.tabSeo', { defaultValue: 'SEO' }),           count: tabErrorBadge(tabCounts.seo) },
          ]}
        />

        <form
          ref={formRef}
          className="flex flex-col gap-6 pb-24"
          onSubmit={(e) => { e.preventDefault(); handleSave() }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
              e.preventDefault()
              handleSave()
            }
          }}
        >
          {/* Chú thích dấu bắt buộc — hiện cả khi tạo mới lẫn khi sửa (trường bắt buộc vẫn còn
              trong cả hai chế độ: tên, danh mục, thương hiệu, ảnh, giá khi không biến thể...). */}
          <p className="text-xs text-muted-foreground">
            <span className="text-danger">*</span>
            {' '}
            {t('products.detail.requiredLegend', { defaultValue: 'Bắt buộc' })}
          </p>
          {activeTab === 'product' && (
            <>
              <CollapsibleGroup
                title={t('products.detail.groupBuyArea', { defaultValue: 'Thông tin bắt buộc' })}
                hint={t('products.detail.groupBuyAreaHint', { defaultValue: 'Bắt buộc — thông tin, ảnh đại diện, giá, biến thể' })}
                open={openGroups.buyArea}
                onToggle={() => toggleGroup('buyArea')}
                errorCount={groupCounts.buyArea}
              >
              {/* ── Card: Thông tin cơ bản ── */}
              <SectionCard
                title={t('products.detail.sectionBasic')}
                required
                badge={
                  <div className="flex items-center gap-1.5">
                    <RoleBadge role="content" />
                    <RoleBadge role="seo" />
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('products.detail.name')}
                    required
                    count={`${langValue('name').length} / 255`}
                    countWarn={langValue('name').length > 230}
                    error={isEnLang ? validationErrors['translations.en.name'] : validationErrors.name}
                  >
                    <Input
                      value={langValue('name')}
                      onChange={(e) => (isEnLang ? handleEnNameChange(e.target.value) : handleNameChange(e.target.value))}
                      onBlur={() => validateFieldOnBlur(isEnLang ? 'translations.en.name' : 'name')}
                      disabled={isReadOnly}
                      maxLength={255}
                    />
                  </Field>

                  <Field
                    full
                    label={t('products.detail.slug')}
                    required={!isEnLang}
                    error={isEnLang ? validationErrors['translations.en.slug'] : validationErrors.slug}
                    helper={isEnLang
                      ? t('products.detail.slugHintEn', { defaultValue: 'Đường dẫn tiếng Anh (tùy chọn) — để trống sẽ dùng đường dẫn tiếng Việt.' })
                      : t('products.detail.slugHint')}
                  >
                    <Input
                      value={isEnLang ? (form.translations?.en?.slug || form.slug || '') : (form.slug || '')}
                      placeholder={isEnLang ? 'vd: fullface-helmet-agv-k1s' : 'vd: mu-bao-hiem-fullface-agv-k1s'}
                      onChange={(e) => (isEnLang ? handleEnSlugChange(e.target.value) : handleSlugChange(e.target.value))}
                      onBlur={(e) => {
                        if (isEnLang) {
                          handleEnSlugBlur(e.target.value)
                          validateFieldOnBlur('translations.en.slug')
                        } else {
                          handleSlugBlur(e.target.value)
                          validateFieldOnBlur('slug')
                        }
                      }}
                      disabled={isReadOnly}
                      maxLength={isEnLang ? 100 : 200}
                      className="font-mono"
                    />
                  </Field>

                  <Field
                    label={t('products.detail.sku')}
                    count={`${form.sku.length} / 100`}
                    countWarn={form.sku.length > 85}
                    helper={t('products.detail.skuHint')}
                    required={!hasVariants}
                    error={validationErrors.sku}
                  >
                    <Input
                      value={form.sku}
                      onChange={(e) => updateField('sku', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={100}
                      className="font-mono"
                    />
                  </Field>

                  <Field label={t('products.detail.categoryId')} required error={validationErrors.categoryId}>
                    <Select value={form.categoryId} onValueChange={(val) => { if (val) updateField('categoryId', val) }} disabled={isReadOnly}>
                      <SelectTrigger onBlur={() => validateFieldOnBlur('categoryId')}>
                        <SelectValue placeholder={t('products.detail.categoryPlaceholder')}>{selectedCategoryLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {form.categoryId && !categoryOptions.some((c) => c.id === form.categoryId) && (
                          <SelectItem value={form.categoryId} disabled>{t('products.detail.optionNotFound', { id: form.categoryId })}</SelectItem>
                        )}
                        {categoryTree.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span style={{ paddingInlineStart: `${c.depth * 16}px` }}>{c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label={t('products.detail.brandId')} required error={validationErrors.brandId}>
                    <Select value={form.brandId} onValueChange={(val) => { if (val) updateField('brandId', val) }} disabled={isReadOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('products.detail.brandPlaceholder')}>{selectedBrandLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {form.brandId && !brandOptions.some((b) => b.id === form.brandId) && (
                          <SelectItem value={form.brandId} disabled>{t('products.detail.optionNotFound', { id: form.brandId })}</SelectItem>
                        )}
                        {brandOptions.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    label={t('products.detail.trust.originBrand', { defaultValue: 'Thương hiệu (nước)' })}
                    helper={t('products.detail.trust.originBrandHint', { defaultValue: 'Nhập riêng cho từng ngôn ngữ — chuyển tab VI/EN ở góc trên để nhập bản còn lại (vd: "Nhật Bản" ở tab VI, "Japan" ở tab EN).' })}
                  >
                    <Input
                      placeholder={isEn ? 'e.g. Japan' : 'vd: Ý'}
                      value={langValue('originBrandCountry')}
                      onChange={(e) => langChange('originBrandCountry', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={120}
                    />
                  </Field>

                  <Field label={t('products.detail.gender', { defaultValue: 'Giới tính' })} required error={validationErrors.gender}>
                    {/* Guard `if (val)`: Radix bắn onValueChange('') giả khi value đồng bộ lúc
                        mount — không guard sẽ xoá gender (hiện trống + lưu mất dữ liệu). Children
                        rõ ràng cho SelectValue để trigger hiện đúng giá trị. */}
                    <Select value={form.gender || 'NONE'} onValueChange={(val) => { if (val) updateField('gender', val === 'NONE' ? '' : val) }} disabled={isReadOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('products.detail.genderPlaceholder', { defaultValue: 'Không chọn' })}>
                          {form.gender
                            ? (GENDER_LABEL_EN[form.gender] && isEn ? GENDER_LABEL_EN[form.gender] : form.gender)
                            : t('products.detail.genderPlaceholder', { defaultValue: 'Không chọn' })}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {/* Radix Select cấm value="" — dùng sentinel 'NONE', map về '' khi lưu. Value lưu DB
                            luôn là "Nam"/"Nữ"/"Unisex" (DATA_CONTRACT.md) — chỉ nhãn hiển thị đổi theo contentLang. */}
                        <SelectItem value="NONE">{t('products.detail.genderPlaceholder', { defaultValue: 'Không chọn' })}</SelectItem>
                        <SelectItem value="Nam">{isEn ? 'Male' : 'Nam'}</SelectItem>
                        <SelectItem value="Nữ">{isEn ? 'Female' : 'Nữ'}</SelectItem>
                        <SelectItem value="Unisex">Unisex</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    full
                    label={t('products.detail.shortDescription')}
                    helper={t('products.detail.shortDescriptionHint')}
                    error={validationErrors.shortDescription}
                  >
                    <RichTextEditorWithSource
                      key={`shortDescription-${contentLang}`}
                      value={langValue('shortDescription')}
                      onChange={(html) => langChange('shortDescription', html)}
                      placeholder={t('products.detail.shortDescriptionPlaceholder')}
                      disabled={isReadOnly}
                      hasError={Boolean(validationErrors.shortDescription)}
                      maxLength={2000}
                    />
                  </Field>

                </div>
              </SectionCard>

              {/* ── Card: Ảnh đại diện ── */}
              <SectionCard title={t('products.detail.mainImageTitle')} required badge={<RoleBadge role="content" />}>
                <ImageUrlInput
                  value={form.imageUrl}
                  onChange={(url) => updateField('imageUrl', url)}
                  alt={form.imageAlt}
                  onAltChange={(v) => updateField('imageAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.imageUrl}
                  recommend={IMAGE_RECO.productImage}
                />
              </SectionCard>

              {/* ── Card: Giá & trạng thái ── */}
              <SectionCard title={t('products.detail.sectionPricing')} required badge={<RoleBadge role="manager" />}>
                {form.variants.length > 0 && (
                  <div className="bb-alert info tight">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>{t('products.detail.variantPricingHint')}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('products.detail.retailPrice')} required={!hasVariants} error={validationErrors.retailPrice}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="vd: 5.900.000"
                      value={formatPrice(form.retailPrice)}
                      onChange={(e) => updateField('retailPrice', e.target.value.replace(/\D/g, ''))}
                      onBlur={() => validateFieldOnBlur('retailPrice')}
                      disabled={isReadOnly}
                    />
                  </Field>

                  <Field
                    label={t('products.detail.salePrice')}
                    error={
                      validationErrors.salePrice
                        ? validationErrors.salePrice
                        : form.salePrice && form.retailPrice && Number(form.salePrice) >= Number(form.retailPrice)
                          ? t('products.detail.saleMustBeLower')
                          : undefined
                    }
                  >
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="vd: 5.500.000"
                        value={formatPrice(form.salePrice)}
                        onChange={(e) => updateField('salePrice', e.target.value.replace(/\D/g, ''))}
                        disabled={isReadOnly}
                      />
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setShowDiscountHelper((p) => !p)}
                          title={t('products.detail.discountButtonTitle')}
                        >
                          {t('products.detail.discountButton')}
                        </Button>
                      )}
                    </div>
                    {showDiscountHelper && !isReadOnly && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 p-2 bg-muted">
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          placeholder={t('products.detail.discountInputPlaceholder')}
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          type="button"
                          disabled={!Number(form.retailPrice)}
                          onClick={() => {
                            const base = Number(form.retailPrice)
                            const pct = Number(discountPct)
                            if (base > 0 && pct > 0 && pct < 100) {
                              updateField('salePrice', String(Math.round(base * (1 - pct / 100))))
                              setShowDiscountHelper(false)
                              setDiscountPct('')
                            }
                          }}
                        >
                          {t('products.detail.apply')}
                        </Button>
                        <small className="text-xs text-muted-foreground">
                          {Number(form.retailPrice)
                            ? t('products.detail.discountFromBaseHint')
                            : t('products.detail.discountNeedsBaseHint')}
                        </small>
                      </div>
                    )}
                  </Field>

                  <Field label={t('products.detail.publishStatus')} error={validationErrors.publishStatus}>
                    <Select value={form.publishStatus} onValueChange={(val) => { if (val) updateField('publishStatus', val) }} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue>{form.publishStatus ? t(`status.publish.${form.publishStatus}`, { defaultValue: form.publishStatus }) : undefined}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {form.publishStatus && !['DRAFT', 'PUBLISHED', 'TRASH'].includes(form.publishStatus) && (
                          <SelectItem value={form.publishStatus} disabled>
                            {t('products.detail.specialPublishNote', { state: form.publishStatus })}
                          </SelectItem>
                        )}
                        <SelectItem value="DRAFT" disabled={!allowedPublishStatuses.includes('DRAFT')}>{t('status.publish.DRAFT')}</SelectItem>
                        <SelectItem value="PUBLISHED" disabled={!allowedPublishStatuses.includes('PUBLISHED')}>{t('status.publish.PUBLISHED')}</SelectItem>
                        {form.publishStatus === 'TRASH' && (
                          <SelectItem value="TRASH" disabled>{t('status.publish.TRASH')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  {form.variants.length === 0 ? (
                    // Sản phẩm KHÔNG biến thể: công tắc Còn/Hết mức sản phẩm (admin tự quyết).
                    // Lưu qua forceOutOfStock; backend dẫn xuất stockState theo công tắc này.
                    <div className="md:col-span-2 flex items-center gap-2.5 p-2.5 border border-border text-sm">
                      <Switch
                        checked={!form.forceOutOfStock}
                        onCheckedChange={(checked) => updateField('forceOutOfStock', !checked)}
                        disabled={isReadOnly}
                        aria-label={t('products.detail.productStock')}
                      />
                      <span className={!form.forceOutOfStock ? 'text-success font-medium' : 'text-danger font-medium'}>
                        {!form.forceOutOfStock ? t('status.stock.IN_STOCK') : t('status.stock.OUT_OF_STOCK')}
                      </span>
                      <span className="text-muted-foreground">— {t('products.detail.productStockHint')}</span>
                    </div>
                  ) : (
                    // Sản phẩm CÓ biến thể: tồn kho theo từng biến thể; ô này là "buộc hết" toàn SP.
                    <label className="md:col-span-2 flex items-start gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted">
                      <Checkbox
                        checked={form.forceOutOfStock}
                        onCheckedChange={(checked) => updateField('forceOutOfStock', checked)}
                        disabled={isReadOnly}
                      />
                      <span><strong>{t('products.detail.forceOutOfStock')}</strong> — {t('products.detail.forceOutOfStockHint')}</span>
                    </label>
                  )}
                </div>
              </SectionCard>

              {/* ── Card: Biến thể (màu/size) — cạnh Giá vì cùng quyết định "bán thế nào" ── */}
              <SectionCard
                title={t('products.detail.variantSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {form.variants.length} {t('products.detail.variantUnit', { defaultValue: 'biến thể' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <VariantsEditor
                  items={form.variants}
                  onChange={(next) => updateField('variants', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  onOpenMatrixWizard={() => setShowMatrixWizard(true)}
                  contentLang={contentLang}
                />
              </SectionCard>
              </CollapsibleGroup>

              <CollapsibleGroup
                title={t('products.detail.groupEnhance', { defaultValue: 'Tùy chọn nâng cao' })}
                hint={t('products.detail.groupEnhanceHint', { defaultValue: 'Không bắt buộc — gallery, dải tin cậy, cam kết, ô số liệu' })}
                open={openGroups.enhance}
                onToggle={() => toggleGroup('enhance')}
                errorCount={groupCounts.enhance}
              >
              {/* ── Card: Gallery (ảnh phụ) ── */}
              <SectionCard
                title={t('products.detail.gallerySectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {form.gallery.length} {t('products.detail.galleryUnit', { defaultValue: 'ảnh' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <GalleryEditor
                  items={form.gallery}
                  onChange={(next) => updateField('gallery', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                />
              </SectionCard>

              {/* ── Card: Dải tin cậy (trên tên sản phẩm) (V233) ── */}
              <SectionCard
                title={t('products.detail.sectionTrustBadges', { defaultValue: 'Dải tin cậy (trên tên sản phẩm)' })}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {parseTrustBadgesFromHtml(langValue('trustBadges')).length} {t('products.detail.trustBadges.unit', { defaultValue: 'nhãn' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">
                  {t('products.detail.trustBadges.hint', { defaultValue: 'Các nhãn ngắn hiển thị NGAY TRÊN tên sản phẩm (vd "Chính hãng", "BH 2 năm", "Freeship"). Để trống → web ẩn dải. Mỗi sản phẩm tự nhập riêng.' })}
                </p>
                {validationErrors.trustBadges && (
                  <p className="field-error mb-2 flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                    <AlertCircle size={13} className="shrink-0" />
                    {validationErrors.trustBadges}
                  </p>
                )}
                <TrustBadgesEditor
                  key={`trustbadges-${contentLang}`}
                  disabled={isReadOnly}
                  html={langValue('trustBadges')}
                  onHtmlChange={(v) => langChange('trustBadges', v)}
                />
              </SectionCard>

              {/* ── Card: Cam kết (dưới nút mua hàng) (V232) — nội dung bán hàng (tùy chọn) ── */}
              <SectionCard
                title={t('products.detail.sectionCommitments')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {form.commitments.length} {t('products.detail.commitments.unit', { defaultValue: 'dòng' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.commitments.hint')}</p>
                {validationErrors.commitments && (
                  <p className="field-error mb-2 flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                    <AlertCircle size={13} className="shrink-0" />
                    {validationErrors.commitments}
                  </p>
                )}
                <CommitmentEditor
                  items={form.commitments}
                  onChange={(next) => updateField('commitments', next)}
                  disabled={isReadOnly}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Specs Dashboard — ô số liệu nổi bật (V235) ── */}
              <SectionCard
                title={t('products.detail.sectionSpecStats')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {parseSpecStatsFromHtml(langValue('specStats')).length} / 4
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.specStats.hint')}</p>
                {validationErrors.specStats && (
                  <p className="field-error mb-2 flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                    <AlertCircle size={13} className="shrink-0" />
                    {validationErrors.specStats}
                  </p>
                )}
                <SpecStatEditor
                  key={`specstats-${contentLang}`}
                  disabled={isReadOnly}
                  html={langValue('specStats')}
                  onHtmlChange={(v) => langChange('specStats', v)}
                />
              </SectionCard>
              </CollapsibleGroup>

              <CollapsibleGroup
                title={t('products.detail.groupBody', { defaultValue: 'Mô tả & nội dung trang' })}
                hint={t('products.detail.groupBodyHint', { defaultValue: 'Tính năng, ưu/nhược, thông số, FAQ' })}
                open={openGroups.body}
                onToggle={() => toggleGroup('body')}
                errorCount={groupCounts.body}
              >
              {/* ── Card: Quick Answer (V300) — đoạn tóm tắt AIO, hiện blockquote #3 ngay trước Tính năng chi tiết ── */}
              <SectionCard
                title={t('products.detail.quickAnswer.sectionTitle', { defaultValue: 'Quick Answer (trả lời nhanh)' })}
                badge={<RoleBadge role="content" />}
              >
                <p className="text-xs text-muted-foreground mb-2">
                  {t('products.detail.quickAnswer.hint', { defaultValue: 'Đoạn tóm tắt 40–60 từ, đặt trước phần mô tả để Google/AI trích dẫn. Câu đầu nói thẳng: sản phẩm là gì + cho ai + nổi bật điều gì. Văn bản thường, không định dạng.' })}
                </p>
                <Textarea
                  value={langValue('quickAnswerSummary')}
                  onChange={(e) => langChange('quickAnswerSummary', e.target.value)}
                  disabled={isReadOnly}
                  maxLength={600}
                  rows={4}
                  placeholder={t('products.detail.quickAnswer.placeholder', { defaultValue: 'Ví dụ: Mũ fullface AGV K6 vỏ sợi carbon nặng 1.250g, kính chống tia UV, đạt chuẩn ECE 22.06...' })}
                  className={validationErrors.quickAnswerSummary ? 'border-danger' : undefined}
                />
                {validationErrors.quickAnswerSummary && (
                  <span className="mt-2 block text-xs font-semibold text-danger">
                    {validationErrors.quickAnswerSummary}
                  </span>
                )}
              </SectionCard>

              {/* ── Card: Mô tả chi tiết — trình dựng khối Tính năng (#4). "Phù hợp với ai"/"Bảng size" có card riêng bên dưới ── */}
              <SectionCard title={t('products.detail.sectionDescription', { defaultValue: 'Mô tả chi tiết' })} badge={<RoleBadge role="content" />}>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('products.detail.descriptionBuilderHint', { defaultValue: 'Trình dựng khối Tính năng chi tiết (chữ, ảnh, ảnh + chữ). Kéo-thả để đổi thứ tự. "Phù hợp với ai" và "Bảng size" nhập ở 2 card riêng bên dưới.' })}
                </p>
                <Field full label={t('products.detail.description')} error={validationErrors.description}>
                  <BlockEditor
                    value={form.descriptionBlocks}
                    onChange={(blocks) => updateField('descriptionBlocks', blocks)}
                    disabled={isReadOnly}
                    hasError={Boolean(validationErrors.description)}
                    fallbackHtml={langValue('description')}
                    productMode
                    contentLang={contentLang}
                  />
                </Field>
              </SectionCard>

              {/* ── Card: Ưu điểm & Nhược điểm (V251) — khối RIÊNG cố định dưới mô tả, ngoài tab ── */}
              <SectionCard
                title={t('products.detail.highlights.sectionTitle', { defaultValue: 'Ưu điểm & Nhược điểm' })}
                badge={<RoleBadge role="content" />}
              >
                <p className="text-xs text-muted-foreground mb-3">
                  {t('products.detail.highlights.hint', { defaultValue: 'Các gạch đầu dòng ưu/nhược điểm thật của sản phẩm — hiện thành khối riêng ngay dưới mô tả (ngoài tab) và đưa vào dữ liệu có cấu trúc. Không bắt buộc; để trống → web ẩn khối.' })}
                </p>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium mb-2">{t('products.detail.highlights.prosTitle', { defaultValue: 'Ưu điểm' })}</div>
                    {validationErrors.positiveNotes && (
                      <p className="field-error mb-2 flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                        <AlertCircle size={13} className="shrink-0" />
                        {validationErrors.positiveNotes}
                      </p>
                    )}
                    <HighlightsEditor
                      items={form.positiveNotes}
                      onChange={(next) => updateField('positiveNotes', next)}
                      disabled={isReadOnly}
                      contentLang={contentLang}
                      placeholder={t('products.detail.highlights.prosPlaceholder', { defaultValue: 'vd: Nhẹ hơn LS2 Storm II 29g' })}
                      addLabel={t('products.detail.highlights.addPro', { defaultValue: 'Thêm ưu điểm' })}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-2">{t('products.detail.highlights.consTitle', { defaultValue: 'Nhược điểm' })}</div>
                    {validationErrors.negativeNotes && (
                      <p className="field-error mb-2 flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                        <AlertCircle size={13} className="shrink-0" />
                        {validationErrors.negativeNotes}
                      </p>
                    )}
                    <HighlightsEditor
                      items={form.negativeNotes}
                      onChange={(next) => updateField('negativeNotes', next)}
                      disabled={isReadOnly}
                      contentLang={contentLang}
                      placeholder={t('products.detail.highlights.consPlaceholder', { defaultValue: 'vd: Không kèm Pinlock' })}
                      addLabel={t('products.detail.highlights.addCon', { defaultValue: 'Thêm nhược điểm' })}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* ── Card: Sản phẩm tương tự — "Xem thêm lựa chọn" (#6) — ngay sau Ưu/Nhược, trước Phù hợp với ai ── */}
              <SectionCard
                title={t('products.detail.sectionRelated')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn('bb-count-pill bb-count-pill--bordered', relatedAtMax && 'bb-count-pill--warning')}
                    >
                      {form.relatedProductIds.length} / {RELATED_PRODUCTS_MAX}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-3">{t('products.detail.relatedHint')}</p>

                {form.relatedProductChips.length > 0 && (
                  <SortableList
                    items={form.relatedProductChips}
                    disabled={isReadOnly}
                    onReorder={reorderRelatedProducts}
                    className="flex flex-col gap-1.5 mb-3 max-h-[22rem] overflow-y-auto pr-1"
                    renderItem={(chip, sortable) => (
                      <RelatedProductRow
                        chip={chip}
                        canEdit={!isReadOnly}
                        onRemove={removeRelatedProduct}
                        t={t}
                        sortable={sortable}
                      />
                    )}
                    renderOverlay={(chip) => (
                      <RelatedProductRow chip={chip} canEdit={false} onRemove={() => {}} t={t} />
                    )}
                  />
                )}

                {!isReadOnly && (
                  <>
                    <ProductPickerCombobox
                      search={relatedSearch}
                      onSearchChange={setRelatedSearch}
                      open={relatedSearchDebounced.length >= 1}
                      loading={isSearchingRelated}
                      items={relatedSearchItems}
                      addedIds={form.relatedProductIds}
                      onPick={addRelatedProduct}
                      placeholder={t('products.detail.relatedSearch')}
                      loadingText={t('products.detail.relatedSearching')}
                      emptyText={t('products.detail.relatedEmpty')}
                      addedText={t('products.detail.relatedAdded')}
                      disabled={relatedAtMax}
                    />
                    {relatedAtMax && (
                      <p className="mt-2 text-xs text-warning">
                        {t('products.detail.relatedLimitHint', { max: RELATED_PRODUCTS_MAX })}
                      </p>
                    )}
                  </>
                )}
              </SectionCard>

              {/* ── Card: Phù hợp với ai (#7) — field riêng form.suitabilitySection (V327/V328) ── */}
              <SectionCard
                title={t('products.detail.blocks.blockTypeSuitability')}
                badge={<RoleBadge role="content" />}
              >
                <p className="text-xs text-muted-foreground mb-3">
                  {t('products.detail.suitabilityCard.hint', { defaultValue: 'Các thẻ tư vấn "đối tượng → lời khuyên". Hiện thành khối riêng cố định trên trang sản phẩm (ngay sau Ưu/nhược điểm), không phụ thuộc vị trí trong mô tả. Để trống → web ẩn khối.' })}
                </p>
                {suitabilityCreateLockedInEn ? (
                  <p className="list-editor-empty">
                    {t('products.detail.suitabilityCard.addInViFirst', { defaultValue: 'Tạo khối này ở tab Tiếng Việt trước, rồi quay lại đây để dịch.' })}
                  </p>
                ) : (
                  <SuitabilityBlockEditor
                    key={`suit-${productId ?? 'new'}-${suitabilitySection._key}`}
                    block={suitabilitySection}
                    disabled={isReadOnly}
                    contentLang={contentLang}
                    onChange={(patch) => updateField('suitabilitySection', { ...suitabilitySection, ...patch })}
                  />
                )}
              </SectionCard>

              {/* ── Card: Bảng size (#8) — field riêng form.sizeGuideSection (V327/V328) ── */}
              <SectionCard
                title={t('products.detail.blocks.blockTypeSizeGuide')}
                badge={<RoleBadge role="content" />}
              >
                <p className="text-xs text-muted-foreground mb-3">
                  {t('products.detail.sizeGuideCard.hint', { defaultValue: 'Bảng chọn size (nhập theo cột/dòng hoặc dán HTML). Hiện thành khối riêng cố định trên trang sản phẩm (ngay sau Phù hợp với ai). Để trống → web ẩn khối.' })}
                </p>
                {sizeGuideCreateLockedInEn ? (
                  <p className="list-editor-empty">
                    {t('products.detail.sizeGuideCard.addInViFirst', { defaultValue: 'Tạo khối này ở tab Tiếng Việt trước, rồi quay lại đây để dịch.' })}
                  </p>
                ) : (
                  <SizeGuideBlockEditor
                    key={`size-${productId ?? 'new'}-${sizeGuideSection._key}`}
                    block={sizeGuideSection}
                    disabled={isReadOnly}
                    contentLang={contentLang}
                    onChange={(patch) => updateField('sizeGuideSection', { ...sizeGuideSection, ...patch })}
                  />
                )}
              </SectionCard>

              {/* ── Card: Thông số ── */}
              <SectionCard
                title={t('products.detail.specsSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {t('products.detail.specCount', { count: parseSpecsFromHtml(langValue('specifications')).length })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <SpecificationsEditor
                  key={`specs-${contentLang}`}
                  disabled={isReadOnly}
                  html={langValue('specifications')}
                  onHtmlChange={(v) => langChange('specifications', v)}
                />
              </SectionCard>

              {/* ── Card: FAQ ── */}
              <SectionCard
                title={t('products.detail.sectionFaqs')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {form.faqs.length} {t('products.detail.faqs.unit', { defaultValue: 'câu hỏi' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.faqs.hint')}</p>
                {validationErrors.faqs && (
                  <p className="field-error mb-2 flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                    <AlertCircle size={13} className="shrink-0" />
                    {validationErrors.faqs}
                  </p>
                )}
                <FaqEditor
                  items={form.faqs}
                  onChange={(next) => updateField('faqs', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Video ── */}
              <SectionCard
                title={t('products.detail.videoSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {form.videos.length} video
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <VideoEditor
                  items={form.videos}
                  onChange={(next) => updateField('videos', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                />
              </SectionCard>
              </CollapsibleGroup>

              <CollapsibleGroup
                title={t('products.detail.groupClosing', { defaultValue: 'Tin cậy & bán kèm (cuối trang)' })}
                hint={t('products.detail.groupOptionalHint', { defaultValue: 'Tùy chọn' })}
                open={openGroups.closing}
                onToggle={() => toggleGroup('closing')}
                errorCount={groupCounts.closing}
              >
              {/* ── Card: Phụ kiện (sản phẩm bán kèm) ── */}
              <SectionCard
                title={t('products.detail.sectionAccessories')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn('bb-count-pill bb-count-pill--bordered', accessoryAtMax && 'bb-count-pill--warning')}
                    >
                      {form.accessoryProductIds.length} / {RELATED_PRODUCTS_MAX}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-3">{t('products.detail.accessoryHint')}</p>

                {form.accessoryProductChips.length > 0 && (
                  <SortableList
                    items={form.accessoryProductChips}
                    disabled={isReadOnly}
                    onReorder={reorderAccessoryProducts}
                    className="flex flex-col gap-1.5 mb-3 max-h-[22rem] overflow-y-auto pr-1"
                    renderItem={(chip, sortable) => (
                      <RelatedProductRow
                        chip={chip}
                        canEdit={!isReadOnly}
                        onRemove={removeAccessoryProduct}
                        t={t}
                        sortable={sortable}
                      />
                    )}
                    renderOverlay={(chip) => (
                      <RelatedProductRow chip={chip} canEdit={false} onRemove={() => {}} t={t} />
                    )}
                  />
                )}

                {!isReadOnly && (
                  <>
                    <ProductPickerCombobox
                      search={accessorySearch}
                      onSearchChange={setAccessorySearch}
                      open={accessorySearchDebounced.length >= 1}
                      loading={isSearchingAccessory}
                      items={accessorySearchItems}
                      addedIds={form.accessoryProductIds}
                      onPick={addAccessoryProduct}
                      placeholder={t('products.detail.accessorySearch')}
                      loadingText={t('products.detail.accessorySearching')}
                      emptyText={t('products.detail.accessoryEmpty')}
                      addedText={t('products.detail.accessoryAdded')}
                      disabled={accessoryAtMax}
                    />
                    {accessoryAtMax && (
                      <p className="mt-2 text-xs text-warning">
                        {t('products.detail.accessoryLimitHint', { max: RELATED_PRODUCTS_MAX })}
                      </p>
                    )}
                  </>
                )}
              </SectionCard>
              </CollapsibleGroup>
            </>
          )}

          {activeTab === 'seo' && (
            <>
              {/* ── Card: SEO ── */}
              <SectionCard title={t('products.detail.sectionSeo')} badge={<RoleBadge role="seo" />}>
                {/* Live Google SERP preview */}
                <div className="mb-4 rte-canvas-frame">
                  <div className="p-3 border border-border bg-white">
                    <div className="flex items-center gap-1 text-xs text-google-url mb-1">
                      <PfSearch size={12} />
                      <span>{t('products.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
                    </div>
                    <div className="text-xs text-google-url break-all mb-1">
                      {canonicalUrlFromSlug(form.slug) || `https://bigbike.vn/product/duong-dan-san-pham/`}
                    </div>
                    <div className="text-lg leading-snug text-google-title break-words mb-1">
                      {(form.seoTitle || form.name || t('products.detail.serpTitleFallback', { defaultValue: 'Tiêu đề sản phẩm trên Google' })).slice(0, 60)}
                    </div>
                    <div className="text-sm leading-relaxed text-google-description break-words">
                      {form.seoDescription || form.shortDescription || t('products.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn về sản phẩm sẽ hiển thị ở đây.' })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('products.detail.seoTitle')}
                    count={`${langValue('seoTitle').length} / 60`}
                    countWarn={langValue('seoTitle').length > 60}
                    error={validationErrors.seoTitle}
                  >
                    <Input
                      value={langValue('seoTitle')}
                      onChange={(e) => langChange('seoTitle', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={255}
                      placeholder={t('products.detail.seoTitle')}
                    />
                  </Field>

                  <Field
                    full
                    label={t('products.detail.seoDescription')}
                    count={`${langValue('seoDescription').length} / 155`}
                    countWarn={langValue('seoDescription').length > 155}
                    error={validationErrors.seoDescription}
                  >
                    <Textarea
                      value={langValue('seoDescription')}
                      onChange={(e) => langChange('seoDescription', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={5000}
                      placeholder={t('products.detail.seoDescription')}
                    />
                  </Field>

                  <Field
                    full
                    label={t('products.detail.seoCanonicalUrl')}
                    helper={t('products.detail.seoCanonicalAuto', { defaultValue: 'Tự sinh theo đường dẫn (slug) — không cần nhập.' })}
                  >
                    <Input
                      value={canonicalUrlFromSlug(form.slug) || ''}
                      readOnly
                      disabled
                      placeholder={`https://bigbike.vn/product/duong-dan-san-pham/`}
                    />
                  </Field>

                  <Field full label={t('products.detail.seoOgImageUrl')} helper="1200×630px (chuẩn mạng xã hội)." error={validationErrors.seoOgImageUrl}>
                    <ImageUrlInput
                      value={form.seoOgImageUrl}
                      onChange={(url) => updateField('seoOgImageUrl', url)}
                      alt={form.seoOgImageAlt}
                      onAltChange={(v) => updateField('seoOgImageAlt', v)}
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
                      <Check size={14} />
                      {t('products.detail.seoChecklist', { defaultValue: 'Checklist SEO' })}
                    </span>
                    <span className="font-mono text-sm font-bold text-success">
                      {seoPassed} / {seoChecks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-3">
                    {seoChecks.map((c, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-xs', c.ok ? 'text-foreground' : 'text-muted-foreground')}>
                        <span className={cn(
                          'w-4 h-4 flex items-center justify-center',
                          c.ok
                            ? 'bg-success-bg text-success'
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

          <Button
            variant="outline"
            type="button"
            onClick={() => setPreviewOpen(true)}
            title={t('products.detail.preview.title', { defaultValue: 'Xem trước trang sản phẩm' })}
          >
            <Eye size={14} className="mr-1.5" />
            {t('products.detail.preview.open', { defaultValue: 'Xem trước' })}
          </Button>

          {!isCreate && (
            <Button
              variant="outline"
              type="button"
              disabled={!canUpdate || isExportingJson}
              onClick={handleExportJson}
              title={!canUpdate ? t('products.requirePermission') : undefined}
            >
              {isExportingJson
                ? <Loader2 size={14} className="animate-spin mr-1.5" />
                : <Download size={14} className="mr-1.5" />}
              {t('products.detail.exportJson', { defaultValue: 'Xuất JSON' })}
            </Button>
          )}


          <Button
            variant="outline"
            type="button"
            disabled={isReadOnly || !isDirty}
            onClick={() => handleSave('DRAFT')}
          >
            {t('products.detail.saveDraft')}
          </Button>

          <Button
            type="button"
            disabled={isReadOnly || isSubmitting || !isDirty}
            onClick={() => handleSave(isPublished ? undefined : 'PUBLISHED')}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {primaryLabel}
          </Button>
        </StickyActionBar>

        {/* Modals */}
        {showPublishChecklist && pendingPublish && (
          <PublishChecklistModal
            form={pendingPublish.formToSave}
            onConfirm={confirmPublish}
            onCancel={() => { setShowPublishChecklist(false); setPendingPublish(null) }}
          />
        )}

        {showMatrixWizard && (
          <VariantMatrixWizard
            onGenerate={(newVariants) => {
              const existing = form.variants
              function variantSig(options) {
                return JSON.stringify(
                  [...(options || [])].map((o) => ({
                    k: isColorAttributeName(o.name) ? '__color__' : normalizeVariantToken(o.name),
                    v: normalizeVariantToken(o.value),
                  }))
                    .sort((a, b) => a.k.localeCompare(b.k))
                    .map(({ k, v }) => `${k}:::${v}`)
                )
              }
              const existingSigs = new Set(existing.map(v => variantSig(v.options)))
              const deduped = newVariants.filter(nv => !existingSigs.has(variantSig(nv.options)))
              const skipped = newVariants.length - deduped.length
              if (skipped > 0) {
                toast.info(t('products.detail.matrix.skipDuplicates', { count: skipped }))
              }
              if (deduped.length > 0) {
                updateField('variants', [...existing, ...deduped])
                toast.success(t('products.detail.matrix.added', { count: deduped.length }))
              }
            }}
            onClose={() => setShowMatrixWizard(false)}
          />
        )}

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
          previewPath="/preview/product/"
          i18nPrefix="products.detail.preview"
          t={t}
        />
    </Screen>
    </AssignmentConfigContext.Provider>
  )
}
