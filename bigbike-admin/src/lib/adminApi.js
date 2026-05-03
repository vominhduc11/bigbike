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
  normalizeSetting,
} from './contracts'
import {
  buildMockAdminUser,
  getMockBrandById,
  getMockCategoryById,
  getMockContentById,
  getMockDashboardSummary,
  getMockProductById,
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

  return error.details.reduce((acc, detail) => {
    if (!detail || typeof detail !== 'object') {
      return acc
    }
    const rawField = typeof detail.field === 'string' ? detail.field : '_form'
    // Normalize bracket notation variants[0].field → variants.0.field
    const field = rawField.replace(/\[(\d+)\]/g, '.$1')
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

export async function updateCustomer(customerId, data) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/customers/${customerId}`, {
    method: 'PATCH',
    body: data,
  })
  return parseDetailPayload(payload, normalizeCustomer)
}

// ── Media ────────────────────────────────────────────────────────────────────

export async function fetchMedia(query) {
  if (FORCE_MOCK) {
    return withMockFallback('Media list served from mock.', queryMockMedia(query))
  }
  try {
    const q = {
      page: query?.page,
      size: query?.pageSize,
      q: query?.search || undefined,
      mimeType: query?.mimeType && query.mimeType !== 'ALL' ? query.mimeType : undefined,
      status: query?.status && query.status !== 'ALL' ? query.status : undefined,
      storageProvider: query?.storageProvider && query.storageProvider !== 'ALL' ? query.storageProvider : undefined,
    }
    const payload = await requestJson('/admin/media', { query: q })
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
  const { accessToken } = readTokens()
  const formData = new FormData()
  formData.append('file', file)
  if (altText) formData.append('altText', altText)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    if (typeof onProgress === 'function') {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      })
    }

    xhr.open('POST', `${API_BASE}/admin/media`)
    xhr.setRequestHeader('Accept', 'application/json')
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)

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

// ── Settings ─────────────────────────────────────────────────────────────────

export async function fetchSettings() {
  if (FORCE_MOCK) {
    return withMockFallback('Settings served from mock.', queryMockSettings())
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

// ── Coupons ───────────────────────────────────────────────────────────────────

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

export async function reorderMenuItems(menuId, items) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/menus/${menuId}/items/reorder`, {
    method: 'POST',
    body: { items },
  })
  return withLiveData(parseDetailPayload(payload, normalizeMenu))
}

// ── Sliders ───────────────────────────────────────────────────────────────────

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

// ── Home Videos ──────────────────────────────────────────────────────────────

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

// ── Audit Logs ────────────────────────────────────────────────────────────────

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

// ── Refund ────────────────────────────────────────────────────────────────────

export async function createRefund(orderId, input) {
  assertMutationEnabled()
  const payload = await requestJson(`/admin/orders/${orderId}/refund`, {
    method: 'POST',
    body: input,
  })
  return parseDetailPayload(payload, normalizeOrder)
}

// ── Reports / Analytics ───────────────────────────────────────────────────────

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
  return {
    summary: {
      totalRevenue: Number(summary.totalRevenue) || 0,
      orderCount: Number(summary.orderCount) || 0,
      avgOrderValue: Number(summary.avgOrderValue) || 0,
      refundAmount: Number(summary.refundAmount) || 0,
    },
    dailyRevenue: Array.isArray(p.dailyRevenue) ? p.dailyRevenue.map((r) => ({
      date: String(r.date || ''),
      revenue: Number(r.revenue) || 0,
      orders: Number(r.orders) || 0,
    })) : [],
    topProducts: Array.isArray(p.topProducts) ? p.topProducts.map((r) => ({
      productName: String(r.productName || ''),
      revenue: Number(r.revenue) || 0,
      unitsSold: Number(r.unitsSold) || 0,
    })) : [],
    topCustomers: Array.isArray(p.topCustomers) ? p.topCustomers.map((r) => ({
      email: String(r.email || ''),
      totalSpent: Number(r.totalSpent) || 0,
      orderCount: Number(r.orderCount) || 0,
    })) : [],
  }
}

// ── Reports / Export ──────────────────────────────────────────────────────────

async function fetchCsvBlob(path, params = {}) {
  const { accessToken } = readTokens()
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`
  const headers = { Accept: 'text/csv' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new ApiClientError(`Export failed with status ${response.status}`, response.status, 'EXPORT_FAILED')
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

// ── Inventory ─────────────────────────────────────────────────────────────────

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
  }
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
  }
}

export function inventoryExportCsvUrl() {
  return `${API_BASE}/admin/inventory/export.csv`
}

// ── Returns / RMA ─────────────────────────────────────────────────────────────

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
  if (query.pageSize) params.pageSize = query.pageSize
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

// ── Dashboard ─────────────────────────────────────────────────────────────────

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
    return withMockFallback(e.message, getMockDashboardSummary(period))
  }
}

// ── POS (Point of Sale) ───────────────────────────────────────────────────────

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

// ── Roles & Permissions ───────────────────────────────────────────────────────

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

export async function fetchRoles() {
  try {
    const payload = await requestJson('/admin/roles')
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeRole) : []
    return withLiveData({ items: list })
  } catch (error) {
    const e = normalizeError(error)
    if (!shouldFallbackToMockOnLiveError()) throw e
    return withMockFallback(e.message, { items: [] })
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

