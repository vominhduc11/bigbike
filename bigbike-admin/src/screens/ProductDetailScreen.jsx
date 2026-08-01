import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import {
  AlertCircle, Check, ChevronDown, ChevronRight, Eye, Info, Loader2, Lock, Save, Search as PfSearch, X,
} from 'lucide-react'

import {
  createProduct,
  fetchBrands,
  fetchCategoryTree,
  fetchProductAssignment,
  fetchProductDetail,
  mapValidationErrors,
  previewProduct,
  publishProduct,
  updateProduct,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { clearNavGuard } from '@/lib/navigationGuard'
import { recordRecentItem } from '../lib/useRecentItems'
import { formatDateTime } from '../lib/formatters'
import { setContentLang, useContentLang, overlayEnNames } from '../lib/contentLang'
import { queryKeys } from '../lib/queryKeys'
import { createProductSchema, zodErrors, normalizeVariantToken, isColorAttributeName } from '../lib/schemas'
import { Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { BrandCombobox } from './product-detail/BrandCombobox'
import { useProductPicker } from '../lib/useProductPicker'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { parseSpecsFromHtml } from '../lib/specSheet'
import { parseSpecStatsFromHtml } from '../lib/specStatsBlock'
import { parseTrustBadgesFromHtml } from '../lib/trustBadgesBlock'
import { RichTextEditor } from '../components/RichTextEditor'
import { BlockEditor } from '../components/BlockEditor'
import { SuitabilityBlockEditor, SizeGuideBlockEditor } from '../components/block-editor/blocks'
import { createBlock } from '../components/block-editor/constants'
import { SortableList } from '../components/Sortable'
import { LivePreview } from '../components/LivePreview'
import { useAutoHideSidebar } from '../components/AdminShell'
import { useAdminPresence } from '../lib/useAdminPresence'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs as UiTabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import {
  slugify,
  formatPrice,
  getAutosaveKey,
  saveFormToStorage,
  loadFormFromStorage,
  clearFormFromStorage,
  buildEmptyForm,
  findOptionById,
  prependSelectedOption,
  buildCategoryPathMap,
  buildCategoryParentPathMap,
  buildCategoryTreeOrder,
  buildCategoryChildrenSet,
  buildVisibleCategoryTreeRows,
  buildFormFromItem,
  toPayload,
  canonicalUrlFromSlug,
  TAB_SECTIONS,
  computeSectionErrorsFromMap,
  findTabForErrors,
  computeAttrSetWarning,
  MAIN_SECTION_GROUPS,
  MAIN_GROUPS_DEFAULT_OPEN,
  groupsWithErrors,
  getPublishReadiness,
  publishBadgeClass,
  RELATED_PRODUCTS_MAX,
  SPEC_STAT_MAX,
  VARIANTS_FILTER_THRESHOLD,
  SYSTEM_CATEGORY_ID,
} from './product-detail/constants'

// ── Sub-components ─────────────────────────────────────────────────────────────

import {
  GalleryEditor,
  VideoEditor,
  SpecificationsEditor,
  HighlightsEditor,
  HighlightsHtmlEditor,
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
// ── Prototype form layout ───────────────────────────────────────────────────────

import {
  RelatedProductRow,
  RoleBadge,
  AssignmentBanner,
} from './product-detail/Layout'
import { SectionCard } from '../components/SectionCard'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { FormField as Field } from '../components/layout/FormField'
import { AssignmentConfigContext } from './product-detail/constants'
import { PublishChecklistModal } from './product-detail/Modals'

// "Phù hợp với ai" (suitability) và "Bảng size" (sizeGuide) có card riêng NGOÀI trình dựng mô tả, và
// (V327/V328) dữ liệu của chúng giờ cũng lưu ở 2 field riêng (form.suitabilitySection/sizeGuideSection)
// — không còn embedded trong descriptionBlocks, không cần helper lọc/ghép nữa.
// Nhãn hiển thị cho giới tính khi contentLang='en' — value lưu DB vẫn luôn "Nam"/"Nữ" (DATA_CONTRACT.md).
const GENDER_LABEL_EN = { Nam: 'Male', 'Nữ': 'Female' }
const EMPTY_ITEMS = []
// Thụt lề theo cấp trong cây danh mục bằng class Tailwind có sẵn; cấp sâu hơn
// dùng lại mức sâu nhất để không cần arbitrary spacing.
const CATEGORY_TREE_INDENT_CLASSES = ['pl-2', 'pl-6', 'pl-10', 'pl-14', 'pl-16', 'pl-20', 'pl-24', 'pl-28']

// ── Main screen ────────────────────────────────────────────────────────────────

export function ProductDetailScreen({ productId, isCreate = false, navigate, canUpdate, canReadCatalog }) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const { hasOtherAdmin } = useAdminPresence('product', isCreate ? null : productId)
  const [form, setForm] = useState(buildEmptyForm)
  // Dirty tracking via boolean flag (set true on any field update, reset on
  // load/save). JSON.stringify(form) was the previous strategy but ran on
  // every render and grew O(N) with variants count — dropped sharply when
  // some sản phẩm lên tới 100+ biến thể.
  const [isDirty, setIsDirty] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublishToggling, setIsPublishToggling] = useState(false)
  const [showPublishChecklist, setShowPublishChecklist] = useState(false)
  const [isRestoreConfirming, setIsRestoreConfirming] = useState(false)
  const [variantsDeletedToEmpty, setVariantsDeletedToEmpty] = useState(false)
  const restoreConfirmingRef = useRef(false)
  const slugEditedByUser = useRef(false)
  const enSlugEditedByUser = useRef(false)

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

  // Mở panel Xem trước → tự ẩn sidebar bên trái, nhường chỗ cho form (màn hình vốn đã
  // chật vì có thêm panel 520px). Đóng preview hoặc rời trang → sidebar hiện lại.
  useAutoHideSidebar(previewOpen)

  useEffect(() => {
    if (!previewOpen || !canUpdate) return
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
  }, [previewOpen, previewLang, form, canUpdate])

  // Autosave / draft recovery
  const autosaveKey = getAutosaveKey(productId, isCreate)
  const [draftRecovery, setDraftRecovery] = useState(null)

  // Variant matrix wizard
  const [showMatrixWizard, setShowMatrixWizard] = useState(false)

  // Discount helper for salePrice
  const [showDiscountHelper, setShowDiscountHelper] = useState(false)
  const [discountPct, setDiscountPct] = useState('')

  // Ưu điểm & Nhược điểm: 1 công tắc Nhập có cấu trúc/Dán mã HTML dùng chung cho cả 2 cột
  const [highlightsMode, setHighlightsMode] = useState('structured')

  const { data: fetchResult, isLoading, isError, error: fetchError, refetch } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProductDetail(productId),
    enabled: !isCreate,
  })

  // Ô gán Danh mục / Thương hiệu phải liệt kê ĐẦY ĐỦ để gán được cả mục chưa dịch.
  // Lấy danh sách 'vi' đầy đủ; ở EN nạp thêm danh sách 'en' để phủ tên Anh khi có.
  const isEn = contentLang === 'en'
  const { data: categoriesResultVi, isError: categoriesLoadError } = useQuery({
    queryKey: queryKeys.categoriesTree('vi'),
    queryFn: () => fetchCategoryTree('vi'),
    enabled: canReadCatalog,
    staleTime: 5 * 60 * 1000,
  })
  const { data: categoriesResultEn } = useQuery({
    queryKey: queryKeys.categoriesTree('en'),
    queryFn: () => fetchCategoryTree('en'),
    enabled: canReadCatalog && isEn,
    staleTime: 5 * 60 * 1000,
  })
  const { data: brandsResultVi } = useQuery({
    queryKey: queryKeys.brandsAll('vi'),
    queryFn: () => fetchBrands({ pageSize: 100, lang: 'vi' }),
    enabled: canReadCatalog,
    staleTime: 5 * 60 * 1000,
  })
  const { data: brandsResultEn } = useQuery({
    queryKey: queryKeys.brandsAll('en'),
    queryFn: () => fetchBrands({ pageSize: 100, lang: 'en' }),
    enabled: canReadCatalog && isEn,
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
    queryKey: queryKeys.productAssignment(),
    queryFn: () => fetchProductAssignment(),
    staleTime: 5 * 60 * 1000,
  })
  const categories = categoriesResult?.items ?? EMPTY_ITEMS
  const brands = brandsResult?.items ?? EMPTY_ITEMS
  const loadedProduct = fetchResult?.item ?? null
  const loadedCategoryRefs = [
    loadedProduct?.category,
    ...(Array.isArray(loadedProduct?.categories) ? loadedProduct.categories : []),
  ].filter(Boolean)
  const selectedBrandRef = findOptionById([loadedProduct?.brand].filter(Boolean), form.brandId)
  const categoryOptions = useMemo(() => {
    const byId = new Map()
    for (const category of [...categories, ...loadedCategoryRefs]) {
      if (category?.id && !byId.has(category.id)) byId.set(category.id, category)
    }
    for (const id of form.categoryIds ?? []) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          name: t('products.detail.optionNotFound', { id }),
          slug: id,
          visible: false,
          deleted: true,
        })
      }
    }
    return [...byId.values()]
  }, [categories, form.categoryIds, loadedCategoryRefs, t])
  const brandOptions = prependSelectedOption(brands, selectedBrandRef)
  // Nhãn "Cha › Con › Cháu" để phân biệt cha/con khi cây danh mục có nhiều cấp.
  const categoryPathById = useMemo(() => buildCategoryPathMap(categoryOptions), [categoryOptions])
  const categoryParentPathById = useMemo(() => buildCategoryParentPathMap(categoryOptions), [categoryOptions])
  // Thứ tự cây + độ sâu để thụt lề con dưới cha trong ô chọn danh mục.
  const categoryTree = useMemo(() => buildCategoryTreeOrder(categoryOptions), [categoryOptions])
  const selectedCategories = (form.categoryIds ?? []).map((id) => (
    findOptionById(categoryOptions, id) || {
      id,
      name: t('products.detail.optionNotFound', { id }),
      slug: id,
      visible: false,
      deleted: true,
    }
  ))
  // Cha (mọi cấp) có ít nhất 1 con trong categoryTree — quyết định hiện mũi tên
  // mở/thu ở ô chọn danh mục.
  const categoryIdsWithChildren = useMemo(() => buildCategoryChildrenSet(categoryTree), [categoryTree])
  // Tổ tiên (mọi cấp) của các danh mục đang được chọn — tự mở để không ẩn mất
  // lựa chọn hiện có khi sửa sản phẩm cũ.
  const autoExpandCategoryIds = useMemo(() => {
    const byId = new Map(categoryTree.map((node) => [node.id, node]))
    const result = new Set()
    for (const id of form.categoryIds ?? []) {
      let node = byId.get(id)
      while (node?.parentId && byId.has(node.parentId)) {
        result.add(node.parentId)
        node = byId.get(node.parentId)
      }
    }
    return result
  }, [categoryTree, form.categoryIds])
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(() => new Set(autoExpandCategoryIds))
  // Đồng bộ trong lúc render (không phải effect) khi form.categoryIds đổi thật
  // (load sản phẩm / tick chọn) — so sánh theo form.categoryIds (chỉ đổi
  // reference qua setForm) chứ không theo autoExpandCategoryIds: categoryTree
  // phía trên build lại object mỗi render (do loadedCategoryRefs không memo),
  // so sánh trực tiếp Set đó sẽ luôn lệch → setState mỗi render → vòng lặp vô hạn.
  const [syncedCategoryIds, setSyncedCategoryIds] = useState(form.categoryIds)
  if (form.categoryIds !== syncedCategoryIds) {
    setSyncedCategoryIds(form.categoryIds)
    if (autoExpandCategoryIds.size > 0) {
      setExpandedCategoryIds((previous) => {
        let changed = false
        const next = new Set(previous)
        for (const id of autoExpandCategoryIds) {
          if (!next.has(id)) {
            next.add(id)
            changed = true
          }
        }
        return changed ? next : previous
      })
    }
  }
  function toggleCategoryExpanded(categoryId) {
    setExpandedCategoryIds((previous) => {
      const next = new Set(previous)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }
  // Danh sách hiện trong popover: gốc luôn hiện, con chỉ hiện khi cha đang mở —
  // categoryTree đã depth-first nên cha luôn duyệt trước con.
  const visibleCategoryTreeRows = useMemo(
    () => buildVisibleCategoryTreeRows(categoryTree, expandedCategoryIds),
    [categoryTree, expandedCategoryIds],
  )
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

  // Check autosave on mount for create mode
  useEffect(() => {
    if (!isCreate) return

    const draft = loadFormFromStorage(autosaveKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (draft?.form) setDraftRecovery(draft)
  }, [autosaveKey, isCreate])

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

  const isReadOnly = !canUpdate || isSubmitting || isPublishToggling
  const formRef = useRef(null)

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

  function setProductCategories(nextIds) {
    const categoryIds = [...new Set(nextIds.map((id) => String(id || '').trim()).filter(Boolean))]
    updateField('categoryIds', categoryIds)
  }

  function toggleProductCategory(categoryId) {
    if (isReadOnly) return
    const category = findOptionById(categoryOptions, categoryId)
    const isLocked = category?.deleted === true || category?.visible === false || category?.isVisible === false
    const selected = form.categoryIds?.includes(categoryId)
    if (isLocked && !selected) return
    setProductCategories(selected
      ? form.categoryIds.filter((id) => id !== categoryId)
      : [
          ...(form.categoryIds ?? []).filter((id) => id !== SYSTEM_CATEGORY_ID),
          categoryId,
        ])
  }

  function moveProductCategory(categoryId, direction) {
    const current = [...(form.categoryIds ?? [])]
    const index = current.indexOf(categoryId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    setProductCategories(current)
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
      // Lỗi theo trường (vd trùng slug/SKU) có thể nằm trong thẻ đang thu gọn — mở ra + nhảy tab.
      if (hasFieldErrors) revealErrorSections(fieldErrors)
      toast.error(
        error.message || t('products.detail.errSaveFailed'),
        hasFieldErrors
          ? undefined
          : { action: { label: t('common.retry', { defaultValue: 'Thử lại' }), onClick: () => handleSave() } },
      )
      setIsSubmitting(false)
    },
  })

  const togglePublishMutation = useMutation({
    mutationFn: (nextStatus) => publishProduct(productId, nextStatus),
    onSuccess: (response, nextStatus) => {
      setForm((previous) => ({ ...previous, publishStatus: nextStatus }))
      setShowPublishChecklist(false)
      queryClient.setQueryData(['product', productId], (previous) => {
        if (response?.item) return response
        if (!previous?.item) return previous
        return {
          ...previous,
          item: { ...previous.item, publishStatus: nextStatus },
        }
      })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(t('products.publishToggleSuccess', { defaultValue: 'Đã đổi trạng thái xuất bản.' }))
      setIsPublishToggling(false)
    },
    onError: (error) => {
      toast.error(error?.message || t('products.detail.errPublishFailed'))
      setIsPublishToggling(false)
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

  // Khi lưu lỗi (client hoặc server trả về): chuyển sang tab chứa lỗi, BUNG các nhóm đang thu gọn
  // có chứa mục lỗi (để không giấu lỗi sau nhóm đã đóng), rồi focus ô lỗi đầu tiên.
  function revealErrorSections(errorsMap) {
    const hasEnglishError = Object.keys(errorsMap).some((key) => key.startsWith('translations.en.'))
    if (hasEnglishError && !isEnLang) {
      setContentLang('en')
      toast.error(t('products.detail.englishErrorsToast', {
        defaultValue: 'Có lỗi ở nội dung tiếng Anh. Màn hình đã chuyển sang English để bạn bổ sung.',
      }))
    }
    const failedSections = computeSectionErrorsFromMap(errorsMap)
    const failedTab = findTabForErrors(failedSections)
    if (failedTab && failedTab !== activeTab) setActiveTab(failedTab)
    const failedGroups = groupsWithErrors(failedSections)
    if (failedGroups.length > 0) {
      setOpenGroups((prev) => {
        const next = { ...prev }
        for (const id of failedGroups) next[id] = true
        return next
      })
    }
    focusFirstError()
  }

  async function handleSave(overridePublishStatus) {
    if (!canUpdate) return null

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
      revealErrorSections(clientErrors)
      return null
    }

    const currentCategoryIds = formToSave.categoryIds ?? []
    const initialCategoryIds = formToSave.initialCategoryIds ?? []
    const categoriesChanged = currentCategoryIds.length !== initialCategoryIds.length ||
      currentCategoryIds.some((id, index) => id !== initialCategoryIds[index])

    setIsSubmitting(true)
    setValidationErrors({})
    try {
      const response = await saveMutation.mutateAsync(
        toPayload(formToSave, { includeCategoryIds: isCreate || categoriesChanged }),
      )
      return response?.item ? buildFormFromItem(response.item) : null
    } catch {
      return null
    }
  }


  // ── Tab navigation state (replaces the old TOC sidebar) ─────────────────────
  // 2 tab: "main" gộp toàn bộ nội dung sản phẩm theo đúng thứ tự khối trên PDP bigbike-web
  // (khối #1 PurchaseSection: tên/ảnh/giá/biến thể + gallery phụ/dải tin cậy → thân trang #2→#12
  // specStats → ... → accessories); "seo" không đổi. Trong tab main, nhóm `overviewExtra`
  // (gallery, dải tin cậy — không bắt buộc) collapsed mặc định để chống ngợp field (audit P0-1).
  const [activeTab, setActiveTab] = useState('main')
  // Tab "main" gom mọi mục thành 3 NHÓM gấp/mở. Mở sẵn nhóm bán hàng cốt lõi (MAIN_GROUPS_DEFAULT_OPEN),
  // 2 nhóm còn lại thu gọn để form không dài lê thê.
  const [openGroups, setOpenGroups] = useState(() => ({ ...MAIN_GROUPS_DEFAULT_OPEN }))
  const toggleGroup = (id) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }))
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
    if (!isCreate && fetchError?.status === 404) {
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

  // Badge số lỗi hiển thị bên phải tiêu đề NHÓM gấp/mở (đẩy sát phải qua ml-auto). Undefined khi
  // nhóm không lỗi để không chiếm chỗ. Đếm theo các mục (section key) thuộc nhóm đang lỗi.
  function mainGroupErrorBadge(groupId) {
    const group = MAIN_SECTION_GROUPS.find((g) => g.id === groupId)
    const count = group ? group.sections.filter((s) => sectionErrors[s]).length : 0
    if (!count) return undefined
    return (
      <span className="ml-auto whitespace-nowrap text-xs font-bold text-danger">
        <span aria-hidden="true">{t('products.detail.groupErrorCount', { count, defaultValue: '{{count}} lỗi' })}</span>
        <span className="sr-only">{t('products.detail.groupErrorCountFull', { count, defaultValue: '{{count}} lỗi cần sửa' })}</span>
      </span>
    )
  }

  // SEO checklist — chấm theo NGÔN NGỮ đang sửa. seoTitle / seoDescription là
  // song ngữ (theo tab VI/EN); slug, alt ảnh và OG image dùng chung nên giữ ở
  // field base. `hint` hiển thị số ký tự hiện tại để trạng thái ✓/✗ tự giải thích.
  const seoTitleVal = langValue('seoTitle')
  const seoDescVal = langValue('seoDescription')
  const seoChecks = [
    { ok: seoTitleVal.length >= 30 && seoTitleVal.length <= 60, hint: seoTitleVal.length, label: t('products.detail.seoCheckTitle', { defaultValue: 'Tiêu đề trên Google dài 30–60 ký tự' }) },
    { ok: seoDescVal.length >= 140 && seoDescVal.length <= 160, hint: seoDescVal.length, label: t('products.detail.seoCheckDesc', { defaultValue: 'Mô tả trên Google dài 140–160 ký tự' }) },
    { ok: !!form.slug && /^[a-z0-9-]+$/.test(form.slug), label: t('products.detail.seoCheckSlug', { defaultValue: 'Đường dẫn dùng chữ thường, không dấu, dùng dấu gạch ngang' }) },
    { ok: !!form.imageUrl?.trim() && !!form.imageAlt?.trim(), label: t('products.detail.seoCheckImageAlt', { defaultValue: 'Ảnh đại diện có mô tả' }) },
    { ok: !!form.seoOgImageUrl, label: t('products.detail.seoCheckOg', { defaultValue: 'Có ảnh để chia sẻ lên mạng xã hội' }) },
    { ok: !!form.imageUrl?.trim() && Number(form.retailPrice) > 0, label: t('products.detail.seoCheckSchema', { defaultValue: 'Thông tin sản phẩm có đủ ảnh và giá' }) },
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

  // Trang sửa chỉ còn 1 nút Lưu: sản phẩm đang PUBLISHED thì lưu giữ nguyên trạng thái
  // (không bị lùi về Nháp chỉ vì sửa nội dung); sản phẩm TRASH cần xác nhận trước khi
  // khôi phục về DRAFT; còn lại luôn lưu về DRAFT — đăng bán là hành động riêng, chỉ
  // làm được từ nút bật/tắt ở màn danh sách sản phẩm.
  const isPublished = form.publishStatus === 'PUBLISHED'
  const isTrashed = form.publishStatus === 'TRASH'
  const primaryLabel = isTrashed
    ? t('products.detail.restoreAndSave')
    : isPublished ? t('products.detail.saveBtn') : t('products.detail.saveDraft')
  const publishActionLabel = isPublished
    ? t('products.unpublishAction', { defaultValue: 'Chuyển về Nháp' })
    : t('products.publishAction', { defaultValue: 'Xuất bản' })

  function changePublishStatus(nextStatus) {
    setIsPublishToggling(true)
    togglePublishMutation.mutate(nextStatus)
  }

  async function handlePublishAction() {
    if (!canUpdate || isCreate || isTrashed || isPublishToggling) return
    if (isDirty) {
      toast.info(t('products.detail.publishRequiresSavedForm', {
        defaultValue: 'Hãy lưu các thay đổi trước khi đổi trạng thái xuất bản.',
      }))
      return
    }

    if (!isPublished) {
      setShowPublishChecklist(true)
      return
    }

    const confirmed = await showConfirm(
      t('products.detail.unpublishConfirm', {
        defaultValue: 'Sản phẩm sẽ ngừng hiển thị trên website và chuyển về Nháp. Tiếp tục?',
      }),
      t('products.detail.unpublishConfirmTitle', { defaultValue: 'Chuyển sản phẩm về Nháp?' }),
      {
        variant: 'default',
        confirmLabel: t('products.unpublishAction', { defaultValue: 'Chuyển về Nháp' }),
      },
    )
    if (confirmed) changePublishStatus('DRAFT')
  }

  function confirmPublishFromChecklist() {
    const blockers = getPublishReadiness(form, t).filter((item) => item.required && !item.ok)
    if (blockers.length > 0) {
      toast.error(t('products.detail.checklist.blockerMessage', { count: blockers.length }))
      return
    }
    changePublishStatus('PUBLISHED')
  }

  async function handlePrimarySave() {
    if (isTrashed) {
      if (restoreConfirmingRef.current) return
      restoreConfirmingRef.current = true
      setIsRestoreConfirming(true)
      try {
        const confirmed = await showConfirm(
          t('products.detail.restoreAndSaveConfirm'),
          t('products.detail.restoreAndSaveConfirmTitle'),
          { variant: 'default', confirmLabel: primaryLabel },
        )
        if (confirmed) await handleSave('DRAFT')
      } finally {
        restoreConfirmingRef.current = false
        setIsRestoreConfirming(false)
      }
      return
    }

    handleSave(isPublished ? undefined : 'DRAFT')
  }

  async function handleClose() {
    if (isDirty) {
      const confirmed = await showConfirm(
        t('products.detail.unsavedChangesConfirm'),
        t('products.detail.unsavedChangesTitle'),
      )
      if (!confirmed) return
    }
    clearNavGuard()
    navigate('/admin/products')
  }

  return (
    <AssignmentConfigContext.Provider value={assignmentConfig ?? null}>
    <div className="flex w-full min-w-0 items-start gap-6">
    {/* @container: các lưới trong form co theo BỀ RỘNG CỘT NÀY, không theo cửa sổ —
        khi kéo khung xem trước rộng ra làm cột hẹp lại thì lưới tự về 1 cột, không chật. */}
    <div className="@container min-w-0 flex-1 basis-0">
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
                      defaultValue: 'Tên tiếng Anh là bắt buộc; nội dung tiếng Anh khác có thể bổ sung sau.',
                    })}
                  </>
                )}
              </span>
            ) : isEnLang ? (
              <span className="text-xs">
                {t('products.detail.langEnHint', {
                  defaultValue: 'Tên tiếng Anh là bắt buộc; nội dung tiếng Anh khác có thể bổ sung sau.',
                })}
              </span>
            ) : null
          }
          badge={
            <span className="inline-flex items-center gap-2">
              <span className={publishBadgeClass(form.publishStatus)}>
                {t(`status.publish.${form.publishStatus}`, { defaultValue: form.publishStatus })}
              </span>
              {!canUpdate && (
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
                className="min-h-11 min-w-11"
                onClick={handleClose}
                aria-label={t('common.cancel')}
                data-screen-close="true"
              >
                <X size={18} />
              </Button>
            </div>
          }
        />

        {/* Banners — trash / read-only / draft-recovery */}
        {isTrashed && (
          <div className="bb-alert warning wrap">
            <AlertCircle size={16} className="shrink-0" />
            <div className="bb-alert-main">{t('products.detail.trashWarning')}</div>
          </div>
        )}

        {hasOtherAdmin ? (
          <Alert tone="warning" size="sm" className="mb-4">
            {t('presence.otherAdminProduct', { defaultValue: 'Có quản trị viên khác đang mở sản phẩm này. Hãy kiểm tra dữ liệu trước khi lưu.' })}
          </Alert>
        ) : null}

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
            { key: 'main', label: t('products.detail.tabMain', { defaultValue: 'Thông tin sản phẩm' }), count: tabErrorBadge(tabCounts.main) },
            { key: 'seo',  label: t('products.detail.tabSeo', { defaultValue: 'SEO' }),                 count: tabErrorBadge(tabCounts.seo) },
          ]}
        />

        <form
          ref={formRef}
          className="flex flex-col gap-6 pb-24"
          onSubmit={(e) => { e.preventDefault(); handlePrimarySave() }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isReadOnly && isDirty) {
              e.preventDefault()
              handlePrimarySave()
            }
          }}
        >
          {activeTab === 'main' && (
            <>
              {/* ══ Nhóm 1: Bán hàng & hình ảnh ══ */}
              <CollapsibleSection
                title={t('products.detail.groupSales', { defaultValue: 'Bán hàng & hình ảnh' })}
                hint={t('products.detail.groupSalesHint', { defaultValue: 'Thông tin để bán: cơ bản, ảnh, giá, biến thể' })}
                open={openGroups.sales}
                onToggle={() => toggleGroup('sales')}
                badge={mainGroupErrorBadge('sales')}
                keepMounted
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
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
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
                      ? t('products.detail.slugHintEn', { defaultValue: 'Đường dẫn tiếng Anh (tùy chọn) — để trống nghĩa là sản phẩm chưa có trang tiếng Anh.' })
                      : t('products.detail.slugHint')}
                  >
                    <Input
                      value={isEnLang ? (form.translations?.en?.slug || '') : (form.slug || '')}
                      placeholder={isEnLang
                        ? t('products.detail.slugPlaceholderEn')
                        : t('products.detail.slugPlaceholderVi')}
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
                    required
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

                  <Field
                    label={t('products.detail.categoryIds')}
                    required
                    error={validationErrors.categoryIds || (categoriesLoadError ? t('products.detail.categoriesLoadError', { defaultValue: 'Không tải được danh mục. Vui lòng tải lại trang.' }) : undefined)}
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal"
                          disabled={isReadOnly}
                          onBlur={() => validateFieldOnBlur('categoryIds')}
                        >
                          {selectedCategories.length > 0
                            ? t('products.detail.categorySelectedCount', { count: selectedCategories.length })
                            : t('products.detail.categoryPlaceholder')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-80 p-2">
                        <p className="px-2 py-1 text-xs text-muted-foreground">
                          {t('products.detail.categoryPickerHint')}
                        </p>
                        <div className="max-h-64 space-y-1 overflow-y-auto">
                          {visibleCategoryTreeRows.map((category) => {
                            const selected = form.categoryIds?.includes(category.id)
                            const locked = category.deleted === true || category.visible === false || category.isVisible === false
                            const hasChildren = categoryIdsWithChildren.has(category.id)
                            const isExpanded = expandedCategoryIds.has(category.id)
                            const parentPath = categoryParentPathById.get(category.id)
                            return (
                              <div
                                key={category.id}
                                title={categoryPathById.get(category.id) || category.name}
                                className={cn(
                                  'flex min-h-11 items-center gap-3 py-2 pr-2 text-sm hover:bg-muted',
                                  CATEGORY_TREE_INDENT_CLASSES[Math.min(category.depth, CATEGORY_TREE_INDENT_CLASSES.length - 1)],
                                  locked && !selected && 'opacity-60',
                                )}
                              >
                                {hasChildren ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="min-h-11 min-w-11 shrink-0 text-muted-foreground"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      toggleCategoryExpanded(category.id)
                                    }}
                                    aria-label={isExpanded
                                      ? t('products.detail.categoryCollapse', { defaultValue: 'Thu gọn' })
                                      : t('products.detail.categoryExpand', { defaultValue: 'Mở rộng' })}
                                  >
                                    {isExpanded
                                      ? <ChevronDown size={14} aria-hidden="true" />
                                      : <ChevronRight size={14} aria-hidden="true" />}
                                  </Button>
                                ) : (
                                  <span className="min-h-11 min-w-11 shrink-0" aria-hidden="true" />
                                )}
                                <label className={cn(
                                  'flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3',
                                  locked && !selected && 'cursor-not-allowed',
                                )}>
                                  <Checkbox
                                    checked={selected}
                                    disabled={isReadOnly || (locked && !selected)}
                                    onCheckedChange={() => toggleProductCategory(category.id)}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate">{category.name}</span>
                                    {parentPath && (
                                      <span className="block truncate text-xs text-muted-foreground">{parentPath}</span>
                                    )}
                                    {locked && (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Lock size={12} aria-hidden="true" />
                                        {t('products.detail.categoryLocked')}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="mt-2 space-y-2">
                      {selectedCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('products.detail.categoryEmpty')}</p>
                      ) : selectedCategories.map((category, index) => {
                        const locked = category.deleted === true || category.visible === false || category.isVisible === false
                        return (
                          <div key={category.id} className="flex items-center gap-2 border border-border bg-muted/30 p-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium">{categoryPathById.get(category.id) || category.name}</span>
                                {index === 0 && <span className="text-xs font-medium text-primary">{t('products.detail.categoryPrimary')}</span>}
                                {locked && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Lock size={12} aria-hidden="true" />
                                    {t('products.detail.categoryLocked')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11 px-2 text-xs"
                                disabled={isReadOnly || locked || index === 0}
                                onClick={() => moveProductCategory(category.id, -1)}
                              >
                                {t('products.detail.categoryMoveUp')}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11 px-2 text-xs"
                                disabled={isReadOnly || locked || index === selectedCategories.length - 1}
                                onClick={() => moveProductCategory(category.id, 1)}
                              >
                                {t('products.detail.categoryMoveDown')}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11 px-2 text-xs"
                                disabled={isReadOnly}
                                onClick={() => toggleProductCategory(category.id)}
                              >
                                {t('products.detail.categoryRemove')}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Field>

                  <Field label={t('products.detail.brandId')} required error={validationErrors.brandId}>
                    <BrandCombobox
                      displayLabel={selectedBrandLabel}
                      options={brandOptions}
                      onChange={(id) => updateField('brandId', id)}
                      disabled={isReadOnly}
                      placeholder={t('products.detail.brandSearchPlaceholder', { defaultValue: 'Tìm hoặc tạo thương hiệu…' })}
                    />
                  </Field>

                  <Field
                    label={t('products.detail.trust.originBrand', { defaultValue: 'Thương hiệu (nước)' })}
                    helper={t('products.detail.trust.originBrandHint', { defaultValue: 'Nhập riêng cho từng ngôn ngữ — chuyển tab VI/EN ở góc trên để nhập bản còn lại (vd: "Nhật Bản" ở tab VI, "Japan" ở tab EN).' })}
                  >
                    <Input
                      placeholder={isEn
                        ? t('products.detail.originBrandPlaceholderEn')
                        : t('products.detail.originBrandPlaceholderVi')}
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
                    <RichTextEditor
                      key={`shortDescription-${contentLang}`}
                      value={langValue('shortDescription')}
                      onChange={(html) => langChange('shortDescription', html)}
                      placeholder={t('products.detail.shortDescriptionPlaceholder')}
                      disabled={isReadOnly}
                      hasError={Boolean(validationErrors.shortDescription)}
                    />
                  </Field>

                </div>
              </SectionCard>

              {/* ── Card: Ảnh đại diện ── */}
              <SectionCard title={t('products.detail.mainImageTitle')} required={isPublished} badge={<RoleBadge role="content" />}>
                <ImageUrlInput
                  value={form.imageUrl}
                  onChange={(url, media) => {
                    updateField('imageUrl', url)
                    updateField('imageWidth', media?.width ?? null)
                    updateField('imageHeight', media?.height ?? null)
                    updateField('imageMimeType', media?.mimeType ?? null)
                  }}
                  alt={form.imageAlt}
                  onAltChange={(v) => updateField('imageAlt', v)}
                  disabled={isReadOnly}
                  error={validationErrors.imageUrl}
                  recommend={IMAGE_RECO.productImage}
                />
              </SectionCard>

              {/* ── Card: Gallery (ảnh phụ) — ngay dưới Ảnh đại diện, không bắt buộc ── */}
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

              {/* ── Card: Giá & trạng thái ── */}
              <SectionCard title={t('products.detail.sectionPricing')} required badge={<RoleBadge role="manager" />}>
                {variantsDeletedToEmpty && form.variants.length === 0 && (
                  <Alert tone="warning" size="sm" className="mb-4">
                    {t('products.detail.variantsEmptyWarning')}
                  </Alert>
                )}
                {form.variants.length > 0 && (
                  <div className="bb-alert info tight">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>{t('products.detail.variantPricingHint')}</span>
                  </div>
                )}
                <div className={cn('grid grid-cols-1 @xl:grid-cols-2 gap-x-4 gap-y-5', form.variants.length > 0 && 'mt-5')}>
                  <Field label={t('products.detail.retailPrice')} required={!hasVariants} error={validationErrors.retailPrice}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t('products.detail.retailPricePlaceholder')}
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
                        placeholder={t('products.detail.salePricePlaceholder')}
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

                  {form.variants.length === 0 && (
                    // Sản phẩm KHÔNG biến thể: công tắc Còn/Hết mức sản phẩm (admin tự quyết).
                    // Lưu qua available; backend dẫn xuất stockState theo công tắc này.
                    <div className="@xl:col-span-2 flex items-center gap-2.5 p-2.5 border border-border text-sm">
                      <Switch
                        checked={form.available}
                        onCheckedChange={(checked) => updateField('available', checked)}
                        disabled={isReadOnly}
                        aria-label={t('products.detail.productStock')}
                      />
                      <span className={form.available ? 'text-success font-medium' : 'text-danger font-medium'}>
                        {form.available ? t('status.stock.IN_STOCK') : t('status.stock.OUT_OF_STOCK')}
                      </span>
                      <span className="text-muted-foreground">— {t('products.detail.productStockHint')}</span>
                    </div>
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
                  onChange={(next) => {
                    if (form.variants.length > 0 && next.length === 0) setVariantsDeletedToEmpty(true)
                    if (next.length > 0) setVariantsDeletedToEmpty(false)
                    updateField('variants', next)
                  }}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  onOpenMatrixWizard={() => setShowMatrixWizard(true)}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Dải tin cậy (trên tên sản phẩm) (V233) — không bắt buộc ── */}
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

              {/* ── Card: Cam kết (dưới nút mua hàng) (V232) — web render khối này NGAY DƯỚI CTA mua hàng
                  (đầu trang, cùng nguồn dữ liệu lặp lại ở Trust "Mua tại BigBike.vn" #11 cuối trang) —
                  đặt cùng Nhóm 1 để khớp vị trí ưu tiên cao trên web, không nằm chung nhóm Video/Phụ kiện. ── */}
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
              </CollapsibleSection>

              {/* ══ Nhóm 2: Nội dung trang ══ */}
              <CollapsibleSection
                title={t('products.detail.groupContent', { defaultValue: 'Nội dung trang' })}
                hint={t('products.detail.groupContentHint', { defaultValue: 'Mô tả, thông số, FAQ, tư vấn — phần lớn không bắt buộc' })}
                open={openGroups.content}
                onToggle={() => toggleGroup('content')}
                badge={mainGroupErrorBadge('content')}
                keepMounted
              >

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
              <SectionCard
                title={t('products.detail.sectionDescription', { defaultValue: 'Mô tả chi tiết' })}
                badge={<RoleBadge role="content" />}
              >
                <p className="text-xs text-muted-foreground mb-3">
                  {t('products.detail.descriptionBuilderHint', { defaultValue: 'Trình dựng khối Tính năng chi tiết (chữ, ảnh, ảnh + chữ). Kéo-thả để đổi thứ tự. "Phù hợp với ai" và "Bảng size" nhập ở 2 card riêng bên dưới.' })}
                </p>
                <Field full label={t('products.detail.description')} error={validationErrors.description}>
                  <BlockEditor
                    value={form.descriptionBlocks}
                    onChange={(blocks) => updateField('descriptionBlocks', blocks)}
                    disabled={isReadOnly}
                    hasError={Boolean(validationErrors.description)}
                    showFallbackHtml={false}
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
                <UiTabs value={highlightsMode} onValueChange={setHighlightsMode} className="mb-3">
                  <TabsList>
                    <TabsTrigger value="structured" disabled={isReadOnly}>{t('products.detail.highlights.modeStructured')}</TabsTrigger>
                    <TabsTrigger value="html" disabled={isReadOnly}>{t('products.detail.highlights.modeHtml')}</TabsTrigger>
                  </TabsList>
                </UiTabs>
                {highlightsMode === 'html' ? (
                  <div>
                    {(validationErrors.positiveNotes || validationErrors.negativeNotes) && (
                      <div className="mb-2 flex flex-col gap-1">
                        {validationErrors.positiveNotes && (
                          <p className="field-error flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                            <AlertCircle size={13} className="shrink-0" />
                            {validationErrors.positiveNotes}
                          </p>
                        )}
                        {validationErrors.negativeNotes && (
                          <p className="field-error flex items-center gap-1 text-xs font-semibold text-danger" role="alert">
                            <AlertCircle size={13} className="shrink-0" />
                            {validationErrors.negativeNotes}
                          </p>
                        )}
                      </div>
                    )}
                    <HighlightsHtmlEditor
                      positiveNotes={form.positiveNotes}
                      negativeNotes={form.negativeNotes}
                      onChangePositive={(next) => updateField('positiveNotes', next)}
                      onChangeNegative={(next) => updateField('negativeNotes', next)}
                      disabled={isReadOnly}
                      contentLang={contentLang}
                    />
                  </div>
                ) : (
                  <div className="grid gap-5 @xl:grid-cols-2">
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
                )}
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
                    className="mb-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1"
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
                    key={`suit-${productId ?? 'new'}-${suitabilitySection._key}-${contentLang}`}
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
                  {t('products.detail.sizeGuideCard.hint', { defaultValue: 'Bảng chọn kích cỡ (nhập theo cột/dòng hoặc dán nội dung có sẵn). Bảng sẽ hiển thị riêng trên trang sản phẩm, ngay sau mục Phù hợp với ai. Để trống, website sẽ ẩn bảng này.' })}
                </p>
                {sizeGuideCreateLockedInEn ? (
                  <p className="list-editor-empty">
                    {t('products.detail.sizeGuideCard.addInViFirst', { defaultValue: 'Tạo khối này ở tab Tiếng Việt trước, rồi quay lại đây để dịch.' })}
                  </p>
                ) : (
                  <SizeGuideBlockEditor
                    key={`size-${productId ?? 'new'}-${sizeGuideSection._key}-${contentLang}`}
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

              </CollapsibleSection>

              {/* ══ Nhóm 3: Video, cam kết & bán kèm ══ */}
              <CollapsibleSection
                title={t('products.detail.groupExtras', { defaultValue: 'Video & bán kèm' })}
                hint={t('products.detail.groupExtrasHint', { defaultValue: 'Không bắt buộc' })}
                open={openGroups.extras}
                onToggle={() => toggleGroup('extras')}
                badge={mainGroupErrorBadge('extras')}
                keepMounted
              >

              {/* ── Card: Video ── */}
              <SectionCard
                title={t('products.detail.videoSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="bb-count-pill">
                      {t('products.detail.videoCount', { count: form.videos.length })}
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
                    className="mb-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1"
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
              </CollapsibleSection>
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
                      {isEnLang
                        ? (form.translations?.en?.slug
                            ? `https://bigbike.vn/products/${form.translations.en.slug}/`
                            : t('products.detail.serpNoEnglishUrl', { defaultValue: 'Chưa có trang tiếng Anh' }))
                        : (canonicalUrlFromSlug(form.slug) || 'https://bigbike.vn/product/duong-dan-san-pham/')}
                    </div>
                    <div className="text-lg leading-snug text-google-title break-words mb-1">
                      {(seoTitleVal || langValue('name') || t('products.detail.serpTitleFallback', { defaultValue: 'Tiêu đề sản phẩm trên Google' })).slice(0, 60)}
                    </div>
                    <div className="text-sm leading-relaxed text-google-description break-words">
                      {seoDescVal || langValue('shortDescription') || t('products.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn về sản phẩm sẽ hiển thị ở đây.' })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
                  <Field
                    full
                    label={t('products.detail.seoTitle')}
                    count={`${langValue('seoTitle').length} / 60`}
                    countWarn={langValue('seoTitle').length > 60}
                    error={isEnLang ? validationErrors['translations.en.seoTitle'] : validationErrors.seoTitle}
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
                    error={isEnLang ? validationErrors['translations.en.seoDescription'] : validationErrors.seoDescription}
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
                    label={t('products.detail.seoOgImageUrl')}
                    helper={t('products.detail.seoOgImageHint', { defaultValue: 'Kích thước đề xuất 1200×630 px cho mạng xã hội.' })}
                    error={validationErrors.seoOgImageUrl}
                  >
                    <ImageUrlInput
                      value={form.seoOgImageUrl}
                      onChange={(url, media) => {
                        updateField('seoOgImageUrl', url)
                        updateField('seoOgImageWidth', media?.width ?? null)
                        updateField('seoOgImageHeight', media?.height ?? null)
                        updateField('seoOgImageMimeType', media?.mimeType ?? null)
                      }}
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
                      {t('products.detail.seoChecklist', { defaultValue: 'Kiểm tra thông tin tìm kiếm' })}
                    </span>
                    <span className="font-mono text-sm font-bold text-success">
                      {seoPassed} / {seoChecks.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 @xl:grid-cols-2 gap-y-1 gap-x-3">
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

        {showPublishChecklist && (
          <PublishChecklistModal
            form={form}
            onConfirm={confirmPublishFromChecklist}
            onCancel={() => setShowPublishChecklist(false)}
          />
        )}

        <StickyActionBar
          ariaLabel={t('common.actionBarLabel', { defaultValue: 'Thanh thao tác' })}
          info={
            <span className="flex items-center gap-2 text-sm">
              <span className={cn('w-2 h-2 rounded-full', saveDotClass)} />
              <span className="font-medium">{saveLabel}</span>
            </span>
          }
        >

          {canUpdate && (
            <Button
              variant="outline"
              type="button"
              className="min-h-11"
              onClick={() => setPreviewOpen(true)}
              title={t('products.detail.preview.title', { defaultValue: 'Xem trước trang sản phẩm' })}
            >
              <Eye size={14} className="mr-1.5" />
              {t('products.detail.preview.open', { defaultValue: 'Xem trước' })}
            </Button>
          )}

          {canUpdate && !isCreate && !isTrashed && (
            <Button
              variant="outline"
              type="button"
              className="min-h-11"
              disabled={isReadOnly || isDirty}
              onClick={handlePublishAction}
              title={isDirty
                ? t('products.detail.publishRequiresSavedForm', {
                    defaultValue: 'Hãy lưu các thay đổi trước khi đổi trạng thái xuất bản.',
                  })
                : publishActionLabel}
            >
              {isPublishToggling && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              {publishActionLabel}
            </Button>
          )}

          <Button
            type="button"
            className="min-h-11"
            disabled={isReadOnly || isSubmitting || isRestoreConfirming || !isDirty}
            onClick={handlePrimarySave}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {primaryLabel}
          </Button>
        </StickyActionBar>

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

      </Screen>
    </div>
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
    </div>
    </AssignmentConfigContext.Provider>
  )
}
