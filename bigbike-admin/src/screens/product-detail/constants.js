// Constants and pure helper functions for ProductDetailScreen.
// Extracted from ProductDetailScreen.jsx to keep the screen file focused on behaviour
// and to satisfy react-refresh (non-component exports must live in a .js file).

import { createContext } from 'react'
import { serializeSuitabilityCards, suitabilityCardHasContent } from '../../lib/suitabilityCards'
import { normalizeVariantToken, isColorAttributeName } from '../../lib/schemas'
import { extractAllowedYouTubeId, isAllowedMediaVideoUrl } from '../../lib/urlPolicies'
import { generateId } from '@/lib/utils'
import { normalizeGenders } from '../../lib/contracts'

// Editable "Phân công" guide text (role names + task lists), fetched from
// GET /admin/product-assignment. SUPER_ADMIN edits it in Cài đặt → Phân công sản phẩm.
// Components read this via context and fall back to the i18n defaults if empty/unloaded.
export const AssignmentConfigContext = createContext(null)
export const SYSTEM_CATEGORY_ID = 'uncategorized'
export const SYSTEM_BRAND_ID = 'uncategorized-brand'

function isWritableVideoInput(provider, url) {
  const normalizedUrl = (url || '').trim()
  if (provider === 'youtube') return Boolean(extractAllowedYouTubeId(normalizedUrl))
  if (provider === 'upload') return isAllowedMediaVideoUrl(normalizedUrl)
  return false
}

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

// URL bản tiếng Anh của trang chi tiết. Theo PRODUCT_RULE_003 (chuẩn hoá 2026-08-03) trang EN
// LUÔN tồn tại tại /en/product/{slugEn hoặc slug}/ — slugEn trống chỉ nghĩa là dùng slug tiếng
// Việt dưới prefix /en, KHÔNG phải "chưa có trang tiếng Anh". null khi chưa có slug nào.
export function englishUrlFromSlugs(slug, slugEn) {
  const s = (slugEn || '').trim() || (slug || '').trim()
  if (!s) return null
  return `${PRODUCT_STOREFRONT_BASE.replace(/\/product$/, '/en/product')}/${s}/`
}

// Matches YouTube IDs across watch, share, embed, and shorts URLs.
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export function inferVideoType(url, provider) {
  if (provider === 'youtube' || provider === 'upload') return provider
  if (provider) return ''
  if (extractYouTubeId(url)) return 'youtube'
  if (isAllowedMediaVideoUrl(url)) return 'upload'
  return url ? '' : 'youtube'
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
  // Publish gate (PRODUCT_RULE_005, cập nhật 2026-08-13): name/slug/category/brand/ảnh
  // bắt buộc ở mọi lần đăng. Gender là tùy chọn; SKU/giá
  // niêm yết cấp sản phẩm chỉ bắt buộc khi KHÔNG có biến thể; khi có biến thể, mỗi biến thể
  // CÓ MÀU phải có ảnh đại diện màu riêng (biến thể không màu, vd chỉ có Size, không cần —
  // sửa 2026-07-11). Mô tả ngắn/mô tả chi tiết/FAQ/ô số liệu/dải tin cậy
  // không bao giờ bắt buộc — chỉ là nhắc nhở (required:false), không chặn đăng.
  const hasVariants = (form.variants || []).some((v) => v.name?.trim())
  const realVariants = (form.variants || []).filter((v) => v.name?.trim())

  const items = [
    { id: 'name',      label: t('products.detail.checklist.name'),      ok: Boolean(form.name?.trim()),                                             required: true  },
    // Tên tiếng Anh bắt buộc (TRANSLATION_RULE_002, schema chặn khi thiếu) — tính vào checklist đăng
    // song song với tên tiếng Việt để lỗi "thiếu tên EN" không còn bị ẩn trong tab EN.
    { id: 'nameEn',    label: t('products.detail.checklist.nameEn', { defaultValue: 'Tên tiếng Anh' }), ok: Boolean(form.translations?.en?.name?.trim()), required: true },
    { id: 'slug',      label: t('products.detail.checklist.slug', { defaultValue: 'Đường dẫn website' }), ok: Boolean(form.slug?.trim()),                required: true  },
    {
      id: 'category',
      label: t('products.detail.checklist.category'),
      ok: Array.isArray(form.categoryIds)
        && form.categoryIds.length > 0
        && form.categoryIds.every((id) => id !== SYSTEM_CATEGORY_ID),
      required: true,
    },
    {
      id: 'brand',
      label: t('products.detail.checklist.brand'),
      ok: Boolean(form.brandId) && form.brandId !== SYSTEM_BRAND_ID,
      required: true,
    },
    { id: 'gender',    label: t('products.detail.checklist.gender', { defaultValue: 'Đối tượng' }), ok: true,                                                    required: false },
    { id: 'image',     label: t('products.detail.checklist.image'),     ok: Boolean(form.imageUrl?.trim()),                                         required: true  },
    // SKU cấp sản phẩm: luôn luôn bắt buộc.
    { id: 'sku',       label: t('products.detail.checklist.sku', { defaultValue: 'Mã sản phẩm' }), ok: Boolean(form.sku?.trim()),          required: true },
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
    // SEO_RULE_002 — bản tiếng Anh chưa đủ nội dung thì trang /en/ không được khai báo
    // với Google dù cờ đang bật. Cảnh báo, KHÔNG chặn đăng bán (required: false).
    { id: 'englishContent', label: t('products.detail.checklist.englishContent', { defaultValue: 'Bản tiếng Anh đủ để hiện trên Google (tên + mô tả)' }), ok: productEnglishReady(form), required: false },
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

// Khi đổi giá trị màu của một biến thể (color-key đổi), quyết định media (ảnh đại diện + gallery)
// mà biến thể mang theo sau khi đổi — KHÔNG xoá trắng ảnh nữa:
//  - Nhóm màu đích ĐÃ có biến thể khác mang media → kế thừa media nhóm đó (đồng nhất theo màu).
//  - Nhóm màu đích CHƯA có media → giữ media hiện có của biến thể, coi là media của nhóm màu mới.
//  - Bỏ hẳn thuộc tính màu (nextColorKey rỗng) → media trống (khớp withColorScopedMedia cho biến thể không màu).
export function resolveColorChangeMedia(current, items, key, nextColorKey) {
  if (!nextColorKey) {
    return { gallery: [], imageUrl: '', imageAlt: '', imageWidth: null, imageHeight: null, imageMimeType: null }
  }
  const siblingGallery = items.find(
    (v) => v._key !== key && getVariantColorKey(v) === nextColorKey && hasGalleryImages(v.gallery),
  )?.gallery
  const siblingImage = items.find(
    (v) => v._key !== key && getVariantColorKey(v) === nextColorKey && v.imageUrl,
  )
  if (siblingGallery || siblingImage) {
    return {
      gallery: cloneGallery(siblingGallery || []),
      imageUrl: siblingImage?.imageUrl || '',
      imageAlt: siblingImage?.imageAlt || '',
      imageWidth: siblingImage?.imageWidth ?? null,
      imageHeight: siblingImage?.imageHeight ?? null,
      imageMimeType: siblingImage?.imageMimeType ?? null,
    }
  }
  return {
    gallery: cloneGallery(current.gallery || []),
    imageUrl: current.imageUrl || '',
    imageAlt: current.imageAlt || '',
    imageWidth: current.imageWidth ?? null,
    imageHeight: current.imageHeight ?? null,
    imageMimeType: current.imageMimeType ?? null,
  }
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
    categoryIds: [],
    // Giữ snapshot để PATCH không gửi lại các liên kết cũ đã bị ẩn/xóa mềm
    // khi quản trị viên chỉ sửa nội dung khác của sản phẩm.
    initialCategoryIds: [],
    retailPrice: '',
    salePrice: '',
    available: true,
    publishStatus: 'DRAFT',
    discontinued: false,
    sizeScaleId: '',
    imageUrl: '',
    imageAlt: '',
    imageWidth: null,
    imageHeight: null,
    imageMimeType: null,
    seoTitle: '',
    seoTitleManuallyEdited: false,
    seoDescription: '',
    seoNoIndex: false,
    seoNoIndexEn: false,
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    seoOgImageWidth: null,
    seoOgImageHeight: null,
    seoOgImageMimeType: null,
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
    genders: [],
    variants: [],
    relatedProductIds: [],
    relatedProductChips: [],
    accessoryProductIds: [],
    accessoryProductChips: [],
    // English content (V136), entered manually. Vietnamese above stays canonical.
    translations: { en: buildEmptyTranslation() },
  }
}

/**
 * Ngưỡng "đủ nội dung tiếng Anh" của SẢN PHẨM — mirror `SeoIndexPolicy.productEnglishReady`
 * ở backend (BUSINESS_RULES `SEO_RULE_002`). Backend mới là nơi quyết định thật; bản này chỉ
 * để màn quản trị báo trước cho người vận hành, tránh cảnh bật ô mà trang vẫn không lên Google.
 *
 * `slug` tiếng Anh CỐ Ý không nằm trong ngưỡng — `PRODUCT_RULE_003` ghi rõ slugEn không phải
 * điều kiện tồn tại trang.
 */
export function productEnglishReady(form) {
  const en = form?.translations?.en || {}
  return Boolean(en.name?.trim() && (en.shortDescription?.trim() || en.description?.trim()))
}

// English product-level content — eight optional translatable text fields.
export function buildEmptyTranslation() {
  return {
    // Optional English URL slug (V214). Bất đối xứng đọc/ghi có chủ đích:
    // ĐỌC từ top-level `slugEn` của response (xem buildFormFromItem), GHI qua
    // `translations.en.slug` của request (ProductTranslationRequest.ProductContentRequest.slug).
    // Form giữ nó trong khối translations.en cho cùng chỗ với các field EN khác.
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

// Map id → đường dẫn cha, không gồm chính danh mục hiện tại.
// Dùng trong dropdown để dòng con chỉ hiện tên ngắn, còn đường dẫn cha nằm ở dòng phụ.
export function buildCategoryParentPathMap(items, separator = ' › ') {
  const byId = new Map()
  for (const it of items) {
    if (it?.id) byId.set(it.id, it)
  }
  const cache = new Map()
  const parentPathFor = (id, seen) => {
    if (!id || !byId.has(id)) return ''
    if (cache.has(id)) return cache.get(id)
    const node = byId.get(id)
    const parentId = node.parentId
    if (!parentId || parentId === id || seen.has(id) || !byId.has(parentId)) {
      cache.set(id, '')
      return ''
    }
    seen.add(id)
    const parent = byId.get(parentId)
    const parentPath = parentPathFor(parent.id, seen)
    const full = parentPath ? `${parentPath}${separator}${parent.name}` : parent.name
    cache.set(id, full)
    return full
  }
  const result = new Map()
  for (const it of items) {
    if (it?.id) result.set(it.id, parentPathFor(it.id, new Set()))
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

export function buildCategoryChildrenSet(items) {
  const ids = new Set((items ?? []).map((item) => item?.id).filter(Boolean))
  const result = new Set()
  for (const item of items ?? []) {
    if (item?.parentId && ids.has(item.parentId)) result.add(item.parentId)
  }
  return result
}

export function buildVisibleCategoryTreeRows(items, expandedIds) {
  const expanded = expandedIds instanceof Set ? expandedIds : new Set(expandedIds ?? [])
  const visible = []
  const openParentIds = new Set()
  for (const node of items ?? []) {
    const isRoot = node.depth === 0
    if (isRoot || (node.parentId && openParentIds.has(node.parentId))) {
      visible.push(node)
      if (expanded.has(node.id)) openParentIds.add(node.id)
    }
  }
  return visible
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
    gallery: (v.gallery || []).map((img) => ({
      _key: generateId(),
      mediaType: img.mediaType || 'image',
      url: img.rawUrl || img.url || '',
      alt: img.alt || '',
      width: img.width ?? null,
      height: img.height ?? null,
      mimeType: img.mimeType ?? null,
      videoUrl: img.videoUrl || '',
      provider: inferVideoType(img.videoUrl || '', img.provider),
    })),
    imageUrl: v.image?.url || '',
    imageAlt: v.image?.alt || '',
    imageWidth: v.image?.width || null,
    imageHeight: v.image?.height || null,
    imageMimeType: v.image?.mimeType || null,
  })))

  const categoryIds = Array.isArray(item.categories) && item.categories.length > 0
    ? item.categories.map((category) => category?.id).filter(Boolean)
    : [item.categoryId || item.category?.id].filter(Boolean)

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
    categoryIds,
    initialCategoryIds: [...categoryIds],
    retailPrice:
      Number.isInteger(item.price?.retailPrice) && item.price.retailPrice >= 0
        ? String(item.price.retailPrice)
        : '',
    salePrice:
      Number.isInteger(item.price?.salePrice) && item.price.salePrice > 0
        ? String(item.price.salePrice)
        : '',
    available: item.available !== false,
    publishStatus: item.publishStatus,
    discontinued: item.discontinued === true,
    sizeScaleId: item.sizeScaleId || '',
    imageUrl: item.image?.rawUrl || item.image?.url || '',
    imageAlt: item.image?.alt || '',
    imageWidth: item.image?.width ?? null,
    imageHeight: item.image?.height ?? null,
    imageMimeType: item.image?.mimeType ?? null,
    seoTitle: item.seo?.title || '',
    seoTitleManuallyEdited: Boolean(item.seo?.title),
    seoDescription: item.seo?.description || '',
    seoNoIndex: Boolean(item.seo?.noIndex),
    seoNoIndexEn: Boolean(item.seo?.noIndexEn),
    seoOgImageUrl: item.seo?.ogImage?.rawUrl || item.seo?.ogImage?.url || '',
    seoOgImageAlt: item.seo?.ogImage?.alt || '',
    seoOgImageWidth: item.seo?.ogImage?.width ?? null,
    seoOgImageHeight: item.seo?.ogImage?.height ?? null,
    seoOgImageMimeType: item.seo?.ogImage?.mimeType ?? null,
    gallery: (item.gallery || []).map((img) => ({
      _key: generateId(),
      mediaType: img.mediaType || 'image',
      url: img.rawUrl || img.url || '',
      alt: img.alt || '',
      width: img.width ?? null,
      height: img.height ?? null,
      mimeType: img.mimeType ?? null,
      videoUrl: img.videoUrl || '',
      provider: inferVideoType(img.videoUrl || '', img.provider),
    })),
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
    genders: normalizeGenders(item.genders, item.gender),
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
        case 'video':     return isWritableVideoInput(b.provider, b.url)
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
      // Khối feature: bỏ các dòng danh sách rỗng để không gửi item trắng xuống backend.
      // Giữ nguyên alt/altEn: đây là metadata SEO/trợ năng thuộc hợp đồng block.
      if (rest.type === 'feature') {
        if (Array.isArray(rest.items)) {
          return {
            ...rest,
            items: rest.items.filter((it) => (it ?? '').trim().length > 0),
            itemsEn: Array.isArray(rest.itemsEn)
              ? rest.itemsEn.filter((it) => (it ?? '').trim().length > 0)
              : rest.itemsEn,
          }
        }
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

export function toPayload(form, { includeCategoryIds = true } = {}) {
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

  const categoryIds = Array.isArray(form.categoryIds)
    ? form.categoryIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []

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
    // Canonical gender shape (DATA_CONTRACT.md): an empty array is valid and
    // intentionally clears both flags on the backend.
    genders: normalizeGenders(form.genders),
    brandId: form.brandId.trim() || undefined,
    // Send null when cleared so backend (presence-flag logic) can distinguish
    // "user erased this" from "field not part of this request".
    retailPrice: toIntegerOrNull(form.retailPrice),
    salePrice: toIntegerOrNull(form.salePrice),
    currency: 'VND',
    available: Boolean(form.available),
    publishStatus: form.publishStatus,
    discontinued: Boolean(form.discontinued),
    sizeScaleId: form.sizeScaleId?.trim() || null,
    seo: hasSeo
      ? {
          title: form.seoTitle.trim() || null,
          description: form.seoDescription.trim() || null,
          // Cờ cho-Google-hiển-thị, tách riêng VI/EN (SEO_RULE_001). Trước V371 hai field
          // này được backend nhận rồi vứt im lặng — API trả 200 mà không lưu gì.
          noIndex: Boolean(form.seoNoIndex),
          noIndexEn: Boolean(form.seoNoIndexEn),
          canonicalUrl,
          ogImage: form.seoOgImageUrl.trim()
            ? {
                url: form.seoOgImageUrl.trim(),
                alt: form.seoOgImageAlt.trim() || null,
                width: form.seoOgImageWidth ?? null,
                height: form.seoOgImageHeight ?? null,
                mimeType: form.seoOgImageMimeType ?? null,
              }
            : null,
        }
      : null,
    // Always include image — null signals "clear the primary image".
    image: form.imageUrl.trim()
      ? {
          url: form.imageUrl.trim(),
          alt: form.imageAlt.trim() || null,
          width: form.imageWidth ?? null,
          height: form.imageHeight ?? null,
          mimeType: form.imageMimeType ?? null,
        }
      : null,
    // English content (V136), entered manually. Always sent so the backend full-replaces
    // the English columns; empty fields clear them — except `name`, which is required
    // (TRANSLATION_RULE_002, validated client-side by createProductSchema too).
    translations: { en: { ...translationToPayload(form.translations?.en) } },
  }

  if (includeCategoryIds) payload.categoryIds = categoryIds

  payload.gallery = form.gallery
    // V248: giữ item có ảnh HOẶC video (gallery hỗn hợp).
    .filter((img) => img.mediaType === 'video'
      ? isWritableVideoInput(img.provider, img.videoUrl)
      : (img.url || '').trim())
    .map((img, i) => (
      img.mediaType === 'video'
        ? {
            mediaType: 'video',
            videoUrl: (img.videoUrl || '').trim(),
            videoProvider: ['youtube', 'upload'].includes(img.provider) ? img.provider : undefined,
            url: (img.url || '').trim() || null,
            alt: (img.alt || '').trim() || null,
            width: img.width ?? null,
            height: img.height ?? null,
            mimeType: img.mimeType ?? null,
            sortOrder: i,
          }
        : {
            mediaType: 'image',
            url: img.url.trim(),
            alt: (img.alt || '').trim() || null,
            width: img.width ?? null,
            height: img.height ?? null,
            mimeType: img.mimeType ?? null,
            sortOrder: i,
          }
    ))

  payload.videos = form.videos
    .filter((v) => isWritableVideoInput(v.type, v.url))
    .map((v, i) => ({
      url: v.url.trim(),
      title: v.title.trim() || undefined,
      description: (v.description || '').trim() || undefined,
      provider: ['youtube', 'upload'].includes(v.type) ? v.type : undefined,
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
      .filter((img) => img.mediaType === 'video'
        ? isWritableVideoInput(img.provider, img.videoUrl)
        : (img.url || '').trim())
      .map((img, j) => (
        img.mediaType === 'video'
          ? {
              mediaType: 'video',
              videoUrl: (img.videoUrl || '').trim(),
              videoProvider: ['youtube', 'upload'].includes(img.provider) ? img.provider : undefined,
              url: (img.url || '').trim() || null,
              alt: (img.alt || '').trim() || null,
              width: img.width ?? null,
              height: img.height ?? null,
              mimeType: img.mimeType ?? null,
              sortOrder: j,
            }
          : {
              mediaType: 'image',
              url: img.url.trim(),
              alt: (img.alt || '').trim() || null,
              width: img.width ?? null,
              height: img.height ?? null,
              mimeType: img.mimeType ?? null,
              sortOrder: j,
            }
      ))

    const shouldSendGallery = Boolean(colorKey && gallery.length > 0 && !emittedGalleryColors.has(colorKey))
    if (shouldSendGallery) emittedGalleryColors.add(colorKey)

    return {
      id: v.id || undefined,
      sku: v.sku.trim() || undefined,
      // Variant price is authoritative once the product has variants (2026-07-06) — always
      // send the key (null when cleared) so the backend presence-flag can tell "cleared" from
      // "not sent" (mirrors the product-level retailPrice/salePrice above).
      retailPrice: toIntegerOrNull(v.retailPrice),
      salePrice: toIntegerOrNull(v.salePrice),
      // Representation image (ảnh đại diện màu) is a separate variant field, scoped per-color.
      imageUrl: v.imageUrl?.trim() || undefined,
      imageAlt: v.imageAlt?.trim() || null,
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

// 2 tab. `main` gộp toàn bộ nội dung sản phẩm theo đúng thứ tự khối hiển thị trên bigbike-web PDP
// (bigbike-web/components/catalog/ProductView.tsx): khu mua hàng (khối #1: tên/giá/ảnh/biến thể/gallery/
// dải tin cậy) → phần thân trang render SAU PurchaseSection theo đúng thứ tự cố định `bodyOrder`
// (ProductView.tsx dòng 258-262) + specStats/quickAnswer: specStats (#2) → quickAnswer (#3) →
// description (#4) → highlights+related (#5) → suitability/sizeGuide (chưa có entry
// SECTION_FIELD_PREFIXES riêng, xem field trong descriptionBuilder) → specs (#8) → faqs (#9) →
// videos (#10) → accessories (#12). `commitments` (cam kết) đặt NGAY SAU trustBadges trong nhóm khu mua
// hàng thay vì theo thứ tự #11 — vì trên web nội dung này render sớm nhất ở PurchaseSection.tsx (khối
// CommitmentsList NGAY DƯỚI nút mua hàng, đầu trang), khối Trust "Mua tại BigBike.vn" cuối trang chỉ lặp
// lại cùng dữ liệu. Form ưu tiên vị trí xuất hiện SỚM NHẤT trên web. `seo` không map vào khối nào trên
// PDP (không hiển thị dạng block riêng). Keys phải khớp SECTION_DEFS keys; drives the per-tab error
// badge + findTabForErrors.
export const TAB_SECTIONS = {
  main: ['basic', 'media', 'pricing', 'variants', 'gallery', 'trustBadges', 'commitments', 'specStats', 'description', 'highlights', 'related', 'specs', 'faqs', 'videos', 'accessories'],
  seo:  ['seo'],
}

// Tab chính ("main") gộp mọi mục nội dung. Form rất dài nên gom thành 3 NHÓM gấp/mở (chống "quá
// nhiều đầu mục" + "quá nhiều field cùng lúc" — audit P0-1). Thứ tự các phần trong nhóm giữ nguyên
// theo thứ tự khối trên PDP web. `sections` = key từng phần (khớp SECTION_FIELD_PREFIXES) để đếm/tự
// bung nhóm khi lưu lỗi. Field originBrandCountry ("Thương hiệu (nước)") hiển thị ở khối "Mua tại
// BigBike.vn" cuối PDP nhưng NHẬP LIỆU nằm ở "Thông tin cơ bản" — form KHÔNG mirror 1:1 vị trí hiển thị.
export const MAIN_SECTION_GROUPS = [
  { id: 'sales',   sections: ['basic', 'media', 'gallery', 'pricing', 'variants', 'trustBadges', 'commitments'] },
  { id: 'content', sections: ['specStats', 'quickAnswer', 'description', 'highlights', 'related', 'suitability', 'sizeGuide', 'specs', 'faqs'] },
  { id: 'extras',  sections: ['videos', 'accessories'] },
]

// Nhóm mở sẵn khi vào trang (nhóm bán hàng cốt lõi); 2 nhóm còn lại thu gọn để form đỡ dài.
export const MAIN_GROUPS_DEFAULT_OPEN = { sales: true }

// Id các nhóm chứa ít nhất một mục đang lỗi — để tự bung nhóm khi lưu lỗi.
export function groupsWithErrors(sectionErrors) {
  return MAIN_SECTION_GROUPS
    .filter((g) => g.sections.some((s) => sectionErrors[s]))
    .map((g) => g.id)
}

// Khóa chuẩn để so bộ thuộc tính giữa các biến thể. Mọi alias màu ("Màu", "Màu sắc",
// "Color", "Colour", mã legacy...) mà isColorAttributeName nhận diện đều quy về CÙNG một
// khóa "__color__" — nhờ vậy biến thể legacy khai "Màu" và biến thể mới khai "màu sắc"
// được coi là cùng một thuộc tính. Thuộc tính khác dùng tên đã normalize làm fallback.
// KHÔNG so theo attributeValueId (mỗi giá trị màu có id riêng) hay theo value (chỉ so LOẠI
// thuộc tính, không so giá trị "Đen"/"Đen bóng"/"Trắng").
export function variantAttributeKey(name) {
  return isColorAttributeName(name) ? '__color__' : normalizeVariantToken(name)
}

// Phát hiện biến thể lệch bộ thuộc tính. Mọi biến thể của một sản phẩm nên khai
// CÙNG tập thuộc tính: web gộp tất cả thuộc tính của mọi biến thể lại rồi bắt khách
// chọn đủ, nên biến thể thiếu — hoặc DƯ so với phần còn lại — dễ thành hàng không
// bán được. So theo KHÓA CHUẨN (variantAttributeKey) của thuộc tính có cả tên LẪN giá trị
// (khớp cách web bỏ qua giá trị trống). Trả về null khi mọi biến thể đồng nhất (hoặc chưa
// khai gì). Thông báo lỗi hiển thị nhãn dễ hiểu (tên gốc gặp đầu tiên cho mỗi khóa).
export function computeAttrSetWarning(items, t) {
  // key chuẩn → nhãn hiển thị (tên gốc đầu tiên gặp cho khóa đó).
  const labelByKey = new Map()
  const sets = items.map((v) =>
    new Set(
      (v.options ?? [])
        .filter((o) => (o.name ?? '').trim() && (o.value ?? '').trim())
        .map((o) => {
          const key = variantAttributeKey(o.name)
          if (!labelByKey.has(key)) labelByKey.set(key, o.name.trim())
          return key
        }),
    ),
  )
  const union = new Set()
  sets.forEach((s) => s.forEach((k) => union.add(k)))
  if (union.size === 0) return null

  const labelFor = (key) => labelByKey.get(key) || key
  const offenders = []
  items.forEach((v, idx) => {
    const s = sets[idx]
    if (s.size === 0) return // biến thể chưa khai thuộc tính nào (đang nhập) — bỏ qua
    const missing = [...union].filter((k) => !s.has(k))
    if (missing.length > 0) {
      offenders.push({
        index: idx + 1,
        name:
          (v.name ?? '').trim() ||
          t('products.detail.variant.defaultLabel', { index: idx + 1 }),
        missing: missing.map(labelFor).join(', '),
      })
    }
  })
  if (offenders.length === 0) return null
  return { attrs: [...union].map(labelFor).join(', '), offenders }
}

// Field-prefix groups by section key — single source of truth used by both the
// in-render sectionErrors derivation and the synchronous save-time tab switch.
export const SECTION_FIELD_PREFIXES = {
  basic:         ['name','slug','sku','genders','shortDescription','brandId','categoryIds','publishStatus'],
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
