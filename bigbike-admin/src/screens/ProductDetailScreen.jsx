import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertCircle, Check, ChevronDown, Eye, GripVertical, ImageOff, Info, Loader2, Lock, Pencil, Plus, Save, Search as PfSearch, Users, X,
  Award, BadgeCheck, Clock, CreditCard, Gift, Headphones, MapPin, Package, RefreshCw, ShieldCheck, Truck, Wrench,
} from 'lucide-react'
import {
  createAttributeValue,
  createProduct,
  fetchAttributes,
  fetchAttributeValues,
  fetchBrands,
  fetchCategoryTree,
  fetchProductAssignment,
  fetchProductDetail,
  fetchProducts,
  mapValidationErrors,
  previewProduct,
  updateAttribute,
  updateAttributeValueLabel,
  updateProduct,
} from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { useContentLang, overlayEnNames } from '../lib/contentLang'
import { createProductSchema, zodErrors, COLOR_ATTRIBUTE_KEYS, normalizeVariantToken, isColorAttributeName } from '../lib/schemas'
import { Modal, Screen, ScreenHeader, StickyActionBar, Tabs } from '../components/layout'
import { StatePanel } from '../components/StatePanel'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { ProductPickerCombobox } from '../components/ProductPickerCombobox'
import { MediaPickerModal } from '../components/MediaPickerModal'
import { VideoPickerModal } from '../components/VideoPickerModal'
import { MediaDimensionWarning } from '../components/MediaDimensionWarning'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { RichTextEditor } from '../components/RichTextEditor'
import { parseSizeGuide } from '../lib/sizeChart'
import { BlockEditor } from '../components/BlockEditor'
import { SortableList } from '../components/Sortable'
import { LivePreview } from '../components/LivePreview'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn, generateId } from '@/lib/utils'
import { resolveDisplayUrl } from '@/lib/contracts'

// Matches YouTube IDs across watch, share, embed, and shorts URLs.
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function inferVideoType(url, provider) {
  if (provider === 'youtube' || provider === 'upload') return provider
  if (extractYouTubeId(url)) return 'youtube'
  return url ? 'upload' : 'youtube'
}

// ── Slug generation ────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
}

// Returns the set of statuses the dropdown should allow given the saved status.
// Mirrors AdminMutationValidators.validatePublishTransition on the backend.
function getAllowedPublishStatuses(from) {
  const RULES = {
    DRAFT:     ['DRAFT', 'PUBLISHED', 'HIDDEN'],
    PUBLISHED: ['PUBLISHED', 'HIDDEN'],
    HIDDEN:    ['HIDDEN', 'PUBLISHED', 'DRAFT'],
    TRASH:     ['TRASH', 'DRAFT'],
    // Legacy escape paths for any remaining DB records before migration
    ARCHIVED:  ['HIDDEN', 'DRAFT'],
    PENDING:   ['PUBLISHED', 'DRAFT'],
    PRIVATE:   ['PUBLISHED', 'DRAFT', 'HIDDEN'],
  }
  return RULES[from] ?? ['DRAFT', 'PUBLISHED', 'HIDDEN']
}

// Format a raw digit string as Vietnamese price (e.g. "6300000" → "6.300.000").
function formatPrice(raw) {
  if (!raw) return ''
  return String(raw).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ── Autosave utilities ─────────────────────────────────────────────────────────

const AUTOSAVE_TTL_MS = 60 * 60 * 1000

function getAutosaveKey(productId, isCreate) {
  return `product-autosave:${isCreate ? 'new' : productId}`
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

// ── Publish readiness checklist ────────────────────────────────────────────────

function getPublishReadiness(form, t, isCreate = false) {
  // Publish gate. Khi TẠO MỚI siết hơn: bắt buộc thêm SKU/đường dẫn/đối tượng và các khối
  // nội dung (FAQ, ô số liệu, dải tin cậy) — khớp createProductSchema.
  // Khi SỬA sản phẩm cũ, các mục này chỉ là nhắc nhở (required:false) để không chặn lưu.
  const items = [
    { id: 'name',      label: t('products.detail.checklist.name'),      ok: Boolean(form.name?.trim()),                                             required: true  },
    { id: 'brand',     label: t('products.detail.checklist.brand'),     ok: Boolean(form.brandId),                                                  required: true  },
    { id: 'category',  label: t('products.detail.checklist.category'),  ok: Boolean(form.categoryId),                                               required: true  },
    { id: 'image',     label: t('products.detail.checklist.image'),     ok: Boolean(form.imageUrl?.trim()),                                         required: true  },
    { id: 'price',     label: t('products.detail.checklist.price'),     ok: Boolean(form.retailPrice?.trim()) && Number(form.retailPrice) > 0,      required: true  },
    { id: 'shortDesc', label: t('products.detail.checklist.shortDesc'), ok: Boolean(form.shortDescription?.trim()),                                 required: true  },
    { id: 'desc',      label: t('products.detail.checklist.desc'),      ok: (Array.isArray(form.descriptionBlocks) ? form.descriptionBlocks.length > 0 : (form.description?.trim().length ?? 0) > 0),  required: true  },
    // Bắt buộc khi tạo mới, nhắc nhở khi sửa.
    { id: 'sku',           label: t('products.detail.checklist.sku', { defaultValue: 'Mã SKU' }),          ok: Boolean(form.sku?.trim()),                required: isCreate },
    { id: 'slug',          label: t('products.detail.checklist.slug', { defaultValue: 'Đường dẫn (slug)' }),ok: Boolean(form.slug?.trim()),               required: isCreate },
    { id: 'gender',        label: t('products.detail.checklist.gender', { defaultValue: 'Đối tượng' }),     ok: Boolean(form.gender?.trim()),             required: isCreate },
    { id: 'specStats',     label: t('products.detail.checklist.specStats'),     ok: (form.specStats || []).some((s) => s.value?.trim() && s.label?.trim()),                                    required: isCreate },
    { id: 'faqs',          label: t('products.detail.checklist.faqs'),          ok: (form.faqs || []).some((f) => f.question?.trim() && f.answer?.trim()),                                     required: isCreate },
    { id: 'trustBadges',   label: t('products.detail.checklist.trustBadges', { defaultValue: 'Dải tin cậy' }), ok: (form.trustBadges || []).some((b) => b.content?.trim()),                            required: isCreate },
    // Nhắc nhở (không chặn đăng): các phần điền vào thì trang sản phẩm đầy đủ & đẹp hơn.
    // Điều kiện `ok` mirror đúng bộ lọc trong toPayload để khớp cái thực sự được lưu.
    { id: 'seoTitle',      label: t('products.detail.checklist.seoTitle'),      ok: Boolean(form.seoTitle?.trim()),           required: false },
    { id: 'seoDesc',       label: t('products.detail.checklist.seoDesc'),       ok: Boolean(form.seoDescription?.trim()),     required: false },
    { id: 'seoCanonical',  label: t('products.detail.checklist.seoCanonical'),  ok: Boolean(form.seoCanonicalUrl?.trim()),    required: false },
    { id: 'gallery',       label: t('products.detail.checklist.gallery'),       ok: (form.gallery || []).some((img) => img.url?.trim()),                                                       required: false },
    { id: 'prosCons',      label: t('products.detail.checklist.prosCons'),      ok: (form.positiveNotes || []).some((h) => (h.content || '').trim()) || (form.negativeNotes || []).some((h) => (h.content || '').trim()), required: false },
    { id: 'suitability',   label: t('products.detail.checklist.suitability'),   ok: (Array.isArray(form.descriptionBlocks) ? form.descriptionBlocks : []).some((b) => b.type === 'suitability' && (b.cards || []).some((c) => c.audience?.trim() || c.advice?.trim() || c.linkLabel?.trim())),    required: false },
    { id: 'specifications',label: t('products.detail.checklist.specifications'),ok: (form.specifications || []).some((s) => s.name?.trim() && s.value?.trim()),                                required: false },
    { id: 'variants',      label: t('products.detail.checklist.variants'),      ok: (form.variants || []).some((v) => v.name?.trim()),                                                         required: false },
  ]

  return items
}

// ── Empty form builders ────────────────────────────────────────────────────────

function getVariantColorValue(variant) {
  return (variant.options || []).find((option) => isColorAttributeName(option.name))?.value?.trim() || ''
}

function getVariantColorKey(variant) {
  const value = getVariantColorValue(variant)
  return value ? normalizeVariantToken(value) : ''
}

function cloneGallery(gallery = []) {
  return gallery.map((img) => ({ ...img }))
}

function hasGalleryImages(gallery = []) {
  // V248: item "có nội dung" khi có ảnh HOẶC video (gallery hỗn hợp).
  return gallery.some((img) => String(img.url || '').trim() || String(img.videoUrl || '').trim())
}

function withColorScopedMedia(variants = []) {
  const galleryByColor = new Map()

  variants.forEach((variant) => {
    const colorKey = getVariantColorKey(variant)
    if (!colorKey) return
    if (hasGalleryImages(variant.gallery) && !galleryByColor.has(colorKey)) {
      galleryByColor.set(colorKey, cloneGallery(variant.gallery))
    }
  })

  // The variant cover image is derived backend-side from the first gallery image
  // (no separate cover field), so the editor only scopes the gallery by color.
  return variants.map((variant) => {
    const colorKey = getVariantColorKey(variant)
    const gallery = colorKey ? galleryByColor.get(colorKey) || [] : []
    return { ...variant, gallery: cloneGallery(gallery) }
  })
}

function buildEmptyForm() {
  return {
    sku: '',
    slug: '',
    name: '',
    shortDescription: '',
    description: '',
    descriptionBlocks: null,
    descriptionBlocksEn: null,
    brandId: '',
    categoryId: '',
    retailPrice: '',
    compareAtPrice: '',
    salePrice: '',
    costPrice: '',
    forceOutOfStock: false,
    publishStatus: 'DRAFT',
    imageUrl: '',
    imageAlt: '',
    seoTitle: '',
    seoTitleManuallyEdited: false,
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    gallery: [],
    videos: [],
    specifications: [],
    // "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235).
    specStats: [],
    faqs: [],
    // Khối cam kết dưới nút mua hàng (V232) — admin quản theo từng sản phẩm.
    commitments: [],
    // Bảng "Mua tại BigBike.vn" dưới khu mua hàng — admin thêm dòng riêng (vd Bảo hành, Giao hàng, Đổi trả).
    purchaseLines: [],
    // Dải tin cậy trên tên sản phẩm (V233) — admin quản theo từng sản phẩm.
    trustBadges: [],
    // Template SEO fields (V175).
    positiveNotes: [],
    negativeNotes: [],
    originBrandCountry: '',
    sizeChart: { col2: 'Vòng đầu (cm)', rows: [], note: '' },
    // "Phù hợp với ai" (V240) — danh sách thẻ {audience, advice, linkLabel, linkUrl + *En}.
    // Serialize thành 2 chuỗi JSON (vi + en) khi lưu; xem parse/serializeSuitabilityCards.
    suitabilityCards: [],
    gender: '',
    variants: [],
    relatedProductIds: [],
    relatedProductChips: [],
    accessoryProductIds: [],
    accessoryProductChips: [],
    // Optional English content (V136). Vietnamese above stays canonical.
    translations: { en: buildEmptyTranslation() },
    // "Hiển thị trên web" (V245) — sản phẩm MỚI mặc định tắt hết (opt-in): admin tự bật phần nào hiện phần đó.
    sectionVisibility: resolveSectionVisibilityForm(null, null),
  }
}

// English product-level content — eight optional translatable text fields.
function buildEmptyTranslation() {
  return {
    // Optional English URL slug (V214). Lives at top-level `slugEn` on the API but is
    // carried inside the form's translations.en block; payload maps it back to slugEn.
    slug: '',
    name: '',
    shortDescription: '',
    description: '',
    suitabilityAdvisory: '',
    seoTitle: '',
    seoDescription: '',
  }
}

function findOptionById(items, id) {
  if (!id) return null
  return items.find((item) => item?.id === id) || null
}

function prependSelectedOption(items, selected) {
  if (!selected?.id || findOptionById(items, selected.id)) {
    return items
  }
  return [selected, ...items]
}

function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()

  const variants = withColorScopedMedia((item.variants || []).map((v) => ({
    _key: v.id || generateId(),
    id: v.id || '',
    sku: v.sku || '',
    name: v.name || '',
    isAvailable: v.isAvailable !== false,
    options: (v.options || []).map((o) => ({
      name: o.name || '',
      value: o.value || '',
      attributeValueId: o.attributeValueId || null,
    })),
    gallery: (v.gallery || []).map((img) => ({ _key: generateId(), mediaType: img.mediaType || 'image', url: img.rawUrl || img.url || '', alt: img.alt || '', videoUrl: img.videoUrl || '', provider: img.provider || 'youtube' })),
  })))

  const form = {
    sku: item.sku || '',
    slug: item.slug || '',
    name: item.name || '',
    shortDescription: item.shortDescription || '',
    description: item.description || '',
    descriptionBlocks: item.descriptionBlocks ?? null,
    // Khối mô tả tiếng Anh (V229) — nằm trong translations.en để admin nạp song ngữ.
    descriptionBlocksEn: item.translations?.en?.descriptionBlocks ?? null,
    brandId: item.brandId || item.brand?.id || '',
    categoryId: item.categoryId || item.category?.id || item.categories?.[0]?.id || '',
    retailPrice:
      Number.isInteger(item.price?.retailPrice) && item.price.retailPrice >= 0
        ? String(item.price.retailPrice)
        : '',
    compareAtPrice:
      Number.isInteger(item.price?.compareAtPrice) && item.price.compareAtPrice > 0
        ? String(item.price.compareAtPrice)
        : '',
    salePrice:
      Number.isInteger(item.price?.salePrice) && item.price.salePrice > 0
        ? String(item.price.salePrice)
        : '',
    costPrice:
      Number.isInteger(item.price?.costPrice) && item.price.costPrice > 0
        ? String(item.price.costPrice)
        : '',
    forceOutOfStock: Boolean(item.forceOutOfStock),
    publishStatus: item.publishStatus,
    imageUrl: item.image?.rawUrl || item.image?.url || '',
    imageAlt: item.image?.alt || '',
    seoTitle: item.seo?.title || '',
    seoTitleManuallyEdited: Boolean(item.seo?.title),
    seoDescription: item.seo?.description || '',
    seoCanonicalUrl: item.seo?.canonicalUrl || '',
    seoOgImageUrl: item.seo?.ogImage?.rawUrl || item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    gallery: (item.gallery || []).map((img) => ({ _key: generateId(), mediaType: img.mediaType || 'image', url: img.rawUrl || img.url || '', alt: img.alt || '', videoUrl: img.videoUrl || '', provider: img.provider || 'youtube' })),
    videos: (item.videos || []).map((v) => ({
      url: v.url || '',
      title: v.title || '',
      description: v.description || '',
      type: inferVideoType(v.url || '', v.provider),
      thumbnailUrl: v.thumbnail?.url || '',
    })),
    specifications: (item.specifications || []).map((s) => ({
      _key: generateId(),
      name: s.name || '',
      value: s.value || '',
      // Response record exposes spec group as `group` (ProductSpecification); the form field
      // and the save DTO (SpecificationRequest) use `groupName`. Read both so the group loads.
      groupName: s.group || s.groupName || '',
      nameEn: s.nameEn || '',
      valueEn: s.valueEn || '',
    })),
    // "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235), tối đa 4, song ngữ.
    specStats: (item.specStats || []).map((s) => ({
      _key: generateId(),
      value: s.value || '',
      label: s.label || '',
      valueEn: s.valueEn || '',
      labelEn: s.labelEn || '',
    })),
    faqs: (item.faqs || []).map((f) => ({
      _key: generateId(),
      question: f.question || '',
      answer: f.answer || '',
      questionEn: f.questionEn || '',
      answerEn: f.answerEn || '',
    })),
    // Cam kết theo từng sản phẩm (V232) — icon (key) + tiêu đề + mô tả, song ngữ.
    commitments: (item.commitments || []).map((c) => ({
      _key: generateId(),
      icon: c.icon || 'shield-check',
      title: c.title || '',
      subtitle: c.subtitle || '',
      titleEn: c.titleEn || '',
      subtitleEn: c.subtitleEn || '',
    })),
    // Bảng "Mua tại BigBike.vn" — dòng {icon, label, value} song ngữ, full-replace.
    purchaseLines: (item.purchaseLines || []).map((p) => ({
      _key: generateId(),
      icon: p.icon || 'shield-check',
      label: p.label || '',
      value: p.value || '',
      labelEn: p.labelEn || '',
      valueEn: p.valueEn || '',
    })),
    // Dải tin cậy trên tên sản phẩm (V233) — badge {content, contentEn}.
    trustBadges: (item.trustBadges || []).map((b) => ({
      _key: generateId(),
      content: b.content || '',
      contentEn: b.contentEn || '',
    })),
    // Template SEO fields (V175). highlights là object {content, contentEn}.
    positiveNotes: (item.positiveNotes || []).map((h) => ({
      _key: generateId(),
      content: h.content || '',
      contentEn: h.contentEn || '',
    })),
    negativeNotes: (item.negativeNotes || []).map((h) => ({
      _key: generateId(),
      content: h.content || '',
      contentEn: h.contentEn || '',
    })),
    originBrandCountry: item.originBrandCountry || '',
    sizeChart: parseSizeGuide(item.sizeGuide),
    suitabilityCards: parseSuitabilityCards(item.suitabilityAdvisory, item.translations?.en?.suitabilityAdvisory),
    gender: item.gender || '',
    variants,
    relatedProductIds: (item.relatedProducts || []).map((p) => p.id).filter(Boolean),
    relatedProductChips: (item.relatedProducts || [])
      .filter((p) => p && p.id)
      .map((p) => ({
        id: p.id,
        name: p.name || p.id,
        slug: p.slug || '',
        imageUrl: p.image?.url || '',
      })),
    accessoryProductIds: (item.accessoryProducts || []).map((p) => p.id).filter(Boolean),
    accessoryProductChips: (item.accessoryProducts || [])
      .filter((p) => p && p.id)
      .map((p) => ({
        id: p.id,
        name: p.name || p.id,
        slug: p.slug || '',
        imageUrl: p.image?.url || '',
      })),
    // slug tiếng Anh nằm ở field top-level `slugEn` của response, không trong translations.en.
    translations: { en: { ...translationFormFromItem(item.translations?.en), slug: item.slugEn || '' } },
  }

  // "Hiển thị trên web" (V245): cấu hình đã lưu thắng; sản phẩm cũ chưa cấu hình → seed bật theo
  // nội dung hiện có (web giữ nguyên cho tới khi admin chỉnh & lưu).
  form.sectionVisibility = resolveSectionVisibilityForm(parseSectionVisibilityForm(item.sectionVisibility), form)
  return form
}

// Map a normalized `translations.en` block to the form shape — every field a
// controlled string ('' when not translated), never undefined.
function translationFormFromItem(en) {
  const source = en && typeof en === 'object' ? en : {}
  const empty = buildEmptyTranslation()
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, source[key] || '']),
  )
}

// Like toIntegerOrUndefined but sends null for empty so the backend can
// distinguish "user cleared this field" from "field not sent at all".
function toIntegerOrNull(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) return Number.NaN
  return parsed
}

// English product-level content → upsert payload. Blank fields become undefined
// so the backend stores null. English is optional (PRODUCT_RULE_001).
function translationToPayload(en) {
  const source = en && typeof en === 'object' ? en : {}
  const out = {}
  for (const key of Object.keys(buildEmptyTranslation())) {
    const trimmed = String(source[key] || '').trim()
    out[key] = trimmed || undefined
  }
  return out
}

// Lọc + dọn khối mô tả trước khi gửi: bỏ khối rỗng (sẽ fail @NotBlank ở backend) và
// strip _key (chỉ dùng tracking ở frontend). Dùng chung cho cả khối VI và EN.
function cleanDescriptionBlocks(blocks) {
  const cardHasContent = (c) =>
    (c?.audience ?? '').trim() || (c?.advice ?? '').trim() || ((c?.linkLabel ?? '').trim() && (c?.linkUrl ?? '').trim())
  return blocks
    .filter((b) => {
      switch (b.type) {
        case 'heading':   return (b.text ?? '').trim().length > 0
        case 'paragraph': return (b.html ?? '').trim().length > 0
        case 'list':      return (b.items ?? []).some((it) => (it ?? '').trim().length > 0)
        case 'image':     return (b.url ?? '').trim().length > 0
        case 'video':     return (b.url ?? '').trim().length > 0
        case 'callout':   return (b.html ?? '').trim().length > 0
        case 'feature':   return (b.url ?? '').trim().length > 0
        case 'suitability': return (b.cards ?? []).some(cardHasContent)
        case 'sizeGuide': return (b.html ?? '').trim().length > 0
        default:          return true
      }
    })
    .map(({ _key, ...rest }) => {
      // Khối feature: bỏ các dòng danh sách rỗng để không gửi item trắng xuống backend.
      if (rest.type === 'feature' && Array.isArray(rest.items)) {
        return { ...rest, items: rest.items.filter((it) => (it ?? '').trim().length > 0) }
      }
      // Phù hợp với ai (V246): bỏ thẻ rỗng.
      if (rest.type === 'suitability') {
        return { ...rest, cards: (rest.cards ?? []).filter(cardHasContent) }
      }
      return rest
    })
}

// "Phù hợp với ai" (V240) — field suitabilityAdvisory lưu JSON array các thẻ. Parse 2 cột
// (vi + en) thành mảng thẻ song ngữ inline cho editor; `linkUrl` dùng chung (lấy từ vi, fallback en).
// Giá trị legacy không-phải-JSON (HTML cũ trước V240) → coi như rỗng, admin nhập lại.
function safeJsonArray(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseSuitabilityCards(viRaw, enRaw) {
  const vi = safeJsonArray(viRaw)
  const en = safeJsonArray(enRaw)
  const len = Math.max(vi.length, en.length)
  const str = (v) => (typeof v === 'string' ? v : '')
  const cards = []
  for (let i = 0; i < len; i += 1) {
    const v = vi[i] || {}
    const e = en[i] || {}
    cards.push({
      _key: generateId(),
      audience: str(v.audience),
      advice: str(v.advice),
      linkLabel: str(v.linkLabel),
      linkUrl: str(v.linkUrl) || str(e.linkUrl),
      audienceEn: str(e.audience),
      adviceEn: str(e.advice),
      linkLabelEn: str(e.linkLabel),
    })
  }
  return cards
}

// (V246) serializeSuitabilityCards đã gỡ — "Phù hợp với ai" giờ nhập qua KHỐI suitability trong mô tả.

// "Hiển thị trên web" (V245) — danh sách section PDP admin bật/tắt. Key PHẢI khớp web
// (lib/utils/section-visibility + ProductView). contentBottom không nằm đây (admin không soạn ở form).
// CHỈ gồm các section nằm TRONG khối Tab của PDP (Mô tả · Thông số · FAQ · Video · Đánh giá). Các khối
// NGOÀI tab (ô số liệu nổi bật, dải tin cậy, khối cam kết, "Mua tại BigBike.vn",
// sản phẩm tương tự, phụ kiện bán kèm) KHÔNG quản ở đây — web tự hiện chúng khi có nội dung.
// Ưu/Nhược điểm · Phù hợp với ai · Bảng size (V246) là KHỐI trong mô tả → theo visibility của 'description'.
const SECTION_VISIBILITY_KEYS = [
  'description', 'specifications', 'faqs', 'videos', 'reviews',
]

// Có nội dung trong form chưa — để seed "bật sẵn" cho sản phẩm cũ chưa cấu hình (giữ web như cũ).
// reviews là nội dung động → seed bật cho hàng cũ.
function sectionHasContent(form, key) {
  const arr = (v) => (Array.isArray(v) ? v : [])
  const t = (v) => String(v ?? '').trim()
  switch (key) {
    case 'description':    return Array.isArray(form.descriptionBlocks) ? form.descriptionBlocks.length > 0 : Boolean(t(form.description))
    case 'specifications': return arr(form.specifications).some((s) => t(s.name) && t(s.value))
    case 'faqs':           return arr(form.faqs).some((f) => t(f.question) && t(f.answer))
    case 'videos':         return arr(form.videos).some((v) => t(v.url))
    case 'reviews':        return true
    default:               return false
  }
}

// Parse chuỗi JSON visibility từ backend → map bool (chỉ giữ key hợp lệ). null nếu rỗng/hỏng.
// Map cũ có thể chứa key ngoài-tab + `_order` (trước V246 mở rộng) — bỏ qua an toàn, chỉ giữ 5 key tab.
function parseSectionVisibilityForm(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const map = {}
    for (const k of SECTION_VISIBILITY_KEYS) if (typeof parsed[k] === 'boolean') map[k] = parsed[k]
    return map
  } catch { return null }
}

// Dựng map visibility cho form. saved (đã cấu hình) thắng; key thiếu → seed theo nội dung khi
// seedFromForm có (sản phẩm cũ), ngược lại false (sản phẩm MỚI = opt-in, admin tự bật).
function resolveSectionVisibilityForm(saved, seedFromForm) {
  const map = {}
  for (const k of SECTION_VISIBILITY_KEYS) {
    if (saved && typeof saved[k] === 'boolean') map[k] = saved[k]
    else map[k] = seedFromForm ? sectionHasContent(seedFromForm, k) : false
  }
  return map
}

function toPayload(form) {
  const hasSeo =
    form.seoTitle.trim() ||
    form.seoDescription.trim() ||
    form.seoCanonicalUrl.trim() ||
    form.seoOgImageUrl.trim() ||
    form.seoOgImageAlt.trim()

  // Ưu/Nhược điểm · Phù hợp với ai · Bảng size (V246): không còn gửi từ ô nhập riêng — admin nhập qua
  // KHỐI trong mô tả (descriptionBlocks). Backend present-flag bỏ qua khi vắng → cột cũ không bị đụng.

  const payload = {
    sku: form.sku.trim() || null,
    slug: form.slug.trim(),
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim() || undefined,
    description: Array.isArray(form.descriptionBlocks) ? undefined : (form.description.trim() || undefined),
    // Template SEO scalars (V175). Null khi cleared (presence-flag).
    originBrandCountry: form.originBrandCountry.trim() ? form.originBrandCountry.trim() : null,
    // "Hiển thị trên web" (V245) — luôn gửi map đầy đủ (presence-flag): "đóng băng" trạng thái hiện tại
    // thành cờ explicit nên web không đổi với sản phẩm cũ, và áp opt-in cho sản phẩm mới.
    sectionVisibility: JSON.stringify(form.sectionVisibility || resolveSectionVisibilityForm(null, form)),
    gender: form.gender.trim() ? form.gender.trim() : null,
    brandId: form.brandId.trim() || undefined,
    categoryId: form.categoryId.trim(),
    // Send null when cleared so backend (presence-flag logic) can distinguish
    // "user erased this" from "field not part of this request".
    retailPrice: toIntegerOrNull(form.retailPrice),
    compareAtPrice: toIntegerOrNull(form.compareAtPrice),
    salePrice: toIntegerOrNull(form.salePrice),
    costPrice: toIntegerOrNull(form.costPrice),
    currency: 'VND',
    forceOutOfStock: Boolean(form.forceOutOfStock),
    publishStatus: form.publishStatus,
    seo: hasSeo
      ? {
          title: form.seoTitle.trim() || null,
          description: form.seoDescription.trim() || null,
          canonicalUrl: form.seoCanonicalUrl.trim() || null,
          ogImage: form.seoOgImageUrl.trim()
            ? { url: form.seoOgImageUrl.trim(), alt: form.seoOgImageAlt.trim() || undefined }
            : null,
        }
      : null,
    // Always include image — null signals "clear the primary image".
    image: form.imageUrl.trim()
      ? { url: form.imageUrl.trim(), alt: form.imageAlt.trim() || undefined }
      : null,
    // Optional English content (V136). Always sent so the backend full-replaces
    // the English columns; empty fields clear them. English is never required.
    translations: { en: { ...translationToPayload(form.translations?.en) } },
  }

  payload.gallery = form.gallery
    // V248: giữ item có ảnh HOẶC video (gallery hỗn hợp).
    .filter((img) => (img.url || '').trim() || (img.mediaType === 'video' && (img.videoUrl || '').trim()))
    .map((img, i) => (
      img.mediaType === 'video'
        ? {
            mediaType: 'video',
            videoUrl: (img.videoUrl || '').trim(),
            videoProvider: img.provider || 'youtube',
            url: (img.url || '').trim() || undefined,
            alt: img.alt?.trim() || undefined,
            sortOrder: i,
          }
        : { mediaType: 'image', url: img.url.trim(), alt: img.alt?.trim() || undefined, sortOrder: i }
    ))

  payload.videos = form.videos
    .filter((v) => v.url.trim())
    .map((v, i) => ({
      url: v.url.trim(),
      title: v.title.trim() || undefined,
      description: (v.description || '').trim() || undefined,
      provider: v.type === 'upload' ? 'upload' : 'youtube',
      thumbnailUrl: v.type === 'upload' ? (v.thumbnailUrl?.trim() || undefined) : undefined,
      sortOrder: i,
    }))

  payload.specifications = form.specifications
    .filter((s) => s.name.trim() && s.value.trim())
    .map((s, i) => ({
      name: s.name.trim(),
      value: s.value.trim(),
      nameEn: (s.nameEn || '').trim() || undefined,
      valueEn: (s.valueEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235), tối đa 4.
  payload.specStats = form.specStats
    .filter((s) => s.value.trim() && s.label.trim())
    .slice(0, 4)
    .map((s, i) => ({
      value: s.value.trim(),
      label: s.label.trim(),
      valueEn: (s.valueEn || '').trim() || undefined,
      labelEn: (s.labelEn || '').trim() || undefined,
      sortOrder: i,
    }))

  payload.faqs = form.faqs
    .filter((f) => f.question.trim() && f.answer.trim())
    .map((f, i) => ({
      question: f.question.trim(),
      answer: f.answer.trim(),
      questionEn: (f.questionEn || '').trim() || undefined,
      answerEn: (f.answerEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // Cam kết theo từng sản phẩm (V232) — full-replace; dòng không có tiêu đề bị bỏ.
  payload.commitments = form.commitments
    .filter((c) => (c.title || '').trim())
    .map((c, i) => ({
      icon: (c.icon || '').trim() || 'shield-check',
      title: c.title.trim(),
      subtitle: (c.subtitle || '').trim() || undefined,
      titleEn: (c.titleEn || '').trim() || undefined,
      subtitleEn: (c.subtitleEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // Bảng "Mua tại BigBike.vn" — full-replace, tối đa 12 dòng; dòng không có nhãn bị bỏ.
  payload.purchaseLines = form.purchaseLines
    .filter((p) => (p.label || '').trim())
    .slice(0, 12)
    .map((p, i) => ({
      icon: (p.icon || '').trim() || 'shield-check',
      label: p.label.trim(),
      value: (p.value || '').trim() || undefined,
      labelEn: (p.labelEn || '').trim() || undefined,
      valueEn: (p.valueEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // Dải tin cậy trên tên sản phẩm (V233) — full-replace; badge content blank bị bỏ.
  payload.trustBadges = form.trustBadges
    .filter((b) => (b.content || '').trim())
    .map((b, i) => ({
      content: b.content.trim(),
      contentEn: (b.contentEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // Ưu/Nhược điểm (V251): khối RIÊNG cố định dưới mô tả — nhập ở card riêng, lưu vào bảng con
  // product_highlights. Full-replace mỗi nhóm; mục content blank bị bỏ (backend @NotBlank).
  payload.positiveNotes = form.positiveNotes
    .filter((h) => (h.content || '').trim())
    .map((h, i) => ({
      content: h.content.trim(),
      contentEn: (h.contentEn || '').trim() || undefined,
      sortOrder: i,
    }))
  payload.negativeNotes = form.negativeNotes
    .filter((h) => (h.content || '').trim())
    .map((h, i) => ({
      content: h.content.trim(),
      contentEn: (h.contentEn || '').trim() || undefined,
      sortOrder: i,
    }))

  // Always send relatedProductIds — empty array explicitly clears the section.
  payload.relatedProductIds = Array.isArray(form.relatedProductIds) ? form.relatedProductIds : []

  // Always send accessoryProductIds — empty array explicitly clears the section.
  payload.accessoryProductIds = Array.isArray(form.accessoryProductIds) ? form.accessoryProductIds : []

  // descriptionBlocks — send when user is in block-editing mode (non-null).
  // Strip _key (frontend tracking) before sending. Filter out blocks that would
  // fail backend @NotBlank validation (e.g. heading with empty text). Omit key
  // entirely when null so the backend presence-flag leaves both columns untouched.
  if (Array.isArray(form.descriptionBlocks)) {
    payload.descriptionBlocks = cleanDescriptionBlocks(form.descriptionBlocks)
  }
  // Khối mô tả tiếng Anh (V229) — gửi top-level descriptionBlocksEn theo cùng presence-flag.
  // Backend render khối EN -> description_en (ghi đè HTML từ translations sau đó).
  if (Array.isArray(form.descriptionBlocksEn)) {
    payload.descriptionBlocksEn = cleanDescriptionBlocks(form.descriptionBlocksEn)
  }
  const scopedVariants = withColorScopedMedia(form.variants).filter((v) => v.name.trim())
  const emittedGalleryColors = new Set()

  payload.variants = scopedVariants.map((v, i) => {
    const colorKey = getVariantColorKey(v)
    const gallery = (v.gallery ?? [])
      // V248: gallery biến thể cũng chứa cả ảnh lẫn video.
      .filter((img) => (img.url || '').trim() || (img.mediaType === 'video' && (img.videoUrl || '').trim()))
      .map((img, j) => (
        img.mediaType === 'video'
          ? {
              mediaType: 'video',
              videoUrl: (img.videoUrl || '').trim(),
              videoProvider: img.provider || 'youtube',
              url: (img.url || '').trim() || undefined,
              alt: img.alt?.trim() || undefined,
              sortOrder: j,
            }
          : { mediaType: 'image', url: img.url.trim(), alt: img.alt?.trim() || undefined, sortOrder: j }
      ))

    const shouldSendGallery = Boolean(colorKey && gallery.length > 0 && !emittedGalleryColors.has(colorKey))
    if (shouldSendGallery) emittedGalleryColors.add(colorKey)

    return {
      id: v.id || undefined,
      sku: v.sku.trim() || undefined,
      name: v.name.trim(),
      // Variant price fields intentionally omitted — see ProductDetailScreen
      // variant form section. Cart/checkout always use product price.
      // Cover image is derived backend-side from the first gallery image; no
      // separate variant image field is sent.
      isAvailable: Boolean(v.isAvailable),
      sortOrder: i,
      options: v.options
        .filter((o) => o.name.trim() && o.value.trim())
        .map((o) => ({
          optionName: o.name.trim(),
          optionValue: o.value.trim(),
          ...(o.attributeValueId ? { attributeValueId: o.attributeValueId } : {}),
        })),
      gallery: shouldSendGallery ? gallery : [],
    }
  })

  return payload
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconChevronUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function GalleryCard({ item, onUpdate, onRemove, disabled, urlError, sortable }) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const isVideo = item.mediaType === 'video'
  const trimmed = (item.url || '').trim()
  const displayUrl = resolveDisplayUrl(trimmed)
  const dragLabel = t('products.detail.gallery.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })

  // ── KHỐI VIDEO trong gallery (V248): YouTube/Upload + thumbnail tuỳ chọn ──
  if (isVideo) {
    const provider = item.provider || 'youtube'
    const ytId = provider === 'youtube' ? extractYouTubeId(item.videoUrl || '') : null
    const posterUrl = trimmed
      ? displayUrl
      : (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '')
    return (
      <div
        ref={sortable?.setNodeRef}
        style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
        className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}
      >
        <div className="gallery-card-thumb relative bg-black">
          {posterUrl
            ? <img src={posterUrl} alt="" loading="eager" />
            : <span className="gallery-thumb-status">🎬</span>}
          <span className="absolute inset-0 flex items-center justify-center text-white text-2xl pointer-events-none">▶</span>
          {!disabled && sortable && (
            <button
              type="button"
              {...sortable.handleProps}
              className="absolute top-1 left-1 z-10 inline-flex items-center justify-center w-6 h-6 bg-black/55 text-white cursor-grab touch-none rounded-sm"
              onClick={(e) => e.stopPropagation()}
              title={dragLabel}
              aria-label={dragLabel}
            >
              <GripVertical size={14} />
            </button>
          )}
          {!disabled && (
            <button
              type="button"
              className="gallery-card-remove"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              aria-label={t('products.detail.gallery.removeImage')}
            >
              ✕
            </button>
          )}
        </div>
        <div className="gallery-card-body flex flex-col gap-2">
          <div className="flex gap-1 p-1 bg-muted w-fit">
            <Button type="button" variant={provider === 'youtube' ? 'default' : 'ghost'} size="sm"
              onClick={() => onUpdate('provider', 'youtube')} disabled={disabled}>YouTube</Button>
            <Button type="button" variant={provider === 'upload' ? 'default' : 'ghost'} size="sm"
              onClick={() => { onUpdate('provider', 'upload'); }} disabled={disabled}>
              {t('products.detail.gallery.videoUpload', { defaultValue: 'Tải lên' })}
            </Button>
          </div>
          {provider === 'youtube' ? (
            <input
              type="text"
              className="gallery-card-alt-input"
              placeholder={t('products.detail.gallery.videoUrlPlaceholder', { defaultValue: 'Dán link YouTube' })}
              value={item.videoUrl || ''}
              onChange={(e) => onUpdate('videoUrl', e.target.value)}
              disabled={disabled}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setVideoPickerOpen(true)} disabled={disabled} className="self-start">
              {item.videoUrl ? t('products.detail.gallery.videoChange', { defaultValue: 'Đổi video' }) : t('products.detail.gallery.videoPick', { defaultValue: 'Chọn video' })}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={disabled} className="self-start">
            {trimmed ? t('products.detail.gallery.thumbChange', { defaultValue: 'Đổi ảnh đại diện' }) : t('products.detail.gallery.thumbPick', { defaultValue: 'Ảnh đại diện (tuỳ chọn)' })}
          </Button>
          <input
            type="text"
            className="gallery-card-alt-input"
            placeholder={t('products.detail.gallery.altPlaceholder')}
            value={item.alt || ''}
            onChange={(e) => onUpdate('alt', e.target.value)}
            disabled={disabled}
            aria-label={t('products.detail.gallery.altAriaLabel')}
          />
          {urlError && <small className="field-error">{urlError}</small>}
        </div>
        {pickerOpen && (
          <MediaPickerModal
            onSelect={(url) => { onUpdate('url', url); setPickerOpen(false) }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {videoPickerOpen && (
          <VideoPickerModal
            onSelect={(url) => { onUpdate('videoUrl', url); onUpdate('provider', 'upload'); setVideoPickerOpen(false) }}
            onClose={() => setVideoPickerOpen(false)}
          />
        )}
      </div>
    )
  }

  const thumbState = trimmed ? 'ok' : 'empty'

  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : undefined }}
      className={`gallery-card${urlError ? ' gallery-card--error' : ''}`}
    >
      <div
        className="gallery-card-thumb"
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setPickerOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && setPickerOpen(true)}
        aria-label={t('products.detail.gallery.pickImage')}
      >
        {thumbState === 'ok' && <img src={displayUrl} alt="" loading="eager" />}
        {thumbState === 'loading' && <span className="gallery-thumb-status">⋯</span>}
        {thumbState === 'error' && <span className="gallery-thumb-status gallery-thumb-error">!</span>}
        {thumbState === 'empty' && <span className="gallery-thumb-status">🖼</span>}
        {!disabled && sortable && (
          <button
            type="button"
            {...sortable.handleProps}
            className="absolute top-1 left-1 z-10 inline-flex items-center justify-center w-6 h-6 bg-black/55 text-white cursor-grab touch-none rounded-sm"
            onClick={(e) => e.stopPropagation()}
            title={dragLabel}
            aria-label={dragLabel}
          >
            <GripVertical size={14} />
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            className="gallery-card-remove"
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            aria-label={t('products.detail.gallery.removeImage')}
          >
            ✕
          </button>
        )}
      </div>
      <div className="gallery-card-body">
        <Button
          variant="outline"
          size="sm"
          className="gallery-card-pick-btn"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
        >
          {trimmed ? t('products.detail.gallery.changeImage') : t('products.detail.gallery.pickImage')}
        </Button>
        <input
          type="text"
          className="gallery-card-alt-input"
          placeholder={t('products.detail.gallery.altPlaceholder')}
          value={item.alt || ''}
          onChange={(e) => onUpdate('alt', e.target.value)}
          disabled={disabled}
          aria-label={t('products.detail.gallery.altAriaLabel')}
        />
        {urlError && <small className="field-error">{urlError}</small>}
        {trimmed && <MediaDimensionWarning url={item.url} recommend={IMAGE_RECO.productImage} kind="image" />}
      </div>
      {pickerOpen && (
        <MediaPickerModal
          onSelect={(url) => { onUpdate('url', url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

function GalleryEditor({ items, onChange, disabled, validationErrors = {} }) {
  const { t } = useTranslation()
  const [multiPickerOpen, setMultiPickerOpen] = useState(false)

  function updateItem(index, field, value) {
    onChange(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), url: '', alt: '' }])
  }
  function addVideoItem() {
    onChange([...items, { _key: generateId(), mediaType: 'video', provider: 'youtube', videoUrl: '', url: '', alt: '' }])
  }

  return (
    <div className="gallery-editor">
      <p className="text-xs text-muted-foreground mb-2">{t('products.detail.gallery.sizeHint')}</p>
      <SortableList
        items={items}
        getId={(it) => it._key}
        onReorder={(next) => onChange(next)}
        disabled={disabled}
        layout="grid"
        className="gallery-grid"
        renderItem={(item, sortable, index) => (
          <GalleryCard
            sortable={sortable}
            item={item}
            onUpdate={(field, value) => updateItem(index, field, value)}
            onRemove={() => removeItem(index)}
            disabled={disabled}
            urlError={validationErrors[`gallery.${index}.url`]}
          />
        )}
        footer={!disabled && (
          <button type="button" className="gallery-card-add" onClick={addItem}>
            <span className="gallery-add-icon">+</span>
            <span>{t('products.detail.gallery.addImage')}</span>
          </button>
        )}
      />
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gallery-multi-pick-btn"
            onClick={() => setMultiPickerOpen(true)}
            title={t('products.detail.gallery.multiSelectTitle')}
          >
            + {t('products.detail.gallery.multiSelect')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addVideoItem}
            title={t('products.detail.gallery.addVideoTitle', { defaultValue: 'Thêm video vào dải ảnh sản phẩm' })}
          >
            + {t('products.detail.gallery.addVideo', { defaultValue: 'Thêm video' })}
          </Button>
        </div>
      )}
      {multiPickerOpen && (
        <MediaPickerModal
          multiSelect
          onSelectMultiple={(urls) => {
            onChange([
              ...items,
              ...urls.map((url) => ({ _key: generateId(), url, alt: '' })),
            ])
            setMultiPickerOpen(false)
          }}
          onClose={() => setMultiPickerOpen(false)}
        />
      )}
    </div>
  )
}

function VideoEditor({ items, onChange, disabled, validationErrors = {} }) {
  const { t } = useTranslation()
  const [pickerOpenIndex, setPickerOpenIndex] = useState(null)

  function updateItem(index, patch) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function addItem() {
    onChange([...items, { url: '', title: '', description: '', type: 'youtube', thumbnailUrl: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="list-editor">
      {items.map((item, index) => {
        const type = item.type || 'youtube'
        const urlError = validationErrors[`videos.${index}.url`]
        const ytId = type === 'youtube' ? extractYouTubeId(item.url) : null
        return (
          <div key={item.url || `video-${index}`} className="list-editor-row">
            <div className="list-editor-fields">
              <div className="flex gap-1 p-1 bg-muted w-fit">
                <Button
                  type="button"
                  variant={type === 'youtube' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateItem(index, { type: 'youtube', url: '', thumbnailUrl: '' })}
                  disabled={disabled}
                >
                  YouTube
                </Button>
                <Button
                  type="button"
                  variant={type === 'upload' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateItem(index, { type: 'upload', url: '' })}
                  disabled={disabled}
                >
                  {t('products.detail.video.fromLibrary')}
                </Button>
              </div>

              {type === 'youtube' ? (
                <div>
                  <Input className={urlError  ? 'border-danger' : undefined}
                    placeholder={t('products.detail.video.youtubePlaceholder')}
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    disabled={disabled}
                   />
                  {urlError && <small className="field-error">{urlError}</small>}
                  {ytId && (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt={t('products.detail.video.youtubePreviewAlt')}
                      className="mt-2 w-full max-w-60 h-auto rounded border border-border"
                    />
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className={urlError ? 'input-error' : undefined}
                      onClick={() => setPickerOpenIndex(index)}
                      disabled={disabled}
                    >
                      {item.url ? t('products.detail.video.changeVideo') : t('products.detail.video.pickFromLibrary')}
                    </Button>
                    {item.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => updateItem(index, { url: '' })}
                        disabled={disabled}
                        aria-label={t('products.detail.video.removeSelectedVideo')}
                      >
                        ✕
                      </Button>
                    )}
                    {item.url && (
                      <span className="truncate max-w-xs text-xs text-muted-foreground">
                        ✓ {item.url.split('/').pop()}
                      </span>
                    )}
                  </div>
                  {urlError && <small className="field-error">{urlError}</small>}
                  {item.url && (
                    <video
                      src={`${item.url}#t=0.001`}
                      controls
                      preload="metadata"
                      className="mt-2 w-full max-w-xs h-auto rounded border border-border"
                    />
                  )}
                </div>
              )}
              <Input
                placeholder={t('products.detail.video.titlePlaceholder')}
                value={item.title || ''}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                disabled={disabled}
              />
              <Input
                placeholder={t('products.detail.video.descriptionPlaceholder')}
                value={item.description || ''}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                disabled={disabled}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.video.removeVideo')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.video.addVideo')}
      </Button>
      {pickerOpenIndex !== null && (
        <VideoPickerModal
          onSelect={(url) => {
            updateItem(pickerOpenIndex, { url, type: 'upload' })
            setPickerOpenIndex(null)
          }}
          onClose={() => setPickerOpenIndex(null)}
        />
      )}
    </div>
  )
}

function SpecificationsEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fName = isEn ? 'nameEn' : 'name'
  const fValue = isEn ? 'valueEn' : 'value'
  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, { _key: generateId(), name: '', value: '', groupName: '', nameEn: '', valueEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.specs.empty')}</p>
      )}
      {items.map((item, index) => {
        const errName = validationErrors?.[`specifications.${index}.name`]
        const errValue = validationErrors?.[`specifications.${index}.value`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
              <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <Input className={errName ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.namePlaceholder')}
                  aria-label={t('products.detail.specs.nameLabel')}
                  value={item[fName] || ''}
                  onChange={(e) => updateItem(index, fName, e.target.value)}
                  disabled={disabled}
                  maxLength={255}
                 />
                {errName && <small className="field-error">{errName}</small>}
              </div>
              <div>
                <Textarea className={errValue ? 'border-danger' : undefined}
                  placeholder={t('products.detail.specs.valuePlaceholder')}
                  aria-label={t('products.detail.specs.valueLabel')}
                  value={item[fValue] || ''}
                  onChange={(e) => updateItem(index, fValue, e.target.value)}
                  disabled={disabled}
                  rows={3}
                  maxLength={2000}
                 />
                {errValue && <small className="field-error">{errValue}</small>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.specs.removeSpec')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.specs.addSpec')}
      </Button>
    </div>
  )
}

/**
 * "Hiển thị trên web" (V245) — bảng công tắc bật/tắt các section nằm TRONG khối Tab của PDP
 * (Mô tả · Thông số · FAQ · Video · Đánh giá). Sản phẩm mới mặc định tắt hết. Các khối ngoài tab
 * không quản ở đây (web tự hiện khi có nội dung).
 */
function SectionVisibilityEditor({ value, onChange, form, disabled }) {
  const { t } = useTranslation()
  const map = value || {}

  function toggle(key, on) {
    onChange({ ...map, [key]: on })
  }
  function setAll(on) {
    onChange(Object.fromEntries(SECTION_VISIBILITY_KEYS.map((k) => [k, on])))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAll(true)} disabled={disabled}>
          {t('products.detail.sectionVisibility.showAll', { defaultValue: 'Bật tất cả' })}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAll(false)} disabled={disabled}>
          {t('products.detail.sectionVisibility.hideAll', { defaultValue: 'Tắt tất cả' })}
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {SECTION_VISIBILITY_KEYS.map((key) => {
          const on = map[key] === true
          const empty = !sectionHasContent(form, key)
          return (
            <div
              key={key}
              className="flex select-none items-center gap-3 rounded-sm border border-border px-3 py-2 text-sm"
            >
              <Checkbox
                checked={on}
                onCheckedChange={(v) => toggle(key, v === true)}
                disabled={disabled}
                id={`sv-${key}`}
              />
              <label htmlFor={`sv-${key}`} className="flex-1 cursor-pointer">
                {t(`products.detail.sectionVisibility.items.${key}`)}
              </label>
              {on && empty && (
                <span className="text-xs text-muted-foreground">
                  {t('products.detail.sectionVisibility.noContent', { defaultValue: 'chưa có nội dung' })}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Ưu/Nhược điểm (V175) — danh sách câu ngắn, song ngữ inline. Dùng chung cho cả
 *  hai nhóm; nhãn/placeholder truyền qua props. */
function HighlightsEditor({ items, onChange, disabled, contentLang = 'vi', placeholder, addLabel }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fContent = isEn ? 'contentEn' : 'content'
  function updateItem(index, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [fContent]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), content: '', contentEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
          <div className="flex-1">
            <Input
              placeholder={placeholder}
              value={item[fContent] || ''}
              onChange={(e) => updateItem(index, e.target.value)}
              disabled={disabled}
              maxLength={2000}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.highlights.remove', { defaultValue: 'Xóa mục' })}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {addLabel}
      </Button>
    </div>
  )
}

function FaqEditor({ items, onChange, disabled, validationErrors, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fQuestion = isEn ? 'questionEn' : 'question'
  const fAnswer = isEn ? 'answerEn' : 'answer'
  function updateItem(index, field, value) {
    const next = items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    onChange(next)
  }
  function addItem() {
    onChange([...items, { _key: generateId(), question: '', answer: '', questionEn: '', answerEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.faqs.empty')}</p>
      )}
      {items.map((item, index) => {
        const errQuestion = validationErrors?.[`faqs.${index}.question`]
        const errAnswer = validationErrors?.[`faqs.${index}.answer`]
        return (
          <div key={item._key} className="list-editor-row list-editor-row--stack">
            <div className="list-editor-reorder">
              <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
              <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div>
                <Input className={errQuestion ? 'border-danger' : undefined}
                  placeholder={t('products.detail.faqs.questionPlaceholder')}
                  value={item[fQuestion] || ''}
                  onChange={(e) => updateItem(index, fQuestion, e.target.value)}
                  disabled={disabled}
                  maxLength={500}
                />
                {errQuestion && <small className="field-error">{errQuestion}</small>}
              </div>
              <div>
                <RichTextEditor
                  key={`faq-answer-${item._key}-${contentLang}`}
                  value={item[fAnswer] || ''}
                  onChange={(html) => updateItem(index, fAnswer, html)}
                  placeholder={t('products.detail.faqs.answerPlaceholder')}
                  disabled={disabled}
                  hasError={Boolean(errAnswer)}
                />
                {errAnswer && <small className="field-error">{errAnswer}</small>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeItem(index)}
              disabled={disabled}
              aria-label={t('products.detail.faqs.removeFaq')}
            >
              ✕
            </Button>
          </div>
        )
      })}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.faqs.addFaq')}
      </Button>
    </div>
  )
}

// Trình soạn khối "Phù hợp với ai" (V240): danh sách thẻ tư vấn, thêm/bớt/đảo thứ tự. Mỗi thẻ
// gồm Đối tượng (in đậm) + Lời khuyên + Link gợi ý tùy chọn. Đối tượng/lời khuyên/nhãn-link song
// ngữ theo contentLang; ĐƯỜNG DẪN link (linkUrl) dùng chung cả VI/EN (không dịch). Mirror FaqEditor.
// (V246) SuitabilityEditor đã gỡ — "Phù hợp với ai" giờ nhập qua KHỐI suitability trong trình dựng mô tả.

// Bộ icon dựng sẵn cho khối cam kết (V232) — key khớp COMMITMENT_ICON_MAP bên web.
// labelKey trỏ tới i18n products.detail.commitments.icons.*; mặc định 'shield-check'.
const COMMITMENT_ICON_OPTIONS = [
  { value: 'truck', Icon: Truck, labelKey: 'truck' },
  { value: 'refresh-cw', Icon: RefreshCw, labelKey: 'refreshCw' },
  { value: 'shield-check', Icon: ShieldCheck, labelKey: 'shieldCheck' },
  { value: 'badge-check', Icon: BadgeCheck, labelKey: 'badgeCheck' },
  { value: 'credit-card', Icon: CreditCard, labelKey: 'creditCard' },
  { value: 'headphones', Icon: Headphones, labelKey: 'headphones' },
  { value: 'package', Icon: Package, labelKey: 'package' },
  { value: 'gift', Icon: Gift, labelKey: 'gift' },
  { value: 'clock', Icon: Clock, labelKey: 'clock' },
  { value: 'map-pin', Icon: MapPin, labelKey: 'mapPin' },
  { value: 'wrench', Icon: Wrench, labelKey: 'wrench' },
  { value: 'award', Icon: Award, labelKey: 'award' },
]

// Trình soạn khối "cam kết" theo từng sản phẩm (V232): thêm/bớt/đảo dòng tùy ý, mỗi
// dòng tự chọn icon + tiêu đề + mô tả. Tiêu đề/mô tả song ngữ (theo contentLang);
// icon dùng chung (không dịch). Mirror FaqEditor.
function CommitmentEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fTitle = isEn ? 'titleEn' : 'title'
  const fSubtitle = isEn ? 'subtitleEn' : 'subtitle'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), icon: 'shield-check', title: '', subtitle: '', titleEn: '', subtitleEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.commitments.empty')}</p>
      )}
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row list-editor-row--stack">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {/* Icon dùng chung mọi ngôn ngữ — chỉ cho sửa ở chế độ nội dung tiếng Việt để tránh nhầm. */}
            <Select value={item.icon || 'shield-check'} onValueChange={(v) => updateItem(index, 'icon', v)} disabled={disabled || isEn}>
              <SelectTrigger className="w-full sm:w-56" aria-label={t('products.detail.commitments.iconLabel')}>
                <SelectValue placeholder={t('products.detail.commitments.iconLabel')} />
              </SelectTrigger>
              <SelectContent>
                {COMMITMENT_ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <opt.Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {t(`products.detail.commitments.icons.${opt.labelKey}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('products.detail.commitments.titlePlaceholder')}
              value={item[fTitle] || ''}
              onChange={(e) => updateItem(index, fTitle, e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
            <Input
              placeholder={t('products.detail.commitments.subtitlePlaceholder')}
              value={item[fSubtitle] || ''}
              onChange={(e) => updateItem(index, fSubtitle, e.target.value)}
              disabled={disabled}
              maxLength={300}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.commitments.removeRow')}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled}>
        + {t('products.detail.commitments.addRow')}
      </Button>
    </div>
  )
}

const PURCHASE_LINE_MAX = 12

// Trình soạn bảng "Mua tại BigBike.vn" dưới khu mua hàng: mỗi dòng = icon + nhãn (label)
// + giá trị (value), song ngữ (theo contentLang); icon dùng chung. Thêm/bớt/đảo dòng tùy ý,
// tối đa 12 dòng. Mirror CommitmentEditor — dùng lại COMMITMENT_ICON_OPTIONS.
function PurchaseLineEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fLabel = isEn ? 'labelEn' : 'label'
  const fValue = isEn ? 'valueEn' : 'value'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), icon: 'shield-check', label: '', value: '', labelEn: '', valueEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.purchaseLines.empty')}</p>
      )}
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row list-editor-row--stack">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {/* Icon dùng chung mọi ngôn ngữ — chỉ cho sửa ở chế độ nội dung tiếng Việt để tránh nhầm. */}
            <Select value={item.icon || 'shield-check'} onValueChange={(v) => updateItem(index, 'icon', v)} disabled={disabled || isEn}>
              <SelectTrigger className="w-full sm:w-56" aria-label={t('products.detail.commitments.iconLabel')}>
                <SelectValue placeholder={t('products.detail.commitments.iconLabel')} />
              </SelectTrigger>
              <SelectContent>
                {COMMITMENT_ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <opt.Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {t(`products.detail.commitments.icons.${opt.labelKey}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('products.detail.purchaseLines.labelPlaceholder')}
              value={item[fLabel] || ''}
              onChange={(e) => updateItem(index, fLabel, e.target.value)}
              disabled={disabled}
              maxLength={120}
            />
            <Input
              placeholder={t('products.detail.purchaseLines.valuePlaceholder')}
              value={item[fValue] || ''}
              onChange={(e) => updateItem(index, fValue, e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.purchaseLines.removeRow')}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled || items.length >= PURCHASE_LINE_MAX}>
        + {t('products.detail.purchaseLines.addRow')}
      </Button>
    </div>
  )
}

// "Specs Dashboard" — ô số liệu nổi bật dưới khu vực mua hàng (V235): mỗi ô gồm một số
// liệu lớn (value) + nhãn (label), song ngữ; tối đa 4 ô. Là "đòn chốt" bán hàng, KHÔNG
// phải lặp lại thông số kỹ thuật.
const SPEC_STAT_MAX = 4

function SpecStatEditor({ items, onChange, disabled, contentLang = 'vi' }) {
  const { t } = useTranslation()
  const isEn = contentLang === 'en'
  const fValue = isEn ? 'valueEn' : 'value'
  const fLabel = isEn ? 'labelEn' : 'label'
  function updateItem(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  function addItem() {
    onChange([...items, { _key: generateId(), value: '', label: '', valueEn: '', labelEn: '' }])
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function moveItem(index, dir) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="list-editor">
      {items.length === 0 && (
        <p className="list-editor-empty">{t('products.detail.specStats.empty')}</p>
      )}
      {items.map((item, index) => (
        <div key={item._key} className="list-editor-row list-editor-row--stack">
          <div className="list-editor-reorder">
            <Button variant="outline" size="icon" onClick={() => moveItem(index, -1)} disabled={disabled || index === 0} aria-label={t('products.detail.moveUp')}>▲</Button>
            <Button variant="outline" size="icon" onClick={() => moveItem(index, 1)} disabled={disabled || index === items.length - 1} aria-label={t('products.detail.moveDown')}>▼</Button>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Input
              placeholder={t('products.detail.specStats.valuePlaceholder')}
              value={item[fValue] || ''}
              onChange={(e) => updateItem(index, fValue, e.target.value)}
              disabled={disabled}
              maxLength={60}
            />
            <Input
              placeholder={t('products.detail.specStats.labelPlaceholder')}
              value={item[fLabel] || ''}
              onChange={(e) => updateItem(index, fLabel, e.target.value)}
              disabled={disabled}
              maxLength={80}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => removeItem(index)}
            disabled={disabled}
            aria-label={t('products.detail.specStats.removeRow')}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} disabled={disabled || items.length >= SPEC_STAT_MAX}>
        + {t('products.detail.specStats.addRow')}
      </Button>
    </div>
  )
}

// Resolve an attribute from the catalog by matching option name against code or name
function resolveAttr(attributes, optionName) {
  const norm = normalizeVariantToken(optionName)
  return attributes.find(
    (a) => normalizeVariantToken(a.name) === norm || normalizeVariantToken(a.code) === norm,
  ) ?? null
}

// Rename an attribute's display name. The code/key stays immutable (shown
// read-only) so existing variant options that resolve via the code keep working.
function AttributeRenameModal({ open, onClose, attribute }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // Mounted only while open (see caller), so initialising from the current name
  // is correct on every open — no effect-sync needed.
  const [name, setName] = useState(attribute?.name ?? '')
  const [nameEn, setNameEn] = useState(attribute?.nameEn ?? '')

  const renameMut = useMutation({
    mutationFn: (vars) => updateAttribute(attribute.id, vars),
    onSuccess: () => {
      toast.success(t('products.detail.variant.attrRenamed', { defaultValue: 'Đã đổi tên thuộc tính.' }))
      queryClient.invalidateQueries({ queryKey: ['attributes'] })
      onClose()
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.attrSaveError', { defaultValue: 'Không lưu được thuộc tính.' })),
  })

  const trimmed = name.trim()
  const dirty = trimmed && (trimmed !== attribute?.name || nameEn.trim() !== (attribute?.nameEn ?? ''))
  const saveRename = () => renameMut.mutate({ name: trimmed, nameEn: nameEn.trim() })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>{t('common.close', { defaultValue: 'Đóng' })}</Button>
          <Button onClick={saveRename} disabled={renameMut.isPending || !dirty}>
            {t('common.save', { defaultValue: 'Lưu' })}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.attrNameLabel', { defaultValue: 'Tên hiển thị' })}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={renameMut.isPending}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !renameMut.isPending) saveRename() }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.attrNameEnLabel', { defaultValue: 'Tên hiển thị (Tiếng Anh)' })}</span>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            disabled={renameMut.isPending}
            placeholder={t('products.detail.variant.attrEnPlaceholder', { defaultValue: 'Để trống sẽ dùng tên tiếng Việt' })}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !renameMut.isPending) saveRename() }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('products.detail.variant.attrCodeLabel', { defaultValue: 'Mã (không đổi):' })}</span>
          <span className="font-mono">{attribute?.code}</span>
        </div>
      </div>
    </Modal>
  )
}

// One editable row in the colour manager: rename an existing value's label.
// The slug (shown read-only) stays fixed so variant references keep working.
function AttributeValueEditRow({ value, onSave, saving }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(value.label)
  const [labelEn, setLabelEn] = useState(value.labelEn ?? '')
  const dirty = label.trim() && (label.trim() !== value.label || labelEn.trim() !== (value.labelEn ?? ''))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1"
          disabled={saving}
        />
        <span className="font-mono text-xs text-muted-foreground w-28 shrink-0 truncate" title={value.slug}>
          {value.slug}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSave({ label: label.trim(), labelEn: labelEn.trim() })}
          disabled={saving || !dirty}
        >
          {t('common.save', { defaultValue: 'Lưu' })}
        </Button>
      </div>
      <Input
        value={labelEn}
        onChange={(e) => setLabelEn(e.target.value)}
        disabled={saving}
        placeholder={t('products.detail.variant.valueEnPlaceholder', { defaultValue: 'Tên tiếng Anh (tùy chọn)' })}
      />
    </div>
  )
}

// Modal to add a new colour to the catalog and rename existing ones. Scoped to
// one attribute; on add it auto-selects the new value back into the variant row.
function AttributeValueManagerModal({ open, onClose, attribute, values, onPicked }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = useState('')
  const [newLabelEn, setNewLabelEn] = useState('')

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['attributeValues', attribute?.id] })

  const createMut = useMutation({
    mutationFn: (vars) => createAttributeValue(attribute.id, vars),
    onSuccess: (created) => {
      toast.success(t('products.detail.variant.colorAdded', { defaultValue: 'Đã thêm màu mới.' }))
      setNewLabel('')
      setNewLabelEn('')
      invalidate()
      if (created?.slug) onPicked?.(created)
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.colorSaveError', { defaultValue: 'Không lưu được màu.' })),
  })

  const renameMut = useMutation({
    mutationFn: ({ id, label, labelEn }) => updateAttributeValueLabel(id, { label, labelEn }),
    onSuccess: () => {
      toast.success(t('products.detail.variant.colorRenamed', { defaultValue: 'Đã đổi tên màu.' }))
      invalidate()
    },
    onError: (err) =>
      toast.error(err?.message || t('products.detail.variant.colorSaveError', { defaultValue: 'Không lưu được màu.' })),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={t('products.detail.variant.colorManagerTitle', { defaultValue: 'Quản lý màu' })}
      actions={<Button variant="outline" onClick={onClose}>{t('common.close', { defaultValue: 'Đóng' })}</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('products.detail.variant.colorAddLabel', { defaultValue: 'Thêm màu mới' })}</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('products.detail.variant.colorAddPlaceholder', { defaultValue: 'Ví dụ: Đỏ đô' })}
                onKeyDown={(e) => { if (e.key === 'Enter' && newLabel.trim() && !createMut.isPending) createMut.mutate({ label: newLabel.trim(), labelEn: newLabelEn.trim() }) }}
                className="flex-1"
              />
              <Button onClick={() => createMut.mutate({ label: newLabel.trim(), labelEn: newLabelEn.trim() })} disabled={createMut.isPending || !newLabel.trim()}>
                <Plus size={16} /> {t('products.detail.variant.colorAddButton', { defaultValue: 'Thêm' })}
              </Button>
            </div>
            <Input
              value={newLabelEn}
              onChange={(e) => setNewLabelEn(e.target.value)}
              placeholder={t('products.detail.variant.valueEnPlaceholder', { defaultValue: 'Tên tiếng Anh (tùy chọn)' })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-sm font-medium">{t('products.detail.variant.colorListLabel', { defaultValue: 'Đổi tên màu hiện có' })}</span>
          <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
            {values.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('products.detail.variant.colorEmpty', { defaultValue: 'Chưa có màu nào.' })}</p>
            ) : (
              values.map((v) => (
                <AttributeValueEditRow
                  key={v.id}
                  value={v}
                  saving={renameMut.isPending}
                  onSave={(vals) => renameMut.mutate({ id: v.id, ...vals })}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// One variant-attribute row. Extracted so color rows can fetch the attribute's
// catalog values via a hook (hooks can't run inside the parent's .map()).
function VariantOptionRow({ opt, attributes, onUpdate, onRemove, disabled }) {
  const { t } = useTranslation()
  const attr = resolveAttr(attributes, opt.name)
  const isColor = Boolean(attr?.kind === 'color' || isColorAttributeName(opt.name))
  const [managerOpen, setManagerOpen] = useState(false)
  const [renameAttrOpen, setRenameAttrOpen] = useState(false)

  // Catalog values for the selected color attribute (e.g. Đen / Đỏ / Xanh lá).
  const { data: attrValues = [] } = useQuery({
    queryKey: ['attributeValues', attr?.id],
    queryFn: () => fetchAttributeValues(attr.id),
    enabled: isColor && Boolean(attr?.id),
    staleTime: 5 * 60 * 1000,
  })

  // The read API returns the value as a display label ("Đen"), not the stored slug
  // ("den"). Resolve the current value back to a catalog slug so the Select selects the
  // right entry and a re-save round-trips the slug (kept in sync with web color filters).
  const matchedValue = attrValues.find(
    (v) =>
      v.slug === opt.value ||
      v.label === opt.value ||
      normalizeVariantToken(v.slug) === normalizeVariantToken(opt.value) ||
      normalizeVariantToken(v.label) === normalizeVariantToken(opt.value),
  )
  const selectValue = matchedValue ? matchedValue.slug : opt.value

  return (
    <div className="list-editor-row variant-option-row">
      {/* Name — Select from attribute catalog; falls back to text input when catalog not loaded */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 min-w-0">
        {attributes.length > 0 ? (
          <Select
            value={opt.name}
            onValueChange={(val) =>
              onUpdate({
                name: val,
                value: '',
                attributeValueId: null,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('products.detail.variant.optionNamePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {opt.name && !attributes.some((a) => a.name === opt.name) && (
                <SelectItem value={opt.name}>{opt.name}</SelectItem>
              )}
              {attributes.map((a) => (
                <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder={t('products.detail.variant.optionNamePlaceholder')}
            value={opt.name}
            onChange={(e) =>
              onUpdate({
                name: e.target.value,
                value: '',
                attributeValueId: null,
              })
            }
            disabled={disabled}
          />
        )}
        </div>
        {attr?.id && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setRenameAttrOpen(true)}
            disabled={disabled}
            aria-label={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
            title={t('products.detail.variant.attrRenameTitle', { defaultValue: 'Đổi tên thuộc tính' })}
          >
            <Pencil size={15} />
          </Button>
        )}
        {attr?.id && renameAttrOpen && (
          <AttributeRenameModal
            open
            onClose={() => setRenameAttrOpen(false)}
            attribute={attr}
          />
        )}
      </div>

      {/* Value — for color attributes a Select from the catalog colour list
          (sets value + attributeValueId); for other attributes a plain text value. */}
      <div className="flex flex-col gap-1 flex-1">
        {isColor ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Select
                  value={selectValue}
                  onValueChange={(val) => {
                    const picked = attrValues.find((v) => v.slug === val)
                    onUpdate({
                      value: val,
                      attributeValueId: picked?.id || null,
                    })
                  }}
                  disabled={disabled || !attr?.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('products.detail.variant.optionValuePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectValue && !attrValues.some((v) => v.slug === selectValue) && (
                      <SelectItem value={selectValue}>{opt.value}</SelectItem>
                    )}
                    {attrValues.map((v) => (
                      <SelectItem key={v.id} value={v.slug}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {attr?.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setManagerOpen(true)}
                  disabled={disabled}
                  aria-label={t('products.detail.variant.colorManagerTitle', { defaultValue: 'Quản lý màu' })}
                  title={t('products.detail.variant.colorManagerTitle', { defaultValue: 'Quản lý màu' })}
                >
                  <Pencil size={15} />
                </Button>
              )}
            </div>
            {attr?.id && (
              <AttributeValueManagerModal
                open={managerOpen}
                onClose={() => setManagerOpen(false)}
                attribute={attr}
                values={attrValues}
                onPicked={(created) => onUpdate({ value: created.slug, attributeValueId: created.id })}
              />
            )}
          </>
        ) : (
          <Input
            className="flex-1"
            placeholder={t('products.detail.variant.optionValuePlaceholder')}
            value={opt.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            disabled={disabled}
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t('products.detail.variant.removeOption')}
      >
        ✕
      </Button>
    </div>
  )
}

function VariantOptionsEditor({ options, onChange, disabled }) {
  const { t } = useTranslation()

  const { data: attributes = [] } = useQuery({
    queryKey: ['attributes'],
    queryFn: fetchAttributes,
    staleTime: 5 * 60 * 1000,
  })

  function updateOptionFields(i, updates) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...updates } : o)))
  }

  function addOption() {
    onChange([...options, { name: '', value: '', attributeValueId: null }])
  }

  function removeOption(i) {
    onChange(options.filter((_, idx) => idx !== i))
  }

  return (
    <div className="variant-options-editor">
      {options.map((opt, i) => (
        <VariantOptionRow
          key={i}
          opt={opt}
          attributes={attributes}
          onUpdate={(updates) => updateOptionFields(i, updates)}
          onRemove={() => removeOption(i)}
          disabled={disabled}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addOption} disabled={disabled}>
        + {t('products.detail.variant.addOption')}
      </Button>
    </div>
  )
}

function VariantCard({
  variant,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  disabled,
  fieldErrors = {},
}) {
  const { t } = useTranslation()
  function updateField(field, value) {
    onChange(variant._key, { [field]: value })
  }

  const label = variant.name.trim() || t('products.detail.variant.defaultLabel', { index: index + 1 })
  const optionSummary = variant.options.filter((o) => o.name && o.value).map((o) => `${o.name}: ${o.value}`).join(', ')
  const hasErrors = Object.keys(fieldErrors).length > 0
  const colorValue = getVariantColorValue(variant)
  const hasColor = Boolean(colorValue)

  return (
    <div className={`variant-card${hasErrors ? ' variant-card--error' : ''}`}>
      <div className="variant-card-header">
        {/* Vùng click/Enter/Space để toggle — không bao bọc các nút action */}
        <button
          type="button"
          className="variant-card-toggle-area"
          onClick={() => onToggle(variant._key)}
          aria-expanded={expanded}
        >
          <div className="variant-card-title">
            <span className="variant-card-index">#{index + 1}</span>
            <span>{label}</span>
            {optionSummary && <span className="variant-card-summary">{optionSummary}</span>}
            {hasErrors && <span className="variant-card-error-badge" title={t('products.detail.variant.hasError')}>!</span>}
          </div>
          <span className="variant-card-toggle" aria-hidden="true">{expanded ? <IconChevronUp /> : <IconChevronDown />}</span>
        </button>
        <div className="variant-card-actions">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDuplicate(variant._key)}
            disabled={disabled}
            aria-label={t('products.detail.variant.duplicate')}
            title={t('products.detail.variant.duplicate')}
          >
            ⎘
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(variant._key)}
            disabled={disabled}
            aria-label={t('products.detail.variant.remove')}
          >
            ✕
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="variant-card-body form-grid">
          <label className="form-field">
            <span>{t('products.detail.variant.name')}</span>
            <Input
              value={variant.name}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={disabled}
              placeholder={t('products.detail.variant.namePlaceholder')}
             />
            {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
          </label>

          <label className="form-field">
            <span>{t('products.detail.variant.sku')}</span>
            <Input
              value={variant.sku}
              onChange={(e) => updateField('sku', e.target.value)}
              disabled={disabled}
              aria-invalid={fieldErrors.sku ? true : undefined}
             />
            {fieldErrors.sku && <small className="field-error">{fieldErrors.sku}</small>}
          </label>

          {/* Variant price inputs removed: storefront, cart, and checkout use
              the parent product price regardless of variant, so collecting
              per-variant prices here would silently diverge from what the
              customer sees and pays. */}

          <label className="form-checkbox form-field-wide">
            <Checkbox
              checked={variant.isAvailable}
              onCheckedChange={(checked) => updateField('isAvailable', checked)}
              disabled={disabled}
             />
            <span>{t('products.detail.variant.isAvailable')}</span>
          </label>

          <div className="form-field form-field-wide">
            <span className="form-field-label">{t('products.detail.variant.optionsLabel')}</span>
            <VariantOptionsEditor
              options={variant.options}
              onChange={(opts) => updateField('options', opts)}
              disabled={disabled}
            />
          </div>

          <div className="form-field form-field-wide">
            <span className="form-field-label">
              {hasColor
                ? t('products.detail.variant.colorGalleryLabelWithValue', { color: colorValue })
                : t('products.detail.variant.colorGalleryLabel')}
            </span>
            <p className="detail-section-desc mt-0 mb-2">
              {hasColor
                ? t('products.detail.variant.colorGalleryHintWithColor')
                : t('products.detail.variant.colorGalleryHintNoColor')}
            </p>
            {fieldErrors.gallery && <small className="field-error">{fieldErrors.gallery}</small>}
            {hasColor && (
              <GalleryEditor
                items={variant.gallery ?? []}
                onChange={(next) => updateField('gallery', next)}
                disabled={disabled}
                validationErrors={fieldErrors}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Threshold above which a filter input is shown. With < 6 variants the
// filter would just take vertical space without helping users locate.
const VARIANTS_FILTER_THRESHOLD = 6

function VariantsEditor({ items, onChange, disabled, validationErrors = {}, onOpenMatrixWizard }) {
  const { t } = useTranslation()
  // Single-open accordion: only one card body is expanded at a time. With
  // 50–500 biến thể, having all open at once produces unmanageable scroll.
  const [expandedKey, setExpandedKey] = useState(() => items[0]?._key ?? null)
  const [filter, setFilter] = useState('')

  // ── Auto-expand the card whose validation key surfaces ───────────────
  // Adjusts state during render (not in an Effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // Without this, submit on a card that's collapsed would silently fail to
  // focus the offending input — the input doesn't exist in the DOM yet.
  const errKey = Object.keys(validationErrors).find((k) => k.startsWith('variants.'))
  const [seenErrKey, setSeenErrKey] = useState(errKey)
  if (errKey !== seenErrKey) {
    setSeenErrKey(errKey)
    if (errKey) {
      const m = errKey.match(/^variants\.(\d+)\./)
      if (m) {
        const offending = items[Number(m[1])]
        if (offending?._key) setExpandedKey(offending._key)
      }
    }
  }

  function toggleExpanded(key) {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  function updateVariant(key, partial) {
    const current = items.find((v) => v._key === key)
    if (!current) return

    const nextCurrent = { ...current, ...partial }

    if (Object.prototype.hasOwnProperty.call(partial, 'gallery')) {
      const colorKey = getVariantColorKey(nextCurrent)
      const gallery = colorKey ? cloneGallery(partial.gallery) : []
      onChange(items.map((v) => (
        v._key === key || (colorKey && getVariantColorKey(v) === colorKey)
          ? { ...v, ...(v._key === key ? partial : {}), gallery: cloneGallery(gallery) }
          : v
      )))
      return
    }

    if (Object.prototype.hasOwnProperty.call(partial, 'options')) {
      const previousColorKey = getVariantColorKey(current)
      const nextColorKey = getVariantColorKey(nextCurrent)
      if (previousColorKey !== nextColorKey) {
        const applyColorChange = () => {
          const existingColorGallery = nextColorKey
            ? items.find((v) => v._key !== key && getVariantColorKey(v) === nextColorKey && hasGalleryImages(v.gallery))?.gallery
            : []
          onChange(items.map((v) => (
            v._key === key
              ? { ...nextCurrent, gallery: cloneGallery(existingColorGallery || []) }
              : v
          )))
        }
        const hasData = hasGalleryImages(current.gallery)
        if (hasData) {
          showConfirm(
            t('products.detail.variant.changeColorConfirm'),
            t('products.detail.variant.changeColorTitle'),
          ).then((confirmed) => { if (confirmed) applyColorChange() })
          return
        }
        applyColorChange()
        return
      }
    }

    onChange(items.map((v) => v._key === key ? nextCurrent : v))
  }

  function buildEmptyVariant() {
    return {
      _key: generateId(),
      id: '',
      sku: '',
      name: '',
      isAvailable: true,
      options: [],
      gallery: [],
    }
  }

  function addVariant() {
    const created = buildEmptyVariant()
    onChange([...items, created])
    setExpandedKey(created._key)
  }

  function duplicateVariant(key) {
    const idx = items.findIndex((v) => v._key === key)
    if (idx === -1) return
    const original = items[idx]

    // Generate a non-colliding copy SKU: base-COPY, base-COPY-2, base-COPY-3…
    const existingSkus = new Set(items.map((v) => v.sku).filter(Boolean))
    function makeCopySku(sku) {
      if (!sku) return ''
      const base = sku.replace(/-COPY(?:-\d+)?$/, '')
      const candidate = `${base}-COPY`
      if (!existingSkus.has(candidate)) return candidate
      let n = 2
      while (existingSkus.has(`${candidate}-${n}`)) n++
      return `${candidate}-${n}`
    }

    const copy = {
      ...original,
      _key: generateId(),
      id: '',
      sku: makeCopySku(original.sku),
      name: original.name ? t('products.detail.variant.copySuffixTemplate', { name: original.name }) : '',
      options: original.options.map((o) => ({ ...o })),
      gallery: (original.gallery ?? []).map((img) => ({ ...img })),
    }
    const next = [...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]
    onChange(next)
    setExpandedKey(copy._key)
  }

  async function removeVariant(key) {
    const idx = items.findIndex((v) => v._key === key)
    if (idx === -1) return
    const variant = items[idx]
    const label = variant.name.trim() || t('products.detail.variant.defaultLabel', { index: idx + 1 })
    const confirmed = await showConfirm(
      t('products.detail.variant.removeConfirm', { label }),
      t('products.detail.variant.remove'),
    )
    if (!confirmed) return
    onChange(items.filter((v) => v._key !== key))
    if (expandedKey === key) setExpandedKey(null)
  }

  // ── Filter (rendered only above threshold) ────────────────────────────
  const filterTerm = filter.trim().toLowerCase()
  const visible = filterTerm
    ? items.flatMap((v, originalIdx) => {
        const haystack = [
          v.name,
          v.sku,
          ...v.options.flatMap((o) => [o.name, o.value]),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(filterTerm) ? [{ v, originalIdx }] : []
      })
    : items.map((v, i) => ({ v, originalIdx: i }))

  // Effective expanded key — if the filter hides the user's choice, render
  // as if the first visible card were expanded so the editor isn't "stuck"
  // showing nothing. Done by deriving rather than syncing via Effect.
  const effectiveExpandedKey =
    filterTerm && visible.length > 0 && !visible.some(({ v }) => v._key === expandedKey)
      ? visible[0].v._key
      : expandedKey

  const showFilter = items.length >= VARIANTS_FILTER_THRESHOLD

  return (
    <div className="variants-editor">
      <div className="variants-editor-toolbar">
        {showFilter && (
          <Input
            type="search" className="variants-filter-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('products.detail.variant.filterPlaceholder', { count: items.length })}
            disabled={disabled}
            aria-label={t('products.detail.variant.filterAria')}
           />
        )}
        {showFilter && filterTerm && (
          <span className="variants-filter-status">
            {t('products.detail.variant.filterMatch', { visible: visible.length, total: items.length })}
          </span>
        )}
        {!disabled && onOpenMatrixWizard && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMatrixWizard}
            title={t('products.detail.variant.generateMatrixTitle')}
          >
            ⊞ {t('products.detail.variant.generateMatrix')}
          </Button>
        )}
      </div>

      {visible.map(({ v, originalIdx }) => {
        const prefix = `variants.${originalIdx}.`
        const fieldErrors = Object.fromEntries(
          Object.entries(validationErrors)
            .filter(([k]) => k.startsWith(prefix))
            .map(([k, val]) => [k.slice(prefix.length), val])
        )
        return (
          <VariantCard
            key={v._key}
            variant={v}
            index={originalIdx}
            expanded={effectiveExpandedKey === v._key}
            onToggle={toggleExpanded}
            onChange={updateVariant}
            onRemove={removeVariant}
            onDuplicate={duplicateVariant}
            disabled={disabled}
            fieldErrors={fieldErrors}
          />
        )
      })}

      {filterTerm && visible.length === 0 && (
        <p className="variants-empty">{t('products.detail.variant.filterEmpty', { filter })}</p>
      )}

      <Button variant="outline" size="sm" onClick={addVariant} disabled={disabled}>
        + {t('products.detail.variant.addVariant')}
      </Button>
    </div>
  )
}

// ── Draft recovery banner ──────────────────────────────────────────────────────

function DraftRecoveryBanner({ ts, onRestore, onDiscard }) {
  const { t } = useTranslation()
  return (
    <div className="draft-recovery-banner">
      <span>{t('products.detail.draftRecovery.found', { time: formatDateTime(new Date(ts).toISOString()) })}</span>
      <div className="draft-recovery-actions">
        <Button size="sm" onClick={onRestore}>{t('products.detail.draftRecovery.restore')}</Button>
        <Button variant="outline" size="sm" onClick={onDiscard}>{t('products.detail.draftRecovery.discard')}</Button>
      </div>
    </div>
  )
}

// ── Publish quality checklist modal ───────────────────────────────────────────

function PublishChecklistModal({ form, isCreate, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const items = getPublishReadiness(form, t, isCreate)
  const requiredItems = items.filter((i) => i.required)
  const optionalItems = items.filter((i) => !i.required)
  const blockers = requiredItems.filter((i) => !i.ok)
  const warnings = optionalItems.filter((i) => !i.ok)

  const renderItem = (item) => (
    <li key={item.id} className={`checklist-item ${item.ok ? 'checklist-ok' : item.required ? 'checklist-error' : 'checklist-warn'}`}>
      <span className="checklist-icon" aria-hidden="true">{item.ok ? '✓' : item.required ? '✕' : '⚠'}</span>
      <span>{item.label}</span>
    </li>
  )

  return (
    <Modal
      open
      title={t('products.detail.checklist.title')}
      onClose={onCancel}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t('products.detail.checklist.backToEdit')}</Button>
          {blockers.length === 0 && (
            <Button type="button" size="sm" onClick={onConfirm}>{t('products.detail.checklist.publishNow')}</Button>
          )}
        </>
      }
    >
      <ul className="publish-checklist">
        {requiredItems.map(renderItem)}
      </ul>
      {blockers.length > 0 && (
        <p className="modal-note modal-note--error">
          {t('products.detail.checklist.blockerMessage', { count: blockers.length })}
        </p>
      )}

      {optionalItems.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground mt-4 mb-1">
            {t('products.detail.checklist.optionalHeading')}
          </p>
          <ul className="publish-checklist">
            {optionalItems.map(renderItem)}
          </ul>
          {blockers.length === 0 && warnings.length > 0 && (
            <p className="modal-note modal-note--warn">
              {t('products.detail.checklist.warningMessage', { count: warnings.length })}
            </p>
          )}
        </>
      )}
    </Modal>
  )
}

// ── Variant matrix wizard ──────────────────────────────────────────────────────

function VariantMatrixWizard({ onGenerate, onClose }) {
  const { t } = useTranslation()
  const [attributes, setAttributes] = useState([
    { name: t('products.detail.matrix.defaultColor'), values: '' },
    { name: t('products.detail.matrix.defaultSize'), values: '' },
  ])

  function updateAttr(i, field, value) {
    setAttributes((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }
  function addAttr() {
    if (attributes.length >= 5) return
    setAttributes((prev) => [...prev, { name: '', values: '' }])
  }
  function removeAttr(i) {
    setAttributes((prev) => prev.filter((_, idx) => idx !== i))
  }

  const parsed = attributes
    .map((a) => ({ name: a.name.trim(), values: a.values.split(',').map((v) => v.trim()).filter(Boolean) }))
    .filter((a) => a.name && a.values.length > 0)

  const estimatedCount = parsed.length > 0
    ? parsed.reduce((acc, a) => acc * a.values.length, 1)
    : 0

  function cartesian(arrays) {
    return arrays.reduce((acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])), [[]])
  }

  const MATRIX_HARD_CAP = 200

  function generate() {
    if (!parsed.length) return
    if (estimatedCount > MATRIX_HARD_CAP) return
    const combos = cartesian(parsed.map((a) => a.values.map((v) => ({ name: a.name, value: v }))))
    const newVariants = combos.map((combo) => ({
      _key: generateId(),
      id: '',
      sku: '',
      name: combo.map((o) => o.value).join(' - '),
      isAvailable: true,
      options: combo.map((o) => ({ name: o.name, value: o.value })),
      gallery: [],
    }))
    onGenerate(newVariants)
    onClose()
  }

  const isValid = estimatedCount > 0 && estimatedCount <= MATRIX_HARD_CAP

  return (
    <Modal
      open
      wide
      title={t('products.detail.matrix.title')}
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="button"
            variant={isValid ? 'default' : 'outline'}
            size="sm"
            onClick={generate}
            disabled={!isValid}
          >
            {estimatedCount === 0
              ? t('products.detail.matrix.generateButtonEmpty')
              : t('products.detail.matrix.generateButton', { count: estimatedCount })}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground mb-4">
        {t('products.detail.matrix.description')}
      </p>

      <div className="flex flex-col gap-3 mb-4">
        {attributes.map((attr, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t('products.detail.matrix.attributePlaceholder')}
                value={attr.name}
                onChange={(e) => updateAttr(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t('products.detail.matrix.valuesPlaceholder')}
                value={attr.values}
                onChange={(e) => updateAttr(i, 'values', e.target.value)}
                className="flex-[2]"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => removeAttr(i)}
                disabled={attributes.length <= 1}
                aria-label={t('products.detail.variant.removeOption')}
              >
                ✕
              </Button>
            </div>
            <p className="text-xs text-muted-foreground ml-0">
              {t('products.detail.matrix.valuesHelp')}
            </p>
            {attr.name.trim() && !attr.values.trim() && (
              <p className="text-xs text-warning">
                {t('products.detail.matrix.rowValuesEmpty')}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addAttr}
        disabled={attributes.length >= 5}
      >
        + {t('products.detail.variant.addOption')}
      </Button>

      {estimatedCount > 0 && (
        <p className={`text-sm mt-3 ${estimatedCount > MATRIX_HARD_CAP ? 'text-danger font-medium' : estimatedCount > 50 ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
          {estimatedCount > MATRIX_HARD_CAP
            ? t('products.detail.matrix.estimateHardCap', { count: estimatedCount, cap: MATRIX_HARD_CAP })
            : estimatedCount > 50
              ? t('products.detail.matrix.estimateWarn', { count: estimatedCount })
              : t('products.detail.matrix.estimate', { count: estimatedCount })}
        </p>
      )}
    </Modal>
  )
}

// ── Prototype form layout ───────────────────────────────────────────────────────

// The 12 sections that map to real backend fields. The prototype's trust-badge /
// CTA sections stay dropped — BigBike's backend has no fields for them — but
// installation guide and FAQ have backing columns (V133) and related products
// have a curated join table (V135).
// `required` sections must be complete before the product can be published.
const SECTION_DEFS = [
  { id: 'section-basic',          key: 'basic',         icon: 'Info',       labelKey: 'products.detail.sectionBasic',         required: true  },
  { id: 'section-pricing',        key: 'pricing',       icon: 'Tag',        labelKey: 'products.detail.sectionPricing',       required: true  },
  { id: 'section-media',          key: 'media',         icon: 'Image',      labelKey: 'products.detail.mainImageTitle',       required: true  },
  { id: 'section-seo',            key: 'seo',           icon: 'Search',     labelKey: 'products.detail.sectionSeo',           required: false },
  { id: 'section-gallery',        key: 'gallery',       icon: 'Images',     labelKey: 'products.detail.gallerySectionTitle',  required: false },
  { id: 'section-videos',         key: 'videos',        icon: 'Video',      labelKey: 'products.detail.videoSectionTitle',    required: false },
  { id: 'section-specs',          key: 'specs',         icon: 'ListChecks', labelKey: 'products.detail.specsSectionTitle',     required: false },
  { id: 'section-spec-stats',     key: 'specStats',     icon: 'Gauge',      labelKey: 'products.detail.sectionSpecStats',      required: false },
  { id: 'section-faqs',           key: 'faqs',          icon: 'HelpCircle', labelKey: 'products.detail.sectionFaqs',           required: false },
  { id: 'section-commitments',    key: 'commitments',   icon: 'ShieldCheck',labelKey: 'products.detail.sectionCommitments',    required: false },
  { id: 'section-purchase-lines', key: 'purchaseLines', icon: 'Package',    labelKey: 'products.detail.sectionPurchaseLines', required: false },
  { id: 'section-trust-badges',   key: 'trustBadges',   icon: 'BadgeCheck', labelKey: 'products.detail.sectionTrustBadges',    required: false },
  { id: 'section-variants',       key: 'variants',      icon: 'Layers',     labelKey: 'products.detail.variantSectionTitle',   required: false },
  { id: 'section-related',        key: 'related',       icon: 'Link2',      labelKey: 'products.detail.sectionRelated',        required: false },
  { id: 'section-accessories',    key: 'accessories',   icon: 'PlusCircle', labelKey: 'products.detail.sectionAccessories',    required: false },
]

// Group sections into 4 fixed tabs — keys must match SECTION_DEFS keys.
// `general` holds the three required sections so users can publish from a single tab.
const TAB_SECTIONS = {
  general:  ['basic', 'pricing', 'media'],
  content:  ['seo', 'gallery', 'videos'],
  details:  ['specs', 'specStats', 'faqs', 'commitments', 'purchaseLines', 'trustBadges'],
  variants: ['variants', 'related', 'accessories'],
}

// Field-prefix groups by section key — single source of truth used by both the
// in-render sectionErrors derivation and the synchronous save-time tab switch.
const SECTION_FIELD_PREFIXES = {
  basic:         ['name','slug','sku','gender','shortDescription','description','brandId','categoryId','publishStatus'],
  pricing:       ['retailPrice','compareAtPrice','salePrice','costPrice'],
  media:         ['imageUrl'],
  seo:           ['seoTitle','seoDescription','seoCanonicalUrl','seoOgImageUrl','seoOgImageAlt'],
  gallery:       ['gallery'],
  videos:        ['videos'],
  specs:         ['specifications'],
  specStats:     ['specStats'],
  faqs:          ['faqs'],
  commitments:   ['commitments'],
  purchaseLines: ['purchaseLines'],
  trustBadges:   ['trustBadges'],
  variants:      ['variants'],
  related:       ['relatedProductIds'],
  accessories:   ['accessoryProductIds'],
}

function computeSectionErrorsFromMap(errors) {
  const keys = Object.keys(errors)
  const result = {}
  for (const [section, prefixes] of Object.entries(SECTION_FIELD_PREFIXES)) {
    result[section] = prefixes.some((p) => keys.some((k) => k === p || k.startsWith(p + '.')))
  }
  return result
}

// Find the first tab containing any failing section for the given errors map.
function findTabForErrors(sectionErrors) {
  for (const [tab, keys] of Object.entries(TAB_SECTIONS)) {
    if (keys.some((k) => sectionErrors[k])) return tab
  }
  return null
}

// Map publishStatus → matching .badge variant. Used in ScreenHeader.
function publishBadgeClass(status) {
  switch (status) {
    case 'PUBLISHED': return 'bb-badge bb-badge-success'
    case 'DRAFT':     return 'bb-badge bb-badge-neutral'
    case 'HIDDEN':    return 'bb-badge bb-badge-warning'
    case 'TRASH':     return 'bb-badge bb-badge-danger'
    default:          return 'bb-badge bb-badge-neutral'
  }
}

// Editable "Phân công" guide text (role names + task lists), fetched from
// GET /admin/product-assignment. SUPER_ADMIN edits it in Cài đặt → Phân công sản phẩm.
// Components read this via context and fall back to the i18n defaults if empty/unloaded.
const AssignmentConfigContext = createContext(null)

// Returns the configured role label for a role key, or the i18n default when the
// admin hasn't customised it (empty/missing value).
function useRoleLabel(role, t) {
  const cfg = useContext(AssignmentConfigContext)
  if (role === 'content') return cfg?.roleContent || t('products.detail.assign.roleContent', { defaultValue: 'Content' })
  if (role === 'seo') return cfg?.roleSeo || t('products.detail.assign.roleSeo', { defaultValue: 'SEO' })
  if (role === 'manager') return cfg?.roleManager || t('products.detail.assign.roleManager', { defaultValue: 'Quản lý' })
  return ''
}

// Pill badge showing which team role owns a section.
// Backend caps related products at 24 (UpsertProductRequest.relatedProductIds @Size(max = 24),
// docs/engineering/API_CONTRACT.md §"Product related products" / DATA_CONTRACT.md §V135).
const RELATED_PRODUCTS_MAX = 24

// One row in the related-products list — draggable (dnd-kit) so the admin can curate the
// storefront carousel order, with a generous thumbnail and an icon remove button.
function RelatedProductRow({ chip, canEdit, onRemove, t, sortable }) {
  return (
    <div
      ref={sortable?.setNodeRef}
      style={{ ...sortable?.style, opacity: sortable?.isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 sm:gap-3 p-2 border border-border bg-background"
    >
      {canEdit && sortable && (
        <button
          type="button"
          {...sortable.handleProps}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label={t('products.detail.relatedDragHint')}
        >
          <GripVertical size={16} />
        </button>
      )}
      {chip.imageUrl ? (
        <img
          src={resolveDisplayUrl(chip.imageUrl)}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="w-10 h-10 sm:w-12 sm:h-12 object-cover flex-shrink-0 border border-border"
        />
      ) : (
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 border border-border bg-muted flex items-center justify-center text-muted-foreground">
          <ImageOff size={16} />
        </div>
      )}
      <span className="flex-1 min-w-0 truncate text-sm font-medium" title={chip.name}>{chip.name}</span>
      {canEdit && (
        <button
          type="button"
          className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(chip.id)}
          aria-label={t('products.detail.relatedRemove', { name: chip.name })}
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

function RoleBadge({ role }) {
  const { t } = useTranslation()
  const label = useRoleLabel(role, t)
  if (role === 'content') {
    return (
      <span
        className="inline-flex items-center text-xs uppercase tracking-wide px-1.5 py-0.5 border rounded-xs"
        style={{ color: 'var(--admin-color-primary)', borderColor: 'var(--admin-color-primary)' }}
      >{label}</span>
    )
  }
  if (role === 'seo') {
    return (
      <span
        className="inline-flex items-center text-xs uppercase tracking-wide px-1.5 py-0.5 border rounded-xs"
        style={{ color: 'var(--admin-color-status-warning-text)', borderColor: 'var(--admin-color-status-warning-text)' }}
      >{label}</span>
    )
  }
  if (role === 'manager') {
    return (
      <span
        className="inline-flex items-center text-xs uppercase tracking-wide px-1.5 py-0.5 border rounded-xs"
        style={{ color: 'var(--admin-color-text-primary)', borderColor: 'var(--admin-color-text-primary)' }}
      >{label}</span>
    )
  }
  return null
}

// Section card wrapper — matches CategoryDetail/BrandDetail "card-head + card-body" pattern.
// Required sections get a subtle red asterisk after the title instead of a loud "BẮT BUỘC" badge.
function SectionCard({ title, badge, required, children }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header">
        <h3>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-status-danger-text)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h3>
        {badge}
      </div>
      <div className="bb-card-body">{children}</div>
    </div>
  )
}

// Inline assignment guide — replaces the icon-only Popover in the header.
// Text comes from the editable product-assignment config (context), falling back to
// the i18n defaults whenever the admin has left a field empty / config hasn't loaded.
function AssignmentBanner({ t }) {
  const cfg = useContext(AssignmentConfigContext)
  const title = cfg?.title || t('products.detail.assign.title')
  const roleContent = cfg?.roleContent || t('products.detail.assign.roleContent')
  const itemsContent = cfg?.itemsContent || t('products.detail.assign.itemsContent')
  const roleSeo = cfg?.roleSeo || t('products.detail.assign.roleSeo')
  const itemsSeo = cfg?.itemsSeo || t('products.detail.assign.itemsSeo')
  const roleManager = cfg?.roleManager || t('products.detail.assign.roleManager')
  const itemsManager = cfg?.itemsManager || t('products.detail.assign.itemsManager')
  return (
    <div className="px-4 py-3 bg-surface-muted border-b border-border">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users size={12} />
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {roleContent}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {itemsContent}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-status-warning-text)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {roleSeo}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {itemsSeo}
          </div>
        </div>
        <div className="border-l-[3px] pl-2 py-0.5" style={{ borderColor: 'var(--admin-color-text-primary)' }}>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-0.5">
            {roleManager}
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--admin-color-text-secondary)' }}>
            {itemsManager}
          </div>
        </div>
      </div>
    </div>
  )
}

// Field shell — pass `full` to span both grid columns.
function Field({ label, hint, error, count, countWarn, full, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {(label || count != null) && (
        <div className="flex justify-between items-baseline text-sm font-medium text-foreground/80">
          {label && <span>{label}</span>}
          {count != null && (
            <span
              className={cn(
                'text-xs tabular-nums text-muted-foreground',
                countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold',
              )}
            >
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

  const { data: fetchResult, isLoading, isError, error: fetchError } = useQuery({
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
  const selectedCategoryLabel =
    findOptionById(categoryOptions, form.categoryId)?.name ||
    (form.categoryId ? t('products.detail.optionNotFound', { id: form.categoryId }) : undefined)
  const selectedBrandLabel =
    findOptionById(brandOptions, form.brandId)?.name ||
    (form.brandId ? t('products.detail.optionNotFound', { id: form.brandId }) : undefined)

  // Product picker for the "Sản phẩm liên quan" section — debounced search,
  // self excluded so a product can't be added to its own related list.
  const [relatedSearch, setRelatedSearch] = useState('')
  const [relatedSearchDebounced, setRelatedSearchDebounced] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => setRelatedSearchDebounced(relatedSearch.trim()), 300)
    return () => clearTimeout(handle)
  }, [relatedSearch])

  const { data: relatedSearchResult, isFetching: isSearchingRelated } = useQuery({
    queryKey: ['product-related-search', relatedSearchDebounced, contentLang],
    queryFn: () => fetchProducts({ q: relatedSearchDebounced, pageSize: 8 }),
    enabled: relatedSearchDebounced.length >= 1,
    staleTime: 60 * 1000,
  })
  const relatedSearchItems = (relatedSearchResult?.items ?? []).filter((p) => p.id !== productId)
  const relatedAtMax = form.relatedProductIds.length >= RELATED_PRODUCTS_MAX

  // Product picker for the "Phụ kiện" section — debounced search, self excluded so a
  // product can't be added to its own accessory list. Mirrors the related-products picker.
  const [accessorySearch, setAccessorySearch] = useState('')
  const [accessorySearchDebounced, setAccessorySearchDebounced] = useState('')
  useEffect(() => {
    const handle = setTimeout(() => setAccessorySearchDebounced(accessorySearch.trim()), 300)
    return () => clearTimeout(handle)
  }, [accessorySearch])

  const { data: accessorySearchResult, isFetching: isSearchingAccessory } = useQuery({
    queryKey: ['product-accessory-search', accessorySearchDebounced, contentLang],
    queryFn: () => fetchProducts({ q: accessorySearchDebounced, pageSize: 8 }),
    enabled: accessorySearchDebounced.length >= 1,
    staleTime: 60 * 1000,
  })
  const accessorySearchItems = (accessorySearchResult?.items ?? []).filter((p) => p.id !== productId)
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

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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
    setRelatedSearch('')
    setRelatedSearchDebounced('')
  }

  function removeRelatedProduct(removeId) {
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
    setAccessorySearch('')
    setAccessorySearchDebounced('')
  }

  function removeAccessoryProduct(removeId) {
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
      if (isCreate && savedItem?.id) navigate(`/admin/products/${savedItem.id}`, { replace: true })
    },
    onError: (error) => {
      setValidationErrors(mapValidationErrors(error))
      toast.error(error.message || t('products.detail.errSaveFailed'))
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

  function handleSave(overridePublishStatus) {
    if (!canUpdate) return

    const formToSave = overridePublishStatus
      ? { ...form, publishStatus: overridePublishStatus }
      : form

    const schema = createProductSchema(t, isCreate)
    const result = schema.safeParse(formToSave)
    const clientErrors = zodErrors(result)
    if (Object.keys(clientErrors).length > 0) {
      setValidationErrors(clientErrors)
      // Switch to the first tab containing an error so the user sees the field
      // we're about to focus. computeSectionErrorsFromMap reuses the same
      // prefix logic used by sectionErrors below.
      const failedTab = findTabForErrors(computeSectionErrorsFromMap(clientErrors))
      if (failedTab && failedTab !== activeTab) setActiveTab(failedTab)
      focusFirstError()
      return
    }

    // Show quality checklist whenever the resulting status would be PUBLISHED
    // but the saved-on-server status is not — covers both the "Save & Publish"
    // button path AND the dropdown-then-save path.
    if (originalPublishStatus !== 'PUBLISHED' && formToSave.publishStatus === 'PUBLISHED') {
      setPendingPublish({ formToSave, payload: toPayload(formToSave) })
      setShowPublishChecklist(true)
      return
    }

    setIsSubmitting(true)
    setValidationErrors({})
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
  const [activeTab, setActiveTab] = useState('general')
  const [savedFlash, setSavedFlash] = useState(false)

  if (state.status === 'loading') {
    return (
      <StatePanel
        tone="info"
        title={t('products.detail.loading')}
        description={t('products.detail.loadingDesc')}
      />
    )
  }

  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('products.detail.loadError')}
        description={state.error}
        actionLabel={t('products.detail.backToList')}
        onAction={() => navigate('/admin/products')}
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
    saveDotState === 'saving'      ? 'bg-[var(--admin-color-status-info-text)] animate-pulse'
    : saveDotState === 'dirty'     ? 'bg-[var(--admin-color-status-warning-text)] animate-pulse'
    :                                'bg-[var(--admin-color-status-success-text)]'
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
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-color-status-warning-bg)] border border-[var(--admin-color-status-warning-border)] text-[var(--admin-color-status-warning-text)] text-sm">
            <Lock size={16} />
            <span>{t('products.detail.permissionDesc')}</span>
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
              onClick={() => {
                setForm(draftRecovery.form)
                setIsDirty(true)
                setDraftRecovery(null)
                slugEditedByUser.current = Boolean(draftRecovery.form.slug)
                enSlugEditedByUser.current = Boolean(draftRecovery.form.translations?.en?.slug)
              }}
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
        <AssignmentBanner t={t} />

        <Tabs
          ariaLabel={t('products.detail.tabsAriaLabel', { defaultValue: 'Phần của sản phẩm' })}
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'general',  label: t('products.detail.tabGeneral'),  count: tabCounts.general  || undefined },
            { key: 'content',  label: t('products.detail.tabContent'),  count: tabCounts.content  || undefined },
            { key: 'details',  label: t('products.detail.tabDetails'),  count: tabCounts.details  || undefined },
            { key: 'variants', label: t('products.detail.tabVariants'), count: tabCounts.variants || undefined },
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
          {activeTab === 'general' && (
            <>
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
                    count={`${langValue('name').length} / 255`}
                    countWarn={langValue('name').length > 230}
                    error={validationErrors.name}
                  >
                    <Input
                      value={langValue('name')}
                      onChange={(e) => (isEnLang ? handleEnNameChange(e.target.value) : handleNameChange(e.target.value))}
                      disabled={isReadOnly}
                      maxLength={255}
                    />
                  </Field>

                  <Field
                    full
                    label={t('products.detail.slug')}
                    error={isEnLang ? validationErrors['translations.en.slug'] : validationErrors.slug}
                    hint={isEnLang
                      ? t('products.detail.slugHintEn', { defaultValue: 'Đường dẫn tiếng Anh (tùy chọn) — để trống sẽ dùng đường dẫn tiếng Việt.' })
                      : t('products.detail.slugHint')}
                  >
                    <Input
                      value={isEnLang ? (form.translations?.en?.slug ?? '') : form.slug}
                      placeholder={isEnLang ? 'vd: fullface-helmet-agv-k1s' : 'vd: mu-bao-hiem-fullface-agv-k1s'}
                      onChange={(e) => (isEnLang ? handleEnSlugChange(e.target.value) : handleSlugChange(e.target.value))}
                      onBlur={(e) => (isEnLang ? handleEnSlugBlur(e.target.value) : handleSlugBlur(e.target.value))}
                      disabled={isReadOnly}
                      maxLength={isEnLang ? 100 : 200}
                      className="font-mono"
                    />
                  </Field>

                  <Field
                    label={t('products.detail.sku')}
                    count={`${form.sku.length} / 100`}
                    countWarn={form.sku.length > 85}
                    hint={t('products.detail.skuHint')}
                  >
                    <Input
                      value={form.sku}
                      onChange={(e) => updateField('sku', e.target.value)}
                      disabled={isReadOnly}
                      maxLength={100}
                      className="font-mono"
                    />
                  </Field>

                  <Field label={t('products.detail.categoryId')} error={validationErrors.categoryId}>
                    <Select value={form.categoryId} onValueChange={(val) => { if (val) updateField('categoryId', val) }} disabled={isReadOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('products.detail.categoryPlaceholder')}>{selectedCategoryLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {form.categoryId && !categoryOptions.some((c) => c.id === form.categoryId) && (
                          <SelectItem value={form.categoryId} disabled>{t('products.detail.optionNotFound', { id: form.categoryId })}</SelectItem>
                        )}
                        {categoryOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label={t('products.detail.brandId')}>
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

                  <Field label={t('products.detail.gender', { defaultValue: 'Giới tính' })}>
                    {/* Guard `if (val)`: Radix bắn onValueChange('') giả khi value đồng bộ lúc
                        mount — không guard sẽ xoá gender (hiện trống + lưu mất dữ liệu). Children
                        rõ ràng cho SelectValue để trigger hiện đúng giá trị. */}
                    <Select value={form.gender || 'NONE'} onValueChange={(val) => { if (val) updateField('gender', val === 'NONE' ? '' : val) }} disabled={isReadOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('products.detail.genderPlaceholder', { defaultValue: 'Không chọn' })}>
                          {form.gender || undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {/* Radix Select cấm value="" — dùng sentinel 'NONE', map về '' khi lưu */}
                        <SelectItem value="NONE">{t('products.detail.genderPlaceholder', { defaultValue: 'Không chọn' })}</SelectItem>
                        <SelectItem value="Nam">Nam</SelectItem>
                        <SelectItem value="Nữ">Nữ</SelectItem>
                        <SelectItem value="Unisex">Unisex</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    full
                    label={t('products.detail.shortDescription')}
                    hint={t('products.detail.shortDescriptionHint')}
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

                  <Field full label={t('products.detail.description')} error={validationErrors.description}>
                    {isEnLang ? (
                      <BlockEditor
                        value={form.descriptionBlocksEn}
                        onChange={(blocks) => updateField('descriptionBlocksEn', blocks)}
                        disabled={isReadOnly}
                        hasError={Boolean(validationErrors.description)}
                        fallbackHtml={langValue('description')}
                        productMode
                      />
                    ) : (
                      <BlockEditor
                        value={form.descriptionBlocks}
                        onChange={(blocks) => updateField('descriptionBlocks', blocks)}
                        disabled={isReadOnly}
                        hasError={Boolean(validationErrors.description)}
                        fallbackHtml={form.description}
                        productMode
                      />
                    )}
                  </Field>

                </div>
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

              {/* ── Card: Hiển thị trên web (V245) ── */}
              <SectionCard title={t('products.detail.sectionVisibility.title', { defaultValue: 'Hiển thị trên web' })} badge={<RoleBadge role="content" />}>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('products.detail.sectionVisibility.hint', { defaultValue: 'Bật phần nào thì phần đó mới hiện trên trang sản phẩm (cần có nội dung). Sản phẩm mới mặc định tắt hết.' })}
                </p>
                <SectionVisibilityEditor
                  value={form.sectionVisibility}
                  onChange={(next) => updateField('sectionVisibility', next)}
                  form={form}
                  disabled={isReadOnly}
                />
              </SectionCard>

              {/* ── Card: Giá & trạng thái ── */}
              <SectionCard title={t('products.detail.sectionPricing')} required badge={<RoleBadge role="manager" />}>
                {form.variants.length > 0 && (
                  <div className="flex items-start gap-2 mb-4 p-3 bg-[var(--admin-color-status-info-bg)] border border-[var(--admin-color-status-info-border)] text-[var(--admin-color-status-info-text)] text-sm">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>{t('products.detail.variantPricingHint')}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('products.detail.retailPrice')} error={validationErrors.retailPrice}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="vd: 5.900.000"
                      value={formatPrice(form.retailPrice)}
                      onChange={(e) => updateField('retailPrice', e.target.value.replace(/\D/g, ''))}
                      disabled={isReadOnly}
                    />
                  </Field>

                  <Field
                    label={<span title={t('products.detail.compareAtPriceTitle')}>{t('products.detail.compareAtPriceLabel')}</span>}
                    error={validationErrors.compareAtPrice}
                  >
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="vd: 6.500.000"
                      value={formatPrice(form.compareAtPrice)}
                      onChange={(e) => updateField('compareAtPrice', e.target.value.replace(/\D/g, ''))}
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
                          disabled={!(Number(form.retailPrice) || Number(form.compareAtPrice))}
                          onClick={() => {
                            const base = Number(form.retailPrice) || Number(form.compareAtPrice)
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
                          {(Number(form.retailPrice) || Number(form.compareAtPrice))
                            ? t('products.detail.discountFromBaseHint')
                            : t('products.detail.discountNeedsBaseHint')}
                        </small>
                      </div>
                    )}
                  </Field>

                  <Field label={t('products.detail.costPrice')} error={validationErrors.costPrice}>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="vd: 3.000.000"
                      value={formatPrice(form.costPrice)}
                      onChange={(e) => updateField('costPrice', e.target.value.replace(/\D/g, ''))}
                      disabled={isReadOnly}
                    />
                    <small className="text-xs text-muted-foreground">{t('products.detail.costPriceHint')}</small>
                  </Field>

                  <Field label={t('products.detail.publishStatus')} error={validationErrors.publishStatus}>
                    <Select value={form.publishStatus} onValueChange={(val) => { if (val) updateField('publishStatus', val) }} disabled={isReadOnly}>
                      <SelectTrigger><SelectValue>{form.publishStatus ? t(`status.publish.${form.publishStatus}`, { defaultValue: form.publishStatus }) : undefined}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {form.publishStatus && !['DRAFT', 'PUBLISHED', 'HIDDEN', 'TRASH'].includes(form.publishStatus) && (
                          <SelectItem value={form.publishStatus} disabled>
                            {t('products.detail.specialPublishNote', { state: form.publishStatus })}
                          </SelectItem>
                        )}
                        <SelectItem value="DRAFT" disabled={!allowedPublishStatuses.includes('DRAFT')}>{t('status.publish.DRAFT')}</SelectItem>
                        <SelectItem value="PUBLISHED" disabled={!allowedPublishStatuses.includes('PUBLISHED')}>{t('status.publish.PUBLISHED')}</SelectItem>
                        <SelectItem value="HIDDEN" disabled={!allowedPublishStatuses.includes('HIDDEN')}>{t('status.publish.HIDDEN')}</SelectItem>
                        {form.publishStatus === 'TRASH' && (
                          <SelectItem value="TRASH" disabled>{t('status.publish.TRASH')}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </Field>

                  <label className="md:col-span-2 flex items-start gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted">
                    <Checkbox
                      checked={form.forceOutOfStock}
                      onCheckedChange={(checked) => updateField('forceOutOfStock', checked)}
                      disabled={isReadOnly}
                    />
                    <span><strong>{t('products.detail.forceOutOfStock')}</strong> — {t('products.detail.forceOutOfStockHint')}</span>
                  </label>
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
            </>
          )}

          {activeTab === 'content' && (
            <>
              {/* ── Card: SEO ── */}
              <SectionCard title={t('products.detail.sectionSeo')} badge={<RoleBadge role="seo" />}>
                {/* Live Google SERP preview */}
                <div className="mb-4 p-3 border border-border bg-white">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <PfSearch size={12} />
                    <span>{t('products.detail.serpPreview', { defaultValue: 'Xem trước trên Google' })}</span>
                  </div>
                  <div className="text-xs text-[#5f6368] break-all mb-1">
                    {form.seoCanonicalUrl?.trim() || `https://bigbike.vn/product/${form.slug || 'duong-dan-san-pham'}`}
                  </div>
                  <div className="text-lg leading-snug text-[#1a0dab] break-words mb-1">
                    {(form.seoTitle || form.name || t('products.detail.serpTitleFallback', { defaultValue: 'Tiêu đề sản phẩm trên Google' })).slice(0, 60)}
                  </div>
                  <div className="text-sm leading-relaxed text-[#4d5156] break-words">
                    {form.seoDescription || form.shortDescription || t('products.detail.serpDescFallback', { defaultValue: 'Mô tả ngắn về sản phẩm sẽ hiển thị ở đây.' })}
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
                      className={validationErrors.seoDescription ? 'border-danger' : undefined}
                    />
                  </Field>

                  <Field full label={t('products.detail.seoCanonicalUrl')} error={validationErrors.seoCanonicalUrl}>
                    <Input
                      value={form.seoCanonicalUrl}
                      onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="https://..."
                      className={validationErrors.seoCanonicalUrl ? 'border-danger' : undefined}
                    />
                  </Field>

                  <Field full label={t('products.detail.seoOgImageUrl')} hint="1200×630px (chuẩn mạng xã hội)." error={validationErrors.seoOgImageUrl}>
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

              {/* ── Card: Gallery ── */}
              <SectionCard
                title={t('products.detail.gallerySectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
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

              {/* ── Card: Video ── */}
              <SectionCard
                title={t('products.detail.videoSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
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
            </>
          )}

          {activeTab === 'details' && (
            <>
              {/* ── Card: Thông số ── */}
              <SectionCard
                title={t('products.detail.specsSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {t('products.detail.specCount', { count: form.specifications.length })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <SpecificationsEditor
                  items={form.specifications}
                  onChange={(next) => updateField('specifications', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Specs Dashboard — ô số liệu nổi bật (V235) ── */}
              <SectionCard
                title={t('products.detail.sectionSpecStats')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.specStats.length} / 4
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.specStats.hint')}</p>
                <SpecStatEditor
                  items={form.specStats}
                  onChange={(next) => updateField('specStats', next)}
                  disabled={isReadOnly}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* Phù hợp với ai · Ưu/Nhược điểm · Bảng size (V246): nhập qua KHỐI trong "Mô tả sản phẩm"
                  (trình dựng khối), không còn ô nhập riêng tại đây. */}

              {/* ── Card: FAQ ── */}
              <SectionCard
                title={t('products.detail.sectionFaqs')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.faqs.length} {t('products.detail.faqs.unit', { defaultValue: 'câu hỏi' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.faqs.hint')}</p>
                <FaqEditor
                  items={form.faqs}
                  onChange={(next) => updateField('faqs', next)}
                  disabled={isReadOnly}
                  validationErrors={validationErrors}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Cam kết (dưới nút mua hàng) (V232) ── */}
              <SectionCard
                title={t('products.detail.sectionCommitments')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.commitments.length} {t('products.detail.commitments.unit', { defaultValue: 'dòng' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">{t('products.detail.commitments.hint')}</p>
                <CommitmentEditor
                  items={form.commitments}
                  onChange={(next) => updateField('commitments', next)}
                  disabled={isReadOnly}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Bảng "Mua tại BigBike.vn" (dưới khu mua hàng) ── */}
              <SectionCard
                title={t('products.detail.sectionPurchaseLines', { defaultValue: 'Mua tại BigBike.vn' })}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.purchaseLines.length} {t('products.detail.purchaseLines.unit', { defaultValue: 'dòng' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">
                  {t('products.detail.purchaseLines.hint', { defaultValue: 'Bảng hiển thị dưới khu mua hàng. Giá, Tồn kho, Hotline và Địa chỉ tự động hiện sẵn — ở đây bạn thêm các dòng riêng (vd Bảo hành, Giao hàng, Đổi trả).' })}
                </p>
                <PurchaseLineEditor
                  items={form.purchaseLines}
                  onChange={(next) => updateField('purchaseLines', next)}
                  disabled={isReadOnly}
                  contentLang={contentLang}
                />
              </SectionCard>

              {/* ── Card: Dải tin cậy (trên tên sản phẩm) (V233) ── */}
              <SectionCard
                title={t('products.detail.sectionTrustBadges', { defaultValue: 'Dải tin cậy (trên tên sản phẩm)' })}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
                      {form.trustBadges.length} {t('products.detail.trustBadges.unit', { defaultValue: 'nhãn' })}
                    </span>
                    <RoleBadge role="content" />
                  </div>
                }
              >
                <p className="text-xs text-muted-foreground mb-2">
                  {t('products.detail.trustBadges.hint', { defaultValue: 'Các nhãn ngắn hiển thị NGAY TRÊN tên sản phẩm (vd "Chính hãng", "BH 2 năm", "Freeship"). Để trống → web ẩn dải. Mỗi sản phẩm tự nhập riêng.' })}
                </p>
                <HighlightsEditor
                  items={form.trustBadges}
                  onChange={(next) => updateField('trustBadges', next)}
                  disabled={isReadOnly}
                  contentLang={contentLang}
                  placeholder={t('products.detail.trustBadges.placeholder', { defaultValue: 'vd: Chính hãng' })}
                  addLabel={t('products.detail.trustBadges.add', { defaultValue: 'Thêm nhãn' })}
                />
              </SectionCard>

              {/* ── Card: Xuất xứ ── */}
              <SectionCard
                title={t('products.detail.trust.sectionTitle', { defaultValue: 'Xuất xứ' })}
                badge={<RoleBadge role="content" />}
              >
                <Field label={t('products.detail.trust.originBrand', { defaultValue: 'Thương hiệu (nước)' })}>
                  <Input
                    placeholder="vd: Ý"
                    value={form.originBrandCountry}
                    onChange={(e) => updateField('originBrandCountry', e.target.value)}
                    disabled={isReadOnly}
                    maxLength={120}
                  />
                </Field>
              </SectionCard>

            </>
          )}

          {activeTab === 'variants' && (
            <>
              {/* ── Card: Biến thể ── */}
              <SectionCard
                title={t('products.detail.variantSectionTitle')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5">
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
                />
              </SectionCard>

              {/* ── Card: Sản phẩm liên quan ── */}
              <SectionCard
                title={t('products.detail.sectionRelated')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-bold tabular-nums px-2 py-0.5 border border-border text-muted-foreground"
                      style={relatedAtMax ? { color: 'var(--admin-color-status-warning-text)', borderColor: 'var(--admin-color-status-warning-text)' } : undefined}
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
                      <p
                        className="text-xs mt-2"
                        style={{ color: 'var(--admin-color-status-warning-text)' }}
                      >
                        {t('products.detail.relatedLimitHint', { max: RELATED_PRODUCTS_MAX })}
                      </p>
                    )}
                  </>
                )}
              </SectionCard>

              {/* ── Card: Phụ kiện (sản phẩm bán kèm) ── */}
              <SectionCard
                title={t('products.detail.sectionAccessories')}
                badge={
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-bold tabular-nums px-2 py-0.5 border border-border text-muted-foreground"
                      style={accessoryAtMax ? { color: 'var(--admin-color-status-warning-text)', borderColor: 'var(--admin-color-status-warning-text)' } : undefined}
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
                      <p
                        className="text-xs mt-2"
                        style={{ color: 'var(--admin-color-status-warning-text)' }}
                      >
                        {t('products.detail.accessoryLimitHint', { max: RELATED_PRODUCTS_MAX })}
                      </p>
                    )}
                  </>
                )}
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

          <Button
            variant="outline"
            type="button"
            disabled={isReadOnly || !isDirty || !allowedPublishStatuses.includes('DRAFT')}
            title={!allowedPublishStatuses.includes('DRAFT') ? t('products.detail.saveDraftDisabledPublished') : undefined}
            onClick={() => handleSave('DRAFT')}
          >
            {t('products.detail.saveDraft')}
          </Button>

          <div className="flex">
            <Button
              type="button"
              disabled={isReadOnly || isSubmitting}
              className="rounded-r-none"
              onClick={() => handleSave(isPublished ? undefined : 'PUBLISHED')}
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
              {primaryLabel}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  disabled={isReadOnly || isSubmitting}
                  className="rounded-l-none border-l border-white/20 px-2"
                  aria-label={t('products.detail.moreSaveOptions', { defaultValue: 'Thêm tuỳ chọn lưu' })}
                >
                  <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleSave('DRAFT')}
                  disabled={!allowedPublishStatuses.includes('DRAFT')}
                  title={!allowedPublishStatuses.includes('DRAFT') ? t('products.detail.saveDraftDisabledPublished') : undefined}
                >
                  {t('products.detail.saveDraft')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSave('HIDDEN')}>
                  {t('products.detail.saveHidden')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </StickyActionBar>

        {/* Modals */}
        {showPublishChecklist && pendingPublish && (
          <PublishChecklistModal
            form={pendingPublish.formToSave}
            isCreate={isCreate}
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
