// Constants and pure helper functions for ProductDetailScreen.
// Extracted from ProductDetailScreen.jsx to keep the screen file focused on behaviour
// and to satisfy react-refresh (non-component exports must live in a .js file).

import { createContext } from 'react'
import { parseSizeGuide } from '../../lib/sizeChart'
import { normalizeVariantToken, isColorAttributeName } from '../../lib/schemas'
import { generateId } from '@/lib/utils'

// Editable "Phân công" guide text (role names + task lists), fetched from
// GET /admin/product-assignment. SUPER_ADMIN edits it in Cài đặt → Phân công sản phẩm.
// Components read this via context and fall back to the i18n defaults if empty/unloaded.
export const AssignmentConfigContext = createContext(null)

// Matches YouTube IDs across watch, share, embed, and shorts URLs.
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export function inferVideoType(url, provider) {
  if (provider === 'youtube' || provider === 'upload') return provider
  if (extractYouTubeId(url)) return 'youtube'
  return url ? 'upload' : 'youtube'
}

// ── Slug generation ────────────────────────────────────────────────────────────

export function slugify(text) {
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
export function getAllowedPublishStatuses(from) {
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
export function formatPrice(raw) {
  if (!raw) return ''
  return String(raw).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ── Autosave utilities ─────────────────────────────────────────────────────────

export const AUTOSAVE_TTL_MS = 60 * 60 * 1000

export function getAutosaveKey(productId, isCreate) {
  return `product-autosave:${isCreate ? 'new' : productId}`
}

export function saveFormToStorage(key, form) {
  try {
    localStorage.setItem(key, JSON.stringify({ form, ts: Date.now() }))
  } catch { /* quota */ }
}

export function loadFormFromStorage(key) {
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

export function clearFormFromStorage(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// ── Publish readiness checklist ────────────────────────────────────────────────

export function getPublishReadiness(form, t, isCreate = false) {
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

export function getVariantColorValue(variant) {
  return (variant.options || []).find((option) => isColorAttributeName(option.name))?.value?.trim() || ''
}

export function getVariantColorKey(variant) {
  const value = getVariantColorValue(variant)
  return value ? normalizeVariantToken(value) : ''
}

export function cloneGallery(gallery = []) {
  return gallery.map((img) => ({ ...img }))
}

export function hasGalleryImages(gallery = []) {
  // V248: item "có nội dung" khi có ảnh HOẶC video (gallery hỗn hợp).
  return gallery.some((img) => String(img.url || '').trim() || String(img.videoUrl || '').trim())
}

export function withColorScopedMedia(variants = []) {
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

export function buildEmptyForm() {
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
export function buildEmptyTranslation() {
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

export function findOptionById(items, id) {
  if (!id) return null
  return items.find((item) => item?.id === id) || null
}

export function prependSelectedOption(items, selected) {
  if (!selected?.id || findOptionById(items, selected.id)) {
    return items
  }
  return [selected, ...items]
}

export function buildFormFromItem(item) {
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
export function translationFormFromItem(en) {
  const source = en && typeof en === 'object' ? en : {}
  const empty = buildEmptyTranslation()
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, source[key] || '']),
  )
}

// Like toIntegerOrUndefined but sends null for empty so the backend can
// distinguish "user cleared this field" from "field not sent at all".
export function toIntegerOrNull(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) return Number.NaN
  return parsed
}

// English product-level content → upsert payload. Blank fields become undefined
// so the backend stores null. English is optional (PRODUCT_RULE_001).
export function translationToPayload(en) {
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
export function cleanDescriptionBlocks(blocks) {
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
export function safeJsonArray(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseSuitabilityCards(viRaw, enRaw) {
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
export const SECTION_VISIBILITY_KEYS = [
  'description', 'specifications', 'faqs', 'videos', 'reviews',
]

// Có nội dung trong form chưa — để seed "bật sẵn" cho sản phẩm cũ chưa cấu hình (giữ web như cũ).
// reviews là nội dung động → seed bật cho hàng cũ.
export function sectionHasContent(form, key) {
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
export function parseSectionVisibilityForm(raw) {
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
export function resolveSectionVisibilityForm(saved, seedFromForm) {
  const map = {}
  for (const k of SECTION_VISIBILITY_KEYS) {
    if (saved && typeof saved[k] === 'boolean') map[k] = saved[k]
    else map[k] = seedFromForm ? sectionHasContent(seedFromForm, k) : false
  }
  return map
}

export function toPayload(form) {
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

// ── Section / tab layout ─────────────────────────────────────────────────────────

export const SECTION_DEFS = [
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
export const TAB_SECTIONS = {
  general:  ['basic', 'pricing', 'media'],
  content:  ['seo', 'gallery', 'videos'],
  details:  ['specs', 'specStats', 'faqs', 'commitments', 'purchaseLines', 'trustBadges'],
  variants: ['variants', 'related', 'accessories'],
}

// Field-prefix groups by section key — single source of truth used by both the
// in-render sectionErrors derivation and the synchronous save-time tab switch.
export const SECTION_FIELD_PREFIXES = {
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

export function computeSectionErrorsFromMap(errors) {
  const keys = Object.keys(errors)
  const result = {}
  for (const [section, prefixes] of Object.entries(SECTION_FIELD_PREFIXES)) {
    result[section] = prefixes.some((p) => keys.some((k) => k === p || k.startsWith(p + '.')))
  }
  return result
}

// Find the first tab containing any failing section for the given errors map.
export function findTabForErrors(sectionErrors) {
  for (const [tab, keys] of Object.entries(TAB_SECTIONS)) {
    if (keys.some((k) => sectionErrors[k])) return tab
  }
  return null
}

// Map publishStatus → matching .badge variant. Used in ScreenHeader.
export function publishBadgeClass(status) {
  switch (status) {
    case 'PUBLISHED': return 'bb-badge bb-badge-success'
    case 'DRAFT':     return 'bb-badge bb-badge-neutral'
    case 'HIDDEN':    return 'bb-badge bb-badge-warning'
    case 'TRASH':     return 'bb-badge bb-badge-danger'
    default:          return 'bb-badge bb-badge-neutral'
  }
}

// Backend caps related products at 24 (UpsertProductRequest.relatedProductIds @Size(max = 24),
// docs/engineering/API_CONTRACT.md §"Product related products" / DATA_CONTRACT.md §V135).
export const RELATED_PRODUCTS_MAX = 24

export const PURCHASE_LINE_MAX = 12

export const SPEC_STAT_MAX = 4

export const VARIANTS_FILTER_THRESHOLD = 6
