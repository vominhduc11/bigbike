import {
  normalizeBrand,
  normalizeCategory,
  normalizeContentItem,
  normalizeCustomer,
  normalizeImageAsset,
  normalizeMediaItem,
  normalizeMenu,
  normalizeOrder,
  normalizePagination,
  normalizeProduct,
  normalizeRedirect,
  normalizeSetting,
} from './contracts'
import { clearTokens, hasAccessToken, readTokens, writeTokens } from './authStorage'
import { getContentLang } from './contentLang'

const API_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/v1').replace(/\/$/, '')

export class ApiClientError extends Error {
  constructor(message, status, code, details = []) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = Array.isArray(details) ? details : []
  }
}

// Auth interceptor state
// We don't pull in axios just for an auth header. The same interceptor pattern
// is implemented around fetch: every request reads the latest accessToken from
// localStorage and, on 401, the request is retried once after a refresh.
//
// onAuthError is set by the AuthProvider so the UI can react (e.g. show login
// screen) when refresh ultimately fails.
let authErrorListener = null

export function setAuthErrorListener(listener) {
  authErrorListener = typeof listener === 'function' ? listener : null
}

let refreshInFlight = null

async function performTokenRefresh() {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const { refreshToken } = readTokens()
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      })
      if (!response.ok) return null
      const payload = await response.json().catch(() => null)
      const data = payload?.data
      if (!data?.accessToken) return null
      writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      return data.accessToken
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

// Attempt a silent refresh using the httpOnly cookie. Called on page load so
// the user does not need to re-login after a hard refresh.
export async function refreshAccessToken() {
  const newAccess = await performTokenRefresh()
  if (!newAccess) {
    clearTokens()
    if (authErrorListener) authErrorListener()
  }
  return newAccess
}

function toQueryString(query) {
  const params = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') {
      return
    }

    params.append(key, String(value))
  })

  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

async function dispatch(method, url, body, accessToken) {
  const headers = { Accept: 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const init = { method, headers }
  if (body !== undefined) {
    if (body instanceof FormData) {
      // Let the browser set multipart boundary automatically — do not set Content-Type
      init.body = body
    } else {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
  }
  const response = await fetch(url, init)
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  return { response, payload }
}

async function requestJson(endpoint, options = {}) {
  const { method = 'GET', query, body, skipAuth = false } = options
  const url = `${API_BASE}${endpoint}${toQueryString(query)}`

  const { accessToken } = skipAuth ? { accessToken: null } : readTokens()
  let { response, payload } = await dispatch(method, url, body, accessToken)

  // 401 -> refresh once, retry once. The refresh endpoint itself is called with
  // skipAuth so we never recurse here.
  if (response.status === 401 && !skipAuth && accessToken) {
    const newAccess = await performTokenRefresh()
    if (newAccess) {
      ({ response, payload } = await dispatch(method, url, body, newAccess))
    }
    if (response.status === 401) {
      // Refresh failed or replay still 401 — surface to AuthProvider so it can
      // clear state and show the login screen.
      clearTokens()
      if (authErrorListener) authErrorListener()
    }
  }

  if (!response.ok) {
    const error = payload?.error || {}
    throw new ApiClientError(
      error.message || `Yêu cầu thất bại (mã ${response.status}). Vui lòng thử lại.`,
      response.status,
      error.code || 'REQUEST_FAILED',
      error.details || [],
    )
  }

  return payload
}

// Admin auth API

export async function loginAdmin({ email, password }) {
  // credentials: 'include' so the server can set the httpOnly refresh cookie
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  let payload = null
  try { payload = await response.json() } catch { /* ignore */ }
  if (!response.ok) {
    const error = payload?.error || {}
    throw new ApiClientError(
      error.message || `Login failed with status ${response.status}`,
      response.status,
      error.code || 'LOGIN_FAILED',
    )
  }
  const data = payload?.data
  if (!data?.accessToken) {
    throw new ApiClientError('Login response missing access token.', 500, 'INVALID_LOGIN_RESPONSE')
  }
  // Store both tokens in memory; refresh token is also set as httpOnly cookie by the server.
  writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return { user: data.user }
}

export async function logoutAdmin() {
  const { refreshToken } = readTokens()
  try {
    // Send refreshToken in body per spec (LogoutRequest); credentials also clears the httpOnly cookie.
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    // Ignore network errors — still clear local tokens below.
  }
  clearTokens()
}

export function hasStoredAccessToken() {
  return hasAccessToken()
}

function withLiveData(data) {
  return {
    ...data,
    mode: 'live',
    warning: undefined,
  }
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error
  }

  return new Error('Đã xảy ra lỗi không xác định, vui lòng thử lại.')
}

function buildProductQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.q ?? query?.search,
    publishStatus: query?.publishStatus,
    stockState: query?.stockState,
    brandId: query?.brandId || undefined,
    categoryId: query?.categoryId || undefined,
    homepageBlock: query?.homepageBlock,
    lang: getContentLang(),
  }
}

function buildCategoryQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.search,
    visibility: query?.visibility,
    lang: getContentLang(),
  }
}

function buildBrandQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.search,
    visibility: query?.visibility,
    lang: query?.lang ?? getContentLang(),
  }
}

function buildContentQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.search,
    type: query?.type,
    publishStatus: query?.publishStatus,
    lang: getContentLang(),
  }
}

function buildRedirectQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    q: query?.search,
    enabled: query?.enabled,
    statusCode: query?.statusCode,
  }
}

function parseListPayload(payload, normalizeItem, fallbackPageSize = 10) {
  const dataPage =
    payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? payload.data
      : null
  const pageSource = Array.isArray(dataPage?.items)
    ? dataPage
    : Array.isArray(payload?.items)
      ? payload
      : null
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(pageSource?.items)
      ? pageSource.items
      : []
  const items = list.map(normalizeItem)
  const pagination = payload?.pagination || pageSource || {}
  const pageSize = Number(pagination?.pageSize) || fallbackPageSize

  return {
    items,
    pagination: normalizePagination(
      {
        page: pagination?.page || 1,
        pageSize,
        totalItems: pagination?.totalItems ?? items.length,
        totalPages:
          pagination?.totalPages ||
          Math.max(1, Math.ceil(items.length / pageSize)),
        hasNext: pagination?.hasNext,
        hasPrevious: pagination?.hasPrevious,
      },
      fallbackPageSize,
    ),
  }
}

function parseDetailPayload(payload, normalizeItem) {
  const item = payload?.data ? normalizeItem(payload.data) : undefined
  return { item }
}

function normalizeContentPathType(contentType) {
  const normalized = String(contentType || '')
    .trim()
    .toLowerCase()

  if (normalized === 'articles' || normalized === 'article') {
    return 'article'
  }
  if (normalized === 'pages' || normalized === 'page') {
    return 'page'
  }
  return 'article'
}

function normalizeContentMutationPath(contentType) {
  const normalized = normalizeContentPathType(contentType)
  return normalized === 'page' ? 'pages' : 'articles'
}

export function mapValidationErrors(error) {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.details)) {
    return {}
  }

  const FIELD_ALIASES = {
    'seo.title': 'seoTitle',
    'seo.description': 'seoDescription',
    'seo.canonicalUrl': 'seoCanonicalUrl',
    'seo.ogImage.url': 'seoOgImageUrl',
    'seo.ogImage.alt': 'seoOgImageAlt',
  }

  return error.details.reduce((acc, detail) => {
    if (!detail || typeof detail !== 'object') {
      return acc
    }
    const rawField = typeof detail.field === 'string' ? detail.field : '_form'
    // Normalize bracket notation variants[0].field -> variants.0.field
    const field = (FIELD_ALIASES[rawField] || rawField).replace(/\[(\d+)\]/g, '.$1')
    const message =
      typeof detail.message === 'string'
        ? detail.message
        : 'Invalid value.'

    if (!acc[field]) {
      acc[field] = message
    }
    return acc
  }, {})
}

export async function fetchCurrentAdminUser() {
  try {
    const payload = await requestJson('/auth/me')
    const userPayload = payload?.data || {}

    const user = {
      id: userPayload.id || 'unknown-user',
      fullName: userPayload.fullName || 'Admin user',
      email: userPayload.email || 'unknown@bigbike.local',
      roles: Array.isArray(userPayload.roles) ? userPayload.roles : ['ADMIN'],
      permissions: Array.isArray(userPayload.permissions)
        ? userPayload.permissions
        : [],
    }

    return withLiveData({ user })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchProducts(query) {
  try {
    const payload = await requestJson('/admin/products', { query: buildProductQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeProduct, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchProductDetail(productId) {
  try {
    const payload = await requestJson(`/admin/products/${productId}`)
    return withLiveData(parseDetailPayload(payload, normalizeProduct))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createProduct(input) {
  const payload = await requestJson('/admin/products', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeProduct)
}

export async function updateProduct(productId, input) {
  const payload = await requestJson(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeProduct)
}

export async function previewProduct(input, lang) {
  // Live-preview dry-run (KHÔNG lưu). Backend trả về PUBLIC Product shape — y hệt
  // storefront GET /products/{slug} — để iframe web render bằng đúng <ProductView>
  // của PDP. Vì vậy trả thẳng `data` thô, KHÔNG chạy normalizeProduct (cái đó map
  // sang model sản phẩm của admin, lệch shape so với web).
  const payload = await requestJson('/admin/products/preview', {
    method: 'POST',
    body: input,
    query: lang ? { lang } : undefined,
  })
  return payload?.data ?? null
}

export async function publishProduct(productId, publishStatus) {
  const payload = await requestJson(`/admin/products/${productId}/publish`, {
    method: 'PATCH',
    body: { publishStatus },
  })
  return parseDetailPayload(payload, normalizeProduct)
}

export async function softDeleteProduct(productId) {
  await requestJson(`/admin/products/${productId}`, { method: 'DELETE' })
}

export async function restoreProduct(productId) {
  const payload = await requestJson(`/admin/products/${productId}/restore`, { method: 'POST' })
  return parseDetailPayload(payload, normalizeProduct)
}


export async function fetchCategories(query) {
  try {
    const payload = await requestJson('/admin/categories', { query: buildCategoryQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeCategory, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

/**
 * Fetch the entire category set in a single request, sorted in tree-friendly
 * order. Used by the list screen's tree-view and the detail screen's parent
 * picker — both need every category to render correctly, and the paginated
 * list endpoint caps pageSize at 100, which silently truncates the tree as
 * the catalog grows.
 */
function flattenCategoryTree(nodes) {
  const result = []
  for (const node of nodes) {
    result.push(normalizeCategory(node))
    if (Array.isArray(node.children) && node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children))
    }
  }
  return result
}

// lang mặc định = ngôn ngữ nội dung hiện tại (EN ở admin = strict, ẩn mục chưa dịch).
// Truyền lang='vi' khi cần TOÀN BỘ cây cho ô chọn cha trong form (không được ẩn
// mục chưa dịch, nếu không sẽ mất lựa chọn cha hợp lệ khi đang ở chế độ EN).
export async function fetchCategoryTree(lang) {
  try {
    const payload = await requestJson('/admin/categories/tree', { query: { lang: lang ?? getContentLang() } })
    const items = Array.isArray(payload?.data) ? flattenCategoryTree(payload.data) : []
    return withLiveData({ items })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchCategoryDetail(categoryId) {
  try {
    const payload = await requestJson(`/admin/categories/${categoryId}`)
    return withLiveData(parseDetailPayload(payload, normalizeCategory))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createCategory(input) {
  const payload = await requestJson('/admin/categories', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeCategory)
}

export async function updateCategory(categoryId, input) {
  const payload = await requestJson(`/admin/categories/${categoryId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeCategory)
}

export async function hardDeleteCategory(categoryId) {
  await requestJson(`/admin/categories/${categoryId}`, { method: 'DELETE' })
}

export async function fetchBrands(query) {
  try {
    const payload = await requestJson('/admin/brands', { query: buildBrandQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeBrand, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchBrandDetail(brandId) {
  try {
    const payload = await requestJson(`/admin/brands/${brandId}`)
    return withLiveData(parseDetailPayload(payload, normalizeBrand))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createBrand(input) {
  const payload = await requestJson('/admin/brands', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeBrand)
}

export async function updateBrand(brandId, input) {
  const payload = await requestJson(`/admin/brands/${brandId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeBrand)
}

export async function deleteBrand(brandId) {
  const payload = await requestJson(`/admin/brands/${brandId}`, { method: 'DELETE' })
  return parseDetailPayload(payload, normalizeBrand)
}

// Attribute management

export async function fetchAttributes() {
  const payload = await requestJson('/admin/attributes')
  // Endpoint returns a bare JSON array (no envelope); tolerate both shapes.
  return Array.isArray(payload) ? payload : (payload?.data ?? [])
}

export async function fetchAttributeValues(attributeId) {
  const payload = await requestJson(`/admin/attributes/${attributeId}/values`)
  // Endpoint returns a bare JSON array (no envelope); tolerate both shapes.
  return Array.isArray(payload) ? payload : (payload?.data ?? [])
}

export async function updateAttribute(attributeId, { name, nameEn }) {
  const payload = await requestJson(`/admin/attributes/${attributeId}`, {
    method: 'PATCH',
    body: { name, nameEn },
  })
  return payload?.data ?? payload
}

export async function createAttributeValue(attributeId, { label, labelEn, slug } = {}) {
  const payload = await requestJson(`/admin/attributes/${attributeId}/values`, {
    method: 'POST',
    body: { label, labelEn, ...(slug ? { slug } : {}) },
  })
  return payload?.data ?? payload
}

export async function updateAttributeValueLabel(valueId, { label, labelEn }) {
  const payload = await requestJson(`/admin/attribute-values/${valueId}`, {
    method: 'PATCH',
    body: { label, labelEn },
  })
  return payload?.data ?? payload
}

export async function fetchContent(query) {
  try {
    const payload = await requestJson('/admin/content', { query: buildContentQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeContentItem, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchContentDetail(contentType, contentId) {
  const pathType = normalizeContentPathType(contentType)

  try {
    const endpoint = `/admin/content/${pathType}/${contentId}`
    const payload = await requestJson(endpoint)
    return withLiveData(parseDetailPayload(payload, normalizeContentItem))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createContent(contentType, input) {
  const mutationPath = normalizeContentMutationPath(contentType)
  const payload = await requestJson(`/admin/content/${mutationPath}`, {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function updateContent(contentType, contentId, input) {
  const mutationPath = normalizeContentMutationPath(contentType)
  const payload = await requestJson(`/admin/content/${mutationPath}/${contentId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function deleteContent(contentType, contentId) {
  const pathType = normalizeContentPathType(contentType)
  const payload = await requestJson(`/admin/content/${pathType}/${contentId}`, { method: 'DELETE' })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function previewArticle(input, lang) {
  // Live-preview dry-run cho bài viết (KHÔNG lưu). Trả PUBLIC Article shape (như
  // GET /api/v1/articles/{slug}) để iframe web render bằng đúng <ArticleView>. Trả
  // thẳng `data` thô, KHÔNG normalize sang model admin.
  const payload = await requestJson('/admin/content/articles/preview', {
    method: 'POST',
    body: input,
    query: lang ? { lang } : undefined,
  })
  return payload?.data ?? null
}

export async function fetchContentCategories() {
  const payload = await requestJson('/admin/content/reference/categories')
  return (payload?.data ?? []).map((c) => ({ id: String(c.id ?? ''), slug: String(c.slug ?? ''), name: String(c.name ?? '') }))
}

export async function fetchContentPageRefs() {
  const payload = await requestJson('/admin/content/reference/pages')
  return (payload?.data ?? []).map((p) => ({ id: String(p.id ?? ''), slug: String(p.slug ?? ''), title: String(p.title ?? '') }))
}

function mapContentCategory(c) {
  const s = c && typeof c === 'object' ? c : {}
  return { id: String(s.id ?? ''), slug: String(s.slug ?? ''), name: String(s.name ?? '') }
}

// Content (blog) category CRUD — POST/PATCH /admin/content/content-categories (perm content.update).
// Note: createCategory() above targets /admin/categories (product categories) — a different resource.
export async function createContentCategory(input) {
  const payload = await requestJson('/admin/content/content-categories', { method: 'POST', body: input })
  return mapContentCategory(payload?.data)
}

export async function updateContentCategory(categoryId, input) {
  const payload = await requestJson(`/admin/content/content-categories/${categoryId}`, { method: 'PATCH', body: input })
  return mapContentCategory(payload?.data)
}

// Hard-delete a content (blog) category. Backend returns 204 and rejects with
// CATEGORY_IN_USE when articles still reference it.
export async function deleteContentCategory(categoryId) {
  await requestJson(`/admin/content/content-categories/${categoryId}`, { method: 'DELETE' })
}

export async function fetchRedirects(query) {
  try {
    const payload = await requestJson('/admin/redirects', { query: buildRedirectQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeRedirect, Number(query?.pageSize) || 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchRedirectDetail(redirectId) {
  try {
    const payload = await requestJson(`/admin/redirects/${redirectId}`)
    return withLiveData(parseDetailPayload(payload, normalizeRedirect))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createRedirect(input) {
  const payload = await requestJson('/admin/redirects', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeRedirect)
}

export async function updateRedirect(redirectId, input) {
  const payload = await requestJson(`/admin/redirects/${redirectId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeRedirect)
}

export async function deleteRedirect(redirectId) {
  await requestJson(`/admin/redirects/${redirectId}`, { method: 'DELETE' })
}

// Orders

export async function fetchOrders(query) {
  try {
    const payload = await requestJson('/admin/orders', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        sort: query?.sort,
        q: query?.search,
        status: query?.orderStatus !== 'ALL' ? query?.orderStatus : undefined,
        paymentStatus: query?.paymentStatus !== 'ALL' ? query?.paymentStatus : undefined,
        from: query?.dateRange?.from?.toISOString().slice(0, 10),
        to: query?.dateRange?.to?.toISOString().slice(0, 10),
      },
    })
    return withLiveData(parseListPayload(payload, normalizeOrder, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchOrderDetail(orderId) {
  try {
    const payload = await requestJson(`/admin/orders/${orderId}`)
    return withLiveData(parseDetailPayload(payload, normalizeOrder))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateOrderStatus(orderId, orderStatus, reason) {
  const body = { status: orderStatus }
  // BE DTO UpdateOrderStatusRequest field is `note` (not `reason`); the cancel/fail reason
  // the admin types is persisted as the order note. Sending `reason` was silently dropped.
  if (reason) body.note = reason
  const payload = await requestJson(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body,
  })
  return parseDetailPayload(payload, normalizeOrder)
}

export async function fetchOrderAllowedTransitions(orderId) {
  try {
    const payload = await requestJson(`/admin/orders/${orderId}/allowed-transitions`)
    const list = Array.isArray(payload?.data) ? payload.data : []
    return { transitions: list }
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateOrderPaymentStatus(orderId, paymentStatus, paidAmount) {
  const body = { paymentStatus }
  if (paidAmount !== undefined && paidAmount !== null) body.paidAmount = paidAmount
  const payload = await requestJson(`/admin/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    body,
  })
  return parseDetailPayload(payload, normalizeOrder)
}

export async function updateOrderFulfillment(orderId, body) {
  const payload = await requestJson(`/admin/orders/${orderId}/fulfillment`, {
    method: 'PATCH',
    body,
  })
  return parseDetailPayload(payload, normalizeOrder)
}

export async function addOrderNote(orderId, { content, customerVisible = false }) {
  const payload = await requestJson(`/admin/orders/${orderId}/notes`, {
    method: 'POST',
    body: { content, customerVisible },
  })
  return payload?.data ?? null
}

export async function fetchOrderAuditTrail(orderId) {
  try {
    const payload = await requestJson(`/admin/orders/${orderId}/audit`)
    return Array.isArray(payload?.data) ? payload.data : []
  } catch (error) {
    throw normalizeError(error)
  }
}

// Customers

export async function fetchCustomers(query) {
  try {
    const payload = await requestJson('/admin/customers', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status, emailVerified: query?.emailVerified },
    })
    return withLiveData(parseListPayload(payload, normalizeCustomer, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchCustomerSummary() {
  const payload = await requestJson('/admin/customers/summary')
  const d = payload?.data || {}
  return {
    total: Number(d.total ?? 0),
    vip: Number(d.vip ?? 0),
    newLast30Days: Number(d.newLast30Days ?? 0),
    active: Number(d.active ?? 0),
  }
}

export async function fetchCustomerDetail(customerId) {
  try {
    const payload = await requestJson(`/admin/customers/${customerId}`)
    return withLiveData(parseDetailPayload(payload, normalizeCustomer))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateCustomerStatus(customerId, status) {
  const payload = await requestJson(`/admin/customers/${customerId}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return parseDetailPayload(payload, normalizeCustomer)
}

export async function updateCustomer(customerId, data) {
  const payload = await requestJson(`/admin/customers/${customerId}`, {
    method: 'PATCH',
    body: data,
  })
  return parseDetailPayload(payload, normalizeCustomer)
}

// Media

export async function fetchMedia(query) {
  try {
    const q = buildMediaQueryParams(query)
    q.page = query?.page
    q.size = query?.pageSize
    const payload = await requestJson('/admin/media', { query: q })
    return withLiveData(parseListPayload(payload, normalizeMediaItem, Number(query?.pageSize) || 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

function buildMediaQueryParams(query) {
  return {
    q: query?.search || undefined,
    mimeType: query?.mimeType && query.mimeType !== 'ALL' ? query.mimeType : undefined,
    status: query?.status && query.status !== 'ALL' ? query.status : undefined,
    usageFilter: query?.usageFilter && query.usageFilter !== 'ALL' ? query.usageFilter : undefined,
    uploadedFrom: query?.uploadedFrom || undefined,
    uploadedTo: query?.uploadedTo || undefined,
    minSize: query?.minSize ? Number(query.minSize) : undefined,
    maxSize: query?.maxSize ? Number(query.maxSize) : undefined,
    minWidth: query?.minWidth ? Number(query.minWidth) : undefined,
    minHeight: query?.minHeight ? Number(query.minHeight) : undefined,
    sort: query?.sort && query.sort !== 'createdAt' ? query.sort : undefined,
    dir: query?.dir && query.dir !== 'desc' ? query.dir : undefined,
    folderFilter: query?.folderFilter || undefined,
    tag: query?.tag || undefined,
  }
}

export async function fetchMediaStats(query) {
  const q = buildMediaQueryParams(query)
  delete q.sort; delete q.dir; delete q.usageFilter
  const payload = await requestJson('/admin/media/stats', { query: q })
  return payload?.data ?? null
}

export async function bulkDeleteMedia(ids) {
  const payload = await requestJson('/admin/media/bulk-delete', {
    method: 'POST',
    body: { ids },
  })
  return payload?.data?.affected ?? 0
}

export async function bulkRestoreMedia(ids) {
  const payload = await requestJson('/admin/media/bulk-restore', {
    method: 'POST',
    body: { ids },
  })
  return payload?.data?.affected ?? 0
}

export async function bulkHardDeleteMedia(ids) {
  const payload = await requestJson('/admin/media/bulk-hard-delete', {
    method: 'POST',
    body: { ids },
  })
  return payload?.data ?? { deleted: 0, missing: 0, blocked: 0 }
}

export async function bulkMoveMedia(ids, folderId) {
  const payload = await requestJson('/admin/media/bulk-move', {
    method: 'POST',
    body: { ids, folderId },
  })
  return payload?.data?.affected ?? 0
}

export async function fetchMediaFolders() {
  const payload = await requestJson('/admin/media-folders')
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function createMediaFolder(input) {
  const payload = await requestJson('/admin/media-folders', { method: 'POST', body: input })
  return payload?.data
}

export async function updateMediaFolder(id, input) {
  const payload = await requestJson(`/admin/media-folders/${id}`, { method: 'PATCH', body: input })
  return payload?.data
}

export async function deleteMediaFolder(id) {
  await requestJson(`/admin/media-folders/${id}`, { method: 'DELETE' })
}

export async function replaceMediaFile(mediaId, file) {
  const form = new FormData()
  form.append('file', file)
  const payload = await requestJson(`/admin/media/${mediaId}/replace`, {
    method: 'POST',
    body: form,
  })
  return { item: normalizeMediaItem(payload?.data || {}) }
}

export async function fetchMediaTags(prefix) {
  const q = prefix ? { prefix, limit: 20 } : { limit: 50 }
  const payload = await requestJson('/admin/media/tags', { query: q })
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function fetchMediaReferences(mediaId) {
  const payload = await requestJson(`/admin/media/${mediaId}/references`)
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function deleteMedia(mediaId) {
  await requestJson(`/admin/media/${mediaId}`, { method: 'DELETE' })
}

export async function hardDeleteMedia(mediaId) {
  await requestJson(`/admin/media/${mediaId}`, { method: 'DELETE', query: { permanent: true } })
}

export async function restoreMedia(mediaId) {
  const payload = await requestJson(`/admin/media/${mediaId}/restore`, { method: 'POST' })
  return { item: normalizeMediaItem(payload?.data || {}) }
}

export async function updateMedia(mediaId, body) {
  const payload = await requestJson(`/admin/media/${mediaId}`, { method: 'PATCH', body })
  return { item: normalizeMediaItem(payload?.data || {}) }
}

export async function uploadMedia(file, altText = '', onProgress = null) {

  // First attempt with current access token; if 401, refresh once and retry.
  // We must use XHR (not fetch) because XHR exposes upload progress events.
  async function attempt(token) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      if (altText) formData.append('altText', altText)

      if (typeof onProgress === 'function') {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        })
      }

      xhr.open('POST', `${API_BASE}/admin/media`)
      xhr.setRequestHeader('Accept', 'application/json')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.onload = () => {
        let payload = null
        try { payload = JSON.parse(xhr.responseText) } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ item: normalizeMediaItem(payload?.data || {}) })
        } else {
          const error = payload?.error || {}
          reject(new ApiClientError(
            error.message || `Upload failed with status ${xhr.status}`,
            xhr.status,
            error.code || 'UPLOAD_FAILED',
            error.details || [],
          ))
        }
      }
      xhr.onerror = () => reject(new ApiClientError('Network error during upload', 0, 'NETWORK_ERROR'))
      xhr.onabort = () => reject(new ApiClientError('Upload aborted', 0, 'ABORTED'))
      xhr.send(formData)
    })
  }

  const { accessToken } = readTokens()
  try {
    return await attempt(accessToken)
  } catch (err) {
    if (err?.status === 401 && accessToken) {
      const refreshed = await performTokenRefresh()
      if (refreshed) return await attempt(refreshed)
    }
    throw err
  }
}

// Settings

export async function fetchSettings() {
  try {
    const payload = await requestJson('/admin/settings', { query: { page: 1, size: 200 } })
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
    return withLiveData({ items: list })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateSetting(key, value) {
  const payload = await requestJson(`/admin/settings/${key}`, {
    method: 'PATCH',
    body: { value },
  })
  return { item: normalizeSetting(payload?.data || {}) }
}

export async function batchUpdateSettings(updates) {
  const payload = await requestJson('/admin/settings', {
    method: 'PATCH',
    body: { updates },
  })
  const items = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
  return { items }
}

// Editable "Phân công" guide text for the product create/edit banner.
// Read is gated by products.read (not settings.read) so SHOP_MANAGER/EDITOR see it too.
export async function fetchProductAssignment() {
  const payload = await requestJson('/admin/product-assignment')
  return payload?.data || {}
}

// Menus

export async function fetchMenus() {
  try {
    const payload = await requestJson('/admin/menus')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeMenu) : []
    return withLiveData({ items: list })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchMenuDetail(menuId) {
  try {
    const payload = await requestJson(`/admin/menus/${menuId}`)
    return withLiveData(parseDetailPayload(payload, normalizeMenu))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createMenuItem(menuId, input) {
  const payload = await requestJson(`/admin/menus/${menuId}/items`, { method: 'POST', body: input })
  return { item: payload?.data }
}

export async function deleteMenuItem(menuId, itemId) {
  await requestJson(`/admin/menus/${menuId}/items/${itemId}`, { method: 'DELETE' })
}

// NOTE: createMenu / updateMenu / deleteMenu admin endpoints exist on the
// backend but are intentionally not exposed here. Menu containers are
// system-defined slots (primary, footer, guide) seeded by Flyway and the
// admin UI manages only the items inside them.

export async function updateMenuItem(menuId, itemId, input) {
  const payload = await requestJson(`/admin/menus/${menuId}/items/${itemId}`, { method: 'PATCH', body: input })
  return { item: payload?.data }
}

export async function reorderMenuItems(menuId, items) {
  const payload = await requestJson(`/admin/menus/${menuId}/items/reorder`, {
    method: 'POST',
    body: { items },
  })
  return withLiveData(parseDetailPayload(payload, normalizeMenu))
}

// Sliders

function normalizeSlider(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: String(s.id || ''),
    location: String(s.location || 'home'),
    sortOrder: Number(s.sortOrder ?? 0),
    isActive: s.isActive !== false,
    desktopImage: normalizeImageAsset(s.desktopImage) ?? null,
    mobileImage: normalizeImageAsset(s.mobileImage) ?? null,
    externalLink: s.externalLink || null,
    productId: s.productId || null,
    productName: (s.product && typeof s.product === 'object' ? s.product.name : null) || null,
    // Tên tiếng Anh của SP liên kết (admin VI/EN switch). Lấy từ translations.en.name
    // có sẵn trong product domain (admin detail). Rỗng nếu SP chưa có tên tiếng Anh.
    productNameEn: (s.product && typeof s.product === 'object' ? s.product.translations?.en?.name : null) || null,
  }
}

export async function fetchSliders(location = 'home') {
  try {
    const payload = await requestJson('/admin/sliders', { query: { location } })
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSlider) : []
    return withLiveData({ items: list })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createSlider(input) {
  const payload = await requestJson('/admin/sliders', { method: 'POST', body: input })
  return { item: normalizeSlider(payload?.data || {}) }
}

export async function updateSlider(sliderId, input) {
  const payload = await requestJson(`/admin/sliders/${sliderId}`, { method: 'PATCH', body: input })
  return { item: normalizeSlider(payload?.data || {}) }
}

export async function reorderSliders(location, items) {
  const payload = await requestJson('/admin/sliders/reorder', {
    method: 'POST',
    body: { location, items },
  })
  const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSlider) : []
  return withLiveData({ items: list })
}

export async function deleteSlider(sliderId) {
  await requestJson(`/admin/sliders/${sliderId}`, { method: 'DELETE' })
}

// -- Home Category Highlights -------------------------------------------------------

export async function fetchHomeHighlights() {
  try {
    const payload = await requestJson('/admin/home/category-highlights', { query: { lang: getContentLang() } })
    return withLiveData({ items: Array.isArray(payload?.data) ? payload.data : [] })
  } catch (error) {
    const e = normalizeError(error)
    throw e
  }
}

export async function saveHomeHighlights(slots) {
  const payload = await requestJson('/admin/home/category-highlights', {
    method: 'PUT',
    body: { slots },
  })
  return { items: Array.isArray(payload?.data) ? payload.data : [] }
}

// Guide page builder (/huong-dan layout). Returns { heroTitleVi, heroTitleEn, heroImageUrl, entries }.
// Detail bodies live in Content -> Pages (referenced by each entry's pageSlug).
export async function fetchGuidePage() {
  const payload = await requestJson('/admin/guide-page')
  const data = payload?.data ?? {}
  return {
    heroTitleVi: data.heroTitleVi ?? '',
    heroTitleEn: data.heroTitleEn ?? '',
    heroImageUrl: data.heroImageUrl ?? '',
    entries: Array.isArray(data.entries) ? data.entries : [],
  }
}

// Saves the hero plus the whole guide card list in one PUT.
export async function saveGuidePage({ heroTitleVi, heroTitleEn, heroImageUrl, entries }) {
  const payload = await requestJson('/admin/guide-page', {
    method: 'PUT',
    body: { heroTitleVi, heroTitleEn, heroImageUrl, entries },
  })
  const data = payload?.data ?? {}
  return {
    heroTitleVi: data.heroTitleVi ?? '',
    heroTitleEn: data.heroTitleEn ?? '',
    heroImageUrl: data.heroImageUrl ?? '',
    entries: Array.isArray(data.entries) ? data.entries : [],
  }
}

// Home Videos

function normalizeHomeVideo(input) {
  return {
    id: input.id ?? '',
    sortOrder: input.sortOrder ?? 0,
    title: input.title ?? '',
    titleEn: input.titleEn ?? '',
    videoUrl: input.videoUrl ?? '',
    youtubeId: input.youtubeId ?? null,
    thumbnail: normalizeImageAsset(input.thumbnail) ?? null,
    isActive: input.isActive !== false,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
  }
}

export async function fetchHomeVideos() {
  try {
    const payload = await requestJson('/admin/home-videos')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeHomeVideo) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    throw e
  }
}

export async function createHomeVideo(input) {
  const payload = await requestJson('/admin/home-videos', { method: 'POST', body: input })
  return { item: normalizeHomeVideo(payload?.data || {}) }
}

export async function updateHomeVideo(id, input) {
  const payload = await requestJson(`/admin/home-videos/${id}`, { method: 'PATCH', body: input })
  return { item: normalizeHomeVideo(payload?.data || {}) }
}

export async function reorderHomeVideos(items) {
  const payload = await requestJson('/admin/home-videos/reorder', {
    method: 'POST',
    body: { items },
  })
  const list = Array.isArray(payload?.data) ? payload.data.map(normalizeHomeVideo) : []
  return withLiveData({ items: list })
}

export async function deleteHomeVideo(id) {
  await requestJson(`/admin/home-videos/${id}`, { method: 'DELETE' })
}

// Admin Users

function normalizeAdminUser(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: String(s.id || ''),
    email: String(s.email || ''),
    displayName: String(s.displayName || ''),
    role: String(s.role || ''),
    status: String(s.status || ''),
    lastLoginAt: s.lastLoginAt || null,
    createdAt: s.createdAt || '',
    updatedAt: s.updatedAt || '',
  }
}

export async function fetchAdminUsers(query) {
  try {
    const payload = await requestJson('/admin/admin-users', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        q: query?.search,
        role: query?.role || undefined,
        status: query?.status || undefined,
      },
    })
    return withLiveData(parseListPayload(payload, normalizeAdminUser, 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createAdminUser(input) {
  const payload = await requestJson('/admin/admin-users', { method: 'POST', body: input })
  const data = payload?.data || {}
  return {
    item: normalizeAdminUser(data),
    inviteEmailSent: data.inviteEmailSent !== false,
    inviteUrl: data.inviteUrl || '',
  }
}

export async function resendAdminInvite(userId) {
  const payload = await requestJson(`/admin/admin-users/${userId}/resend-invite`, { method: 'POST' })
  const data = payload?.data || {}
  return {
    item: normalizeAdminUser(data),
    inviteEmailSent: data.inviteEmailSent !== false,
    inviteUrl: data.inviteUrl || '',
  }
}

export async function updateAdminUser(userId, input) {
  const payload = await requestJson(`/admin/admin-users/${userId}`, { method: 'PATCH', body: input })
  return { item: normalizeAdminUser(payload?.data || {}) }
}

// ── Admin invite (public, token-gated — no auth) ─────────────────────────────
export async function validateAdminInvite(token) {
  const payload = await requestJson(`/auth/admin/invite?token=${encodeURIComponent(token)}`, { skipAuth: true })
  const data = payload?.data || {}
  return { email: String(data.email || ''), expiresAt: data.expiresAt || '' }
}

export async function acceptAdminInvite(token, password) {
  await requestJson('/auth/admin/accept-invite', { method: 'POST', body: { token, password }, skipAuth: true })
}

// Reviews

function normalizeReview(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: s.id,
    productId: String(s.productId || ''),
    productName: String(s.productName || ''),
    productNameEn: String(s.productNameEn || ''),
    productSlug: String(s.productSlug || ''),
    authorName: String(s.authorName || ''),
    authorEmail: String(s.authorEmail || ''),
    rating: Number(s.rating ?? 0),
    title: String(s.title || ''),
    body: String(s.body || ''),
    photos: Array.isArray(s.photos) ? s.photos.map(String) : [],
    status: String(s.status || ''),
    createdAt: s.createdAt || '',
    updatedAt: s.updatedAt || '',
  }
}

export async function fetchReviews(query) {
  try {
    const payload = await requestJson('/admin/reviews', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status, lang: getContentLang() },
    })
    return withLiveData(parseListPayload(payload, normalizeReview, 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchReviewDetail(reviewId) {
  try {
    const payload = await requestJson(`/admin/reviews/${reviewId}`)
    return withLiveData(parseDetailPayload(payload, normalizeReview))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateReviewStatus(reviewId, status) {
  const payload = await requestJson(`/admin/reviews/${reviewId}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return { item: normalizeReview(payload?.data || {}) }
}

export async function deleteReview(reviewId) {
  await requestJson(`/admin/reviews/${reviewId}`, { method: 'DELETE' })
}

// Audit Logs

function normalizeAuditLog(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: s.id || '',
    actorType: s.actorType || '',
    actorId: s.actorId || null,
    actorDisplayName: s.actorDisplayName || null,
    actorEmail: s.actorEmail || null,
    action: s.action || '',
    resourceType: s.resourceType || '',
    resourceId: s.resourceId || null,
    resourceDisplayName: s.resourceDisplayName || null,
    resourceCode: s.resourceCode || null,
    beforeData: s.beforeData || null,
    afterData: s.afterData || null,
    ipAddress: s.ipAddress || null,
    createdAt: s.createdAt || '',
  }
}

export async function fetchAuditLogs(query) {
  try {
    const payload = await requestJson('/admin/audit-logs', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        actorType:    query?.actorType    === 'ALL' ? undefined : query?.actorType,
        resourceType: query?.resourceType === 'ALL' ? undefined : query?.resourceType,
        action:       query?.action       === 'ALL' ? undefined : query?.action,
        q:    query?.q    || undefined,
        from: query?.from || undefined,
        to:   query?.to   || undefined,
      },
    })
    return withLiveData(parseListPayload(payload, normalizeAuditLog, Number(query?.pageSize) || 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

// Reports / Analytics

export async function fetchAnalytics(from, to) {
  try {
    const payload = await requestJson('/admin/reports/analytics', {
      query: { from: from || undefined, to: to || undefined },
    })
    return { data: normalizeAnalytics(payload), mode: 'live' }
  } catch (error) {
    throw normalizeError(error)
  }
}

function normalizeAnalytics(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const summary = p.summary && typeof p.summary === 'object' ? p.summary : {}
  // grossOrderValue ?? totalRevenue: backward compat with old backend shape during rollout
  const grossOrderValue = Number(summary.grossOrderValue ?? summary.totalRevenue) || 0
  const paidRevenue = Number(summary.paidRevenue) || 0
  const refundAmount = Number(summary.refundAmount) || 0
  return {
    summary: {
      grossOrderValue,
      paidRevenue,
      refundAmount,
      netRevenue: Number(summary.netRevenue) || (paidRevenue - refundAmount),
      orderCount: Number(summary.orderCount) || 0,
      avgOrderValue: Number(summary.avgOrderValue) || 0,
    },
    dailyRevenue: Array.isArray(p.dailyRevenue) ? p.dailyRevenue.map((r) => ({
      date: String(r.date || ''),
      revenue: Number(r.revenue) || 0,
      orders: Number(r.orders) || 0,
    })) : [],
    topProducts: Array.isArray(p.topProducts) ? p.topProducts.map((r) => ({
      productKey: String(r.productKey || r.productId || ''),
      productName: String(r.productName || ''),
      revenue: Number(r.revenue) || 0,
      unitsSold: Number(r.unitsSold) || 0,
    })) : [],
    topCustomers: Array.isArray(p.topCustomers) ? p.topCustomers.map((r) => ({
      customerKey: String(r.customerKey || r.email || ''),
      customerEmail: String(r.customerEmail || r.email || ''),
      revenue: Number(r.revenue ?? r.totalSpent) || 0,
      orderCount: Number(r.orderCount) || 0,
    })) : [],
  }
}

// Reports / Export

// Trình duyệt lưu blob xuống máy người dùng (tạo link tải tạm rồi click).
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Lấy tên file backend gửi qua header Content-Disposition; fallback nếu thiếu.
function filenameFromDisposition(headerValue, fallback) {
  if (!headerValue) return fallback
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue)
  if (utf8Match) {
    try { return decodeURIComponent(utf8Match[1]) } catch { /* ignore */ }
  }
  const match = /filename="?([^";]+)"?/i.exec(headerValue)
  return match ? match[1].trim() : fallback
}

async function fetchCsvBlob(path, params = {}, fallbackName = 'export.csv') {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`

  const doFetch = (token) => {
    const headers = { Accept: 'text/csv' }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(url, { headers })
  }

  let { accessToken } = readTokens()
  let response = await doFetch(accessToken)

  if (response.status === 401 && accessToken) {
    const newAccess = await performTokenRefresh()
    if (newAccess) {
      response = await doFetch(newAccess)
    }
    if (response.status === 401) {
      clearTokens()
      if (authErrorListener) authErrorListener()
    }
  }

  if (!response.ok) {
    throw new ApiClientError(`Export failed with status ${response.status}`, response.status, 'EXPORT_FAILED')
  }
  const blob = await response.blob()
  const filename = filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName)
  triggerBlobDownload(blob, filename)
  return {
    filename,
    truncated: response.headers.get('X-Export-Truncated') === 'true',
    maxRows: Number(response.headers.get('X-Export-Max-Rows')) || null,
  }
}

export async function exportOrdersCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/orders/export', {
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    from: filters.from,
    to: filters.to,
  }, 'orders.csv')
}

export async function exportCustomersCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/customers/export', { status: filters.status }, 'customers.csv')
}

export async function exportProductsCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/products/export', { publishStatus: filters.publishStatus }, 'products.csv')
}

// Inventory
// Chỉ còn endpoint tổng kết (Còn/Hết) phục vụ cảnh báo "Hết hàng" ở Dashboard.
// Màn "Kho hàng" độc lập đã gỡ — trạng thái Còn/Hết sửa trong form sản phẩm.

export async function fetchInventorySummary() {
  const payload = await requestJson('/admin/inventory/summary')
  const d = payload?.data || payload || {}
  return {
    totalItems: Number(d.totalItems) || 0,
    inStockCount: Number(d.inStockCount) || 0,
    outOfStockCount: Number(d.outOfStockCount) || 0,
  }
}

// Dashboard

export async function fetchDashboardSummary(period = '30d') {
  try {
    const payload = await requestJson(`/admin/dashboard?period=${period}`)
    if (!payload?.data) {
      throw new ApiClientError('Dashboard response missing data.', 500, 'INVALID_DASHBOARD_RESPONSE')
    }
    return { data: payload.data }
  } catch (error) {
    throw normalizeError(error)
  }
}

// Roles & Permissions

function normalizeRole(input) {
  const r = input && typeof input === 'object' ? input : {}
  return {
    id: String(r.id || ''),
    name: String(r.name || ''),
    description: String(r.description || ''),
    isSystem: r.isSystem === true,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
  }
}

export async function fetchPermissionCatalog() {
  const payload = await requestJson('/admin/permissions')
  return Array.isArray(payload?.data) ? payload.data : null
}

export async function fetchRoles() {
  try {
    const payload = await requestJson('/admin/roles')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeRole) : []
    return withLiveData({ items: list })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateRolePermissions(roleId, permissions) {
  const payload = await requestJson(`/admin/roles/${encodeURIComponent(roleId)}/permissions`, {
    method: 'PUT',
    body: { permissions: Array.isArray(permissions) ? permissions : Array.from(permissions) },
  })
  return { item: normalizeRole(payload?.data || {}) }
}

export async function createRole(input) {
  const payload = await requestJson('/admin/roles', { method: 'POST', body: input })
  return { item: normalizeRole(payload?.data || {}) }
}

export async function deleteRole(roleId) {
  await requestJson(`/admin/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' })
}

// Featured Products (homepage blocks)

export async function fetchHomepageBlocks() {
  const payload = await requestJson('/admin/products', {
    query: { homepageBlock: 'FEATURED_GRID', size: 20, sort: 'homepageOrder:asc', lang: getContentLang() },
  })
  return {
    featuredGrid: (Array.isArray(payload?.data) ? payload.data : (payload?.items ?? [])).map(normalizeProduct),
  }
}

export async function saveHomepageBlocks(featuredGrid) {
  const payload = await requestJson('/admin/products/homepage-blocks', {
    method: 'POST',
    body: { featuredGrid },
  })
  return payload
}

// ── Admin notifications (server-persisted, V102) ─────────────────────────────
// Complements the realtime /topic/admin/orders WebSocket feed: lets an admin on a
// new browser / after being offline catch up on order events the backend stored.
function normalizeAdminNotification(input) {
  const s = input && typeof input === 'object' ? input : {}
  let parsed = {}
  if (typeof s.payload === 'string') {
    try { parsed = JSON.parse(s.payload) } catch { parsed = {} }
  } else if (s.payload && typeof s.payload === 'object') {
    parsed = s.payload
  }
  return {
    id: s.id != null ? String(s.id) : '',
    type: s.type || parsed.type || 'ORDER_UPDATE',
    orderId: s.orderId ? String(s.orderId) : '',
    orderNumber: s.orderNumber || parsed.orderNumber || '',
    status: parsed.status,
    paymentMethod: parsed.paymentMethod,
    at: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
    read: s.isRead === true,
    fromServer: true,
  }
}

export async function fetchAdminNotifications() {
  const payload = await requestJson('/admin/notifications')
  const data = payload?.data ?? {}
  const items = Array.isArray(data.items) ? data.items : []
  return {
    unreadCount: Number(data.unreadCount ?? items.length),
    items: items.map(normalizeAdminNotification),
  }
}

export async function markAdminNotificationsRead(ids) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (list.length === 0) return { updated: 0 }
  const payload = await requestJson('/admin/notifications/mark-read', {
    method: 'POST',
    body: { ids: list },
  })
  return payload?.data ?? { updated: 0 }
}

export async function markAllAdminNotificationsRead() {
  const payload = await requestJson('/admin/notifications/mark-all-read', { method: 'POST' })
  return payload?.data ?? { updated: 0 }
}
