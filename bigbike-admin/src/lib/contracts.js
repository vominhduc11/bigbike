/**
 * Canonical data helpers for BigBike admin.
 * These helpers normalize unknown backend payloads to the documented contract.
 */

export const PUBLISH_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'TRASH']
export const STOCK_STATE_VALUES = [
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
]
export const CONTENT_TYPE_VALUES = ['ARTICLE', 'PAGE']

export function isKnownPublishStatus(value) {
  return PUBLISH_STATUS_VALUES.includes(value)
}

export function isKnownStockState(value) {
  return STOCK_STATE_VALUES.includes(value)
}

export function isKnownContentType(value) {
  return CONTENT_TYPE_VALUES.includes(value)
}

export function normalizePublishStatus(value) {
  return isKnownPublishStatus(value) ? value : 'UNKNOWN'
}

export function normalizeStockState(value) {
  return isKnownStockState(value) ? value : 'UNKNOWN'
}

export const HOMEPAGE_BLOCKS = ['NONE', 'FEATURED_GRID', 'RECOMMENDED_CAROUSEL']

export function normalizeHomepageBlock(value) {
  return HOMEPAGE_BLOCKS.includes(value) ? value : 'NONE'
}

export function normalizeContentType(value) {
  return isKnownContentType(value) ? value : 'ARTICLE'
}

function toTrimmedString(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function toInteger(value, fallback = 0) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return fallback
  }

  return parsed
}

// Rewrites MinIO URLs (both Docker-internal and localhost) to the nginx-proxied
// /media-proxy/... path so the browser can load them.
// Handles two origin forms stored in the DB:
//   - http://minio:9000/...  (set by migration runner inside Docker)
//   - http://localhost:9000/... (set by migration when MINIO_ENDPOINT=localhost)
// VITE_MINIO_INTERNAL_ORIGIN overrides the primary internal origin (default: http://minio:9000).
const _MINIO_INTERNAL_ORIGIN = (
  import.meta.env.VITE_MINIO_INTERNAL_ORIGIN || 'http://minio:9000'
).replace(/\/$/, '')

const _MINIO_LOCALHOST_ORIGIN = 'http://localhost:9000'

function rewriteInternalMinioUrl(url) {
  let rest = null
  for (const origin of [_MINIO_INTERNAL_ORIGIN, _MINIO_LOCALHOST_ORIGIN]) {
    const prefix = origin + '/'
    if (url.startsWith(prefix)) {
      rest = url.slice(prefix.length)
      break
    }
  }
  if (rest === null) return url
  const slashIdx = rest.indexOf('/')
  if (slashIdx === -1) return url
  return '/media-proxy/' + rest.slice(slashIdx + 1)
}

export function normalizeImageAsset(input) {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const rawUrl = toTrimmedString(input.url)
  if (!rawUrl) {
    return undefined
  }
  const url = rewriteInternalMinioUrl(rawUrl)

  return {
    id: toTrimmedString(input.id) || undefined,
    url,
    alt: toTrimmedString(input.alt) || undefined,
    width: Number.isFinite(input.width) ? Number(input.width) : undefined,
    height: Number.isFinite(input.height) ? Number(input.height) : undefined,
    mimeType: toTrimmedString(input.mimeType) || undefined,
  }
}

export function normalizeVideoAsset(input) {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const url = toTrimmedString(input.url)
  if (!url) {
    return undefined
  }

  return {
    id: toTrimmedString(input.id) || undefined,
    url,
    title: toTrimmedString(input.title) || undefined,
    provider: toTrimmedString(input.provider) || undefined,
    thumbnail: normalizeImageAsset(input.thumbnail),
  }
}

export function normalizeSeoMeta(input) {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const seo = {
    title: toTrimmedString(input.title) || undefined,
    description: toTrimmedString(input.description) || undefined,
    canonicalUrl: toTrimmedString(input.canonicalUrl) || undefined,
    ogImage: normalizeImageAsset(input.ogImage),
    noIndex: typeof input.noIndex === 'boolean' ? input.noIndex : undefined,
  }

  const hasValues = Object.values(seo).some((value) => value !== undefined)
  return hasValues ? seo : undefined
}

function normalizePrice(input) {
  const source = input && typeof input === 'object' ? input : {}

  return {
    retailPrice: toInteger(source.retailPrice, 0),
    compareAtPrice: toInteger(source.compareAtPrice, 0) || undefined,
    salePrice: toInteger(source.salePrice, 0) || undefined,
    currency: toTrimmedString(source.currency) || 'VND',
  }
}

function normalizeCategorySummary(input) {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const id = toTrimmedString(input.id)
  const name = toTrimmedString(input.name)
  const slug = toTrimmedString(input.slug)

  if (!id || !name || !slug) {
    return undefined
  }

  return { id, name, slug }
}

function normalizeBrandSummary(input) {
  if (!input || typeof input !== 'object') {
    return undefined
  }

  const id = toTrimmedString(input.id)
  const name = toTrimmedString(input.name)
  const slug = toTrimmedString(input.slug)

  if (!id || !name || !slug) {
    return undefined
  }

  return { id, name, slug }
}

function normalizeVariantOption(input) {
  if (!input || typeof input !== 'object') return undefined
  const name = toTrimmedString(input.name || input.optionName)
  const value = toTrimmedString(input.value || input.optionValue)
  if (!name || !value) return undefined
  return {
    name,
    value,
    attributeValueId: toTrimmedString(input.attributeValueId) || null,
    colorHex: toTrimmedString(input.colorHex) || null,
    swatchImageUrl: toTrimmedString(input.swatchImageUrl) || null,
    swatchImageId: toTrimmedString(input.swatchImageId) || null,
  }
}

function normalizeVariant(input) {
  if (!input || typeof input !== 'object') return undefined
  const id = toTrimmedString(input.id) || undefined
  return {
    id,
    sku: toTrimmedString(input.sku) || undefined,
    name: toTrimmedString(input.name) || 'Biến thể',
    options: Array.isArray(input.options)
      ? input.options.map(normalizeVariantOption).filter(Boolean)
      : [],
    price: normalizePrice(input.price),
    stockState: normalizeStockState(input.stockState),
    // Surface stockQuantity so the inventory column in the variants table /
    // any "Còn N" hint can render. The backend now exposes it on every
    // variant (nullable when not tracked).
    stockQuantity: Number.isFinite(input.stockQuantity)
      ? Number(input.stockQuantity)
      : null,
    image: normalizeImageAsset(input.image),
    // Color-scoped variant gallery. Without this pass-through the edit
    // form's GalleryEditor opens empty even when the database has rows.
    gallery: Array.isArray(input.gallery)
      ? input.gallery.map(normalizeImageAsset).filter(Boolean)
      : [],
    isAvailable: input.isAvailable !== false,
    trackSerials: Boolean(input.trackSerials),
  }
}

function normalizeSpecification(input) {
  if (!input || typeof input !== 'object') return undefined
  const name = toTrimmedString(input.name)
  const value = toTrimmedString(input.value || input.specValue)
  if (!name || !value) return undefined
  return {
    name,
    value,
    group: toTrimmedString(input.group || input.groupName) || undefined,
    // Optional English content (V136) — admin product read carries both languages.
    nameEn: toTrimmedString(input.nameEn) || undefined,
    valueEn: toTrimmedString(input.valueEn) || undefined,
    groupEn: toTrimmedString(input.groupEn || input.groupNameEn) || undefined,
  }
}

function normalizeFaq(input) {
  if (!input || typeof input !== 'object') return undefined
  const question = toTrimmedString(input.question)
  const answer = toTrimmedString(input.answer)
  if (!question || !answer) return undefined
  return {
    question,
    answer,
    questionEn: toTrimmedString(input.questionEn) || undefined,
    answerEn: toTrimmedString(input.answerEn) || undefined,
  }
}

/**
 * Optional English product-level content (V136). The admin product read returns
 * `translations.en`; null/absent means no English version exists yet.
 */
function normalizeProductTranslations(input) {
  const en = input && typeof input === 'object' ? input.en : undefined
  const source = en && typeof en === 'object' ? en : {}
  return {
    name: toTrimmedString(source.name) || undefined,
    shortDescription: toTrimmedString(source.shortDescription) || undefined,
    description: toTrimmedString(source.description) || undefined,
    contentBottom: toTrimmedString(source.contentBottom) || undefined,
    promotionContent: toTrimmedString(source.promotionContent) || undefined,
    installationGuide: toTrimmedString(source.installationGuide) || undefined,
    seoTitle: toTrimmedString(source.seoTitle) || undefined,
    seoDescription: toTrimmedString(source.seoDescription) || undefined,
  }
}

export function normalizeProduct(input) {
  const source = input && typeof input === 'object' ? input : {}
  const id = toTrimmedString(source.id) || 'unknown-product'
  const slug = toTrimmedString(source.slug) || id
  const brandSource = source.brand && typeof source.brand === 'object' ? source.brand : null
  const categorySource = source.category && typeof source.category === 'object' ? source.category : null
  const categories = Array.isArray(source.categories)
    ? source.categories.map(normalizeCategorySummary).filter(Boolean)
    : []
  const brandId =
    toTrimmedString(source.brandId) ||
    (brandSource ? toTrimmedString(brandSource.id) : '')
  const categoryId =
    toTrimmedString(source.categoryId) ||
    (categorySource ? toTrimmedString(categorySource.id) : '') ||
    categories[0]?.id ||
    ''
  const category =
    normalizeCategorySummary(categorySource) ||
    (categoryId
      ? {
          id: categoryId,
          name: toTrimmedString(categorySource?.name) || categoryId,
          slug: toTrimmedString(categorySource?.slug) || categoryId,
        }
      : {
          id: 'uncategorized',
          name: 'Uncategorized',
          slug: 'uncategorized',
        })

  return {
    id,
    sku: toTrimmedString(source.sku) || undefined,
    slug,
    name: toTrimmedString(source.name) || 'Untitled product',
    shortDescription: toTrimmedString(source.shortDescription) || undefined,
    description: toTrimmedString(source.description) || undefined,
    contentBottom: toTrimmedString(source.contentBottom) || undefined,
    promotionContent: toTrimmedString(source.promotionContent) || undefined,
    installationGuide: toTrimmedString(source.installationGuide) || undefined,
    brand: normalizeBrandSummary(brandSource),
    brandId: brandId || undefined,
    category,
    categoryId: categoryId || undefined,
    categories,
    image: normalizeImageAsset(source.image),
    gallery: Array.isArray(source.gallery)
      ? source.gallery.map(normalizeImageAsset).filter(Boolean)
      : [],
    videos: Array.isArray(source.videos)
      ? source.videos.map(normalizeVideoAsset).filter(Boolean)
      : [],
    variants: Array.isArray(source.variants)
      ? source.variants.map(normalizeVariant).filter(Boolean)
      : [],
    specifications: Array.isArray(source.specifications)
      ? source.specifications.map(normalizeSpecification).filter(Boolean)
      : [],
    faqs: Array.isArray(source.faqs)
      ? source.faqs.map(normalizeFaq).filter(Boolean)
      : [],
    // Admin-curated related products — list-view refs used to render product
    // chips in the editor and to power the PDP "Sản phẩm liên quan" section.
    relatedProducts: Array.isArray(source.relatedProducts)
      ? source.relatedProducts
          .map((p) => (p && typeof p === 'object'
            ? {
                id: toTrimmedString(p.id),
                name: toTrimmedString(p.name),
                slug: toTrimmedString(p.slug),
                image: normalizeImageAsset(p.image),
              }
            : null))
          .filter((p) => p && p.id)
      : [],
    price: normalizePrice(source.price),
    stockState: normalizeStockState(source.stockState),
    stockQuantity: Number.isFinite(source.stockQuantity) ? Number(source.stockQuantity) : null,
    forceOutOfStock: Boolean(source.forceOutOfStock),
    publishStatus: normalizePublishStatus(source.publishStatus),
    homepageBlock: normalizeHomepageBlock(source.homepageBlock),
    homepageOrder: Number.isFinite(source.homepageOrder) ? Number(source.homepageOrder) : null,
    seo: normalizeSeoMeta(source.seo),
    // Optional English content (V136). Always an object so the form can bind
    // the EN language tab; individual fields are undefined when not translated.
    translations: { en: normalizeProductTranslations(source.translations) },
    descriptionBlocks: Array.isArray(source.descriptionBlocks) ? source.descriptionBlocks : null,
    createdAt: toTrimmedString(source.createdAt) || undefined,
    updatedAt: toTrimmedString(source.updatedAt) || undefined,
  }
}

export function normalizeCategory(input) {
  const source = input && typeof input === 'object' ? input : {}
  const id = toTrimmedString(source.id) || 'unknown-category'
  const slug = toTrimmedString(source.slug) || id

  return {
    id,
    slug,
    name: toTrimmedString(source.name) || 'Untitled category',
    description: toTrimmedString(source.description) || undefined,
    parentId: toTrimmedString(source.parentId) || undefined,
    image: normalizeImageAsset(source.image),
    icon: normalizeImageAsset(source.icon),
    seo: normalizeSeoMeta(source.seo),
    isVisible: source.isVisible !== false,
    showOnHomepage: source.showOnHomepage === true,
    sortOrder: Number.isFinite(source.sortOrder) ? Number(source.sortOrder) : undefined,
    translations: {
      en: {
        name: toTrimmedString(source.translations?.en?.name) || undefined,
        description: toTrimmedString(source.translations?.en?.description) || undefined,
        seoTitle: toTrimmedString(source.translations?.en?.seoTitle) || undefined,
        seoDescription: toTrimmedString(source.translations?.en?.seoDescription) || undefined,
      },
    },
    createdAt: toTrimmedString(source.createdAt) || undefined,
    updatedAt: toTrimmedString(source.updatedAt) || undefined,
  }
}

export function normalizeBrand(input) {
  const source = input && typeof input === 'object' ? input : {}
  const id = toTrimmedString(source.id) || 'unknown-brand'
  const slug = toTrimmedString(source.slug) || id

  return {
    id,
    slug,
    name: toTrimmedString(source.name) || 'Untitled brand',
    description: toTrimmedString(source.description) || undefined,
    logo: normalizeImageAsset(source.logo),
    bannerImage: normalizeImageAsset(source.bannerImage),
    seo: normalizeSeoMeta(source.seo),
    isVisible: source.isVisible !== false,
    translations: {
      en: {
        name: toTrimmedString(source.translations?.en?.name) || undefined,
        description: toTrimmedString(source.translations?.en?.description) || undefined,
        seoTitle: toTrimmedString(source.translations?.en?.seoTitle) || undefined,
        seoDescription: toTrimmedString(source.translations?.en?.seoDescription) || undefined,
      },
    },
    createdAt: toTrimmedString(source.createdAt) || undefined,
    updatedAt: toTrimmedString(source.updatedAt) || undefined,
  }
}

export function normalizeContentItem(input) {
  const source = input && typeof input === 'object' ? input : {}
  const id = toTrimmedString(source.id) || 'unknown-content'
  const slug = toTrimmedString(source.slug) || id
  const publishStatus = normalizePublishStatus(source.publishStatus)
  const type = normalizeContentType(source.type || source.contentType)

  const authorSource = source.author && typeof source.author === 'object' ? source.author : null

  // authorId/categoryId: prefer explicit flat scalar; fall back to nested object id
  // so existing data without the flat field still resolves correctly.
  const authorId =
    toTrimmedString(source.authorId) ||
    (authorSource ? toTrimmedString(authorSource.id) : undefined) ||
    undefined
  const categorySource = source.category && typeof source.category === 'object' ? source.category : null
  const categoryId =
    toTrimmedString(source.categoryId) ||
    (categorySource ? toTrimmedString(categorySource.id) : undefined) ||
    undefined

  return {
    id,
    type,
    slug,
    title: toTrimmedString(source.title) || 'Untitled content',
    excerpt: toTrimmedString(source.excerpt) || undefined,
    body: toTrimmedString(source.body) || undefined,
    coverImage: normalizeImageAsset(source.coverImage),
    productImage: normalizeImageAsset(source.productImage),
    pageType: toTrimmedString(source.pageType) || undefined,
    // Flat id scalars — required by ContentDetailScreen to pre-select dropdowns
    // and to re-send on save so backend does not clear the association.
    authorId,
    categoryId,
    parentId: toTrimmedString(source.parentId) || undefined,
    // Hero fields for PAGE type
    heroImage: normalizeImageAsset(source.heroImage),
    heroTitle: toTrimmedString(source.heroTitle) || undefined,
    heroDescription: toTrimmedString(source.heroDescription) || undefined,
    heroKicker: toTrimmedString(source.heroKicker) || undefined,
    tags: Array.isArray(source.tags)
      ? source.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim())
      : [],
    // Article ↔ product links — lightweight refs used to render product chips in the editor.
    relatedProducts: Array.isArray(source.relatedProducts)
      ? source.relatedProducts
          .map((p) => (p && typeof p === 'object'
            ? {
                id: toTrimmedString(p.id) || undefined,
                slug: toTrimmedString(p.slug) || undefined,
                name: toTrimmedString(p.name) || undefined,
                imageUrl: toTrimmedString(p.imageUrl) || undefined,
              }
            : null))
          .filter((p) => p && p.id)
      : [],
    categories: Array.isArray(source.categories)
      ? source.categories.map(normalizeCategorySummary).filter(Boolean)
      : [],
    category: normalizeCategorySummary(source.category),
    author: authorSource
      ? {
          id: toTrimmedString(authorSource.id) || undefined,
          name: toTrimmedString(authorSource.name) || undefined,
        }
      : undefined,
    publishStatus,
    seo: normalizeSeoMeta(source.seo),
    publishedAt: toTrimmedString(source.publishedAt) || undefined,
    createdAt: toTrimmedString(source.createdAt) || undefined,
    updatedAt: toTrimmedString(source.updatedAt) || undefined,
    bodyBlocks: Array.isArray(source.bodyBlocks) ? source.bodyBlocks : null,
  }
}

// ── Orders ──────────────────────────────────────────────────────────────────

export function normalizeRedirect(input) {
  const source = input && typeof input === 'object' ? input : {}
  const id = toTrimmedString(source.id) || 'unknown-redirect'
  const statusCode = Number(source.statusCode)
  const hitCount = Number(source.hitCount)
  const legacyId = Number(source.legacyId)

  return {
    id,
    sourcePattern: toTrimmedString(source.sourcePattern) || '',
    targetUrl: toTrimmedString(source.targetUrl) || '',
    redirectType: toTrimmedString(source.redirectType) || 'PERMANENT',
    statusCode: Number.isFinite(statusCode) ? statusCode : 301,
    enabled: source.enabled !== false,
    hitCount: Number.isFinite(hitCount) ? hitCount : 0,
    lastHitAt: toTrimmedString(source.lastHitAt) || undefined,
    notes: toTrimmedString(source.notes) || undefined,
    legacyId: Number.isFinite(legacyId) ? legacyId : undefined,
    createdAt: toTrimmedString(source.createdAt) || undefined,
    updatedAt: toTrimmedString(source.updatedAt) || undefined,
  }
}

export const ORDER_STATUS_VALUES = [
  'PENDING', 'ON_HOLD', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED',
]
export const PAYMENT_STATUS_VALUES = [
  'UNPAID', 'PAID', 'REFUNDED', 'CANCELLED',
]

function toTrimmedStringLocal(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function toIntegerLocal(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export function normalizeOrderStatus(value) {
  return ORDER_STATUS_VALUES.includes(value) ? value : 'UNKNOWN'
}
export function normalizePaymentStatus(value) {
  return PAYMENT_STATUS_VALUES.includes(value) ? value : 'UNKNOWN'
}

function normalizeOrderItem(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown',
    productId: toTrimmedStringLocal(s.productId) || undefined,
    productName: toTrimmedStringLocal(s.productName) || 'Unknown product',
    variantName: toTrimmedStringLocal(s.variantName) || undefined,
    sku: toTrimmedStringLocal(s.sku) || undefined,
    quantity: toIntegerLocal(s.quantity, 1),
    unitPrice: toIntegerLocal(s.unitPrice, 0),
    lineSubtotal: toIntegerLocal(s.lineSubtotal, 0),
    lineDiscount: toIntegerLocal(s.lineDiscount, 0),
    lineTotal: toIntegerLocal(s.lineTotal, 0),
  }
}

function normalizeAddress(input) {
  if (!input || typeof input !== 'object') return undefined
  return {
    type: toTrimmedStringLocal(input.type) || undefined,
    fullName: toTrimmedStringLocal(input.fullName) || undefined,
    email: toTrimmedStringLocal(input.email) || undefined,
    phone: toTrimmedStringLocal(input.phone) || undefined,
    addressLine1: toTrimmedStringLocal(input.addressLine1) || undefined,
    addressLine2: toTrimmedStringLocal(input.addressLine2) || undefined,
    ward: toTrimmedStringLocal(input.ward) || undefined,
    district: toTrimmedStringLocal(input.district) || undefined,
    province: toTrimmedStringLocal(input.province) || undefined,
    country: toTrimmedStringLocal(input.country) || 'VN',
  }
}

function normalizeOrderNote(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown',
    content: toTrimmedStringLocal(s.content) || '',
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
  }
}

export function normalizeOrder(input) {
  const s = input && typeof input === 'object' ? input : {}

  // Derive addresses — backend returns list; split by type
  const addresses = Array.isArray(s.addresses) ? s.addresses.map(normalizeAddress) : []
  const shippingAddress = addresses.find((a) => a?.type === 'SHIPPING') ?? addresses[0] ?? undefined
  const billingAddress = addresses.find((a) => a?.type === 'BILLING') ?? undefined

  // Derive payment method from first payment record
  const payments = Array.isArray(s.payments) ? s.payments : []
  const paymentMethod = toTrimmedStringLocal(payments[0]?.paymentMethod) || undefined

  // Derive customerName: prefer explicit name fields, then shipping address fullName.
  // Do NOT fall back to email/phone — those are separate display fields and showing
  // email in a "name" column causes duplicate display (bug: Name field showed email).
  // NEEDS_BACKEND_CHANGE: backend should include customer name in order response.
  const customerName =
    toTrimmedStringLocal(s.customerName) ||
    toTrimmedStringLocal(s.customer?.fullName) ||
    toTrimmedStringLocal(s.customer?.name) ||
    toTrimmedStringLocal(s.customer?.displayName) ||
    toTrimmedStringLocal(
      Array.isArray(s.addresses)
        ? (s.addresses.find((a) => a?.type === 'SHIPPING') ?? s.addresses[0])?.fullName
        : undefined
    ) ||
    undefined

  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-order',
    orderNumber: toTrimmedStringLocal(s.orderNumber) || s.id,
    orderKey: toTrimmedStringLocal(s.orderKey) || undefined,
    customerId: toTrimmedStringLocal(s.customerId) || undefined,
    customerEmail: toTrimmedStringLocal(s.customerEmail) || undefined,
    customerPhone: toTrimmedStringLocal(s.customerPhone) || undefined,
    customerName,
    customerNote: toTrimmedStringLocal(s.customerNote) || undefined,
    orderStatus: normalizeOrderStatus(s.status ?? s.orderStatus),
    paymentStatus: normalizePaymentStatus(s.paymentStatus),
    fulfillmentStatus: toTrimmedStringLocal(s.fulfillmentStatus) || undefined,
    fulfillmentType: toTrimmedStringLocal(s.fulfillmentType) || 'DELIVERY',
    trackingNumber: toTrimmedStringLocal(s.trackingNumber) || undefined,
    shippingCarrier: toTrimmedStringLocal(s.shippingCarrier) || undefined,
    shippedAt: toTrimmedStringLocal(s.shippedAt) || undefined,
    paymentMethod,
    source: toTrimmedStringLocal(s.source) || undefined,
    // Line items — backend field is lineItems (not items)
    items: Array.isArray(s.lineItems) ? s.lineItems.map(normalizeOrderItem) : [],
    itemCount: toIntegerLocal(s.itemCount, 0),
    addresses,
    shippingAddress,
    billingAddress,
    shippingItems: Array.isArray(s.shippingItems) ? s.shippingItems : [],
    payments,
    notes: Array.isArray(s.notes) ? s.notes.map(normalizeOrderNote) : [],
    // Amounts — backend uses *Amount suffix
    subtotal: toIntegerLocal(s.subtotalAmount, 0),
    shippingFee: toIntegerLocal(s.shippingAmount, 0),
    discount: toIntegerLocal(s.discountAmount, 0),
    feeAmount: toIntegerLocal(s.feeAmount, 0),
    taxAmount: toIntegerLocal(s.taxAmount, 0),
    total: toIntegerLocal(s.totalAmount, 0),
    paidAmount: toIntegerLocal(s.paidAmount, 0),
    refundAmount: toIntegerLocal(s.refundAmount, 0),
    refundReason: toTrimmedStringLocal(s.refundReason) || undefined,
    refundedAt: toTrimmedStringLocal(s.refundedAt) || undefined,
    currency: toTrimmedStringLocal(s.currency) || 'VND',
    // Dates — backend uses placedAt (not createdAt)
    placedAt: toTrimmedStringLocal(s.placedAt) || undefined,
    paidAt: toTrimmedStringLocal(s.paidAt) || undefined,
    completedAt: toTrimmedStringLocal(s.completedAt) || undefined,
    cancelledAt: toTrimmedStringLocal(s.cancelledAt) || undefined,
    createdAt: toTrimmedStringLocal(s.placedAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Customers ────────────────────────────────────────────────────────────────

export const CUSTOMER_STATUS_VALUES = ['ACTIVE', 'PENDING', 'DISABLED', 'BLOCKED']

export function normalizeCustomerStatus(value) {
  return CUSTOMER_STATUS_VALUES.includes(value) ? value : 'UNKNOWN'
}

export function normalizeCustomer(input) {
  const s = input && typeof input === 'object' ? input : {}
  const orderSummary = s.orderSummary && typeof s.orderSummary === 'object' ? s.orderSummary : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-customer',
    email: toTrimmedStringLocal(s.email) || undefined,
    displayName: toTrimmedStringLocal(s.displayName) || undefined,
    fullName: toTrimmedStringLocal(s.displayName) || toTrimmedStringLocal(s.fullName) || toTrimmedStringLocal(s.name) || 'Unknown',
    phone: toTrimmedStringLocal(s.phone) || undefined,
    status: normalizeCustomerStatus(s.status),
    emailVerifiedAt: toTrimmedStringLocal(s.emailVerifiedAt) || undefined,
    lastLoginAt: toTrimmedStringLocal(s.lastLoginAt) || undefined,
    orderCount: toIntegerLocal(orderSummary.orderCount ?? s.orderCount, 0),
    totalSpent: toIntegerLocal(orderSummary.totalSpent ?? s.totalSpent, 0),
    avgOrderValue: toIntegerLocal(orderSummary.avgOrderValue, 0),
    segment: toTrimmedStringLocal(orderSummary.segment) || 'NEW',
    firstOrderAt: toTrimmedStringLocal(orderSummary.firstOrderAt) || undefined,
    lastOrderAt: toTrimmedStringLocal(orderSummary.lastOrderAt) || undefined,
    latestOrders: Array.isArray(orderSummary.latestOrders) ? orderSummary.latestOrders : [],
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Media ────────────────────────────────────────────────────────────────────

export function normalizeMediaItem(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-media',
    filename: toTrimmedStringLocal(s.filename) || toTrimmedStringLocal(s.filePath) || 'unknown',
    publicUrl: toTrimmedStringLocal(s.publicUrl) || toTrimmedStringLocal(s.url) || undefined,
    mimeType: toTrimmedStringLocal(s.mimeType) || 'application/octet-stream',
    fileSize: toIntegerLocal(s.fileSize, 0),
    width: s.width ? toIntegerLocal(s.width) : undefined,
    height: s.height ? toIntegerLocal(s.height) : undefined,
    altText: toTrimmedStringLocal(s.altText) || undefined,
    title: toTrimmedStringLocal(s.title) || undefined,
    caption: toTrimmedStringLocal(s.caption) || undefined,
    storageProvider: (toTrimmedStringLocal(s.storageProvider) || 'UNKNOWN').toUpperCase(),
    status: toTrimmedStringLocal(s.status) || 'ACTIVE',
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
    usageCount: typeof s.usageCount === 'number' ? s.usageCount : 0,
    references: Array.isArray(s.references) ? s.references : [],
    folderId: toTrimmedStringLocal(s.folderId) || null,
    tags: Array.isArray(s.tags) ? s.tags : [],
    sizes: parseSizesJson(s.sizes),
  }
}

function parseSizesJson(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function normalizeSetting(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    key: toTrimmedStringLocal(s.key) || toTrimmedStringLocal(s.settingKey) || 'unknown',
    value: toTrimmedStringLocal(s.value) || toTrimmedStringLocal(s.settingValue) || undefined,
    description: toTrimmedStringLocal(s.description) || undefined,
    settingGroup: toTrimmedStringLocal(s.settingGroup) || 'GENERAL',
    valueType: toTrimmedStringLocal(s.valueType) || 'STRING',
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Coupons ──────────────────────────────────────────────────────────────────

export const COUPON_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'EXPIRED', 'ARCHIVED']
export const DISCOUNT_TYPE_VALUES = ['PERCENT', 'FIXED']

export function normalizeCoupon(input) {
  const s = input && typeof input === 'object' ? input : {}
  // discountType: backend stores "FIXED" or "PERCENT"; accept legacy "FIXED_AMOUNT" from mock
  const rawType = toTrimmedStringLocal(s.discountType)
  const discountType = rawType === 'FIXED_AMOUNT' ? 'FIXED' : (DISCOUNT_TYPE_VALUES.includes(rawType) ? rawType : 'FIXED')
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-coupon',
    code: toTrimmedStringLocal(s.code) || 'UNKNOWN',
    name: toTrimmedStringLocal(s.name) || '',
    discountType,
    // backend: `amount`; mock compat: `discountValue`
    discountValue: toIntegerLocal(s.amount ?? s.discountValue, 0),
    // backend: `minimumAmount`; mock compat: `minimumOrderAmount`
    minimumOrderAmount: toIntegerLocal(s.minimumAmount ?? s.minimumOrderAmount, 0),
    maximumAmount: s.maximumAmount != null ? toIntegerLocal(s.maximumAmount) : undefined,
    // backend: `usageLimit`; mock compat: `maxUsage`
    maxUsage: (s.usageLimit ?? s.maxUsage) != null ? toIntegerLocal(s.usageLimit ?? s.maxUsage) : undefined,
    usageCount: toIntegerLocal(s.usageCount, 0),
    status: COUPON_STATUS_VALUES.includes(s.status) ? s.status : 'INACTIVE',
    channel: ['ALL', 'ONLINE', 'POS'].includes(s.channel) ? s.channel : 'ALL',
    customerId: toTrimmedStringLocal(s.customerId) || undefined,
    expiresAt: toTrimmedStringLocal(s.expiresAt) || undefined,
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Menus ─────────────────────────────────────────────────────────────────────

function normalizeMenuItem(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown',
    label: toTrimmedStringLocal(s.label) || 'Untitled',
    url: toTrimmedStringLocal(s.url) || '#',
    sortOrder: toIntegerLocal(s.sortOrder, 0),
    parentId: toTrimmedStringLocal(s.parentId) || undefined,
    targetType: toTrimmedStringLocal(s.targetType) || 'CUSTOM',
    targetId: toTrimmedStringLocal(s.targetId) || undefined,
    target: toTrimmedStringLocal(s.target) || '_self',
    openInNewTab: s.openInNewTab === true,
    cssClass: toTrimmedStringLocal(s.cssClass) || undefined,
    status: toTrimmedStringLocal(s.status) || 'ACTIVE',
  }
}

export function normalizeMenu(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-menu',
    name: toTrimmedStringLocal(s.name) || 'Untitled menu',
    location: toTrimmedStringLocal(s.location) || undefined,
    status: toTrimmedStringLocal(s.status) || 'ACTIVE',
    items: Array.isArray(s.items) ? s.items.map(normalizeMenuItem) : [],
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function normalizePagination(input, defaultPageSize = 10) {
  const source = input && typeof input === 'object' ? input : {}

  const page = Math.max(1, toInteger(source.page, 1))
  const pageSize = Math.max(1, toInteger(source.pageSize, defaultPageSize))
  const totalItems = Math.max(0, toInteger(source.totalItems, 0))
  const totalPages =
    Math.max(1, toInteger(source.totalPages, 0)) ||
    Math.max(1, Math.ceil(totalItems / pageSize))

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNext:
      typeof source.hasNext === 'boolean'
        ? source.hasNext
        : page < totalPages,
    hasPrevious:
      typeof source.hasPrevious === 'boolean' ? source.hasPrevious : page > 1,
  }
}
