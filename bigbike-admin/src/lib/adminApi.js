import {
  normalizeBrand,
  normalizeCategory,
  normalizeContentItem,
  normalizeCoupon,
  normalizeCustomer,
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
  getMockProductById,
  queryMockBrands,
  queryMockCategories,
  queryMockContent,
  queryMockCustomers,
  queryMockMedia,
  queryMockOrders,
  queryMockProducts,
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

// ── Auth interceptor state ───────────────────────────────────────────────────
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
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
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

  // 401 → refresh once, retry once. The refresh endpoint itself is called with
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

// ── Admin auth API ───────────────────────────────────────────────────────────

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

function parseListPayload(payload, normalizeItem, fallbackPageSize = 10) {
  const list = Array.isArray(payload?.data) ? payload.data : []
  const items = list.map(normalizeItem)
  const pageSize = Number(payload?.pagination?.pageSize) || fallbackPageSize

  return {
    items,
    pagination: normalizePagination(
      {
        page: payload?.pagination?.page || 1,
        pageSize,
        totalItems: payload?.pagination?.totalItems || items.length,
        totalPages:
          payload?.pagination?.totalPages ||
          Math.max(1, Math.ceil(items.length / pageSize)),
        hasNext: payload?.pagination?.hasNext,
        hasPrevious: payload?.pagination?.hasPrevious,
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

  return error.details.reduce((acc, detail) => {
    if (!detail || typeof detail !== 'object') {
      return acc
    }
    const field = typeof detail.field === 'string' ? detail.field : '_form'
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

export async function softDeleteCategory(categoryId) {
  assertMutationEnabled()
  await requestJson(`/admin/categories/${categoryId}`, { method: 'DELETE' })
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

// ── Orders ───────────────────────────────────────────────────────────────────

export async function fetchOrders(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Order list served from mock.', queryMockOrders(query))
  }
  try {
    const payload = await requestJson('/admin/orders', {
      query: { page: query?.page, size: query?.pageSize, sort: query?.sort, q: query?.search, status: query?.orderStatus },
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

export async function updateOrderPaymentStatus(orderId, paymentStatus) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    body: { paymentStatus },
  })
  return parseDetailPayload(payload, normalizeOrder)
}

// ── Customers ────────────────────────────────────────────────────────────────

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

// ── Media ────────────────────────────────────────────────────────────────────

export async function fetchMedia(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Media list served from mock.', queryMockMedia(query))
  }
  try {
    const payload = await requestJson('/admin/media', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, mimeType: query?.mimeType },
    })
    return withLiveData(parseListPayload(payload, normalizeMediaItem, Number(query?.pageSize) || 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, queryMockMedia(query))
  }
}

export async function deleteMedia(mediaId) {
  assertMutationEnabled()
  await requestJson(`/admin/media/${mediaId}`, { method: 'DELETE' })
}

export async function uploadMedia(file, altText = '') {
  assertMutationEnabled()
  const { accessToken } = readTokens()
  const formData = new FormData()
  formData.append('file', file)
  if (altText) formData.append('altText', altText)

  const headers = { Accept: 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(`${API_BASE}/admin/media`, {
    method: 'POST',
    headers,
    body: formData,
  })
  let payload = null
  try { payload = await response.json() } catch { /* ignore */ }
  if (!response.ok) {
    const error = payload?.error || {}
    throw new ApiClientError(
      error.message || `Upload failed with status ${response.status}`,
      response.status,
      error.code || 'UPLOAD_FAILED',
      error.details || [],
    )
  }
  return { item: normalizeMediaItem(payload?.data || {}) }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function fetchSettings() {
  if (FORCE_MOCK) {
    return withMockFallback('Settings served from mock.', { items: [] })
  }
  try {
    const payload = await requestJson('/admin/settings')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [] })
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

// ── Coupons ───────────────────────────────────────────────────────────────────

export async function fetchCoupons(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Coupon list served from mock.', { items: [], pagination: normalizePagination({}) })
  }
  try {
    const payload = await requestJson('/admin/coupons', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status },
    })
    return withLiveData(parseListPayload(payload, normalizeCoupon, Number(query?.pageSize) || 10))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({}) })
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

// ── Redirects ─────────────────────────────────────────────────────────────────

export async function fetchRedirects(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Redirect list served from mock.', { items: [], pagination: normalizePagination({}) })
  }
  try {
    const payload = await requestJson('/admin/redirects', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search },
    })
    return withLiveData(parseListPayload(payload, normalizeRedirect, Number(query?.pageSize) || 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({}) })
  }
}

export async function createRedirect(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/redirects', { method: 'POST', body: input })
  return parseDetailPayload(payload, normalizeRedirect)
}

export async function toggleRedirect(redirectId, isEnabled) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/redirects/${redirectId}/enabled`, {
    method: 'PATCH',
    body: { enabled: isEnabled },
  })
  return parseDetailPayload(payload, normalizeRedirect)
}

export async function deleteRedirect(redirectId) {
  assertMutationEnabled()
  await requestJson(`/admin/redirects/${redirectId}`, { method: 'DELETE' })
}

// ── Menus ──────────────────────────────────────────────────────────────────────

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

export async function createMenu(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/menus', { method: 'POST', body: input })
  return parseDetailPayload(payload, normalizeMenu)
}

export async function updateMenu(menuId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/menus/${menuId}`, { method: 'PATCH', body: input })
  return parseDetailPayload(payload, normalizeMenu)
}

export async function deleteMenu(menuId) {
  assertMutationEnabled()
  await requestJson(`/admin/menus/${menuId}`, { method: 'DELETE' })
}

export async function updateMenuItem(menuId, itemId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/menus/${menuId}/items/${itemId}`, { method: 'PATCH', body: input })
  return { item: payload?.data }
}

// ── Sliders ───────────────────────────────────────────────────────────────────

function normalizeSlider(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: String(s.id || ''),
    location: String(s.location || 'home'),
    sortOrder: Number(s.sortOrder ?? 0),
    desktopImage: s.desktopImage || null,
    mobileImage: s.mobileImage || null,
    externalLink: s.externalLink || null,
    productId: s.productId || null,
  }
}

export async function fetchSliders(location = 'home') {
  if (FORCE_MOCK) {
    return withMockFallback('Slider list served from mock.', { items: [] })
  }
  try {
    const payload = await requestJson('/admin/sliders', { query: { location } })
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSlider) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [] })
  }
}

export async function upsertSlider(input) {
  assertMutationEnabled()
  const payload = await requestJson('/admin/sliders', { method: 'POST', body: input })
  return { item: normalizeSlider(payload?.data || {}) }
}

export async function deleteSlider(sliderId) {
  assertMutationEnabled()
  await requestJson(`/admin/sliders/${sliderId}`, { method: 'DELETE' })
}

// ── Shipping ──────────────────────────────────────────────────────────────────

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
    return withMockFallback('Shipping zones served from mock.', { items: [], pagination: normalizePagination({}) })
  }
  try {
    const payload = await requestJson('/admin/shipping/zones', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search },
    })
    return withLiveData(parseListPayload(payload, normalizeShippingZone, 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({}) })
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
    return withMockFallback('Shipping methods served from mock.', { items: [] })
  }
  try {
    const payload = await requestJson(`/admin/shipping/zones/${zoneId}/methods`)
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeShippingMethod) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [] })
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

// ── Admin Users ───────────────────────────────────────────────────────────────

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
    return withMockFallback('Admin users served from mock.', { items: [], pagination: normalizePagination({}) })
  }
  try {
    const payload = await requestJson('/admin/admin-users', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search },
    })
    return withLiveData(parseListPayload(payload, normalizeAdminUser, 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({}) })
  }
}

export async function updateAdminUser(userId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/admin-users/${userId}`, { method: 'PATCH', body: input })
  return { item: normalizeAdminUser(payload?.data || {}) }
}

// ── Reviews ───────────────────────────────────────────────────────────────────

function normalizeReview(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: s.id,
    productId: String(s.productId || ''),
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
    return withMockFallback('Reviews served from mock.', { items: [], pagination: normalizePagination({}) })
  }
  try {
    const payload = await requestJson('/admin/reviews', {
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status },
    })
    return withLiveData(parseListPayload(payload, normalizeReview, 20))
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [], pagination: normalizePagination({}) })
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

