#!/usr/bin/env node

/**
 * Safe E2E data inventory and cleanup.
 *
 * This file deliberately has no dependency on the admin UI.  It is shared by
 * the operator CLI and the Playwright worker guard, so a broken or timed-out
 * browser flow cannot prevent cleanup from reaching the backend.
 */

import process from 'node:process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const API_BASE = '/api/v1'
export const PAGE_SIZE = 100

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 1_000
const MAX_PAGES = 10_000

/**
 * Only these prefixes and exact legacy filenames are test markers.  Keep this
 * list intentionally boring and explicit: a generic "test" search is unsafe
 * on a shop whose real content can contain that word.
 */
export const E2E_MARKERS = Object.freeze({
  products: Object.freeze({
    prefixes: Object.freeze(['E2E_PRODUCT_', 'E2E_TEST_', 'E2E-TEST-']),
    fields: Object.freeze(['sku', 'slug', 'slugEn', 'name', 'nameEn']),
  }),
  brands: Object.freeze({
    prefixes: Object.freeze(['E2E_BRAND_', 'e2e-brand-']),
    fields: Object.freeze(['slug', 'name']),
  }),
  categories: Object.freeze({
    prefixes: Object.freeze(['E2E_CATEGORY_', 'e2e-category-']),
    fields: Object.freeze(['slug', 'slugEn', 'name']),
  }),
  articles: Object.freeze({
    prefixes: Object.freeze(['E2E_CONTENT_', 'e2e-content-']),
    fields: Object.freeze(['slug', 'slugEn', 'title', 'titleEn']),
  }),
  redirects: Object.freeze({
    prefixes: Object.freeze(['/E2E_REDIRECT_', '/e2e-redirect-']),
    fields: Object.freeze(['sourcePattern']),
  }),
  media: Object.freeze({
    prefixes: Object.freeze([
      'E2E_MEDIA_',
      'E2E_VIDEO_',
      'E2E_CONTENT_MEDIA_',
      'e2e_content_cover_',
    ]),
    exactFilenames: Object.freeze(['test-upload.png', 'product-image-2000.jpg']),
    fields: Object.freeze(['originalFilename', 'filePath', 'title', 'altText']),
  }),
  homeVideos: Object.freeze({
    prefixes: Object.freeze(['E2E_HOME_VIDEO_']),
    fields: Object.freeze(['title', 'titleEn']),
  }),
})

const RESOURCE_ORDER = Object.freeze([
  'products',
  'brands',
  'categories',
  'articles',
  'redirects',
  'homeVideos',
  'media',
])

const RESOURCE_PATHS = Object.freeze({
  products: '/admin/products',
  brands: '/admin/brands',
  categories: '/admin/categories',
  articles: '/admin/content',
  redirects: '/admin/redirects',
  media: '/admin/media',
  homeVideos: '/admin/home-videos',
})

const REQUIRED_PERMISSIONS = Object.freeze({
  products: Object.freeze({ read: 'products.read', write: 'products.update' }),
  brands: Object.freeze({ read: 'catalog.read', write: 'catalog.update' }),
  categories: Object.freeze({ read: 'catalog.read', write: 'catalog.update' }),
  articles: Object.freeze({ read: 'content.read', write: 'content.update' }),
  redirects: Object.freeze({ read: 'redirects.read', write: 'redirects.write' }),
  media: Object.freeze({ read: 'media.read', write: 'media.write', hard: '*' }),
  homeVideos: Object.freeze({ read: 'home_videos.read', write: 'home_videos.write' }),
})

export class E2EDataCleanupError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'E2EDataCleanupError'
    this.details = details
  }
}

function asText(value) {
  return typeof value === 'string' ? value : ''
}

function startsWithOneOf(value, prefixes) {
  const text = asText(value)
  return prefixes.some((prefix) => text.startsWith(prefix))
}

function basename(value) {
  const text = asText(value).split('?')[0].split('#')[0]
  return text.slice(text.lastIndexOf('/') + 1)
}

function isExactLegacyFilename(value, exactFilenames) {
  const text = asText(value)
  return exactFilenames.includes(text) || exactFilenames.includes(basename(text))
}

function fieldValues(resource, item) {
  const marker = E2E_MARKERS[resource]
  return marker.fields.map((field) => item?.[field]).filter((value) => typeof value === 'string')
}

function isMarkedValue(resource, value) {
  if (startsWithOneOf(value, E2E_MARKERS[resource].prefixes)) return true
  // A media API may expose only the object key/URL rather than the original
  // filename. The basename is still checked against the same exact prefixes.
  if (resource === 'media' && startsWithOneOf(basename(value), E2E_MARKERS[resource].prefixes)) return true
  return resource === 'media' && isExactLegacyFilename(value, E2E_MARKERS[resource].exactFilenames)
}

/** Pure, unit-testable marker check. */
export function matchesE2EMarker(resource, item = {}) {
  const marker = E2E_MARKERS[resource]
  if (!marker) return false
  return fieldValues(resource, item).some((value) => isMarkedValue(resource, value))
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || ''
}

function recordId(item) {
  return firstString(item?.id, item?.uuid)
}

function identity(resource, item) {
  switch (resource) {
    case 'products': return firstString(item?.sku, item?.name, item?.slug, recordId(item))
    case 'brands': return firstString(item?.name, item?.slug, recordId(item))
    case 'categories': return firstString(item?.name, item?.slug, recordId(item))
    case 'articles': return firstString(item?.title, item?.slug, item?.titleEn, recordId(item))
    case 'redirects': return firstString(item?.sourcePattern, item?.sourcePath, item?.source, item?.targetUrl, recordId(item))
    case 'media': return firstString(item?.originalFilename, item?.title, item?.filePath, recordId(item))
    case 'homeVideos': return firstString(item?.title, item?.titleEn, item?.sourceUrl, recordId(item))
    default: return recordId(item)
  }
}

function status(resource, item) {
  switch (resource) {
    case 'products': return firstString(item?.publishStatus, 'UNKNOWN')
    case 'brands': return item?.isVisible === false ? 'HIDDEN' : 'VISIBLE'
    case 'categories': return item?.deleted === true ? 'DELETED' : 'ACTIVE'
    case 'articles': return firstString(item?.publishStatus, item?.status, 'UNKNOWN')
    case 'redirects': return item?.enabled === false ? 'DISABLED' : 'ENABLED'
    case 'media': return firstString(item?.status, 'UNKNOWN')
    case 'homeVideos': return 'ACTIVE'
    default: return 'UNKNOWN'
  }
}

function markerField(resource, item) {
  const marker = E2E_MARKERS[resource]
  for (const field of marker.fields) {
    const value = item?.[field]
    if (typeof value === 'string' && isMarkedValue(resource, value)) {
      return `${field}:${value}`
    }
  }
  return ''
}

function toRecord(resource, item) {
  return {
    resource,
    id: recordId(item),
    identity: identity(resource, item),
    status: status(resource, item),
    marker: markerField(resource, item),
    raw: item,
  }
}

function compareRecords(left, right) {
  const resourceCompare = RESOURCE_ORDER.indexOf(left.resource) - RESOURCE_ORDER.indexOf(right.resource)
  if (resourceCompare) return resourceCompare
  const identityCompare = left.identity.localeCompare(right.identity)
  if (identityCompare) return identityCompare
  return left.id.localeCompare(right.id)
}

function emptyInventory() {
  return Object.fromEntries(RESOURCE_ORDER.map((resource) => [resource, []]))
}

function addUnique(inventory, resource, item) {
  const id = recordId(item)
  if (!id || !matchesE2EMarker(resource, item)) return
  const existing = inventory[resource].find((entry) => entry.id === id)
  if (existing) return
  inventory[resource].push(toRecord(resource, item))
}

async function responseBody(response) {
  if (response.body !== undefined) return response.body
  return null
}

function responseHeaders(response) {
  return response.headers && typeof response.headers.get === 'function' ? response.headers : null
}

function retryAfterMs(response, fallbackMs, attempt) {
  const retryAfter = responseHeaders(response)?.get('retry-after')
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000
  return fallbackMs * (attempt + 1)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Small fetch adapter.  The adapter is injectable so all safety logic can be
 * tested without a live shop or a browser.
 */
export function createCleanupClient({
  baseUrl,
  accessToken,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleepImpl = wait,
} = {}) {
  if (!baseUrl) throw new Error('E2E cleanup needs a base URL.')
  if (typeof fetchImpl !== 'function') throw new Error('E2E cleanup needs fetch.')
  const normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, '')

  return {
    baseUrl: normalizedBaseUrl,
    async request(method, path, { query, body, allowStatuses = [] } = {}) {
      const url = new URL(`${API_BASE}${path}`, `${normalizedBaseUrl}/`)
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
      }

      for (let attempt = 0; ; attempt += 1) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        const timeout = controller ? setTimeout(() => controller.abort(), requestTimeoutMs) : null
        let response
        try {
          response = await fetchImpl(url, {
            method,
            headers: {
              Accept: 'application/json',
              ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            ...(controller ? { signal: controller.signal } : {}),
          })
        } catch (error) {
          if (timeout) clearTimeout(timeout)
          if (attempt < maxRetries) {
            await sleepImpl(retryDelayMs * (attempt + 1))
            continue
          }
          throw new E2EDataCleanupError(`Request ${method} ${path} failed: ${error?.message || error}`, {
            method,
            path,
            cause: error,
          })
        }
        if (timeout) clearTimeout(timeout)

        if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
          await sleepImpl(retryAfterMs(response, retryDelayMs, attempt))
          continue
        }

        let parsedBody = null
        if (typeof response.text === 'function') {
          const text = await response.text()
          if (text) {
            try { parsedBody = JSON.parse(text) } catch { parsedBody = { message: text.slice(0, 500) } }
          }
        } else if (typeof response.json === 'function') {
          try { parsedBody = await response.json() } catch { parsedBody = null }
        } else {
          parsedBody = await responseBody(response)
        }

        return {
          status: response.status,
          ok: response.status >= 200 && response.status < 300,
          body: parsedBody,
          headers: response.headers,
          url: String(url),
          allowed: allowStatuses.includes(response.status),
        }
      }
    },
  }
}

function assertResponse(response, description) {
  if (response.ok) return response
  throw new E2EDataCleanupError(`${description} failed with HTTP ${response.status}.`, {
    status: response.status,
    response: response.body,
  })
}

function listPayload(body) {
  const data = body?.data
  if (Array.isArray(data)) return { items: data, pagination: body?.pagination || null }
  if (Array.isArray(data?.items)) return { items: data.items, pagination: data.pagination || body?.pagination || null }
  if (Array.isArray(data?.content)) return { items: data.content, pagination: data.pagination || body?.pagination || null }
  throw new E2EDataCleanupError('List endpoint returned an unexpected data shape.', { body })
}

function hasNextPage(pagination, page, itemCount) {
  if (pagination && typeof pagination.hasNext === 'boolean') return pagination.hasNext
  if (pagination && typeof pagination.hasNextPage === 'boolean') return pagination.hasNextPage
  const totalPages = Number(pagination?.totalPages)
  if (Number.isFinite(totalPages) && totalPages > 0) return page < totalPages
  const totalItems = Number(pagination?.totalItems ?? pagination?.totalElements)
  if (Number.isFinite(totalItems) && totalItems >= 0) return page * PAGE_SIZE < totalItems
  return itemCount >= PAGE_SIZE
}

async function listPaged(client, path, query = {}) {
  const items = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await client.request('GET', path, { query: { ...query, page, size: PAGE_SIZE } })
    assertResponse(response, `GET ${path}`)
    const payload = listPayload(response.body)
    items.push(...payload.items)
    if (!hasNextPage(payload.pagination, page, payload.items.length)) return items
  }
  throw new E2EDataCleanupError(`Pagination limit exceeded for GET ${path}.`)
}

async function listHomeVideos(client) {
  const response = await client.request('GET', RESOURCE_PATHS.homeVideos)
  assertResponse(response, 'GET /admin/home-videos')
  const items = response.body?.data
  if (!Array.isArray(items)) throw new E2EDataCleanupError('Home video endpoint returned an unexpected data shape.', { body: response.body })
  return items
}

async function collectResource(client, resource) {
  const inventory = []
  if (resource === 'homeVideos') {
    inventory.push(...await listHomeVideos(client))
    return inventory
  }

  if (resource === 'products') {
    // Do not rely on the server's search fields: the marker registry also
    // covers localized identifiers, and a search endpoint may not index all
    // of them. The list is capped at 100 per page and filtered locally.
    inventory.push(...await listPaged(client, RESOURCE_PATHS[resource], {
      publishStatus: 'ALL_INCLUDING_TRASH',
    }))
    return inventory
  }
  if (resource === 'brands') {
    for (const visibility of ['VISIBLE', 'HIDDEN']) {
      inventory.push(...await listPaged(client, RESOURCE_PATHS[resource], { visibility }))
    }
    return inventory
  }
  if (resource === 'categories') {
    for (const deleted of [false, true]) {
      inventory.push(...await listPaged(client, RESOURCE_PATHS[resource], { deleted }))
    }
    return inventory
  }
  if (resource === 'articles') {
    for (const publishStatus of ['DRAFT', 'PUBLISHED', 'TRASH']) {
      inventory.push(...await listPaged(client, RESOURCE_PATHS[resource], {
        type: 'ARTICLE',
        publishStatus,
      }))
    }
    return inventory
  }
  if (resource === 'media') {
    for (const statusValue of ['ACTIVE', 'INACTIVE', 'DELETED']) {
      inventory.push(...await listPaged(client, RESOURCE_PATHS[resource], {
        status: statusValue,
      }))
    }
    return inventory
  }

  inventory.push(...await listPaged(client, RESOURCE_PATHS[resource]))
  return inventory
}

/**
 * Scan every supported E2E resource.  The result is filtered again locally;
 * every list is paginated without a marker search, so fields that the backend
 * does not index for search cannot hide a marked record.
 */
export async function scanE2EData(client) {
  const inventory = emptyInventory()
  for (const resource of RESOURCE_ORDER) {
    const seen = new Set()
    const candidates = await collectResource(client, resource)
    for (const item of candidates) {
      const id = recordId(item)
      if (!id || seen.has(id) || !matchesE2EMarker(resource, item)) continue
      seen.add(id)
      addUnique(inventory, resource, item)
    }
    inventory[resource].sort(compareRecords)
  }
  return inventory
}

export function inventoryRecords(inventory) {
  return RESOURCE_ORDER.flatMap((resource) => inventory?.[resource] || []).sort(compareRecords)
}

function productCategoryIds(product) {
  const ids = []
  if (product?.category?.id) ids.push(String(product.category.id))
  if (Array.isArray(product?.categories)) {
    for (const category of product.categories) if (category?.id) ids.push(String(category.id))
  }
  return new Set(ids)
}

function productBrandId(product) {
  return firstString(product?.brand?.id, product?.brandId)
}

function subtreeIds(rootId, categories) {
  const ids = new Set([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const category of categories) {
      const id = recordId(category)
      const parentId = firstString(category?.parentId)
      if (id && parentId && ids.has(parentId) && !ids.has(id)) {
        ids.add(id)
        changed = true
      }
    }
  }
  return ids
}

async function allProducts(client) {
  return listPaged(client, RESOURCE_PATHS.products, { publishStatus: 'ALL_INCLUDING_TRASH' })
}

async function allCategories(client) {
  const [active, deleted] = await Promise.all([
    listPaged(client, RESOURCE_PATHS.categories, { deleted: false }),
    listPaged(client, RESOURCE_PATHS.categories, { deleted: true }),
  ])
  const byId = new Map()
  for (const category of [...active, ...deleted]) {
    const id = recordId(category)
    if (id) byId.set(id, category)
  }
  return [...byId.values()]
}

async function deletionSafety(client, inventory) {
  const issues = []
  const taggedProductIds = new Set((inventory.products || []).map((record) => record.id))
  const taggedCategoryIds = new Set((inventory.categories || []).map((record) => record.id))
  const taggedBrandIds = new Set((inventory.brands || []).map((record) => record.id))

  let products = null
  let categories = null
  if ((inventory.categories || []).length || (inventory.brands || []).length) {
    products = await allProducts(client)
  }
  if ((inventory.categories || []).length) categories = await allCategories(client)

  if (categories) {
    for (const taggedCategory of inventory.categories) {
      const rootId = taggedCategory.id
      const treeIds = subtreeIds(rootId, categories)
      const unmarkedDescendants = categories
        .filter((category) => treeIds.has(recordId(category)) && !taggedCategoryIds.has(recordId(category)))
        .map((category) => `${recordId(category)} (${identity('categories', category)})`)
      if (unmarkedDescendants.length) {
        issues.push(`Danh mục ${taggedCategory.identity} có danh mục con không mang marker: ${unmarkedDescendants.join(', ')}`)
      }

      const realProducts = products
        .filter((product) => !taggedProductIds.has(recordId(product)))
        .filter((product) => [...productCategoryIds(product)].some((id) => treeIds.has(id)))
        .map((product) => `${recordId(product)} (${identity('products', product)})`)
      if (realProducts.length) {
        issues.push(`Danh mục ${taggedCategory.identity} đang liên kết sản phẩm thật: ${realProducts.join(', ')}`)
      }
    }
  }

  if (products && taggedBrandIds.size) {
    for (const taggedBrand of inventory.brands) {
      const realProducts = products
        .filter((product) => productBrandId(product) === taggedBrand.id && !taggedProductIds.has(recordId(product)))
        .map((product) => `${recordId(product)} (${identity('products', product)})`)
      if (realProducts.length) {
        issues.push(`Thương hiệu ${taggedBrand.identity} đang được sản phẩm thật dùng: ${realProducts.join(', ')}`)
      }
    }
  }

  return issues
}

function categoryDepth(record, categoriesById) {
  let depth = 0
  let current = record.raw
  const visited = new Set()
  while (current?.parentId) {
    const parentId = String(current.parentId)
    if (visited.has(parentId)) break
    visited.add(parentId)
    const parent = categoriesById.get(parentId)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

function orderEntityRecords(records, inventory) {
  const categoriesById = new Map((inventory.categories || []).map((record) => [record.id, record.raw]))
  return [...records].sort((left, right) => {
    if (left.resource === 'categories' && right.resource === 'categories') {
      // The category hard-delete contract removes a subtree and can reject a
      // parent that still has children. Delete marked descendants first.
      const depthDifference = categoryDepth(right, categoriesById) - categoryDepth(left, categoriesById)
      if (depthDifference) return depthDifference
    }
    return compareRecords(left, right)
  })
}

function permissionSet(profile) {
  const permissions = profile?.data?.permissions || profile?.permissions || profile?.data?.user?.permissions || []
  return new Set(Array.isArray(permissions) ? permissions.map(String) : [])
}

async function assertDeletePermissions(client, inventory) {
  const profileResponse = await client.request('GET', '/auth/me')
  assertResponse(profileResponse, 'GET /auth/me để kiểm tra quyền xoá')
  const permissions = permissionSet(profileResponse.body)
  const required = new Map()
  for (const resource of RESOURCE_ORDER) {
    if (!(inventory[resource] || []).length) continue
    const spec = REQUIRED_PERMISSIONS[resource]
    required.set(spec.write, resource)
    if (spec.hard) required.set(spec.hard, resource)
  }
  // Category/brand hard deletion has a safety preflight over the complete
  // product catalog, so that read permission is required before any mutation.
  if ((inventory.categories || []).length || (inventory.brands || []).length) {
    if (!permissions.has('*')) required.set('products.read', 'catalog safety preflight')
  }
  if (permissions.has('*')) return
  const missing = [...required.entries()]
    .filter(([permission]) => !permissions.has(permission))
    .map(([permission, resource]) => `${permission} (${resource})`)
  if (missing.length) {
    throw new E2EDataCleanupError(`Tài khoản không có quyền xoá bắt buộc: ${missing.join(', ')}. Chưa gửi request xoá nào.`, {
      missing,
      residual: inventory,
    })
  }
}

function knownE2EReference(reference, initialInventory, remainingInventory) {
  const id = asText(reference?.id)
  if (!id) return false
  const type = asText(reference?.type).toUpperCase()
  const typeMap = {
    PRODUCT: 'products',
    PRODUCT_GALLERY: 'products',
    ARTICLE: 'articles',
    CONTENT: 'articles',
    CONTENT_SEO_OG: 'articles',
    BRAND: 'brands',
    CATEGORY: 'categories',
    HOME_VIDEO: 'homeVideos',
    HOMEVIDEO: 'homeVideos',
  }
  const variantReference = type === 'PRODUCT_VARIANT' || type === 'PRODUCT_VARIANT_GALLERY'
  const resource = variantReference ? 'products' : typeMap[type]
  if (!resource) return false
  // Variant reference IDs belong to product_variants, not products. The API
  // supplies the owning product in adminPath, so use that ID to prove the
  // reference belonged to a marked product before it was hard-deleted.
  const referencedRecordId = variantReference
    ? asText(reference?.productId) || asText(reference?.adminPath).match(/^\/admin\/products\/([^/?#]+)/)?.[1] || ''
    : id
  if (!referencedRecordId) return false
  const wasInitiallyMarked = (initialInventory[resource] || []).some((record) => record.id === referencedRecordId)
  if (!wasInitiallyMarked) return false
  // A marked reference is safe only after the referenced E2E record is absent
  // from the post-entity-deletion scan.  This prevents media cleanup from
  // racing ahead when a product/article deletion failed.
  return !(remainingInventory[resource] || []).some((record) => record.id === referencedRecordId)
}

async function ensureDeleteResponse(client, method, path, description) {
  const response = await client.request(method, path, { allowStatuses: [404] })
  if (response.ok || response.status === 404) return response
  throw new E2EDataCleanupError(`${description} failed with HTTP ${response.status}.`, {
    resourcePath: path,
    status: response.status,
    response: response.body,
  })
}

async function deleteSoftAndHard(client, record, { softPath, hardPath, trashStatuses, description }) {
  if (!trashStatuses.includes(record.status)) await ensureDeleteResponse(client, 'DELETE', softPath, `${description} chuyển vào thùng rác`)
  await ensureDeleteResponse(client, 'DELETE', hardPath, `${description} xoá vĩnh viễn`)
}

async function deleteRecord(client, record, initialInventory, remainingInventory = initialInventory) {
  const encodedId = encodeURIComponent(record.id)
  switch (record.resource) {
    case 'products':
      return deleteSoftAndHard(client, record,
        { softPath: `/admin/products/${encodedId}`, hardPath: `/admin/products/${encodedId}/permanent`, trashStatuses: ['TRASH'], description: `Sản phẩm ${record.identity}` })
    case 'articles':
      return deleteSoftAndHard(client, record,
        { softPath: `/admin/content/article/${encodedId}`, hardPath: `/admin/content/articles/${encodedId}/permanent`, trashStatuses: ['TRASH'], description: `Bài viết ${record.identity}` })
    case 'brands':
      return deleteSoftAndHard(client, record,
        { softPath: `/admin/brands/${encodedId}`, hardPath: `/admin/brands/${encodedId}/permanent`, trashStatuses: ['HIDDEN'], description: `Thương hiệu ${record.identity}` })
    case 'categories':
      return deleteSoftAndHard(client, record,
        { softPath: `/admin/categories/${encodedId}`, hardPath: `/admin/categories/${encodedId}/permanent`, trashStatuses: ['DELETED'], description: `Danh mục ${record.identity}` })
    case 'redirects':
      return ensureDeleteResponse(client, 'DELETE', `/admin/redirects/${encodedId}`, `Chuyển hướng ${record.identity}`)
    case 'homeVideos':
      return ensureDeleteResponse(client, 'DELETE', `/admin/home-videos/${encodedId}`, `Video trang chủ ${record.identity}`)
    case 'media': {
      const detailResponse = await client.request('GET', `/admin/media/${encodedId}`)
      assertResponse(detailResponse, `GET chi tiết media ${record.identity}`)
      const detail = detailResponse.body?.data
      if (!detail || !Array.isArray(detail.references)) {
        throw new E2EDataCleanupError(`Media ${record.identity} không trả danh sách liên kết để kiểm tra an toàn. Không xoá media.`, {
          id: record.id,
          response: detailResponse.body,
        })
      }
      const references = detail.references
      const unknownReferences = references.filter((reference) => !knownE2EReference(reference, initialInventory, remainingInventory))
      if (unknownReferences.length) {
        const description = unknownReferences.map((reference) => `${reference.type || 'UNKNOWN'}:${reference.id || '?'}`).join(', ')
        throw new E2EDataCleanupError(`Media ${record.identity} còn được bản ghi không xác định sử dụng: ${description}. Không xoá media.`, {
          id: record.id,
          references: unknownReferences,
        })
      }
      if (record.status !== 'DELETED') await ensureDeleteResponse(client, 'DELETE', `/admin/media/${encodedId}`, `Media ${record.identity} chuyển vào đã xoá`)
      return ensureDeleteResponse(client, 'DELETE', `/admin/media/${encodedId}?permanent=true`, `Media ${record.identity} xoá vĩnh viễn`)
    }
    default:
      throw new E2EDataCleanupError(`Không có chiến lược xoá cho resource ${record.resource}.`)
  }
}

/**
 * Delete the inventory through direct ID endpoints and prove the result with a
 * second full marker scan.  Any failure is returned as a failed operation and
 * never converted into a note/annotation.
 */
export async function purgeE2EData(client, { logger = () => {} } = {}) {
  const before = await scanE2EData(client)
  const records = inventoryRecords(before)
  if (!records.length) return { before, deleted: [], failed: [], residual: before, safetyIssues: [] }

  await assertDeletePermissions(client, before)
  const safetyIssues = await deletionSafety(client, before)
  if (safetyIssues.length) {
    throw new E2EDataCleanupError(`Dừng trước khi xoá vì phát hiện liên kết dữ liệu thật:\n${safetyIssues.map((issue) => `- ${issue}`).join('\n')}`, {
      safetyIssues,
      residual: before,
    })
  }

  const deleted = []
  const failed = []
  // Products/entities first; media last, after all references have had a
  // chance to disappear.  Within a resource, stable ID order makes reruns
  // deterministic and keeps the operator log auditable.
  const entityRecords = orderEntityRecords(records.filter((record) => record.resource !== 'media'), before)
  const mediaRecords = records.filter((record) => record.resource === 'media')
  for (const record of entityRecords) {
    try {
      await deleteRecord(client, record, before)
      deleted.push(record)
      logger(`Đã xoá ${record.resource} ${record.identity} (${record.id})`)
    } catch (error) {
      failed.push({ record, error: String(error?.message || error) })
      logger(`LỖI xoá ${record.resource} ${record.identity} (${record.id}): ${String(error?.message || error)}`)
    }
  }

  // Re-scan before touching media so a reference to a failed entity is treated
  // as blocking instead of being mistaken for a harmless E2E reference.
  const remainingBeforeMedia = mediaRecords.length ? await scanE2EData(client) : before
  for (const record of mediaRecords) {
    try {
      await deleteRecord(client, record, before, remainingBeforeMedia)
      deleted.push(record)
      logger(`Đã xoá ${record.resource} ${record.identity} (${record.id})`)
    } catch (error) {
      failed.push({ record, error: String(error?.message || error) })
      logger(`LỖI xoá ${record.resource} ${record.identity} (${record.id}): ${String(error?.message || error)}`)
    }
  }

  const residual = await scanE2EData(client)
  if (failed.length || inventoryRecords(residual).length) {
    throw new E2EDataCleanupError(
      `Dọn dữ liệu E2E chưa hoàn tất: thất bại ${failed.length}, còn sót ${inventoryRecords(residual).length}.`,
      { before, deleted, failed, residual, safetyIssues },
    )
  }
  return { before, deleted, failed, residual, safetyIssues }
}

export function formatInventory(inventory) {
  const records = inventoryRecords(inventory)
  if (!records.length) return 'E2E data: 0 bản ghi còn sót.\nKhông có thao tác xoá nào được thực hiện.'
  const lines = [`E2E data: ${records.length} bản ghi còn sót.`]
  for (const resource of RESOURCE_ORDER) {
    const group = inventory[resource] || []
    if (!group.length) continue
    lines.push(`\n${resource} (${group.length}):`)
    for (const record of group) lines.push(`- ${record.id} | ${record.identity} | trạng thái=${record.status} | marker=${record.marker}`)
  }
  return lines.join('\n')
}

function usage() {
  return [
    'Usage:',
    '  E2E_BASE_URL=https://admin.bigbike.vn E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node scripts/ops/e2e-data-cleanup.mjs',
    '  E2E_BASE_URL=https://admin.bigbike.vn E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node scripts/ops/e2e-data-cleanup.mjs --delete',
    '',
    'Mặc định chỉ liệt kê. Chỉ --delete mới gửi request xoá.',
  ].join('\n')
}

function parseArgs(argv, env = process.env) {
  const args = { delete: false, baseUrl: env.E2E_BASE_URL || '' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--delete') args.delete = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--base-url') args.baseUrl = argv[++index] || ''
    else throw new Error(`Tham số không hợp lệ: ${arg}`)
  }
  return args
}

async function login(baseUrl, email, password) {
  const url = new URL(`${API_BASE}/auth/login`, `${baseUrl.replace(/\/$/, '')}/`)
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (response.status === 429 && attempt < 6) {
      const retryAfter = Number(response.headers.get('retry-after'))
      await wait((Number.isFinite(retryAfter) ? retryAfter * 1_000 : 13_000 + attempt * 4_000))
      continue
    }
    let body = null
    const text = await response.text()
    if (text) {
      try { body = JSON.parse(text) } catch { body = { message: text.slice(0, 500) } }
    }
    if (!response.ok || !body?.data?.accessToken) {
      throw new E2EDataCleanupError(`Đăng nhập thất bại: HTTP ${response.status}.`, { status: response.status, response: body })
    }
    return body.data.accessToken
  }
}

export async function runCli(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv, env)
  if (args.help) {
    console.log(usage())
    return 0
  }
  const baseUrl = args.baseUrl || env.E2E_BASE_URL || ''
  const email = env.E2E_ADMIN_EMAIL || ''
  const password = env.E2E_ADMIN_PASSWORD || ''
  if (!baseUrl || !email || !password) {
    console.error(`${usage()}\n\nThiếu E2E_BASE_URL, E2E_ADMIN_EMAIL hoặc E2E_ADMIN_PASSWORD.`)
    return 2
  }

  try {
    const accessToken = await login(baseUrl, email, password)
    const client = createCleanupClient({ baseUrl, accessToken })
    const inventory = await scanE2EData(client)
    console.log(formatInventory(inventory))
    if (!args.delete) {
      console.log('\nChế độ liệt kê: không có request xoá nào được thực hiện.')
      return 0
    }
    const result = await purgeE2EData(client, { logger: (message) => console.log(message) })
    console.log(`\nĐã xoá ${result.deleted.length} bản ghi. Quét sau dọn: ${inventoryRecords(result.residual).length}.`)
    return 0
  } catch (error) {
    console.error(`E2E cleanup FAILED: ${error?.message || error}`)
    if (error?.details?.failed?.length) {
      for (const failure of error.details.failed) console.error(`- còn lỗi: ${failure.record.resource}/${failure.record.id}: ${failure.error}`)
    }
    if (error?.details?.residual) console.error(formatInventory(error.details.residual))
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const exitCode = await runCli()
  process.exitCode = exitCode
}
