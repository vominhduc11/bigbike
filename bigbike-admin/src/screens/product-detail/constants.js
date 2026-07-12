// Constants and pure helper functions for ProductDetailScreen.
// Extracted from ProductDetailScreen.jsx to keep the screen file focused on behaviour
// and to satisfy react-refresh (non-component exports must live in a .js file).

import { createContext } from 'react'
import { serializeSuitabilityCards, suitabilityCardHasContent } from '../../lib/suitabilityCards'
import { normalizeVariantToken, isColorAttributeName } from '../../lib/schemas'
import { generateId } from '@/lib/utils'

// Editable "Phân công" guide text (role names + task lists), fetched from
// GET /admin/product-assignment. SUPER_ADMIN edits it in Cài đặt → Phân công sản phẩm.
// Components read this via context and fall back to the i18n defaults if empty/unloaded.
export const AssignmentConfigContext = createContext(null)

// Base URL trang sản phẩm trên storefront. Canonical luôn tự sinh từ slug
// (https://bigbike.vn/product/{slug}) — admin không nhập tay (khớp PRODUCT_DATA_COMPLETENESS_AUDIT).
//
// KHÔNG tái dùng thẳng VITE_STOREFRONT_BASE_URL: biến đó phục vụ mục đích khác (base URL cho
// iframe live-preview — trên VPS bị trỏ vào IP máy chủ để né trình duyệt chặn Private Network
// Access, xem project_admin_preview_storefront_url). Backend chỉ chấp nhận host bigbike.vn/
// www.bigbike.vn, hoặc localhost/127.0.0.1 khi profile dev (AdminMutationValidators.validatePublicUrl)
// — một IP dev/staging bất kỳ sẽ luôn bị 400 seo.canonicalUrl. Nên tự xét host của biến env trước:
// chỉ dùng khi nó thật sự là localhost/127.0.0.1, còn lại luôn fallback về domain production.
function resolveProductStorefrontBase() {
  const raw = import.meta.env.VITE_STOREFRONT_BASE_URL
  if (raw) {
    try {
      const host = new URL(raw).hostname
      if (host === 'localhost' || host === '127.0.0.1') {
        return `${raw.replace(/\/$/, '')}/product`
      }
    } catch {
      // raw không parse được thành URL hợp lệ -> rơi xuống fallback production bên dưới.
    }
  }
  return 'https://bigbike.vn/product'
}
const PRODUCT_STOREFRONT_BASE = resolveProductStorefrontBase()

// URL canonical tự sinh từ slug. null khi chưa có slug.
// Dấu "/" cuối khớp với route web (next.config trailingSlash:true → /product/{slug}/).
// Luôn dùng slug tiếng Việt (bản canonical theo PRODUCT_RULE_001) bất kể admin đang xem VI hay EN;
// bản tiếng Anh được web khai báo qua hreflang alternate (slugEn), không phải qua canonical.
export function canonicalUrlFromSlug(slug) {
  const s = (slug || '').trim()
  return s ? `${PRODUCT_STOREFRONT_BASE}/${s}/` : null
}

// Matches YouTube IDs across watch, share, embed, and shorts URLs.
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

// Matches TikTok numeric video IDs (full links only; vt./vm. short links unsupported).
export function extractTikTokId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|video\/|v\/|embed\/v2\/|embed\/)(\d{6,30})/)
  return m ? m[1] : null
}

// Facebook video: nhúng cả link gốc (fb.watch rút gọn không hỗ trợ).
export function isFacebookVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:[^?#]*\/videos\/|reel\/|watch\/?(?:\?|$)|[^?#]*video\.php)/i.test(url)
}

export function inferVideoType(url, provider) {
  if (provider === 'youtube' || provider === 'tiktok' || provider === 'facebook' || provider === 'upload') return provider
  if (extractYouTubeId(url)) return 'youtube'
  if (extractTikTokId(url)) return 'tiktok'
  if (isFacebookVideoUrl(url)) return 'facebook'
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
// Publish-status transition rules are shared with Content (identical rule set) — see
// lib/contentPublishTransitions.js, which mirrors AdminMutationValidators.validatePublishTransition.
export { allowedPublishOptions as getAllowedPublishStatuses } from '../../lib/contentPublishTransitions'

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

export function getPublishReadiness(form, t) {
  // Publish gate (PRODUCT_RULE_005, viết lại 2026-07-07): name/slug/category/brand/gender/ảnh
  // bắt buộc ở mọi lần đăng, tạo mới lẫn sửa như nhau (không còn phân biệt isCreate). SKU/giá
  // niêm yết cấp sản phẩm chỉ bắt buộc khi KHÔNG có biến thể; khi có biến thể, mỗi biến thể
  // CÓ MÀU phải có ảnh đại diện màu riêng (biến thể không màu, vd chỉ có Size, không cần —
  // sửa 2026-07-11). Mô tả ngắn/mô tả chi tiết/FAQ/ô số liệu/dải tin cậy
  // không bao giờ bắt buộc — chỉ là nhắc nhở (required:false), không chặn đăng.
  const hasVariants = (form.variants || []).some((v) => v.name?.trim())
  const realVariants = (form.variants || []).filter((v) => v.name?.trim())

  const items = [
    { id: 'name',      label: t('products.detail.checklist.name'),      ok: Boolean(form.name?.trim()),                                             required: true  },
    { id: 'slug',      label: t('products.detail.checklist.slug', { defaultValue: 'Đường dẫn (slug)' }), ok: Boolean(form.slug?.trim()),                required: true  },
    { id: 'category',  label: t('products.detail.checklist.category'),  ok: Boolean(form.categoryId),                                               required: true  },
    { id: 'brand',     label: t('products.detail.checklist.brand'),     ok: Boolean(form.brandId),                                                  required: true  },
    { id: 'gender',    label: t('products.detail.checklist.gender', { defaultValue: 'Đối tượng' }), ok: Boolean(form.gender?.trim()),                required: true  },
    { id: 'image',     label: t('products.detail.checklist.image'),     ok: Boolean(form.imageUrl?.trim()),                                         required: true  },
    // SKU cấp sản phẩm: luôn luôn bắt buộc.
    { id: 'sku',       label: t('products.detail.checklist.sku', { defaultValue: 'Mã SKU' }), ok: Boolean(form.sku?.trim()),          required: true },
    { id: 'price',     label: t('products.detail.checklist.price'),     ok: hasVariants || (Boolean(form.retailPrice?.trim()) && Number(form.retailPrice) > 0), required: true },
    // Ảnh đại diện màu: chỉ bắt buộc cho biến thể CÓ màu (sửa 2026-07-11); biến thể không màu
    // (vd chỉ có Size) không có ô ảnh trên form nên không tính vào gate đăng bán.
    { id: 'variantImages', label: t('products.detail.checklist.variantImages', { defaultValue: 'Ảnh đại diện màu (từng biến thể)' }), ok: realVariants.filter((v) => getVariantColorValue(v)).every((v) => Boolean(v.imageUrl?.trim())), required: realVariants.some((v) => getVariantColorValue(v)) },
    // Nhắc nhở (không chặn đăng): các phần điền vào thì trang sản phẩm đầy đủ & đẹp hơn.
    // Điều kiện `ok` mirror đúng bộ lọc trong toPayload để khớp cái thực sự được lưu.
    { id: 'shortDesc', label: t('products.detail.checklist.shortDesc'), ok: Boolean(form.shortDescription?.trim()),                                 required: false },
    { id: 'desc',      label: t('products.detail.checklist.desc'),      ok: (Array.isArray(form.descriptionBlocks) ? form.descriptionBlocks.length > 0 : (form.description?.trim().length ?? 0) > 0),  required: false },
    { id: 'specStats',     label: t('products.detail.checklist.specStats'),     ok: Boolean((form.specStats || '').trim()),                                                                 required: false },
    { id: 'faqs',          label: t('products.detail.checklist.faqs'),          ok: (form.faqs || []).some((f) => f.question?.trim() && f.answer?.trim()),                                     required: false },
    { id: 'trustBadges',   label: t('products.detail.checklist.trustBadges', { defaultValue: 'Dải tin cậy' }), ok: Boolean((form.trustBadges || '').trim()),                                       required: false },
    { id: 'seoTitle',      label: t('products.detail.checklist.seoTitle'),      ok: Boolean(form.seoTitle?.trim()),           required: false },
    { id: 'seoDesc',       label: t('products.detail.checklist.seoDesc'),       ok: Boolean(form.seoDescription?.trim()),     required: false },
    { id: 'seoCanonical',  label: t('products.detail.checklist.seoCanonical'),  ok: Boolean(form.slug?.trim()),    required: false },
    { id: 'gallery',       label: t('products.detail.checklist.gallery'),       ok: (form.gallery || []).some((img) => img.url?.trim()),                                                       required: false },
    { id: 'prosCons',      label: t('products.detail.checklist.prosCons'),      ok: (form.positiveNotes || []).some((h) => (h.content || '').trim()) || (form.negativeNotes || []).some((h) => (h.content || '').trim()), required: false },
    { id: 'suitability',   label: t('products.detail.checklist.suitability'),   ok: Boolean((form.suitabilitySection?.html || '').trim() || (form.suitabilitySection?.cards || []).some(suitabilityCardHasContent)),    required: false },
    { id: 'specifications',label: t('products.detail.checklist.specifications'),ok: Boolean((form.specifications || '').trim()),                                                            required: false },
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
  const imageByColor = new Map()

  variants.forEach((variant) => {
    const colorKey = getVariantColorKey(variant)
    if (!colorKey) return
    if (hasGalleryImages(variant.gallery) && !galleryByColor.has(colorKey)) {
      galleryByColor.set(colorKey, cloneGallery(variant.gallery))
    }
    if (variant.imageUrl && !imageByColor.has(colorKey)) {
      imageByColor.set(colorKey, {
        imageUrl: variant.imageUrl,
        imageAlt: variant.imageAlt,
        imageWidth: variant.imageWidth,
        imageHeight: variant.imageHeight,
        imageMimeType: variant.imageMimeType,
      })
    }
  })

  return variants.map((variant) => {
    const colorKey = getVariantColorKey(variant)
    const gallery = colorKey ? galleryByColor.get(colorKey) || [] : []
    const imageFields = (colorKey && imageByColor.get(colorKey)) || {
      imageUrl: '',
      imageAlt: '',
      imageWidth: null,
      imageHeight: null,
      imageMimeType: null,
    }
    return { ...variant, gallery: cloneGallery(gallery), ...imageFields }
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
    brandId: '',
    categoryId: '',
    retailPrice: '',
    salePrice: '',
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
    // Chế độ "Dán mã HTML" cho khối Thông số kỹ thuật (V255) — bản vi; bản en ở translations.en.
    specifications: '',
    // "Dán mã HTML" cho khối Ô số liệu nổi bật (V256) — bản vi; bản en ở translations.en.
    specStats: '',
    // "Dán mã HTML" cho khối Dải tin cậy (V257) — bản vi; bản en ở translations.en.
    trustBadges: '',
    // "Quick Answer" (trả lời nhanh, V300) — bản vi; bản en ở translations.en.
    quickAnswerSummary: '',
    faqs: [],
    // Khối cam kết dưới nút mua hàng (V232) — admin quản theo từng sản phẩm.
    commitments: [],
    // Template SEO fields (V175).
    positiveNotes: [],
    negativeNotes: [],
    originBrandCountry: '',
    // "Phù hợp với ai" / "Bảng size" (V240/V246, tách khỏi descriptionBlocks ở V327/V328) — 2 field
    // riêng, object đơn (null khi chưa nhập). Xem SuitabilityBlockEditor/SizeGuideBlockEditor.
    suitabilitySection: null,
    sizeGuideSection: null,
    gender: '',
    variants: [],
    relatedProductIds: [],
    relatedProductChips: [],
    accessoryProductIds: [],
    accessoryProductChips: [],
    // English content (V136), entered manually. Vietnamese above stays canonical.
    translations: { en: buildEmptyTranslation() },
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
    specifications: '',
    specStats: '',
    trustBadges: '',
    quickAnswerSummary: '',
    seoTitle: '',
    seoDescription: '',
    originBrandCountry: '',
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

// Map id → đường dẫn đầy đủ "Cha › Con › Cháu" cho ô chọn danh mục nhiều cấp.
// Đi ngược theo parentId tới gốc; `seen` chặn vòng lặp parentId hỏng (dừng ở tên
// hiện tại). Mục thiếu parentId / không tìm thấy cha → chỉ hiện tên của chính nó.
export function buildCategoryPathMap(items, separator = ' › ') {
  const byId = new Map()
  for (const it of items) {
    if (it?.id) byId.set(it.id, it)
  }
  const cache = new Map()
  const pathFor = (id, seen) => {
    if (!id || !byId.has(id)) return ''
    if (cache.has(id)) return cache.get(id)
    const node = byId.get(id)
    let full = node.name
    if (node.parentId && !seen.has(id)) {
      seen.add(id)
      const parentPath = pathFor(node.parentId, seen)
      if (parentPath) full = `${parentPath}${separator}${node.name}`
    }
    cache.set(id, full)
    return full
  }
  const result = new Map()
  for (const it of items) {
    if (it?.id) result.set(it.id, pathFor(it.id, new Set()))
  }
  return result
}

// Sắp danh mục theo thứ tự cây (depth-first): con nằm ngay dưới cha, kèm `depth`
// để thụt lề trong ô chọn. Mục thiếu parentId hoặc không tìm thấy cha được coi là
// gốc; `seen` chặn vòng lặp parentId hỏng. Giữ nguyên thứ tự đầu vào trong mỗi cấp.
export function buildCategoryTreeOrder(items) {
  const byId = new Map()
  for (const it of items) {
    if (it?.id) byId.set(it.id, it)
  }
  const childrenByParent = new Map()
  const roots = []
  for (const it of items) {
    if (!it?.id) continue
    const hasParent = it.parentId && it.parentId !== it.id && byId.has(it.parentId)
    if (hasParent) {
      if (!childrenByParent.has(it.parentId)) childrenByParent.set(it.parentId, [])
      childrenByParent.get(it.parentId).push(it)
    } else {
      roots.push(it)
    }
  }
  const result = []
  const seen = new Set()
  const visit = (node, depth) => {
    if (seen.has(node.id)) return
    seen.add(node.id)
    result.push({ ...node, depth })
    for (const kid of childrenByParent.get(node.id) || []) visit(kid, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  // Phòng mục còn sót do vòng lặp parentId: append như gốc.
  for (const it of items) {
    if (it?.id && !seen.has(it.id)) visit(it, 0)
  }
  return result
}

export function buildFormFromItem(item) {
  if (!item) return buildEmptyForm()

  const variants = withColorScopedMedia((item.variants || []).map((v) => ({
    _key: v.id || generateId(),
    id: v.id || '',
    sku: v.sku || '',
    name: v.name || '',
    retailPrice:
      Number.isInteger(v.price?.retailPrice) && v.price.retailPrice >= 0
        ? String(v.price.retailPrice)
        : '',
    salePrice:
      Number.isInteger(v.price?.salePrice) && v.price.salePrice > 0
        ? String(v.price.salePrice)
        : '',
    isAvailable: v.isAvailable !== false,
    options: (v.options || []).map((o) => ({
      _key: generateId(),
      name: o.name || '',
      value: o.value || '',
      attributeValueId: o.attributeValueId || null,
    })),
    gallery: (v.gallery || []).map((img) => ({ _key: generateId(), mediaType: img.mediaType || 'image', url: img.rawUrl || img.url || '', alt: img.alt || '', videoUrl: img.videoUrl || '', provider: img.provider || 'youtube' })),
    imageUrl: v.image?.url || '',
    imageAlt: v.image?.alt || '',
    imageWidth: v.image?.width || null,
    imageHeight: v.image?.height || null,
    imageMimeType: v.image?.mimeType || null,
  })))

  const form = {
    sku: item.sku || '',
    slug: item.slug || '',
    name: item.name || '',
    shortDescription: item.shortDescription || '',
    // Thông số kỹ thuật — html là nguồn render duy nhất (backend không còn nhận/trả bảng
    // `specifications` có cấu trúc kiểu cũ, đã xoá ở product_specifications/V329/V330).
    specifications: item.specifications || '',
    // Ô số liệu nổi bật — html là nguồn render duy nhất (V256; backend không còn nhận/trả lưới
    // `specStats` có cấu trúc kiểu cũ, đã xoá ở product_spec_stats/V329/V330).
    specStats: item.specStats || '',
    // Dải tin cậy — html là nguồn render duy nhất (V257; backend không còn nhận/trả dải
    // `trustBadges` có cấu trúc kiểu cũ, đã xoá ở product_trust_badges/V329/V330).
    trustBadges: item.trustBadges || '',
    // "Quick Answer" (trả lời nhanh, V300) — bản vi; bản en ở translations.en (auto qua translationFormFromItem).
    quickAnswerSummary: item.quickAnswerSummary || '',
    description: item.description || '',
    // Nạp lại _key cho từng khối (đã bị strip khi lưu) — thiếu _key thì kéo-thả sắp xếp chết.
    // V326: mỗi khối đã mang sẵn cả 2 ngôn ngữ (field *En) — không còn mảng EN riêng.
    descriptionBlocks: hydrateBlockKeys(item.descriptionBlocks),
    suitabilitySection: hydrateSuitabilitySection(item.suitabilitySection),
    sizeGuideSection: hydrateSizeGuideSection(item.sizeGuideSection),
    brandId: item.brandId || item.brand?.id || '',
    categoryId: item.categoryId || item.category?.id || item.categories?.[0]?.id || '',
    retailPrice:
      Number.isInteger(item.price?.retailPrice) && item.price.retailPrice >= 0
        ? String(item.price.retailPrice)
        : '',
    salePrice:
      Number.isInteger(item.price?.salePrice) && item.price.salePrice > 0
        ? String(item.price.salePrice)
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

// Nạp lại _key (mã tracking client-only, bị strip khi lưu) cho khối mô tả khi mở sản phẩm:
// thiếu _key thì SortableList không nhận diện được khối → kéo-thả sắp xếp chết. Đối xứng với
// cleanDescriptionBlocks (chiều ngược lại). Trả null khi không phải mảng để giữ ngữ nghĩa
// "chưa có khối / dùng HTML legacy".
function hydrateBlockKeys(blocks) {
  if (!Array.isArray(blocks)) return null
  return blocks.map((b) => (b._key ? b : { ...b, _key: generateId() }))
}

// Nạp lại _key cho field suitabilitySection (object đơn, không phải mảng — V327/V328) khi mở sản
// phẩm. Dữ liệu cũ chỉ có `cards` → sinh `html` để không mất nội dung khi web chuyển sang
// render-theo-html (đối xứng với cleanSuitabilitySection, chiều ngược lại).
function hydrateSuitabilitySection(section) {
  if (!section || typeof section !== 'object') return null
  const withKey = section._key ? section : { ...section, _key: generateId() }
  if (!(withKey.html ?? '').trim() && Array.isArray(withKey.cards)) {
    return { ...withKey, html: serializeSuitabilityCards(withKey.cards) }
  }
  return withKey
}

// Nạp lại _key cho field sizeGuideSection (object đơn — V327/V328) khi mở sản phẩm.
function hydrateSizeGuideSection(section) {
  if (!section || typeof section !== 'object') return null
  return section._key ? section : { ...section, _key: generateId() }
}

// Lọc + dọn khối mô tả trước khi gửi: bỏ khối rỗng (sẽ fail @NotBlank ở backend) và
// strip _key (chỉ dùng tracking ở frontend). 1 mảng duy nhất mang cả 2 ngôn ngữ (V326) — khối được
// coi là "có nội dung" nếu VI HOẶC field *En có chữ (tránh rớt khối chỉ mới dịch xong, chưa có VI).
export function cleanDescriptionBlocks(blocks) {
  return blocks
    .filter((b) => {
      switch (b.type) {
        case 'heading':   return (b.text ?? '').trim().length > 0 || (b.textEn ?? '').trim().length > 0
        case 'paragraph': return (b.html ?? '').trim().length > 0 || (b.htmlEn ?? '').trim().length > 0
        case 'list':      return (b.items ?? []).some((it) => (it ?? '').trim().length > 0)
          || (b.itemsEn ?? []).some((it) => (it ?? '').trim().length > 0)
        case 'image':     return (b.url ?? '').trim().length > 0
        case 'video':     return (b.url ?? '').trim().length > 0
        case 'callout':   return (b.html ?? '').trim().length > 0 || (b.htmlEn ?? '').trim().length > 0
        case 'feature': {
          const hasImage = (b.url ?? '').trim().length > 0
          const hasText = (b.subheading ?? '').trim().length > 0
            || (b.subheadingEn ?? '').trim().length > 0
            || (b.heading ?? '').trim().length > 0
            || (b.headingEn ?? '').trim().length > 0
            || (b.html ?? '').trim().length > 0
            || (b.htmlEn ?? '').trim().length > 0
            || (b.items ?? []).some((it) => (it ?? '').trim().length > 0)
            || (b.itemsEn ?? []).some((it) => (it ?? '').trim().length > 0)
          return hasImage || hasText
        }
        default:          return true
      }
    })
    .map(({ _key, ...rest }) => {
      // Khối image: bỏ alt text
      if (rest.type === 'image') {
        const { alt: _alt, ...keep } = rest
        return keep
      }
      // Khối feature: bỏ alt text và bỏ các dòng danh sách rỗng để không gửi item trắng xuống backend.
      if (rest.type === 'feature') {
        const { alt: _alt, ...keep } = rest
        if (Array.isArray(keep.items)) {
          return { ...keep, items: keep.items.filter((it) => (it ?? '').trim().length > 0) }
        }
        return keep
      }
      return rest
    })
}

// Dọn form.suitabilitySection trước khi gửi (V327/V328, tách khỏi descriptionBlocks — đối xứng với
// cleanDescriptionBlocks nhưng áp dụng cho 1 object đơn, không phải mảng). Rỗng → null (backend clear
// field). html là nguồn DUY NHẤT được lưu; nếu thiếu html (dữ liệu cũ chỉ có cards) thì sinh từ cards.
export function cleanSuitabilitySection(section) {
  if (!section) return null
  const hasContent = (section.html ?? '').trim().length > 0
    || (section.htmlEn ?? '').trim().length > 0
    || (section.cards ?? []).some(suitabilityCardHasContent)
  if (!hasContent) return null
  const { _key, cards: _cards, ...rest } = section
  const html = (rest.html ?? '').trim() || serializeSuitabilityCards(section.cards)
  return { ...rest, html }
}

// Dọn form.sizeGuideSection trước khi gửi (V327/V328). Rỗng → null.
export function cleanSizeGuideSection(section) {
  if (!section) return null
  const hasContent = (section.html ?? '').trim().length > 0 || (section.htmlEn ?? '').trim().length > 0
  if (!hasContent) return null
  const { _key, ...rest } = section
  return rest
}

// (V327/V328) parseSuitabilityCards(viRaw, enRaw)/safeJsonArray đã gỡ — parser JSON cũ của cột dormant
// `suitability_advisory` (tiền-V240), chỉ dùng để nạp ghost field form.suitabilityCards (đã gỡ, không
// ai đọc). "Phù hợp với ai" giờ nhập qua form.suitabilitySection (xem hydrateSuitabilitySection).
// (V246) serializeSuitabilityCards đã gỡ — "Phù hợp với ai" giờ nhập qua KHỐI suitability trong mô tả.
// (2026-06-22) "Hiển thị trên web" đã GỠ (SECTION_VISIBILITY_KEYS + sectionHasContent + parse/resolveSectionVisibilityForm):
// 5 phần PDP giờ hiện thuần theo nội dung, không còn bật/tắt từng phần. Cột section_visibility
// đã DROP khỏi DB 2026-07-07 (V325__drop_dead_product_fields.sql) — không còn tồn tại, kể cả ngủ yên.

export function toPayload(form) {
  // Canonical luôn tự sinh từ slug — không lấy từ ô nhập tay nữa.
  const canonicalUrl = canonicalUrlFromSlug(form.slug)

  const hasSeo =
    form.seoTitle.trim() ||
    form.seoDescription.trim() ||
    canonicalUrl ||
    form.seoOgImageUrl.trim() ||
    form.seoOgImageAlt.trim()

  // Ưu/Nhược điểm: không còn gửi từ ô nhập riêng — admin nhập qua card riêng, lưu vào
  // positiveNotes/negativeNotes. Phù hợp với ai/Bảng size (V327/V328): field riêng suitabilitySection/
  // sizeGuideSection, gửi bên dưới (không còn qua khối trong descriptionBlocks).

  const payload = {
    sku: form.sku.trim() || null,
    slug: form.slug.trim(),
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim() || undefined,
    // V255: luôn gửi key (null khi rỗng) để presence-flag backend xoá được HTML khi quay về tab cấu trúc.
    specifications: form.specifications?.trim() || null,
    // V256: Ô số liệu nổi bật — html là nguồn render web; luôn gửi key (null khi rỗng).
    specStats: form.specStats?.trim() || null,
    // V257: Dải tin cậy — html là nguồn render web; luôn gửi key (null khi rỗng).
    trustBadges: form.trustBadges?.trim() || null,
    // V300: Quick Answer — presence-flag, luôn gửi key (null khi rỗng).
    quickAnswerSummary: form.quickAnswerSummary?.trim() || null,
    description: Array.isArray(form.descriptionBlocks) ? undefined : (form.description.trim() || undefined),
    // Template SEO scalars (V175). Null khi cleared (presence-flag).
    originBrandCountry: form.originBrandCountry.trim() ? form.originBrandCountry.trim() : null,
    gender: form.gender.trim() ? form.gender.trim() : null,
    brandId: form.brandId.trim() || undefined,
    categoryId: form.categoryId.trim(),
    // Send null when cleared so backend (presence-flag logic) can distinguish
    // "user erased this" from "field not part of this request".
    retailPrice: toIntegerOrNull(form.retailPrice),
    salePrice: toIntegerOrNull(form.salePrice),
    currency: 'VND',
    forceOutOfStock: Boolean(form.forceOutOfStock),
    publishStatus: form.publishStatus,
    seo: hasSeo
      ? {
          title: form.seoTitle.trim() || null,
          description: form.seoDescription.trim() || null,
          canonicalUrl,
          ogImage: form.seoOgImageUrl.trim()
            ? { url: form.seoOgImageUrl.trim() }
            : null,
        }
      : null,
    // Always include image — null signals "clear the primary image".
    image: form.imageUrl.trim()
      ? { url: form.imageUrl.trim() }
      : null,
    // English content (V136), entered manually. Always sent so the backend full-replaces
    // the English columns; empty fields clear them — except `name`, which is required
    // (TRANSLATION_RULE_002, validated client-side by createProductSchema too).
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
            sortOrder: i,
          }
        : { mediaType: 'image', url: img.url.trim(), sortOrder: i }
    ))

  payload.videos = form.videos
    .filter((v) => v.url.trim())
    .map((v, i) => ({
      url: v.url.trim(),
      title: v.title.trim() || undefined,
      description: (v.description || '').trim() || undefined,
      provider: v.type === 'upload' ? 'upload' : v.type === 'tiktok' ? 'tiktok' : v.type === 'facebook' ? 'facebook' : 'youtube',
      thumbnailUrl: v.type === 'upload' ? (v.thumbnailUrl?.trim() || undefined) : undefined,
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

  // Ưu/Nhược điểm (V251): khối RIÊNG cố định dưới mô tả — nhập ở card riêng, lưu vào bảng con
  // product_highlights. Full-replace mỗi nhóm; mục content blank bị bỏ (backend @NotBlank).
  // Wire gộp thành 1 field lồng `highlights` (2026-07-07) — form vẫn giữ 2 field phẳng.
  payload.highlights = {
    positiveNotes: form.positiveNotes
      .filter((h) => (h.content || '').trim())
      .map((h, i) => ({
        content: h.content.trim(),
        contentEn: (h.contentEn || '').trim() || undefined,
        sortOrder: i,
      })),
    negativeNotes: form.negativeNotes
      .filter((h) => (h.content || '').trim())
      .map((h, i) => ({
        content: h.content.trim(),
        contentEn: (h.contentEn || '').trim() || undefined,
        sortOrder: i,
      })),
  }

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
  // suitabilitySection / sizeGuideSection (V327/V328) — field riêng, luôn gửi key (null khi rỗng)
  // giống pattern specifications, không phải pattern điều kiện của descriptionBlocks.
  payload.suitabilitySection = cleanSuitabilitySection(form.suitabilitySection)
  payload.sizeGuideSection = cleanSizeGuideSection(form.sizeGuideSection)
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
              sortOrder: j,
            }
          : { mediaType: 'image', url: img.url.trim(), sortOrder: j }
      ))

    const shouldSendGallery = Boolean(colorKey && gallery.length > 0 && !emittedGalleryColors.has(colorKey))
    if (shouldSendGallery) emittedGalleryColors.add(colorKey)

    return {
      id: v.id || undefined,
      sku: v.sku.trim() || undefined,
      name: v.name.trim(),
      // Variant price is authoritative once the product has variants (2026-07-06) — always
      // send the key (null when cleared) so the backend presence-flag can tell "cleared" from
      // "not sent" (mirrors the product-level retailPrice/salePrice above).
      retailPrice: toIntegerOrNull(v.retailPrice),
      salePrice: toIntegerOrNull(v.salePrice),
      // Representation image (ảnh đại diện màu) is a separate variant field, scoped per-color.
      imageUrl: v.imageUrl?.trim() || undefined,
      imageWidth: v.imageWidth ?? undefined,
      imageHeight: v.imageHeight ?? undefined,
      imageMimeType: v.imageMimeType ?? undefined,
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
  { id: 'section-trust-badges',   key: 'trustBadges',   icon: 'BadgeCheck', labelKey: 'products.detail.sectionTrustBadges',    required: false },
  { id: 'section-variants',       key: 'variants',      icon: 'Layers',     labelKey: 'products.detail.variantSectionTitle',   required: false },
  { id: 'section-related',        key: 'related',       icon: 'Link2',      labelKey: 'products.detail.sectionRelated',        required: false },
  { id: 'section-accessories',    key: 'accessories',   icon: 'PlusCircle', labelKey: 'products.detail.sectionAccessories',    required: false },
]

// Two tabs only: everything product-related on one page (split into collapsible
// groups below), with SEO on its own tab so the SEO-role workflow stays separate.
// Keys must match SECTION_DEFS keys; drives the per-tab error badge + findTabForErrors.
export const TAB_SECTIONS = {
  product: ['basic', 'description', 'highlights', 'pricing', 'media', 'variants', 'gallery', 'videos', 'specs', 'specStats', 'faqs', 'commitments', 'trustBadges', 'related', 'accessories'],
  seo:     ['seo'],
}

// Within the "product" tab the sections are split into 3 collapsible groups that
// mirror the storefront product-page flow (the owner's "thứ tự đầy đủ trang sản phẩm"
// reference): `buyArea` = đầu trang (ảnh/giá/biến thể/cam kết/ô số liệu), `body` = thân
// trang (mô tả → ưu-nhược → tương tự → phù hợp → bảng size → thông số → FAQ → video),
// `closing` = cuối trang (bán kèm). Field originBrandCountry ("Thương hiệu (nước)") vẫn
// hiển thị trong khối "Mua tại BigBike.vn" cuối trang PDP, nhưng NHẬP LIỆU admin đã
// chuyển lên card "Thông tin cơ bản" (cạnh Thương hiệu) cho tiện gõ khi tạo SP mới —
// form KHÔNG còn mirror 1:1 vị trí hiển thị của field này.
// `buyArea` (required) opens by default; the two optional groups start collapsed.
// Keys/order mirror the render order in ProductDetailScreen (canonical PDP order §0b).
export const PRODUCT_GROUPS = {
  buyArea: ['basic', 'media', 'gallery', 'trustBadges', 'pricing', 'variants', 'commitments', 'specStats'],
  body:    ['description', 'highlights', 'related', 'specs', 'faqs', 'videos'],
  closing: ['accessories'],
}

// First group (top-down) containing any failing section — used to auto-expand the
// right group when validation fails on save.
export function findGroupForErrors(sectionErrors) {
  for (const [group, keys] of Object.entries(PRODUCT_GROUPS)) {
    if (keys.some((k) => sectionErrors[k])) return group
  }
  return null
}

// Phát hiện biến thể lệch bộ thuộc tính. Mọi biến thể của một sản phẩm nên khai
// CÙNG tập thuộc tính: web gộp tất cả thuộc tính của mọi biến thể lại rồi bắt khách
// chọn đủ, nên biến thể thiếu — hoặc DƯ so với phần còn lại — dễ thành hàng không
// bán được. Tính theo tên thuộc tính có cả tên LẪN giá trị (khớp cách web bỏ qua
// giá trị trống). Trả về null khi mọi biến thể đồng nhất (hoặc chưa khai gì).
export function computeAttrSetWarning(items, t) {
  const sets = items.map((v) =>
    new Set(
      (v.options ?? [])
        .filter((o) => (o.name ?? '').trim() && (o.value ?? '').trim())
        .map((o) => o.name.trim()),
    ),
  )
  const union = new Set()
  sets.forEach((s) => s.forEach((n) => union.add(n)))
  if (union.size === 0) return null

  const offenders = []
  items.forEach((v, idx) => {
    const s = sets[idx]
    if (s.size === 0) return // biến thể chưa khai thuộc tính nào (đang nhập) — bỏ qua
    const missing = [...union].filter((n) => !s.has(n))
    if (missing.length > 0) {
      offenders.push({
        index: idx + 1,
        name:
          (v.name ?? '').trim() ||
          t('products.detail.variant.defaultLabel', { index: idx + 1 }),
        missing: missing.join(', '),
      })
    }
  })
  if (offenders.length === 0) return null
  return { attrs: [...union].join(', '), offenders }
}

// Field-prefix groups by section key — single source of truth used by both the
// in-render sectionErrors derivation and the synchronous save-time tab switch.
export const SECTION_FIELD_PREFIXES = {
  basic:         ['name','slug','sku','gender','shortDescription','brandId','categoryId','publishStatus'],
  description:   ['description'],
  pricing:       ['retailPrice','salePrice'],
  media:         ['imageUrl'],
  seo:           ['seoTitle','seoDescription','seoCanonicalUrl','seoOgImageUrl','seoOgImageAlt'],
  gallery:       ['gallery'],
  videos:        ['videos'],
  // Khoá bên trái = section key (tên tab); mảng bên phải = tên field thực trong form/payload —
  // sau khi bỏ hậu tố "Html", specStats/trustBadges trùng chữ với section key của chính chúng.
  specs:         ['specifications'],
  specStats:     ['specStats'],
  faqs:          ['faqs'],
  commitments:   ['commitments'],
  highlights:    ['positiveNotes', 'negativeNotes'],
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

export const SPEC_STAT_MAX = 4

export const VARIANTS_FILTER_THRESHOLD = 6

// Ngưỡng render ban đầu + kích thước mỗi lô "Hiện thêm" cho danh sách biến thể (A7).
// Một số sản phẩm thật có 100+ biến thể — render hết toàn bộ thẻ (kể cả nhánh đã lọc)
// cùng lúc làm DOM nặng dù accordion đã đóng bớt (mỗi thẻ vẫn có input/select ẩn bên
// trong). Chỉ render N dòng đầu; phần còn lại mở dần theo lô khi bấm "Hiện thêm".
export const VARIANTS_RENDER_CAP = 50
