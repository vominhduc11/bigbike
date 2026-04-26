/**
 * Canonical data helpers for BigBike admin.
 * These helpers normalize unknown backend payloads to the documented contract.
 */

export const PUBLISH_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED']
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

export function normalizeImageAsset(input) {
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
    price: normalizePrice(source.price),
    stockState: normalizeStockState(source.stockState),
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
    sortOrder: Number.isFinite(source.sortOrder) ? Number(source.sortOrder) : 0,
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

  return {
    id,
    type,
    slug,
    title: toTrimmedString(source.title) || 'Untitled content',
    excerpt: toTrimmedString(source.excerpt) || undefined,
    body: toTrimmedString(source.body) || undefined,
    coverImage: normalizeImageAsset(source.coverImage),
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
  'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED',
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
    sku: toTrimmedStringLocal(s.sku) || undefined,
    quantity: toIntegerLocal(s.quantity, 1),
    unitPrice: toIntegerLocal(s.unitPrice, 0),
    lineTotal: toIntegerLocal(s.lineTotal ?? s.subtotal, 0),
  }
}

function normalizeAddress(input) {
  if (!input || typeof input !== 'object') return undefined
  return {
    fullName: toTrimmedStringLocal(input.fullName) || undefined,
    phone: toTrimmedStringLocal(input.phone) || undefined,
    addressLine1: toTrimmedStringLocal(input.addressLine1) || undefined,
    city: toTrimmedStringLocal(input.city) || undefined,
    province: toTrimmedStringLocal(input.province) || undefined,
    country: toTrimmedStringLocal(input.country) || 'VN',
  }
}

export function normalizeOrder(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-order',
    orderNumber: toTrimmedStringLocal(s.orderNumber) || s.id,
    customerId: toTrimmedStringLocal(s.customerId) || undefined,
    customerEmail: toTrimmedStringLocal(s.customerEmail) || undefined,
    customerName: toTrimmedStringLocal(s.customerName) || undefined,
    orderStatus: normalizeOrderStatus(s.orderStatus || s.status),
    paymentStatus: normalizePaymentStatus(s.paymentStatus),
    paymentMethod: toTrimmedStringLocal(s.paymentMethod) || undefined,
    items: Array.isArray(s.items) ? s.items.map(normalizeOrderItem) : [],
    shippingAddress: normalizeAddress(s.shippingAddress),
    subtotal: toIntegerLocal(s.subtotal, 0),
    shippingFee: toIntegerLocal(s.shippingFee, 0),
    discount: toIntegerLocal(s.discount, 0),
    total: toIntegerLocal(s.total, 0),
    notes: toTrimmedStringLocal(s.notes) || undefined,
    createdAt: toTrimmedStringLocal(s.createdAt) || undefined,
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Customers ────────────────────────────────────────────────────────────────

export const CUSTOMER_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'BANNED']

export function normalizeCustomerStatus(value) {
  return CUSTOMER_STATUS_VALUES.includes(value) ? value : 'UNKNOWN'
}

export function normalizeCustomer(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-customer',
    email: toTrimmedStringLocal(s.email) || undefined,
    fullName: toTrimmedStringLocal(s.fullName) || toTrimmedStringLocal(s.name) || 'Unknown',
    phone: toTrimmedStringLocal(s.phone) || undefined,
    status: normalizeCustomerStatus(s.status),
    orderCount: toIntegerLocal(s.orderCount, 0),
    totalSpent: toIntegerLocal(s.totalSpent, 0),
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
    storageProvider: toTrimmedStringLocal(s.storageProvider) || 'UNKNOWN',
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
    updatedAt: toTrimmedStringLocal(s.updatedAt) || undefined,
  }
}

// ── Coupons ──────────────────────────────────────────────────────────────────

export const COUPON_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'EXPIRED']
export const DISCOUNT_TYPE_VALUES = ['PERCENT', 'FIXED_AMOUNT']

export function normalizeCoupon(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-coupon',
    code: toTrimmedStringLocal(s.code) || 'UNKNOWN',
    discountType: DISCOUNT_TYPE_VALUES.includes(s.discountType) ? s.discountType : 'FIXED_AMOUNT',
    discountValue: toIntegerLocal(s.discountValue, 0),
    minimumOrderAmount: toIntegerLocal(s.minimumOrderAmount, 0),
    maxUsage: s.maxUsage ? toIntegerLocal(s.maxUsage) : undefined,
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
    redirectType: toIntegerLocal(s.redirectType, 301),
    isEnabled: s.isEnabled !== false,
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
    target: toTrimmedStringLocal(s.target) || '_self',
  }
}

export function normalizeMenu(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: toTrimmedStringLocal(s.id) || 'unknown-menu',
    name: toTrimmedStringLocal(s.name) || 'Untitled menu',
    location: toTrimmedStringLocal(s.location) || undefined,
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
