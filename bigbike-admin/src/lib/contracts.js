/**
 * Canonical data helpers for BigBike admin.
 * These helpers normalize unknown backend payloads to the documented contract.
 */

export const PUBLISH_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED', 'TRASH']
export const STOCK_STATE_VALUES = [
  'IN_STOCK',
  'LOW_STOCK',
  'OUT_OF_STOCK',
  'PREORDER',
  'CONTACT_FOR_STOCK',
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

// Rewrites Docker-internal MinIO URLs (http://minio:PORT/BUCKET/...) to the
// nginx-proxied /media-proxy/... path so the browser can load them.
function rewriteInternalMinioUrl(url) {
  const match = url.match(/^http:\/\/minio:[0-9]+\/[^/]+\/(.*)$/)
  if (match) {
    return '/media-proxy/' + match[1]
  }
  return url
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
  return { name, value }
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
  }
}

export function normalizeProduct(input) {
  const source = input && typeof input === 'object' ? input : {}
  const id = toTrimmedString(source.id) || 'unknown-product'
  const slug = toTrimmedString(source.slug) || id
  const category =
    normalizeCategorySummary(source.category) || {
      id: 'uncategorized',
      name: 'Uncategorized',
      slug: 'uncategorized',
    }

  return {
    id,
    sku: toTrimmedString(source.sku) || undefined,
    slug,
    name: toTrimmedString(source.name) || 'Untitled product',
    shortDescription: toTrimmedString(source.shortDescription) || undefined,
    description: toTrimmedString(source.description) || undefined,
    brand: normalizeBrandSummary(source.brand),
    category,
    categories: Array.isArray(source.categories)
      ? source.categories.map(normalizeCategorySummary).filter(Boolean)
      : [],
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
    price: normalizePrice(source.price),
    stockState: normalizeStockState(source.stockState),
    forceOutOfStock: Boolean(source.forceOutOfStock),
    publishStatus: normalizePublishStatus(source.publishStatus),
    isFeatured: Boolean(source.isFeatured),
    showOnHomepage: Boolean(source.showOnHomepage),
    seo: normalizeSeoMeta(source.seo),
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
    seo: normalizeSeoMeta(source.seo),
    isVisible: source.isVisible !== false,
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
    tags: Array.isArray(source.tags)
      ? source.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim())
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
  }
}

// ── Orders ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_VALUES = [
  'PENDING', 'ON_HOLD', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED',
]
export const PAYMENT_STATUS_VALUES = [
  'UNPAID', 'PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'REFUNDED', 'CANCELLED', 'PARTIALLY_REFUNDED',
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

  // Backend has no customerName field; derive from email then phone
  const customerName = toTrimmedStringLocal(s.customerEmail) || toTrimmedStringLocal(s.customerPhone) || undefined

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

export const CUSTOMER_STATUS_VALUES = ['ACTIVE', 'DISABLED', 'BLOCKED']

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
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function normalizeSetting(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    key: toTrimmedStringLocal(s.key) || toTrimmedStringLocal(s.settingKey) || 'unknown',
    value: toTrimmedStringLocal(s.value) || undefined,
    description: toTrimmedStringLocal(s.description) || undefined,
    settingGroup: toTrimmedStringLocal(s.settingGroup) || 'GENERAL',
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
    expiresAt: toTrimmedStringLocal(s.expiresAt) || undefined,
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Redirects ────────────────────────────────────────────────────────────────

export function normalizeRedirect(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-redirect',
    sourcePattern: toTrimmedStringLocal(s.sourcePattern) || '/',
    targetUrl: toTrimmedStringLocal(s.targetUrl) || '/',
    redirectType: toTrimmedStringLocal(s.redirectType) || 'EXACT',
    statusCode: toIntegerLocal(s.statusCode, 301),
    isEnabled: s.enabled !== false,
    hitCount: toIntegerLocal(s.hitCount, 0),
    lastHitAt: toTrimmedStringLocal(s.lastHitAt) || undefined,
    notes: toTrimmedStringLocal(s.notes) || undefined,
    legacyId: s.legacyId != null ? s.legacyId : undefined,
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
