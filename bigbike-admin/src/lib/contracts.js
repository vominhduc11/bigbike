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
