import {
  normalizeBrand,
  normalizeCategory,
  normalizeContentItem,
  normalizeCoupon,
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
import {
  buildMockAdminUser,
  getMockBrandById,
  getMockCategoryById,
  getMockContentById,
  getMockRedirectById,
  getMockDashboardSummary,
  getMockProductById,
  getMockReviewById,
  queryMockAdminUsers,
  queryMockAnalytics,
  queryMockBrands,
  queryMockCategories,
  queryMockContent,
  queryMockCoupons,
  queryMockCustomers,
  queryMockMedia,
  queryMockOrders,
  queryMockProducts,
  queryMockReviews,
  queryMockRedirects,
  queryMockSettings,
  queryMockShippingMethods,
  queryMockShippingZones,
  queryMockSliders,
} from './mockData'
import { clearTokens, hasAccessToken, readTokens, writeTokens } from './authStorage'

const API_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/v1').replace(/\/$/, '')
const FORCE_MOCK = import.meta.env.VITE_USE_ADMIN_MOCK === 'true'
const IS_DEV = Boolean(import.meta.env.DEV)
const DEFAULT_MOCK_ROLE = import.meta.env.VITE_ADMIN_ROLE || 'ADMIN'

export class ApiClientError extends Error {
  constructor(message, status, code, details = []) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = Array.isArray(details) ? details : []
  }
}

// â”€â”€ Auth interceptor state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // 401 â†’ refresh once, retry once. The refresh endpoint itself is called with
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
      error.message || `Request failed with status ${response.status}`,
      response.status,
      error.code || 'REQUEST_FAILED',
      error.details || [],
    )
  }

  return payload
}

// â”€â”€ Admin auth API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function loginAdmin({ email, password }) {
  if (FORCE_MOCK) {
    writeTokens({ accessToken: 'mock-access', refreshToken: 'mock-refresh' })
    return { user: buildMockAdminUser(DEFAULT_MOCK_ROLE) }
  }
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

function withMockFallback(reason, data) {
  return {
    ...data,
    mode: 'mock',
    warning:
      reason ||
      'Running with typed mock layer because admin backend endpoint is unavailable.',
  }
}

function withLiveData(data) {
  return {
    ...data,
    mode: 'live',
    warning: undefined,
  }
}

function shouldFallbackToMockOnLiveError() {
  return IS_DEV
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error
  }

  return new Error('Unexpected admin API error.')
}

function assertMutationEnabled() {
  if (!FORCE_MOCK) {
    return
  }

  throw new ApiClientError(
    'Admin mutation API is disabled because VITE_USE_ADMIN_MOCK=true.',
    501,
    'MUTATION_NOT_IMPLEMENTED',
    [],
  )
}

function buildProductQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.search,
    publishStatus: query?.publishStatus,
    stockState: query?.stockState,
    brandId: query?.brandId || undefined,
    categoryId: query?.categoryId || undefined,
  }
}

function buildCategoryQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.search,
    visibility: query?.visibility,
  }
}

function buildBrandQuery(query) {
  return {
    page: query?.page,
    size: query?.pageSize,
    sort: query?.sort,
    q: query?.search,
    visibility: query?.visibility,
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
    // Normalize bracket notation variants[0].field â†’ variants.0.field
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
  if (FORCE_MOCK) {
    return withMockFallback(
      'Mock mode is enabled by VITE_USE_ADMIN_MOCK=true.',
      { user: buildMockAdminUser(DEFAULT_MOCK_ROLE) },
    )
  }

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
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, {
      user: buildMockAdminUser(DEFAULT_MOCK_ROLE),
    })
  }
}

export async function fetchProducts(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Product list is served from typed mock layer (mock mode enabled).',
      queryMockProducts(query),
    )
  }

  try {
    const payload = await requestJson('/admin/products', { query: buildProductQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeProduct, Number(query?.pageSize) || 10))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, queryMockProducts(query))
  }
}

export async function fetchProductDetail(productId) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Product detail is served from typed mock layer (mock mode enabled).',
      { item: getMockProductById(productId) },
    )
  }

  try {
    const payload = await requestJson(`/admin/products/${productId}`)
    return withLiveData(parseDetailPayload(payload, normalizeProduct))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, { item: getMockProductById(productId) })
  }
}

export async function createProduct(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/products', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeProduct)
}

export async function updateProduct(productId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/products/${productId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeProduct)
}

export async function publishProduct(productId, publishStatus) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/products/${productId}/publish`, {
    method: 'PATCH',
    body: { publishStatus },
  })
  return parseDetailPayload(payload, normalizeProduct)
}

export async function softDeleteProduct(productId) {
  assertMutationEnabled()
  await requestJson(`/admin/products/${productId}`, { method: 'DELETE' })
}

export async function restoreProduct(productId) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/products/${productId}/restore`, { method: 'POST' })
  return parseDetailPayload(payload, normalizeProduct)
}


export async function fetchCategories(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Category list is served from typed mock layer (mock mode enabled).',
      queryMockCategories(query),
    )
  }

  try {
    const payload = await requestJson('/admin/categories', { query: buildCategoryQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeCategory, Number(query?.pageSize) || 10))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, queryMockCategories(query))
  }
}

/**
 * Fetch the entire category set in a single request, sorted in tree-friendly
 * order. Used by the list screen's tree-view and the detail screen's parent
 * picker — both need every category to render correctly, and the paginated
 * list endpoint caps pageSize at 100, which silently truncates the tree as
 * the catalog grows.
 */
export async function fetchCategoryTree() {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Category tree is served from typed mock layer (mock mode enabled).',
      { items: queryMockCategories({ page: 1, pageSize: 1000 }).items },
    )
  }

  try {
    const payload = await requestJson('/admin/categories/tree')
    const items = Array.isArray(payload?.data) ? payload.data.map(normalizeCategory) : []
    return withLiveData({ items })
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }
    return withMockFallback(
      normalizedError.message,
      { items: queryMockCategories({ page: 1, pageSize: 1000 }).items },
    )
  }
}

export async function fetchCategoryDetail(categoryId) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Category detail is served from typed mock layer (mock mode enabled).',
      { item: getMockCategoryById(categoryId) },
    )
  }

  try {
    const payload = await requestJson(`/admin/categories/${categoryId}`)
    return withLiveData(parseDetailPayload(payload, normalizeCategory))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, { item: getMockCategoryById(categoryId) })
  }
}

export async function createCategory(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/categories', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeCategory)
}

export async function updateCategory(categoryId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/categories/${categoryId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeCategory)
}

export async function hardDeleteCategory(categoryId) {
  assertMutationEnabled()
  await requestJson(`/admin/categories/${categoryId}`, { method: 'DELETE' })
}

export async function fetchBrands(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Brand list is served from typed mock layer (mock mode enabled).',
      queryMockBrands(query),
    )
  }

  try {
    const payload = await requestJson('/admin/brands', { query: buildBrandQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeBrand, Number(query?.pageSize) || 10))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, queryMockBrands(query))
  }
}

export async function fetchBrandDetail(brandId) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Brand detail is served from typed mock layer (mock mode enabled).',
      { item: getMockBrandById(brandId) },
    )
  }

  try {
    const payload = await requestJson(`/admin/brands/${brandId}`)
    return withLiveData(parseDetailPayload(payload, normalizeBrand))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, { item: getMockBrandById(brandId) })
  }
}

export async function createBrand(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/brands', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeBrand)
}

export async function updateBrand(brandId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/brands/${brandId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeBrand)
}

export async function deleteBrand(brandId) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/brands/${brandId}`, { method: 'DELETE' })
  return parseDetailPayload(payload, normalizeBrand)
}

export async function fetchContent(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Content list is served from typed mock layer (mock mode enabled).',
      queryMockContent(query),
    )
  }

  try {
    const payload = await requestJson('/admin/content', { query: buildContentQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeContentItem, Number(query?.pageSize) || 10))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, queryMockContent(query))
  }
}

export async function fetchContentDetail(contentType, contentId) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Content detail is served from typed mock layer (mock mode enabled).',
      { item: getMockContentById(contentType, contentId) },
    )
  }

  const pathType = normalizeContentPathType(contentType)

  try {
    const endpoint = `/admin/content/${pathType}/${contentId}`
    const payload = await requestJson(endpoint)
    return withLiveData(parseDetailPayload(payload, normalizeContentItem))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) {
      throw normalizedError
    }

    return withMockFallback(normalizedError.message, {
      item: getMockContentById(contentType, contentId),
    })
  }
}

export async function createContent(contentType, input) {
  assertMutationEnabled()
  const mutationPath = normalizeContentMutationPath(contentType)
  const payload = await requestJson(`/admin/content/${mutationPath}`, {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function updateContent(contentType, contentId, input) {
  assertMutationEnabled()
  const mutationPath = normalizeContentMutationPath(contentType)
  const payload = await requestJson(`/admin/content/${mutationPath}/${contentId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function deleteContent(contentType, contentId) {
  assertMutationEnabled()
  const pathType = normalizeContentPathType(contentType)
  const payload = await requestJson(`/admin/content/${pathType}/${contentId}`, { method: 'DELETE' })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function fetchContentAuthors() {
  try {
    const payload = await requestJson('/admin/content/reference/authors')
    return (payload?.data ?? []).map((a) => ({ id: String(a.id ?? ''), name: String(a.name ?? '') }))
  } catch {
    return []
  }
}

export async function fetchContentCategories() {
  try {
    const payload = await requestJson('/admin/content/reference/categories')
    return (payload?.data ?? []).map((c) => ({ id: String(c.id ?? ''), slug: String(c.slug ?? ''), name: String(c.name ?? '') }))
  } catch {
    return []
  }
}

export async function fetchContentPageRefs() {
  try {
    const payload = await requestJson('/admin/content/reference/pages')
    return (payload?.data ?? []).map((p) => ({ id: String(p.id ?? ''), slug: String(p.slug ?? ''), title: String(p.title ?? '') }))
  } catch {
    return []
  }
}

export async function fetchRedirects(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Redirect list served from mock.', queryMockRedirects(query))
  }

  try {
    const payload = await requestJson('/admin/redirects', { query: buildRedirectQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeRedirect, Number(query?.pageSize) || 20))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw normalizedError
    return withMockFallback(normalizedError.message, queryMockRedirects(query))
  }
}

export async function fetchRedirectDetail(redirectId) {
  if (FORCE_MOCK) {
    return withMockFallback('Redirect detail served from mock.', { item: getMockRedirectById(redirectId) })
  }

  try {
    const payload = await requestJson(`/admin/redirects/${redirectId}`)
    return withLiveData(parseDetailPayload(payload, normalizeRedirect))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw normalizedError
    return withMockFallback(normalizedError.message, { item: getMockRedirectById(redirectId) })
  }
}

export async function createRedirect(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/redirects', {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeRedirect)
}

export async function updateRedirect(redirectId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/redirects/${redirectId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeRedirect)
}

export async function deleteRedirect(redirectId) {
  assertMutationEnabled()
  await requestJson(`/admin/redirects/${redirectId}`, { method: 'DELETE' })
}

// â”€â”€ Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchOrders(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Order list served from mock.', queryMockOrders(query))
  }
  try {
    const payload = await requestJson('/admin/orders', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        sort: query?.sort,
        q: query?.search,
        status: query?.orderStatus,
        from: query?.dateRange?.from?.toISOString().slice(0, 10),
        to: query?.dateRange?.to?.toISOString().slice(0, 10),
      },
    })
    return withLiveData(parseListPayload(payload, normalizeOrder, Number(query?.pageSize) || 10))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockOrders(query))
  }
}

export async function fetchOrderDetail(orderId) {
  if (FORCE_MOCK) {
    return withMockFallback('Order detail served from mock.', { item: queryMockOrders({}).items[0] || null })
  }
  try {
    const payload = await requestJson(`/admin/orders/${orderId}`)
    return withLiveData(parseDetailPayload(payload, normalizeOrder))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { item: null })
  }
}

export async function updateOrderStatus(orderId, orderStatus) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: orderStatus },
  })
  return parseDetailPayload(payload, normalizeOrder)
}

export async function fetchOrderAllowedTransitions(orderId) {
  if (FORCE_MOCK) {
    return { transitions: [] }
  }
  try {
    const payload = await requestJson(`/admin/orders/${orderId}/allowed-transitions`)
    const list = Array.isArray(payload?.data) ? payload.data : []
    return { transitions: list }
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return { transitions: [] }
  }
}

export async function updateOrderPaymentStatus(orderId, paymentStatus, paidAmount) {
  assertMutationEnabled()
  const body = { paymentStatus }
  if (paidAmount !== undefined && paidAmount !== null) body.paidAmount = paidAmount
  const payload = await requestJson(`/admin/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    body,
  })
  return parseDetailPayload(payload, normalizeOrder)
}

export async function addOrderNote(orderId, { content, customerVisible = false }) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/orders/${orderId}/notes`, {
    method: 'POST',
    body: { content, customerVisible },
  })
  return payload?.data ?? null
}

// â”€â”€ Customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchCustomers(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Customer list served from mock.', queryMockCustomers(query))
  }
  try {
    const payload = await requestJson('/admin/customers', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status },
    })
    return withLiveData(parseListPayload(payload, normalizeCustomer, Number(query?.pageSize) || 10))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockCustomers(query))
  }
}

export async function fetchCustomerDetail(customerId) {
  if (FORCE_MOCK) {
    return withMockFallback('Customer detail served from mock.', { item: null })
  }
  try {
    const payload = await requestJson(`/admin/customers/${customerId}`)
    return withLiveData(parseDetailPayload(payload, normalizeCustomer))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { item: null })
  }
}

export async function updateCustomerStatus(customerId, status) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/customers/${customerId}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return parseDetailPayload(payload, normalizeCustomer)
}

export async function updateCustomer(customerId, data) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/customers/${customerId}`, {
    method: 'PATCH',
    body: data,
  })
  return parseDetailPayload(payload, normalizeCustomer)
}

// â”€â”€ Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchMedia(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Media list served from mock.', queryMockMedia(query))
  }
  try {
    const q = buildMediaQueryParams(query)
    q.page = query?.page
    q.size = query?.pageSize
    const payload = await requestJson('/admin/media', { query: q })
    return withLiveData(parseListPayload(payload, normalizeMediaItem, Number(query?.pageSize) || 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockMedia(query))
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
  try {
    const q = buildMediaQueryParams(query)
    delete q.sort; delete q.dir; delete q.usageFilter
    const payload = await requestJson('/admin/media/stats', { query: q })
    return payload?.data ?? null
  } catch (error) {
    return null
  }
}

export async function bulkDeleteMedia(ids) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/media/bulk-delete', {
    method: 'POST',
    body: { ids },
  })
  return payload?.data?.affected ?? 0
}

export async function bulkRestoreMedia(ids) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/media/bulk-restore', {
    method: 'POST',
    body: { ids },
  })
  return payload?.data?.affected ?? 0
}

export async function bulkHardDeleteMedia(ids) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/media/bulk-hard-delete', {
    method: 'POST',
    body: { ids },
  })
  return payload?.data ?? { deleted: 0, missing: 0, blocked: 0 }
}

export async function bulkMoveMedia(ids, folderId) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/media/bulk-move', {
    method: 'POST',
    body: { ids, folderId },
  })
  return payload?.data?.affected ?? 0
}

export async function fetchMediaFolders() {
  try {
    const payload = await requestJson('/admin/media-folders')
    return Array.isArray(payload?.data) ? payload.data : []
  } catch { return [] }
}

export async function createMediaFolder(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/media-folders', { method: 'POST', body: input })
  return payload?.data
}

export async function updateMediaFolder(id, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/media-folders/${id}`, { method: 'PATCH', body: input })
  return payload?.data
}

export async function deleteMediaFolder(id) {
  assertMutationEnabled()
  await requestJson(`/admin/media-folders/${id}`, { method: 'DELETE' })
}

export async function replaceMediaFile(mediaId, file) {
  assertMutationEnabled()
  const form = new FormData()
  form.append('file', file)
  const payload = await requestJson(`/admin/media/${mediaId}/replace`, {
    method: 'POST',
    body: form,
  })
  return { item: normalizeMediaItem(payload?.data || {}) }
}

export async function fetchMediaTags(prefix) {
  try {
    const q = prefix ? { prefix, limit: 20 } : { limit: 50 }
    const payload = await requestJson('/admin/media/tags', { query: q })
    return Array.isArray(payload?.data) ? payload.data : []
  } catch { return [] }
}

export async function fetchMediaReferences(mediaId) {
  const payload = await requestJson(`/admin/media/${mediaId}/references`)
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function deleteMedia(mediaId) {
  assertMutationEnabled()
  await requestJson(`/admin/media/${mediaId}`, { method: 'DELETE' })
}

export async function hardDeleteMedia(mediaId) {
  assertMutationEnabled()
  await requestJson(`/admin/media/${mediaId}`, { method: 'DELETE', query: { permanent: true } })
}

export async function restoreMedia(mediaId) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/media/${mediaId}/restore`, { method: 'POST' })
  return { item: normalizeMediaItem(payload?.data || {}) }
}

export async function updateMedia(mediaId, body) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/media/${mediaId}`, { method: 'PATCH', body })
  return { item: normalizeMediaItem(payload?.data || {}) }
}

export async function uploadMedia(file, altText = '', onProgress = null) {
  assertMutationEnabled()

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

// â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchSettings() {
  if (FORCE_MOCK) {
    return withMockFallback('Đang hiển thị dữ liệu mẫu — chưa kết nối hệ thống thật. Mọi thay đổi sẽ không được lưu.', queryMockSettings())
  }
  try {
    const payload = await requestJson('/admin/settings', { query: { page: 1, size: 200 } })
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockSettings())
  }
}

export async function updateSetting(key, value) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/settings/${key}`, {
    method: 'PATCH',
    body: { value },
  })
  return { item: normalizeSetting(payload?.data || {}) }
}

export async function batchUpdateSettings(updates) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/settings', {
    method: 'PATCH',
    body: { updates },
  })
  const items = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
  return { items }
}

// Returns true when the backend serial_inventory_only gate is enabled.
// Fails open (returns false) so the UI is never blocked by a network error.
export async function fetchSerialInventoryOnly() {
  if (FORCE_MOCK) return false
  try {
    const payload = await requestJson('/admin/settings/serial_inventory_only')
    return (payload?.data?.settingValue ?? payload?.data?.item?.settingValue) === 'true'
  } catch {
    return false
  }
}

// â”€â”€ Coupons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchCoupons(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Coupon list served from mock.', queryMockCoupons(query))
  }
  try {
    const payload = await requestJson('/admin/coupons', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status },
    })
    return withLiveData(parseListPayload(payload, normalizeCoupon, Number(query?.pageSize) || 10))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockCoupons(query))
  }
}

export async function createCoupon(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/coupons', { method: 'POST', body: input })
  return parseDetailPayload(payload, normalizeCoupon)
}

export async function updateCouponStatus(couponId, status) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/coupons/${couponId}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return parseDetailPayload(payload, normalizeCoupon)
}

export async function updateCoupon(couponId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/coupons/${couponId}`, {
    method: 'PATCH',
    body: input,
  })
  return parseDetailPayload(payload, normalizeCoupon)
}

// â”€â”€ Menus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchMenus() {
  if (FORCE_MOCK) {
    return withMockFallback('Menu list served from mock.', { items: [] })
  }
  try {
    const payload = await requestJson('/admin/menus')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeMenu) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [] })
  }
}

export async function fetchMenuDetail(menuId) {
  if (FORCE_MOCK) {
    return withMockFallback('Menu detail served from mock.', { item: null })
  }
  try {
    const payload = await requestJson(`/admin/menus/${menuId}`)
    return withLiveData(parseDetailPayload(payload, normalizeMenu))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { item: null })
  }
}

export async function createMenuItem(menuId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/menus/${menuId}/items`, { method: 'POST', body: input })
  return { item: payload?.data }
}

export async function deleteMenuItem(menuId, itemId) {
  assertMutationEnabled()
  await requestJson(`/admin/menus/${menuId}/items/${itemId}`, { method: 'DELETE' })
}

// NOTE: createMenu / updateMenu / deleteMenu admin endpoints exist on the
// backend but are intentionally not exposed here. Menu containers are
// system-defined slots (primary, footer, guide) seeded by Flyway and the
// admin UI manages only the items inside them.

export async function updateMenuItem(menuId, itemId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/menus/${menuId}/items/${itemId}`, { method: 'PATCH', body: input })
  return { item: payload?.data }
}

export async function reorderMenuItems(menuId, items) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/menus/${menuId}/items/reorder`, {
    method: 'POST',
    body: { items },
  })
  return withLiveData(parseDetailPayload(payload, normalizeMenu))
}

// â”€â”€ Sliders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeSlider(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: String(s.id || ''),
    location: String(s.location || 'home'),
    sortOrder: Number(s.sortOrder ?? 0),
    isActive: s.isActive !== false,
    desktopImage: s.desktopImage || null,
    mobileImage: s.mobileImage || null,
    externalLink: s.externalLink || null,
    productId: s.productId || null,
  }
}

export async function fetchSliders(location = 'home') {
  if (FORCE_MOCK) {
    return withMockFallback('Slider list served from mock.', queryMockSliders(location))
  }
  try {
    const payload = await requestJson('/admin/sliders', { query: { location } })
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSlider) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockSliders(location))
  }
}

export async function createSlider(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/sliders', { method: 'POST', body: input })
  return { item: normalizeSlider(payload?.data || {}) }
}

export async function updateSlider(sliderId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/sliders/${sliderId}`, { method: 'PATCH', body: input })
  return { item: normalizeSlider(payload?.data || {}) }
}

export async function reorderSliders(location, items) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/sliders/reorder', {
    method: 'POST',
    body: { location, items },
  })
  const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSlider) : []
  return withLiveData({ items: list })
}

export async function deleteSlider(sliderId) {
  assertMutationEnabled()
  await requestJson(`/admin/sliders/${sliderId}`, { method: 'DELETE' })
}

// â”€â”€ Home Videos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeHomeVideo(input) {
  return {
    id: input.id ?? '',
    sortOrder: input.sortOrder ?? 0,
    title: input.title ?? '',
    videoUrl: input.videoUrl ?? '',
    youtubeId: input.youtubeId ?? null,
    thumbnail: input.thumbnail ?? null,
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
  assertMutationEnabled()
  const payload = await requestJson('/admin/home-videos', { method: 'POST', body: input })
  return { item: normalizeHomeVideo(payload?.data || {}) }
}

export async function updateHomeVideo(id, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/home-videos/${id}`, { method: 'PATCH', body: input })
  return { item: normalizeHomeVideo(payload?.data || {}) }
}

export async function reorderHomeVideos(items) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/home-videos/reorder', {
    method: 'POST',
    body: { items },
  })
  const list = Array.isArray(payload?.data) ? payload.data.map(normalizeHomeVideo) : []
  return withLiveData({ items: list })
}

export async function deleteHomeVideo(id) {
  assertMutationEnabled()
  await requestJson(`/admin/home-videos/${id}`, { method: 'DELETE' })
}

// â”€â”€ Shipping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeShippingZone(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: String(s.id || ''),
    name: String(s.name || ''),
    regionCode: String(s.regionCode || ''),
    sortOrder: Number(s.sortOrder ?? 0),
    enabled: s.enabled !== false,
    createdAt: s.createdAt || '',
    updatedAt: s.updatedAt || '',
  }
}

function normalizeShippingMethod(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: String(s.id || ''),
    zoneId: String(s.zoneId || ''),
    methodCode: String(s.methodCode || ''),
    title: String(s.title || ''),
    description: String(s.description || ''),
    cost: Number(s.cost ?? 0),
    minOrderAmount: Number(s.minOrderAmount ?? 0),
    sortOrder: Number(s.sortOrder ?? 0),
    enabled: s.enabled !== false,
  }
}

export async function fetchShippingZones(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Shipping zones served from mock.', queryMockShippingZones(query))
  }
  try {
    const payload = await requestJson('/admin/shipping/zones', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search },
    })
    return withLiveData(parseListPayload(payload, normalizeShippingZone, 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockShippingZones(query))
  }
}

export async function createShippingZone(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/shipping/zones', { method: 'POST', body: input })
  return { item: normalizeShippingZone(payload?.data || {}) }
}

export async function updateShippingZone(zoneId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/shipping/zones/${zoneId}`, { method: 'PATCH', body: input })
  return { item: normalizeShippingZone(payload?.data || {}) }
}

export async function deleteShippingZone(zoneId) {
  assertMutationEnabled()
  await requestJson(`/admin/shipping/zones/${zoneId}`, { method: 'DELETE' })
}

export async function fetchShippingMethods(zoneId) {
  if (FORCE_MOCK) {
    return withMockFallback('Shipping methods served from mock.', queryMockShippingMethods(zoneId))
  }
  try {
    const payload = await requestJson(`/admin/shipping/zones/${zoneId}/methods`)
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeShippingMethod) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockShippingMethods(zoneId))
  }
}

export async function createShippingMethod(zoneId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/shipping/zones/${zoneId}/methods`, { method: 'POST', body: input })
  return { item: normalizeShippingMethod(payload?.data || {}) }
}

export async function updateShippingMethod(zoneId, methodId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/shipping/zones/${zoneId}/methods/${methodId}`, { method: 'PATCH', body: input })
  return { item: normalizeShippingMethod(payload?.data || {}) }
}

export async function deleteShippingMethod(zoneId, methodId) {
  assertMutationEnabled()
  await requestJson(`/admin/shipping/zones/${zoneId}/methods/${methodId}`, { method: 'DELETE' })
}

// â”€â”€ Admin Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if (FORCE_MOCK) {
    return withMockFallback('Admin users served from mock.', queryMockAdminUsers(query))
  }
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
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockAdminUsers(query))
  }
}

export async function createAdminUser(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/admin-users', { method: 'POST', body: input })
  return { item: normalizeAdminUser(payload?.data || {}) }
}

export async function updateAdminUser(userId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/admin-users/${userId}`, { method: 'PATCH', body: input })
  return { item: normalizeAdminUser(payload?.data || {}) }
}

// â”€â”€ Reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const REVIEW_PRODUCT_FALLBACKS = {
  'prod-agv-k1': { productName: 'AGV K1 S', productSlug: 'mu-bao-hiem-agv-k1-s' },
  'prod-ls2-ff352': { productName: 'LS2 FF352 Rookie', productSlug: 'mu-bao-hiem-ls2-ff352-rookie' },
}

function normalizeReview(input) {
  const s = input && typeof input === 'object' ? input : {}
  const fallbackProduct = REVIEW_PRODUCT_FALLBACKS[String(s.productId || '')] || {}
  return {
    id: s.id,
    productId: String(s.productId || ''),
    productName: String(s.productName || fallbackProduct.productName || ''),
    productSlug: String(s.productSlug || fallbackProduct.productSlug || ''),
    authorName: String(s.authorName || ''),
    authorEmail: String(s.authorEmail || ''),
    rating: Number(s.rating ?? 0),
    body: String(s.body || ''),
    status: String(s.status || ''),
    createdAt: s.createdAt || '',
    updatedAt: s.updatedAt || '',
  }
}

export async function fetchReviews(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Reviews served from mock.', queryMockReviews(query))
  }
  try {
    const payload = await requestJson('/admin/reviews', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status },
    })
    return withLiveData(parseListPayload(payload, normalizeReview, 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockReviews(query))
  }
}

export async function fetchReviewDetail(reviewId) {
  if (FORCE_MOCK) {
    return withMockFallback('Review detail served from mock.', { item: normalizeReview(getMockReviewById(reviewId)) })
  }
  try {
    const payload = await requestJson(`/admin/reviews/${reviewId}`)
    return withLiveData(parseDetailPayload(payload, normalizeReview))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { item: normalizeReview(getMockReviewById(reviewId)) })
  }
}

export async function updateReviewStatus(reviewId, status) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/reviews/${reviewId}/status`, {
    method: 'PATCH',
    body: { status },
  })
  return { item: normalizeReview(payload?.data || {}) }
}

export async function deleteReview(reviewId) {
  assertMutationEnabled()
  await requestJson(`/admin/reviews/${reviewId}`, { method: 'DELETE' })
}

// â”€â”€ Audit Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }, 20) })
  }
}

// â”€â”€ Refund â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createRefund(orderId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeOrder)
}

// â”€â”€ Reports / Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchAnalytics(from, to) {
  try {
    const payload = await requestJson('/admin/reports/analytics', {
      query: { from: from || undefined, to: to || undefined },
    })
    return { data: normalizeAnalytics(payload), mode: 'live' }
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return {
      data: queryMockAnalytics(from, to),
      mode: 'mock',
      warning: e.message,
    }
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

// â”€â”€ Reports / Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchCsvBlob(path, params = {}) {
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
  return response.blob()
}

export async function exportOrdersCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/orders/export', {
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    from: filters.from,
    to: filters.to,
  })
}

export async function exportCustomersCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/customers/export', { status: filters.status })
}

export async function exportProductsCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/products/export', { publishStatus: filters.publishStatus })
}

// â”€â”€ Inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchInventory(query = {}) {
  try {
    const payload = await requestJson('/admin/inventory', {
      query: {
        page: query.page,
        size: query.pageSize,
        q: query.q || undefined,
        stockState: query.stockState === 'ALL' ? undefined : query.stockState,
      },
    })
    return withLiveData(parseListPayload(payload, normalizeStockItem, Number(query.pageSize) || 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }, 20) })
  }
}

function normalizeStockItem(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: s.variantId || s.productId || '',
    productId: s.productId || '',
    productName: s.productName || '',
    productSku: s.productSku || undefined,
    productImage: normalizeImageAsset(s.productImage || s.image || s.product?.image),
    variantId: s.variantId || '',
    variantName: s.variantName || '',
    variantSku: s.variantSku || undefined,
    stockState: s.stockState || 'UNKNOWN',
    quantityOnHand: Number(s.quantityOnHand) || 0,
    retailPrice: Number(s.retailPrice) || 0,
    trackSerials: Boolean(s.trackSerials),
  }
}

function normalizeSerial(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: s.id || '',
    productId: s.productId || '',
    productName: s.productName || '',
    variantId: s.variantId || null,
    variantName: s.variantName || null,
    chassisNumber: s.chassisNumber || null,
    engineNumber: s.engineNumber || null,
    status: s.status || 'IN_STOCK',
    reservedUntil: s.reservedUntil || null,
    orderLineItemId: s.orderLineItemId || null,
    returnItemId: s.returnItemId || null,
    receivedAt: s.receivedAt || null,
    soldAt: s.soldAt || null,
    returnedAt: s.returnedAt || null,
    note: s.note || null,
    createdAt: s.createdAt || null,
    updatedAt: s.updatedAt || null,
  }
}

export async function fetchVariantSerials(variantId, query = {}) {
  const payload = await requestJson(`/admin/inventory/variants/${variantId}/serials`, {
    query: { page: query.page || 1, size: query.pageSize || 20, status: query.status || undefined },
  })
  return parseListPayload(payload, normalizeSerial, Number(query.pageSize) || 20)
}

export async function fetchProductSerials(productId, query = {}) {
  const payload = await requestJson(`/admin/inventory/products/${productId}/serials`, {
    query: { page: query.page || 1, size: query.pageSize || 20, status: query.status || undefined },
  })
  return parseListPayload(payload, normalizeSerial, Number(query.pageSize) || 20)
}

export async function addVariantSerials(variantId, serials, note) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/inventory/variants/${variantId}/serials`, {
    method: 'POST',
    body: { serials, note: note || undefined },
  })
  const items = Array.isArray(payload?.data) ? payload.data.map(normalizeSerial)
              : Array.isArray(payload) ? payload.map(normalizeSerial) : []
  return { items }
}

export async function addProductSerials(productId, serials, note) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/inventory/products/${productId}/serials`, {
    method: 'POST',
    body: { serials, note: note || undefined },
  })
  const items = Array.isArray(payload?.data) ? payload.data.map(normalizeSerial)
              : Array.isArray(payload) ? payload.map(normalizeSerial) : []
  return { items }
}

export async function updateSerialStatus(serialId, status, note) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/inventory/serials/${serialId}/status`, {
    method: 'PATCH',
    body: { status, note: note || undefined },
  })
  return { item: normalizeSerial(payload?.data || payload || {}) }
}

export async function enableVariantSerialTracking(variantId, enabled = true) {
  assertMutationEnabled()
  await requestJson(`/admin/inventory/variants/${variantId}/enable-tracking?enabled=${enabled}`, {
    method: 'POST',
  })
}

export async function enableProductSerialTracking(productId, enabled = true) {
  assertMutationEnabled()
  await requestJson(`/admin/inventory/products/${productId}/enable-tracking?enabled=${enabled}`, {
    method: 'POST',
  })
}

export async function adjustStock(variantId, quantityDelta, movementType, note, serialNumbers) {
  assertMutationEnabled()
  const body = { quantityDelta, movementType: movementType || 'ADJUSTMENT', note }
  if (Array.isArray(serialNumbers) && serialNumbers.length > 0) {
    body.serialNumbers = serialNumbers
  }
  const payload = await requestJson(`/admin/inventory/variants/${variantId}/adjust`, {
    method: 'POST',
    body,
  })
  return { item: normalizeStockItem(payload?.data || payload || {}) }
}

export async function adjustProductStock(productId, quantityDelta, movementType, note) {
  assertMutationEnabled()
  const body = { quantityDelta, movementType: movementType || 'ADJUSTMENT', note }
  const payload = await requestJson(`/admin/inventory/products/${productId}/adjust`, {
    method: 'POST',
    body,
  })
  return { item: normalizeStockItem(payload?.data || payload || {}) }
}

export async function fetchInventorySummary() {
  try {
    const payload = await requestJson('/admin/inventory/summary')
    const d = payload?.data || payload || {}
    return {
      totalVariants: Number(d.totalVariants) || 0,
      outOfStockCount: Number(d.outOfStockCount) || 0,
      lowStockCount: Number(d.lowStockCount) || 0,
    }
  } catch {
    return { totalVariants: 0, outOfStockCount: 0, lowStockCount: 0 }
  }
}

export async function fetchAllMovements(query = {}) {
  const payload = await requestJson('/admin/inventory/movements', {
    query: {
      page: query.page,
      size: query.pageSize,
      movementType: query.movementType || undefined,
      referenceType: query.referenceType || undefined,
    },
  })
  return parseListPayload(payload, normalizeMovement, Number(query.pageSize) || 20)
}

export async function fetchVariantMovements(variantId, query = {}) {
  const payload = await requestJson(`/admin/inventory/variants/${variantId}/movements`, {
    query: { page: query.page, size: query.pageSize },
  })
  return parseListPayload(payload, normalizeMovement, Number(query.pageSize) || 20)
}

function normalizeMovement(input) {
  const m = input && typeof input === 'object' ? input : {}
  return {
    id: m.id || '',
    movementType: m.movementType || '',
    quantityDelta: Number(m.quantityDelta) || 0,
    quantityBefore: Number(m.quantityBefore) || 0,
    quantityAfter: Number(m.quantityAfter) || 0,
    referenceType: m.referenceType || '',
    note: m.note || '',
    createdAt: m.createdAt || null,
    serialCount: typeof m.serialCount === 'number' ? m.serialCount : 0,
    productName: m.productName || null,
    variantName: m.variantName || null,
    variantSku: m.variantSku || null,
  }
}

export async function downloadInventoryCsv() {
  const { accessToken } = readTokens()
  const response = await fetch(`${API_BASE}/admin/inventory/export.csv`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`CSV export failed: ${response.status}`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// â”€â”€ Returns / RMA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeReturn(s) {
  if (!s || typeof s !== 'object') return {}
  return {
    id: s.id || '',
    returnNumber: s.returnNumber || '',
    orderId: s.orderId || '',
    orderNumber: s.orderNumber || null,
    customerEmail: s.customerEmail || null,
    customerId: s.customerId || '',
    status: s.status || 'PENDING',
    reason: s.reason || '',
    customerNote: s.customerNote || '',
    adminNote: s.adminNote || '',
    refundAmount: s.refundAmount != null ? Number(s.refundAmount) : 0,
    createdAt: s.createdAt || null,
    updatedAt: s.updatedAt || null,
    items: Array.isArray(s.items) ? s.items : [],
    history: Array.isArray(s.history) ? s.history : [],
  }
}

function buildReturnQuery(query = {}) {
  const params = {}
  if (query.page) params.page = query.page
  if (query.pageSize) params.size = query.pageSize
  if (query.status && query.status !== 'ALL') params.status = query.status
  if (query.q) params.q = query.q
  return params
}

function mockReturns(query = {}) {
  const all = [
    { id: 'r1', returnNumber: 'RMA-001001', orderId: 'ord-aaa-1', customerId: 'c1', status: 'PENDING', reason: 'DEFECTIVE', customerNote: 'Sản phẩm bị lỗi', adminNote: '', refundAmount: 0, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString(), items: [], history: [] },
    { id: 'r2', returnNumber: 'RMA-001002', orderId: 'ord-bbb-2', customerId: 'c2', status: 'APPROVED', reason: 'WRONG_ITEM', customerNote: '', adminNote: 'Đã xác nhận', refundAmount: 0, createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date().toISOString(), items: [], history: [] },
    { id: 'r3', returnNumber: 'RMA-001003', orderId: 'ord-ccc-3', customerId: 'c1', status: 'COMPLETED', reason: 'CHANGED_MIND', customerNote: '', adminNote: '', refundAmount: 350000, createdAt: new Date(Date.now() - 604800000).toISOString(), updatedAt: new Date().toISOString(), items: [], history: [] },
  ]
  let filtered = all
  if (query.status && query.status !== 'ALL') filtered = filtered.filter((r) => r.status === query.status)
  if (query.q) filtered = filtered.filter((r) => r.returnNumber.includes(query.q))
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20
  const total = filtered.length
  const items = filtered.slice((page - 1) * pageSize, page * pageSize)
  return { items: items.map(normalizeReturn), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } }
}

export async function fetchReturns(query = {}) {
  if (FORCE_MOCK) {
    return withMockFallback('Returns served from mock.', mockReturns(query))
  }
  try {
    const payload = await requestJson('/admin/returns', { query: buildReturnQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeReturn, Number(query.pageSize) || 20))
  } catch (error) {
    const normalizedError = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw normalizedError
    return withMockFallback(normalizedError.message, mockReturns(query))
  }
}

export async function fetchReturnDetail(returnId) {
  try {
    const payload = await requestJson(`/admin/returns/${returnId}`)
    return normalizeReturn(payload?.data || payload || {})
  } catch {
    return null
  }
}

export async function updateReturnStatus(returnId, body) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/returns/${returnId}/status`, {
    method: 'PATCH',
    body,
  })
  return normalizeReturn(payload?.data || payload || {})
}

// â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchDashboardSummary(period = '30d') {
  if (FORCE_MOCK) {
    await new Promise((r) => setTimeout(r, 280))
    return { data: getMockDashboardSummary(period), isMock: true }
  }
  try {
    const payload = await requestJson(`/admin/dashboard?period=${period}`)
    return { data: payload?.data || getMockDashboardSummary(period), isMock: false }
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return { data: getMockDashboardSummary(period), isMock: true, warning: e.message }
  }
}

// â”€â”€ POS (Point of Sale) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function posSearchProducts(q, page = 1, size = 20) {
  if (FORCE_MOCK) {
    throw new ApiClientError('POS product search requires live API.', 501, 'MOCK_NOT_SUPPORTED')
  }
  const payload = await requestJson('/admin/pos/products/search', {
    query: { q, page, size },
  })
  return withLiveData(parseListPayload(payload, normalizeProduct, size))
}

export async function posCreateOrder(body) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/pos/orders', {
    method: 'POST',
    body,
  })
  return payload?.data ?? null
}

// ── Receivables / Công nợ ──────────────────────────────────────────────────────

function normalizeReceivable(input) {
  const r = input && typeof input === 'object' ? input : {}
  return {
    id: String(r.id || ''),
    orderId: String(r.orderId || ''),
    orderNumber: r.orderNumber || null,
    customerId: r.customerId || null,
    customerName: r.customerName || '',
    customerPhone: r.customerPhone || '',
    originalAmount: Number(r.originalAmount ?? 0),
    paidAmount: Number(r.paidAmount ?? 0),
    outstandingAmount: Number(r.outstandingAmount ?? 0),
    writtenOffAmount: Number(r.writtenOffAmount ?? 0),
    status: String(r.status || 'OPEN'),
    dueDate: r.dueDate || null,
    paymentTermsDays: r.paymentTermsDays ?? null,
    overdueDays: r.overdueDays ?? null,
    creditLimitSnapshot: r.creditLimitSnapshot ?? null,
    createdFrom: r.createdFrom || '',
    note: r.note || null,
    writeOffReason: r.writeOffReason || null,
    writtenOffAt: r.writtenOffAt || null,
    createdByAdminId: r.createdByAdminId || null,
    createdAt: r.createdAt || '',
    updatedAt: r.updatedAt || '',
  }
}

export async function fetchReceivables(query = {}) {
  try {
    const payload = await requestJson('/admin/receivables', {
      query: {
        page: query.page,
        size: query.pageSize,
        status: query.status && query.status !== 'ALL' ? query.status : undefined,
        customerId: query.customerId || undefined,
        q: query.search || undefined,
      },
    })
    return withLiveData(parseListPayload(payload, normalizeReceivable, Number(query.pageSize) || 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }, 20) })
  }
}

export async function fetchReceivableDetail(receivableId) {
  try {
    const payload = await requestJson(`/admin/receivables/${receivableId}`)
    return withLiveData({ item: normalizeReceivable(payload?.data || {}) })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { item: null })
  }
}

export async function fetchReceivableSummary() {
  try {
    const payload = await requestJson('/admin/receivables/summary')
    const d = payload?.data || {}
    return {
      totalOutstanding: Number(d.totalOutstanding ?? 0),
      overdueOutstanding: Number(d.overdueOutstanding ?? 0),
      writtenOffTotal: Number(d.writtenOffTotal ?? 0),
      countOpen: Number(d.countOpen ?? 0),
      countOverdue: Number(d.countOverdue ?? 0),
    }
  } catch {
    return { totalOutstanding: 0, overdueOutstanding: 0, writtenOffTotal: 0, countOpen: 0, countOverdue: 0 }
  }
}

export async function fetchReceivableAging() {
  try {
    const payload = await requestJson('/admin/receivables/aging')
    const d = payload?.data || {}
    return {
      notDue: Number(d.notDue ?? 0),
      days0To30: Number(d.days0To30 ?? 0),
      days31To60: Number(d.days31To60 ?? 0),
      days61To90: Number(d.days61To90 ?? 0),
      over90: Number(d.over90 ?? 0),
    }
  } catch {
    return { notDue: 0, days0To30: 0, days31To60: 0, days61To90: 0, over90: 0 }
  }
}

export async function fetchCustomerReceivables(customerId, query = {}) {
  try {
    const payload = await requestJson(`/admin/customers/${customerId}/receivables`, {
      query: { page: query.page, size: query.pageSize || 20 },
    })
    return withLiveData(parseListPayload(payload, normalizeReceivable, 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }, 20) })
  }
}

export async function recordReceivablePayment(receivableId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/receivables/${receivableId}/payments`, {
    method: 'POST',
    body: input,
  })
  return { item: normalizeReceivable(payload?.data || {}) }
}

export async function writeOffReceivable(receivableId, reason) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/receivables/${receivableId}/write-off`, {
    method: 'POST',
    body: { reason },
  })
  return { item: normalizeReceivable(payload?.data || {}) }
}

function normalizeCustomerCredit(d, fallbackCustomerId) {
  return {
    customerId: d.customerId || fallbackCustomerId,
    creditEnabled: d.creditEnabled === true,
    creditLimit: d.creditLimit ?? null,
    paymentTermsDays: d.paymentTermsDays ?? null,
    creditStatus: d.creditStatus || 'ACTIVE',
    creditNote: d.creditNote || null,
    currentOutstanding: d.currentOutstanding ?? 0,
    availableCredit: d.availableCredit ?? null,
  }
}

export async function fetchCustomerCredit(customerId) {
  try {
    const payload = await requestJson(`/admin/customers/${customerId}/credit`)
    return normalizeCustomerCredit(payload?.data || {}, customerId)
  } catch {
    return null
  }
}

export async function updateCustomerCredit(customerId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/customers/${customerId}/credit`, {
    method: 'PATCH',
    body: input,
  })
  return normalizeCustomerCredit(payload?.data || {}, customerId)
}

// ── Roles & Permissions ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

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

function buildMockRoles() {
  const ALL_PERMS = [
    'orders.read','orders.write','customers.read','customers.write',
    'coupons.read','coupons.write','shipping.read','shipping.write',
    'reviews.read','reviews.write',
    'products.read','products.update','catalog.read','catalog.update',
    'content.read','content.update','media.read','media.write',
    'menus.read','menus.write','sliders.read','sliders.write',
    'home_videos.read','home_videos.write',
    'redirects.read','redirects.write',
    'settings.read','settings.write',
    'admin-users.read','admin-users.write',
    'roles.read','roles.write',
    'audit-logs.read',
    'pos.read','pos.write','pos.price_override',
    'receivables.read','receivables.create','receivables.record_payment',
    'receivables.write_off','receivables.override_limit','receivables.export',
    'reports.read','reports.export',
  ]
  return [
    { id: 'SUPER_ADMIN', name: 'Super Admin', description: 'Toàn quyền hệ thống', isSystem: true, permissions: [...ALL_PERMS], updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'ADMIN', name: 'Admin', description: 'Quản lý toàn bộ shop', isSystem: true, permissions: [...ALL_PERMS], updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'SHOP_MANAGER', name: 'Shop Manager', description: 'Vận hành bán hàng', isSystem: true, permissions: ['orders.read','orders.write','customers.read','customers.write','coupons.read','coupons.write','shipping.read','reviews.read','reviews.write','products.read','products.update','catalog.read'], updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'EDITOR', name: 'Editor', description: 'Nội dung & sản phẩm', isSystem: true, permissions: ['products.read','catalog.read','content.read','content.update','media.read','media.write','menus.read','menus.write','sliders.read','sliders.write'], updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'AUTHOR', name: 'Author', description: 'Viết & upload ảnh', isSystem: true, permissions: ['content.read','content.update','media.read','media.write'], updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'CONTRIBUTOR', name: 'Contributor', description: 'Chỉ xem nội dung', isSystem: true, permissions: ['content.read','media.read'], updatedAt: '2026-04-15T10:00:00Z' },
    { id: 'SEO_EDITOR', name: 'SEO Editor', description: 'Tối ưu nội dung SEO', isSystem: true, permissions: ['content.read','content.update','redirects.read','redirects.write'], updatedAt: '2026-04-15T10:00:00Z' },
  ]
}

export async function fetchPermissionCatalog() {
  try {
    const payload = await requestJson('/admin/permissions')
    return Array.isArray(payload?.data) ? payload.data : null
  } catch {
    return null
  }
}

export async function fetchRoles() {
  if (FORCE_MOCK) {
    return withMockFallback('Roles served from mock data.', { items: buildMockRoles() })
  }
  try {
    const payload = await requestJson('/admin/roles')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeRole) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: buildMockRoles() })
  }
}

export async function updateRolePermissions(roleId, permissions) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/roles/${encodeURIComponent(roleId)}/permissions`, {
    method: 'PUT',
    body: { permissions: Array.isArray(permissions) ? permissions : Array.from(permissions) },
  })
  return { item: normalizeRole(payload?.data || {}) }
}

export async function createRole(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/roles', { method: 'POST', body: input })
  return { item: normalizeRole(payload?.data || {}) }
}

export async function deleteRole(roleId) {
  assertMutationEnabled()
  await requestJson(`/admin/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' })
}


