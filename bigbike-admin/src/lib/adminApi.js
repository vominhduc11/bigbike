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
  normalizeLegacyDiscontinuedProduct,
  normalizeSetting,
} from './contracts'
import { clearTokens, hasAccessToken, readTokens, writeTokens } from './authStorage'
import { getContentLang } from './contentLang'
import { generateId } from './utils'

const API_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/v1').replace(/\/$/, '')

export class ApiClientError extends Error {
  constructor(message, status, code, details = [], retryAfterSeconds = null) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = Array.isArray(details) ? details : []
    this.retryAfterSeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : null
  }
}

function normalizeApiErrorMessage(error, status) {
  if (error?.code === 'RATE_LIMIT_EXCEEDED' || status === 429) {
    return 'Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.'
  }
  if (error?.code === 'VALIDATION_ERROR') {
    return 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các ô đang báo lỗi.'
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }
  return `Yêu cầu thất bại (mã ${status}). Vui lòng thử lại.`
}

function parseRetryAfter(headerValue) {
  const value = Number(headerValue)
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null
}

// Auth interceptor state
// We don't pull in axios just for an auth header. The same interceptor pattern
// is implemented around fetch: every request reads the latest accessToken from
// localStorage and, on 401, the request is retried once after a refresh.
//
// onAuthError is set by the AuthProvider so the UI can react (e.g. show login
// screen) when refresh ultimately fails.
let authErrorListener = null
let authorizationErrorListener = null

export function setAuthErrorListener(listener) {
  authErrorListener = typeof listener === 'function' ? listener : null
}

// A 403 means the bearer token still identifies an admin, but their current server-side
// permission snapshot may have changed. The AuthProvider performs one coalesced /auth/me refresh
// so old screens repair themselves without treating the browser cache as authority.
export function setAuthorizationErrorListener(listener) {
  authorizationErrorListener = typeof listener === 'function' ? listener : null
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
    if (response.status === 403 && !skipAuth && authorizationErrorListener) {
      authorizationErrorListener()
    }
    const error = payload?.error || {}
    throw new ApiClientError(
      normalizeApiErrorMessage(error, response.status),
      response.status,
      error.code || 'REQUEST_FAILED',
      error.details || [],
      parseRetryAfter(response.headers.get('Retry-After')),
    )
  }

  return payload
}

async function requestBlob(endpoint, fallbackFilename = 'download') {
  const url = `${API_BASE}${endpoint}`
  const { accessToken } = readTokens()
  const dispatchBlob = (token) => {
    const headers = { Accept: 'application/octet-stream' }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(url, { method: 'GET', headers })
  }

  let response = await dispatchBlob(accessToken)
  if (response.status === 401 && accessToken) {
    const newAccess = await performTokenRefresh()
    if (newAccess) response = await dispatchBlob(newAccess)
    if (response.status === 401) {
      clearTokens()
      if (authErrorListener) authErrorListener()
    }
  }

  if (!response.ok) {
    if (response.status === 403 && authorizationErrorListener) authorizationErrorListener()
    let payload = null
    try { payload = await response.json() } catch { payload = null }
    const error = payload?.error || {}
    throw new ApiClientError(
      normalizeApiErrorMessage(error, response.status),
      response.status,
      error.code || 'REQUEST_FAILED',
      error.details || [],
      parseRetryAfter(response.headers.get('Retry-After')),
    )
  }

  const contentDisposition = response.headers.get('Content-Disposition') || ''
  const encodedName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quotedName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1]
  let filename = encodedName ? decodeURIComponent(encodedName) : quotedName
  if (!filename) filename = fallbackFilename || 'download'
  return { blob: await response.blob(), filename }
}

// Admin auth API

export async function loginAdmin({ email, password }) {
  // skipAuth: no access token exists yet, and we don't want the 401-refresh interceptor
  // kicking in on a failed login attempt. API_BASE is always same-origin (dev proxy / prod
  // nginx), so fetch's default same-origin credentials mode still lets the server set its
  // httpOnly refresh cookie — no explicit credentials: 'include' needed here.
  const payload = await requestJson('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  })
  const data = payload?.data
  if (!data?.accessToken) {
    throw new ApiClientError('Phản hồi đăng nhập từ máy chủ thiếu access token.', 500, 'INVALID_LOGIN_RESPONSE')
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
  if (Array.isArray(data)) return [...data]

  return {
    ...data,
    mode: 'live',
    warning: undefined,
  }
}

function normalizeError(error) {
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch' || error.message?.includes('Failed to fetch')) {
      return new Error('Không thể kết nối máy chủ, vui lòng kiểm tra mạng')
    }
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
    filter_gender: query?.gender || undefined,
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
    deleted: query?.deleted,
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

// Content chỉ còn ARTICLE (PAGE đã gỡ khỏi backend) — luôn resolve về path bài viết.
function normalizeContentPathType(_contentType) {
  return 'article'
}

function normalizeContentMutationPath(_contentType) {
  return 'articles'
}

export function mapValidationErrors(error, translate) {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.details)) {
    return {}
  }

  const FIELD_ALIASES = {
    'seo.title': 'seoTitle',
    'seo.description': 'seoDescription',
    'seo.canonicalUrl': 'seoCanonicalUrl',
    'seo.ogImage.url': 'seoOgImageUrl',
    'seo.ogImage.alt': 'seoOgImageAlt',
    'image.url': 'imageUrl',
  }

  return error.details.reduce((acc, detail) => {
    if (!detail || typeof detail !== 'object') {
      return acc
    }
    const rawField = typeof detail.field === 'string' ? detail.field : '_form'
    // Normalize bracket notation variants[0].field -> variants.0.field
    const field = (FIELD_ALIASES[rawField] || rawField).replace(/\[(\d+)\]/g, '.$1')
    const message = translateValidationMessage(field, detail, translate)

    if (!acc[field]) {
      acc[field] = message
    }
    return acc
  }, {})
}

function translateValidationMessage(field, detail, translate) {
  const code = typeof detail?.code === 'string' ? detail.code : ''
  const rawMessage = typeof detail?.message === 'string' ? detail.message : ''

  if (/^variants\.\d+\.options\.\d+\.attributeValueId$/.test(field)) {
    if (code === 'REQUIRED') {
      return translate
        ? translate('products.detail.variant.optionValueSelectRequired', { defaultValue: 'Hãy chọn giá trị thuộc tính từ danh sách.' })
        : 'Hãy chọn giá trị thuộc tính từ danh sách.'
    }
    if (code === 'NOT_FOUND' || code === 'MISMATCH') {
      return translate
        ? translate('products.detail.variant.optionValueInvalid', { defaultValue: 'Giá trị thuộc tính không còn hợp lệ. Hãy chọn lại từ danh sách.' })
        : 'Giá trị thuộc tính không còn hợp lệ. Hãy chọn lại từ danh sách.'
    }
  }

  if (code === 'DUPLICATE' && field === 'slug') {
    return 'Đường dẫn này đã được dùng. Hãy mở bản ghi đang có hoặc đổi đường dẫn khác.'
  }
  if (code === 'DUPLICATE' && field === 'translations.en.slug') {
    return 'Đường dẫn tiếng Anh này đã được dùng. Hãy đổi đường dẫn tiếng Anh hoặc để trống.'
  }
  if (rawMessage === 'Slug is already in use.') {
    return 'Đường dẫn này đã được dùng. Hãy mở bản ghi đang có hoặc đổi đường dẫn khác.'
  }
  if (rawMessage === 'English slug is already in use.') {
    return 'Đường dẫn tiếng Anh này đã được dùng. Hãy đổi đường dẫn tiếng Anh hoặc để trống.'
  }
  if (code === 'SELF_LOOP' && field === 'targetUrl') {
    return 'Địa chỉ mới không được trùng với địa chỉ cũ.'
  }
  if (code === 'REDIRECT_LOOP' && field === 'targetUrl') {
    return 'Địa chỉ mới đang tạo vòng lặp chuyển hướng. Hãy chọn địa chỉ khác.'
  }
  if (code === 'EXTERNAL_TARGET' && field === 'targetUrl') {
    return 'Địa chỉ mới phải thuộc website này — không được trỏ sang trang bên ngoài.'
  }
  if (code === 'UNSAFE_TARGET' && field === 'targetUrl') {
    return 'Địa chỉ mới chưa đúng. Hãy nhập đường dẫn trong website, bắt đầu bằng dấu "/" (ví dụ /sp/).'
  }
  if (code === 'INVALID_SOURCE' && field === 'sourcePattern') {
    return 'Địa chỉ cũ phải là đường dẫn trong website, không gồm tên miền, query hoặc dấu #.'
  }
  if (code === 'UNSUPPORTED' && (field === 'statusCode' || field === 'redirectType')) {
    return 'Hệ thống chỉ hỗ trợ mã 301 hoặc 410; hãy bỏ cấu hình kiểu chuyển hướng cũ.'
  }
  if (code === 'INVALID_STATUS_CODE' && field === 'statusCode') {
    return 'Mã phản hồi chỉ có thể là 301 hoặc 410.'
  }

  return rawMessage || 'Giá trị chưa hợp lệ.'
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

export async function fetchSizeScaleGroups() {
  const payload = await requestJson('/admin/size-scale-groups')
  return Array.isArray(payload) ? payload : (payload?.data ?? [])
}

export async function fetchSizeScales() {
  const payload = await requestJson('/admin/size-scales')
  return Array.isArray(payload) ? payload : (payload?.data ?? [])
}

export async function createSizeScale(input) {
  const payload = await requestJson('/admin/size-scales', { method: 'POST', body: input })
  return payload?.data ?? payload
}

export async function updateSizeScale(scaleId, input) {
  const payload = await requestJson(`/admin/size-scales/${scaleId}`, { method: 'PATCH', body: input })
  return payload?.data ?? payload
}

export async function deleteSizeScale(scaleId) {
  await requestJson(`/admin/size-scales/${scaleId}`, { method: 'DELETE' })
}

export async function createSizeScaleValue(scaleId, input) {
  const payload = await requestJson(`/admin/size-scales/${scaleId}/values`, { method: 'POST', body: input })
  return payload?.data ?? payload
}

export async function updateSizeScaleValue(valueId, input) {
  const payload = await requestJson(`/admin/size-scale-values/${valueId}`, { method: 'PATCH', body: input })
  return payload?.data ?? payload
}

export async function deleteSizeScaleValue(valueId) {
  await requestJson(`/admin/size-scale-values/${valueId}`, { method: 'DELETE' })
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

export async function permanentDeleteProduct(productId) {
  await requestJson(`/admin/products/${productId}/permanent`, { method: 'DELETE' })
}

// Bulk import products from a JSON file — validate = dry-run report, no persistence;
// commit = same file re-sent, actually saves rows that still validate clean.
export async function importProductsValidate(file) {
  const form = new FormData()
  form.append('file', file)
  const payload = await requestJson('/admin/products/import/validate', {
    method: 'POST',
    body: form,
  })
  return payload?.data
}

export async function importProductsCommit(file, skipRowKeys) {
  const form = new FormData()
  form.append('file', file)
  const payload = await requestJson('/admin/products/import/commit', {
    method: 'POST',
    query: { skipRowKeys: skipRowKeys?.length ? skipRowKeys.join(',') : undefined },
    body: form,
  })
  return payload?.data
}

export async function exportProductJson(productId) {
  return fetchCsvBlob(`/admin/products/import/export/${productId}`, {}, `product-${productId}.json`, 'application/json')
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

// Read-only catalog facts used by the AI content brief. The public facets
// endpoint already applies the canonical PUBLISHED + non-discontinued gate,
// counts descendants, deduplicates products, and returns effective prices.
export async function fetchCatalogFacets({ category, lang } = {}) {
  try {
    const payload = await requestJson('/catalog/facets', {
      query: { category, lang: lang ?? getContentLang() },
      skipAuth: true,
    })
    return withLiveData(payload?.data ?? payload ?? {})
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

export async function softDeleteCategory(categoryId) {
  await requestJson(`/admin/categories/${categoryId}`, { method: 'DELETE' })
}

export async function restoreCategory(categoryId) {
  const payload = await requestJson(`/admin/categories/${categoryId}/restore`, { method: 'POST' })
  return parseDetailPayload(payload, normalizeCategory)
}

export async function hardDeleteCategory(categoryId) {
  await requestJson(`/admin/categories/${categoryId}/permanent`, { method: 'DELETE' })
}

export async function previewCategoryPermanentDelete(categoryIds) {
  const payload = await requestJson('/admin/categories/permanent-delete-impact', {
    method: 'POST',
    body: { categoryIds },
  })
  const data = payload?.data ?? {}
  return {
    requestedCategoryCount: Number(data.requestedCategoryCount) || 0,
    rootCategoryIds: Array.isArray(data.rootCategoryIds) ? data.rootCategoryIds.map(String) : [],
    descendantCategoryCount: Number(data.descendantCategoryCount) || 0,
    affectedProductCount: Number(data.affectedProductCount) || 0,
    reassignedProductCount: Number(data.reassignedProductCount) || 0,
  }
}

export async function fetchBrands(query) {
  try {
    const payload = await requestJson('/admin/brands', { query: buildBrandQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeBrand, Number(query?.pageSize) || 10))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function importBrandLogoUrl(input) {
  try {
    const payload = await requestJson('/admin/brands/logo/import-url', {
      method: 'POST',
      body: input,
    })
    return { item: normalizeMediaItem(payload?.data || {}) }
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

export async function restoreBrand(brandId) {
  const payload = await requestJson(`/admin/brands/${brandId}/restore`, { method: 'POST' })
  return parseDetailPayload(payload, normalizeBrand)
}

export async function permanentDeleteBrand(brandId) {
  const payload = await requestJson(`/admin/brands/${brandId}/permanent`, { method: 'DELETE' })
  return { reassignedProductCount: payload?.data?.reassignedProductCount ?? 0 }
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

export async function createAttribute({ name, nameEn } = {}) {
  const payload = await requestJson('/admin/attributes', {
    method: 'POST',
    body: { name, nameEn },
  })
  return payload?.data ?? payload
}

export async function deleteAttribute(attributeId) {
  await requestJson(`/admin/attributes/${attributeId}`, { method: 'DELETE' })
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

export async function deleteAttributeValue(valueId) {
  await requestJson(`/admin/attribute-values/${valueId}`, { method: 'DELETE' })
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

export async function restoreContent(contentType, contentId) {
  const mutationPath = normalizeContentMutationPath(contentType)
  const payload = await requestJson(`/admin/content/${mutationPath}/${contentId}/restore`, { method: 'POST' })
  return parseDetailPayload(payload, normalizeContentItem)
}

export async function permanentDeleteContent(contentType, contentId) {
  const mutationPath = normalizeContentMutationPath(contentType)
  await requestJson(`/admin/content/${mutationPath}/${contentId}/permanent`, { method: 'DELETE' })
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

export async function fetchRedirects(query) {
  try {
    const payload = await requestJson('/admin/redirects', { query: buildRedirectQuery(query) })
    return withLiveData(parseListPayload(payload, normalizeRedirect, Number(query?.pageSize) || 20))
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

export async function fetchLegacyDiscontinuedProducts(query) {
  try {
    const payload = await requestJson('/admin/legacy-discontinued-products', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        q: query?.search,
        enabled: query?.enabled,
      },
    })
    return withLiveData(parseListPayload(payload, normalizeLegacyDiscontinuedProduct, Number(query?.pageSize) || 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function createLegacyDiscontinuedProduct(input) {
  const payload = await requestJson('/admin/legacy-discontinued-products', { method: 'POST', body: input })
  return parseDetailPayload(payload, normalizeLegacyDiscontinuedProduct)
}

export async function updateLegacyDiscontinuedProduct(id, input) {
  const payload = await requestJson(`/admin/legacy-discontinued-products/${id}`, { method: 'PATCH', body: input })
  return parseDetailPayload(payload, normalizeLegacyDiscontinuedProduct)
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
        from: query?.from,
        to: query?.to,
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
  if (reason) body.cancelReason = reason
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
      // toQueryString() bỏ qua 'ALL' — cùng cơ chế với status, nên synthetic ('ALL'/'true'/'false')
      // chỉ thực sự lên query string khi khác 'ALL'.
      query: { page: query?.page, size: query?.pageSize, q: query?.search, status: query?.status, synthetic: query?.synthetic, emailVerified: query?.emailVerified },
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

export async function updateCustomerStatus(customerId, status, reason) {
  const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
  const payload = await requestJson(`/admin/customers/${customerId}/status`, {
    method: 'PATCH',
    body: trimmedReason ? { status, reason: trimmedReason } : { status },
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

export async function removeCustomerAvatar(customerId) {
  const payload = await requestJson(`/admin/customers/${customerId}/avatar`, { method: 'DELETE' })
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

export async function downloadMedia(mediaId, fallbackFilename) {
  const { blob, filename } = await requestBlob(`/admin/media/${mediaId}/download`, fallbackFilename)
  if (typeof URL?.createObjectURL !== 'function' || typeof document === 'undefined') {
    throw new ApiClientError('Không thể tạo file tải xuống trong trình duyệt.', 0, 'DOWNLOAD_UNSUPPORTED')
  }
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

export async function fetchMediaBlob(mediaId, fallbackFilename = 'media-download') {
  try {
    return await requestBlob(`/admin/media/${mediaId}/download`, fallbackFilename)
  } catch (error) {
    throw normalizeError(error)
  }
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

export async function uploadMedia(file, altText = '', onProgress = null, folderId = null, clearFolder = false) {

  // First attempt with current access token; if 401, refresh once and retry.
  // We must use XHR (not fetch) because XHR exposes upload progress events.
  async function attempt(token) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      if (altText) formData.append('altText', altText)
      if (folderId) formData.append('folderId', folderId)
      if (clearFolder) formData.append('clearFolder', 'true')

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
          const detailMessage = Array.isArray(error.details)
            ? error.details.find((detail) => typeof detail?.message === 'string' && detail.message.trim())?.message
            : ''
          reject(new ApiClientError(
            detailMessage || error.message || `Upload failed with status ${xhr.status}`,
            xhr.status,
            error.code || 'UPLOAD_FAILED',
            error.details || [],
            parseRetryAfter(xhr.getResponseHeader('Retry-After')),
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
    if (err?.status === 401) {
      if (accessToken) {
        const refreshed = await performTokenRefresh()
        if (refreshed) {
          try {
            return await attempt(refreshed)
          } catch (retryError) {
            if (retryError?.status === 403 && authorizationErrorListener) authorizationErrorListener()
            if (retryError?.status === 401) {
              clearTokens()
              if (authErrorListener) authErrorListener()
            }
            throw retryError
          }
        }
      }
      clearTokens()
      if (authErrorListener) authErrorListener()
    }
    if (err?.status === 403 && authorizationErrorListener) {
      authorizationErrorListener()
    }
    throw err
  }
}

// Settings

export async function fetchPublicSettings() {
  try {
    const payload = await requestJson('/settings/public', { skipAuth: true })
    return Array.isArray(payload?.data) ? payload.data : []
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchSettings() {
  try {
    const payload = await requestJson('/admin/settings', { query: { page: 1, size: 200 } })
    const list = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
    return withLiveData({ items: list })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function batchUpdateSettings(updates) {
  const payload = await requestJson('/admin/settings', {
    method: 'PATCH',
    body: { updates },
  })
  const items = Array.isArray(payload?.data) ? payload.data.map(normalizeSetting) : []
  return { items }
}

// Maintenance (admin-panel lock)
//
// Read is intentionally ungated so every signed-in staff member sees why the panel is
// locked; the server restricts the write to the DEVELOPER role and reports it back as
// `canToggle`, so the UI never has to re-derive the rule.

export async function fetchMaintenance() {
  try {
    const payload = await requestJson('/admin/maintenance')
    return payload?.data || null
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function updateMaintenance({ state, staffNote }) {
  const payload = await requestJson('/admin/maintenance', {
    method: 'PUT',
    body: {
      state,
      staffNote: staffNote?.trim() ? staffNote.trim() : null,
    },
  })
  return payload?.data || null
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
    const data = payload?.data
    return withLiveData({
      items: Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []),
      version: Array.isArray(data) ? 0 : (Number.isInteger(data?.version) ? data.version : 0),
    })
  } catch (error) {
    const e = normalizeError(error)
    throw e
  }
}

export async function saveHomeHighlights(slots, expectedVersion) {
  const payload = await requestJson('/admin/home/category-highlights', {
    method: 'PUT',
    body: { slots, expectedVersion },
  })
  const data = payload?.data
  return {
    items: Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []),
    version: Array.isArray(data) ? expectedVersion : (Number.isInteger(data?.version) ? data.version : expectedVersion),
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

function safeReviewString(value) {
  return typeof value === 'string' ? value : ''
}

function safeReviewPhoto(value) {
  if (typeof value !== 'string') return ''
  const candidate = value.trim()
  if (!candidate.startsWith('/media/reviews/') || candidate.includes('?') || candidate.includes('#') || candidate.includes('\\')) return ''
  try {
    const decoded = decodeURIComponent(candidate)
    if (decoded.includes('?') || decoded.includes('#') || decoded.includes('\\')) return ''
    const segments = decoded.slice('/media/reviews/'.length).split('/')
    return segments.length > 0 && segments.every((segment) => segment && segment !== '.' && segment !== '..')
      ? candidate
      : ''
  } catch {
    return ''
  }
}

function safeReviewCount(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : 0
}

function safeReviewAverage(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 5 ? number : 0
}

function normalizeReview(input) {
  const s = input && typeof input === 'object' ? input : {}
  const rating = Number(s.rating)
  return {
    id: typeof s.id === 'string' || Number.isFinite(s.id) ? s.id : '',
    productId: typeof s.productId === 'string' || Number.isFinite(s.productId) ? String(s.productId) : '',
    productName: safeReviewString(s.productName),
    productNameEn: safeReviewString(s.productNameEn),
    productSlug: safeReviewString(s.productSlug),
    authorName: safeReviewString(s.authorName),
    authorEmail: safeReviewString(s.authorEmail),
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 && Number.isInteger(rating * 2) ? rating : null,
    body: safeReviewString(s.body),
    photos: Array.isArray(s.photos) ? s.photos.map(safeReviewPhoto).filter(Boolean) : [],
    status: safeReviewString(s.status),
    version: Number.isInteger(Number(s.version)) && Number(s.version) >= 0 ? Number(s.version) : 0,
    createdAt: safeReviewString(s.createdAt),
    updatedAt: safeReviewString(s.updatedAt),
  }
}

export async function fetchReviews(query) {
  try {
    const payload = await requestJson('/admin/reviews', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        q: query?.search,
        status: query?.status,
        rating: query?.rating || undefined,
        lang: getContentLang(),
      },
    })
    return withLiveData(parseListPayload(payload, normalizeReview, 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchReviewSummary() {
  try {
    const payload = await requestJson('/admin/reviews/summary')
    const data = payload?.data || {}
    const approved = data.approved || {}
    const pending = data.pending || {}
    const ratingBreakdown = approved.ratingBreakdown && typeof approved.ratingBreakdown === 'object'
      ? approved.ratingBreakdown
      : {}
    return {
      approved: {
        averageRating: safeReviewAverage(approved.averageRating),
        totalReviews: safeReviewCount(approved.totalReviews),
        // REVIEW_RULE_008: 9 mức nửa sao (5 → 1, bước 0,5).
        ratingBreakdown: Object.fromEntries([5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((star) => [
          String(star),
          safeReviewCount(ratingBreakdown[String(star)]),
        ])),
      },
      pending: {
        totalReviews: safeReviewCount(pending.totalReviews),
        oneStarReviews: safeReviewCount(pending.oneStarReviews),
      },
    }
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

export async function updateReviewStatus(reviewId, status, expectedVersion) {
  const payload = await requestJson(`/admin/reviews/${reviewId}/status`, {
    method: 'PATCH',
    body: { status, expectedVersion },
  })
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
  const item = normalizeReview(data)
  // PATCH returns the privacy-safe list projection. Preserve the detail-only
  // email already loaded by omitting this key when the server omits it.
  if (!Object.prototype.hasOwnProperty.call(data, 'authorEmail')) delete item.authorEmail
  return { item }
}

export async function deleteReview(reviewId, expectedVersion) {
  await requestJson(`/admin/reviews/${reviewId}`, {
    method: 'DELETE',
    query: { expectedVersion },
  })
}

function normalizeReviewBulkResult(payload) {
  const data = payload?.data || {}
  return {
    affected: Number.isInteger(Number(data.affected)) && Number(data.affected) >= 0
      ? Number(data.affected)
      : 0,
    skipped: Array.isArray(data.skipped)
      ? data.skipped.map((item) => ({
          id: item?.id,
          reason: String(item?.reason || 'UNKNOWN'),
        }))
      : [],
  }
}

/** Versioned, best-effort bulk moderation; see API_CONTRACT.md "Admin Reviews Contract". */
export async function bulkUpdateReviewStatus(items, status) {
  const payload = await requestJson('/admin/reviews/bulk-status', {
    method: 'POST',
    body: { items, status },
  })
  return normalizeReviewBulkResult(payload)
}

/** Bulk counterpart of {@link deleteReview}. */
export async function bulkDeleteReviews(items) {
  const payload = await requestJson('/admin/reviews/bulk-delete', {
    method: 'POST',
    body: { items },
  })
  return normalizeReviewBulkResult(payload)
}

// AI assistant conversations (read-only; CHAT_RULE_012).

function safeChatString(value) {
  return typeof value === 'string' ? value : ''
}

function safeChatCount(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : 0
}

function nullableChatNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function normalizeChatConversation(input) {
  const s = input && typeof input === 'object' ? input : {}
  const aiCallCount = safeChatCount(s.aiCallCount)
  const providerRequests = nullableChatNumber(s.providerRequests)
  return {
    id: safeChatString(s.id),
    locale: s.locale === 'en' ? 'en' : 'vi',
    customerDisplayName: safeChatString(s.customerDisplayName),
    turnCount: safeChatCount(s.turnCount),
    aiCallCount,
    hasLead: Boolean(s.hasLead),
    startedAt: safeChatString(s.startedAt),
    lastMessageAt: safeChatString(s.lastMessageAt),
    endedReason: safeChatString(s.endedReason),
    inputTokens: nullableChatNumber(s.inputTokens),
    outputTokens: nullableChatNumber(s.outputTokens),
    thinkingTokens: nullableChatNumber(s.thinkingTokens),
    providerRequests,
    averageLatencyMs: nullableChatNumber(s.averageLatencyMs),
    estimatedCostUsd: nullableChatNumber(s.estimatedCostUsd),
    contentRefusals: nullableChatNumber(s.contentRefusals),
    assistedOrders: nullableChatNumber(s.assistedOrders),
    assistedRevenue: nullableChatNumber(s.assistedRevenue),
    hasTelemetry: aiCallCount === 0 || (providerRequests ?? 0) > 0,
  }
}

function normalizeChatMessage(input) {
  const s = input && typeof input === 'object' ? input : {}
  let products = []
  if (Array.isArray(s.products)) products = s.products
  else if (typeof s.productsJson === 'string' && s.productsJson.trim()) {
    try {
      const parsed = JSON.parse(s.productsJson)
      products = Array.isArray(parsed) ? parsed : []
    } catch { products = [] }
  }
  return {
    id: safeChatString(s.id),
    sequenceNo: safeChatCount(s.sequenceNo),
    role: ['USER', 'CUSTOMER', 'ASSISTANT', 'STAFF', 'SYSTEM'].includes(s.role)
      ? (s.role === 'CUSTOMER' ? 'USER' : s.role)
      : 'ASSISTANT',
    staffDisplayName: safeChatString(s.staffDisplayName),
    content: safeChatString(s.content),
    source: safeChatString(s.source),
    aiCalled: Boolean(s.aiCalled),
    products: products.filter((item) => item && typeof item === 'object').slice(0, 8),
    answerFormat: s.answerFormat === 'MARKDOWN' ? 'MARKDOWN' : 'PLAIN_TEXT',
    resultKind: safeChatString(s.resultKind),
    inputTokens: nullableChatNumber(s.inputTokens),
    outputTokens: nullableChatNumber(s.outputTokens),
    thinkingTokens: nullableChatNumber(s.thinkingTokens),
    providerRequestCount: nullableChatNumber(s.providerRequestCount),
    latencyMs: nullableChatNumber(s.latencyMs),
    estimatedCostUsd: nullableChatNumber(s.estimatedCostUsd),
    createdAt: safeChatString(s.createdAt),
    images: Array.isArray(s.images)
      ? s.images.map((image) => ({
        id: safeChatString(image?.id),
        contentPath: safeChatString(image?.contentPath),
        mimeType: safeChatString(image?.mimeType),
        width: safeChatCount(image?.width),
        height: safeChatCount(image?.height),
        sizeBytes: safeChatCount(image?.sizeBytes),
        status: safeChatString(image?.status),
        createdAt: safeChatString(image?.createdAt),
      })).filter((image) => image.id).slice(0, 1)
      : [],
  }
}

function normalizeChatOrderAttribution(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    orderId: safeChatString(s.orderId),
    orderLineItemId: safeChatString(s.orderLineItemId),
    attributedAmount: nullableChatNumber(s.attributedAmount),
    currency: safeChatString(s.currency) || 'VND',
    createdAt: safeChatString(s.createdAt),
  }
}

function normalizeChatLead(input) {
  if (!input || typeof input !== 'object') return null
  return {
    id: safeChatString(input.id),
    name: safeChatString(input.name),
    phone: safeChatString(input.phone),
    note: safeChatString(input.note),
    source: safeChatString(input.source),
    consentedAt: safeChatString(input.consentedAt),
  }
}

function normalizeChatDetail(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    ...normalizeChatConversation(s),
    customerId: safeChatString(s.customerId),
    leadOfferStatus: safeChatString(s.leadOfferStatus),
    messages: Array.isArray(s.messages) ? s.messages.map(normalizeChatMessage) : [],
    orderAttributions: Array.isArray(s.orderAttributions)
      ? s.orderAttributions.map(normalizeChatOrderAttribution).filter((item) => item.orderId)
      : [],
    lead: normalizeChatLead(s.lead),
  }
}

export async function fetchChatConversations(query) {
  try {
    const payload = await requestJson('/admin/chat/conversations', {
      query: {
        page: query?.page,
        size: query?.pageSize,
        from: query?.from,
        to: query?.to,
        hasLead: query?.hasLead,
      },
    })
    return withLiveData(parseListPayload(payload, normalizeChatConversation, 20))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchChatConversation(conversationId) {
  try {
    const payload = await requestJson(`/admin/chat/conversations/${encodeURIComponent(conversationId)}`)
    return withLiveData(parseDetailPayload(payload, normalizeChatDetail))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchAdminChatImageBlob(imageId) {
  try {
    const result = await requestBlob(`/admin/chat/images/${encodeURIComponent(imageId)}/content`, 'chat-image')
    return result.blob
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchChatStats(input) {
  try {
    const params = typeof input === 'string' ? { date: input } : (input || {})
    const payload = await requestJson('/admin/chat/stats', {
      query: { date: params.date, from: params.from, to: params.to },
    })
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
    return withLiveData({
      date: safeChatString(data.date),
      periodFrom: safeChatString(data.periodFrom),
      periodTo: safeChatString(data.periodTo),
      aiCalls: safeChatCount(data.aiCalls),
      conversations: safeChatCount(data.conversations),
      leads: safeChatCount(data.leads),
      unanswered: safeChatCount(data.unanswered),
      dailyLimit: safeChatCount(data.dailyLimit),
      remainingAiCalls: safeChatCount(data.remainingAiCalls),
      inputTokens: nullableChatNumber(data.inputTokens),
      outputTokens: nullableChatNumber(data.outputTokens),
      thinkingTokens: nullableChatNumber(data.thinkingTokens),
      providerRequests: nullableChatNumber(data.providerRequests),
      averageLatencyMs: nullableChatNumber(data.averageLatencyMs),
      estimatedCostUsd: nullableChatNumber(data.estimatedCostUsd),
      contentRefusals: nullableChatNumber(data.contentRefusals),
      assistedOrders: nullableChatNumber(data.assistedOrders),
      assistedRevenue: nullableChatNumber(data.assistedRevenue),
      quality: {
        answers: safeChatCount(data.quality?.answers),
        productResults: safeChatCount(data.quality?.productResults),
        clarifications: safeChatCount(data.quality?.clarifications),
        outOfScope: safeChatCount(data.quality?.outOfScope),
        contentRefusals: safeChatCount(data.quality?.contentRefusals),
      },
      leadFunnel: {
        callbackFormOpened: safeChatCount(data.leadFunnel?.callbackFormOpened),
        sequence1Viewed: safeChatCount(data.leadFunnel?.sequence1Viewed),
        sequence2Viewed: safeChatCount(data.leadFunnel?.sequence2Viewed),
        accepted: safeChatCount(data.leadFunnel?.accepted),
        declined: safeChatCount(data.leadFunnel?.declined),
      },
      actionStats: Array.isArray(data.actionStats) ? data.actionStats.map((row) => ({
        actionType: safeChatString(row?.actionType),
        clicks: safeChatCount(row?.clicks),
        cartLines: safeChatCount(row?.cartLines),
        orders: safeChatCount(row?.orders),
        revenue: nullableChatNumber(row?.revenue) ?? 0,
        conversionRate: nullableChatNumber(row?.conversionRate) ?? 0,
      })).filter((row) => row.actionType) : [],
      monthlyCostUsd: nullableChatNumber(data.monthlyCostUsd) ?? 0,
      monthlyCostWarningUsd: nullableChatNumber(data.monthlyCostWarningUsd) ?? 0,
      monthlyCostWarningExceeded: data.monthlyCostWarningExceeded === true,
      costs: {
        todayUsd: nullableChatNumber(data.costs?.todayUsd) ?? 0,
        monthUsd: nullableChatNumber(data.costs?.monthUsd) ?? 0,
        averagePerConversationUsd: nullableChatNumber(data.costs?.averagePerConversationUsd) ?? 0,
        textTodayUsd: nullableChatNumber(data.costs?.textTodayUsd) ?? 0,
        textMonthUsd: nullableChatNumber(data.costs?.textMonthUsd) ?? 0,
        imageTodayUsd: nullableChatNumber(data.costs?.imageTodayUsd) ?? 0,
        imageMonthUsd: nullableChatNumber(data.costs?.imageMonthUsd) ?? 0,
        indexTodayUsd: nullableChatNumber(data.costs?.indexTodayUsd) ?? 0,
        indexMonthUsd: nullableChatNumber(data.costs?.indexMonthUsd) ?? 0,
        evaluationTodayUsd: nullableChatNumber(data.costs?.evaluationTodayUsd) ?? 0,
        evaluationMonthUsd: nullableChatNumber(data.costs?.evaluationMonthUsd) ?? 0,
      },
      fallbacks: {
        today: safeChatCount(data.fallbacks?.today),
        month: safeChatCount(data.fallbacks?.month),
        rate: nullableChatNumber(data.fallbacks?.rate) ?? 0,
        lastReason: safeChatString(data.fallbacks?.lastReason),
        giveUpCount14Days: safeChatCount(data.fallbacks?.giveUpCount14Days),
        replyCount14Days: safeChatCount(data.fallbacks?.replyCount14Days),
        giveUpRate14Days: nullableChatNumber(data.fallbacks?.giveUpRate14Days) ?? 0,
        baselineGiveUpRate: nullableChatNumber(data.fallbacks?.baselineGiveUpRate) ?? 0.09,
        p50LatencyMs14Days: nullableChatNumber(data.fallbacks?.p50LatencyMs14Days),
        p95LatencyMs14Days: nullableChatNumber(data.fallbacks?.p95LatencyMs14Days),
      },
      modelUsage: Array.isArray(data.modelUsage) ? data.modelUsage.map((item) => ({
        modelId: safeChatString(item?.modelId),
        uses: safeChatCount(item?.uses),
        costUsd: nullableChatNumber(item?.costUsd) ?? 0,
      })).filter((item) => item.modelId) : [],
      hasTelemetry: safeChatCount(data.aiCalls) === 0 || (nullableChatNumber(data.providerRequests) ?? 0) > 0,
    })
  } catch (error) {
    throw normalizeError(error)
  }
}

function normalizeChatFunnel(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    from: safeChatString(s.from),
    to: safeChatString(s.to),
    conversations: safeChatCount(s.conversations),
    productViews: safeChatCount(s.productViews),
    cartAdds: safeChatCount(s.cartAdds),
    orders: safeChatCount(s.orders),
    revenue: nullableChatNumber(s.revenue) ?? 0,
    conversationToViewRate: nullableChatNumber(s.conversationToViewRate) ?? 0,
    viewToCartRate: nullableChatNumber(s.viewToCartRate) ?? 0,
    cartToOrderRate: nullableChatNumber(s.cartToOrderRate) ?? 0,
    matureThrough: safeChatString(s.matureThrough),
    complete: s.complete === true,
  }
}

export async function fetchChatFunnel(query) {
  try {
    const payload = await requestJson('/admin/chat/funnel', {
      query: { from: query?.from, to: query?.to },
    })
    return withLiveData(normalizeChatFunnel(payload?.data))
  } catch (error) {
    throw normalizeError(error)
  }
}

function normalizeChatHandoff(input) {
  const s = input && typeof input === 'object' ? input : {}
  return {
    id: safeChatString(s.id),
    conversationId: safeChatString(s.conversationId),
    status: ['WAITING', 'ACTIVE', 'RETURNED_TO_AI', 'CLOSED'].includes(s.status) ? s.status : 'WAITING',
    triggerSource: safeChatString(s.triggerSource),
    customerKind: s.customerKind === 'SIGNED_IN' ? 'SIGNED_IN' : 'GUEST',
    questionSummary: safeChatString(s.questionSummary),
    products: Array.isArray(s.products) ? s.products.map((item) => ({
      slug: safeChatString(item?.slug),
      name: safeChatString(item?.name),
    })).filter((item) => item.slug && item.name).slice(0, 8) : [],
    contactPresent: s.contactPresent === true,
    requestedAt: safeChatString(s.requestedAt),
    waitingSeconds: safeChatCount(s.waitingSeconds),
    assignedAt: safeChatString(s.assignedAt),
    assignedAdminId: safeChatString(s.assignedAdminId),
    assignedDisplayName: safeChatString(s.assignedDisplayName),
    resolvedAt: safeChatString(s.resolvedAt),
    resolution: safeChatString(s.resolution),
    withinBusinessHours: s.withinBusinessHours === true,
    nextOpenAt: safeChatString(s.nextOpenAt),
  }
}

export async function fetchChatHandoffs() {
  try {
    const payload = await requestJson('/admin/chat/handoffs')
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
    return withLiveData({
      waitingCount: safeChatCount(data.waitingCount),
      items: Array.isArray(data.items)
        ? data.items.map(normalizeChatHandoff).filter((item) => item.id && item.conversationId)
        : [],
    })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function acknowledgeChatHandoff(id) {
  try {
    const payload = await requestJson(`/admin/chat/handoffs/${encodeURIComponent(id)}/acknowledge`, {
      method: 'POST',
    })
    return withLiveData(normalizeChatHandoff(payload?.data))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function claimChatHandoff(id) {
  try {
    const payload = await requestJson(`/admin/chat/handoffs/${encodeURIComponent(id)}/claim`, { method: 'POST' })
    return withLiveData(normalizeChatHandoff(payload?.data))
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function sendChatStaffMessage(conversationId, content, requestId = generateId()) {
  try {
    const payload = await requestJson(`/admin/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: { requestId, content },
    })
    return withLiveData(payload?.data ?? null)
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function returnChatToAi(id, locale = 'vi') {
  try {
    const payload = await requestJson(`/admin/chat/handoffs/${encodeURIComponent(id)}/return-to-ai`, {
      method: 'POST', body: { locale },
    })
    return withLiveData(normalizeChatHandoff(payload?.data))
  } catch (error) { throw normalizeError(error) }
}

export async function closeChatHandoff(id, locale = 'vi') {
  try {
    const payload = await requestJson(`/admin/chat/handoffs/${encodeURIComponent(id)}/close`, {
      method: 'POST', body: { locale },
    })
    return withLiveData(normalizeChatHandoff(payload?.data))
  } catch (error) { throw normalizeError(error) }
}

export async function fetchChatFeedback(query) {
  try {
    const payload = await requestJson('/admin/chat/feedback', {
      query: { from: query?.from, to: query?.to },
    })
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
    return withLiveData({
      helpful: safeChatCount(data.helpful),
      unhelpful: safeChatCount(data.unhelpful),
      issues: Array.isArray(data.issues) ? data.issues.map((item) => ({
        topicCode: safeChatString(item?.topicCode), reason: safeChatString(item?.reason), total: safeChatCount(item?.total),
      })) : [],
      weeklyTrend: Array.isArray(data.weeklyTrend) ? data.weeklyTrend.map((item) => ({
        weekStart: safeChatString(item?.weekStart), helpful: safeChatCount(item?.helpful), unhelpful: safeChatCount(item?.unhelpful),
      })) : [],
      samples: Array.isArray(data.samples) ? data.samples.map((item) => ({
        feedbackId: safeChatString(item?.feedbackId),
        conversationId: safeChatString(item?.conversationId),
        messageId: safeChatString(item?.messageId),
        question: safeChatString(item?.question),
        answer: safeChatString(item?.answer),
        topicCode: safeChatString(item?.topicCode),
        reason: safeChatString(item?.reason),
        createdAt: safeChatString(item?.createdAt),
        total: safeChatCount(item?.total),
      })).filter((item) => item.feedbackId) : [],
    })
  } catch (error) { throw normalizeError(error) }
}

export async function fetchChatFeedbackTemplatePrefill(id) {
  try {
    const payload = await requestJson(`/admin/chat/feedback/${encodeURIComponent(id)}/template-prefill`)
    return withLiveData(payload?.data ?? null)
  } catch (error) { throw normalizeError(error) }
}

export async function previewAssistantTemplate(body) {
  try {
    const payload = await requestJson('/admin/settings/ai-assistant/templates/preview', { method: 'POST', body })
    return withLiveData(payload?.data ?? null)
  } catch (error) { throw normalizeError(error) }
}

function normalizeAssistantModel(input) {
  const item = input && typeof input === 'object' ? input : {}
  return {
    id: safeChatString(item.id),
    displayName: safeChatString(item.displayName),
    speedTier: safeChatString(item.speedTier),
    costTier: safeChatString(item.costTier),
    speedDescriptionVi: safeChatString(item.speedDescriptionVi),
    speedDescriptionEn: safeChatString(item.speedDescriptionEn),
    costDescriptionVi: safeChatString(item.costDescriptionVi),
    costDescriptionEn: safeChatString(item.costDescriptionEn),
    inputUsdPerMillion: nullableChatNumber(item.inputUsdPerMillion),
    outputUsdPerMillion: nullableChatNumber(item.outputUsdPerMillion),
    supportsImages: item.supportsImages === true,
    available: item.available === true,
    selectable: item.selectable === true,
    reason: safeChatString(item.reason),
    priceEffectiveFrom: safeChatString(item.priceEffectiveFrom),
    pricingSource: safeChatString(item.pricingSource),
  }
}

function normalizeAssistantModelCatalog(input) {
  const data = input && typeof input === 'object' ? input : {}
  return {
    currentModel: safeChatString(data.currentModel),
    fallbackModel: safeChatString(data.fallbackModel),
    reviewModerationModel: safeChatString(data.reviewModerationModel),
    models: Array.isArray(data.models)
      ? data.models.map(normalizeAssistantModel).filter((item) => item.id)
      : [],
    refreshedAt: safeChatString(data.refreshedAt),
    stale: data.stale === true,
  }
}

export async function fetchAssistantModels(refresh = false) {
  try {
    const payload = await requestJson('/admin/chat/models', { query: { refresh } })
    return withLiveData(normalizeAssistantModelCatalog(payload?.data))
  } catch (error) { throw normalizeError(error) }
}

export async function updateAssistantModel(modelId) {
  try {
    const payload = await requestJson('/admin/chat/model', { method: 'PUT', body: { modelId } })
    return withLiveData(normalizeAssistantModelCatalog(payload?.data))
  } catch (error) { throw normalizeError(error) }
}

function normalizeEvaluationResult(input) {
  const item = input && typeof input === 'object' ? input : {}
  return {
    modelId: safeChatString(item.modelId),
    totalCases: safeChatCount(item.totalCases),
    passedCases: safeChatCount(item.passedCases),
    numericCaseCount: safeChatCount(item.numericCaseCount),
    numericAccuracy: nullableChatNumber(item.numericAccuracy) ?? 0,
    intentAccuracy: nullableChatNumber(item.intentAccuracy) ?? 0,
    nonFabricationCaseCount: safeChatCount(item.nonFabricationCaseCount),
    nonFabricationRate: nullableChatNumber(item.nonFabricationRate) ?? 0,
    giveUpRate: nullableChatNumber(item.giveUpRate) ?? 0,
    p50LatencyMs: nullableChatNumber(item.p50LatencyMs),
    p95LatencyMs: nullableChatNumber(item.p95LatencyMs),
    inputTokens: safeChatCount(item.inputTokens),
    outputTokens: safeChatCount(item.outputTokens),
    thinkingTokens: safeChatCount(item.thinkingTokens),
    fallbackCount: safeChatCount(item.fallbackCount),
    estimatedCostUsd: nullableChatNumber(item.estimatedCostUsd) ?? 0,
    averageCostUsd: nullableChatNumber(item.averageCostUsd) ?? 0,
  }
}

function normalizeEvaluationRun(input) {
  const item = input && typeof input === 'object' ? input : {}
  return {
    id: safeChatString(item.id),
    datasetVersion: safeChatString(item.datasetVersion),
    datasetChecksum: safeChatString(item.datasetChecksum),
    modelIds: Array.isArray(item.modelIds) ? item.modelIds.map(safeChatString).filter(Boolean) : [],
    maxCostUsd: nullableChatNumber(item.maxCostUsd) ?? 0,
    actualCostUsd: nullableChatNumber(item.actualCostUsd) ?? 0,
    status: safeChatString(item.status),
    failureCode: safeChatString(item.failureCode),
    startedAt: safeChatString(item.startedAt),
    completedAt: safeChatString(item.completedAt),
    results: Array.isArray(item.results)
      ? item.results.map(normalizeEvaluationResult).filter((result) => result.modelId)
      : [],
  }
}

export async function fetchAssistantEvaluationDatasets() {
  try {
    const payload = await requestJson('/admin/chat/evaluations/datasets')
    const items = Array.isArray(payload?.data) ? payload.data : []
    return withLiveData(items.map((item) => ({
      version: safeChatString(item?.version),
      checksum: safeChatString(item?.checksum),
      caseCount: safeChatCount(item?.caseCount),
      acceptanceCheckCount: safeChatCount(item?.acceptanceCheckCount),
      realConversationCaseCount: safeChatCount(item?.realConversationCaseCount),
      sourceSummary: safeChatString(item?.sourceSummary),
      descriptionVi: safeChatString(item?.descriptionVi),
      descriptionEn: safeChatString(item?.descriptionEn),
      acceptanceCoverage: Array.isArray(item?.acceptanceCoverage)
        ? item.acceptanceCoverage.map(safeChatString).filter(Boolean)
        : [],
      acceptanceRegistryComplete: item?.acceptanceRegistryComplete === true,
      needsRealQuestionReview: item?.needsRealQuestionReview === true,
    })).filter((item) => item.version))
  } catch (error) { throw normalizeError(error) }
}

export async function fetchAssistantEvaluationRuns() {
  try {
    const payload = await requestJson('/admin/chat/evaluations/runs')
    const items = Array.isArray(payload?.data) ? payload.data : []
    return withLiveData(items.map(normalizeEvaluationRun).filter((item) => item.id))
  } catch (error) { throw normalizeError(error) }
}

export async function startAssistantEvaluation(body) {
  try {
    const payload = await requestJson('/admin/chat/evaluations/runs', { method: 'POST', body })
    return withLiveData(normalizeEvaluationRun(payload?.data))
  } catch (error) { throw normalizeError(error) }
}

export async function createAssistantEvaluationDraft() {
  try {
    const payload = await requestJson('/admin/chat/evaluations/dataset-draft', { method: 'POST' })
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
    return withLiveData({
      sanitizedQuestionCount: safeChatCount(data.sanitizedQuestionCount),
      draftJson: safeChatString(data.draftJson),
      notice: safeChatString(data.notice),
    })
  } catch (error) { throw normalizeError(error) }
}

export async function fetchChatUnanswered(query) {
  try {
    const payload = await requestJson('/admin/chat/unanswered', {
      query: { from: query?.from, to: query?.to },
    })
    const items = Array.isArray(payload?.data) ? payload.data : []
    return withLiveData({ items: items.map((item) => ({
      conversationId: safeChatString(item?.conversationId),
      assistantMessageId: safeChatString(item?.assistantMessageId),
      customerQuestion: safeChatString(item?.customerQuestion),
      reason: safeChatString(item?.reason),
      createdAt: safeChatString(item?.createdAt),
    })).filter((item) => item.conversationId) })
  } catch (error) {
    throw normalizeError(error)
  }
}

export async function fetchChatDataGaps() {
  try {
    const payload = await requestJson('/admin/chat/data-gaps')
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {}
    return withLiveData({
      affectedProducts: safeChatCount(data.affectedProducts),
      missingSizeGuides: safeChatCount(data.missingSizeGuides),
      missingSpecifications: safeChatCount(data.missingSpecifications),
      rawOptionProducts: safeChatCount(data.rawOptionProducts),
      missingAccessoryLinks: safeChatCount(data.missingAccessoryLinks),
      items: Array.isArray(data.items) ? data.items.map((item) => ({
        productId: safeChatString(item?.productId),
        slug: safeChatString(item?.slug),
        name: safeChatString(item?.name),
        gaps: Array.isArray(item?.gaps) ? item.gaps.filter((gap) => typeof gap === 'string') : [],
        rawOptions: Array.isArray(item?.rawOptions)
          ? item.rawOptions.filter((value) => typeof value === 'string').slice(0, 50)
          : [],
      })).filter((item) => item.productId) : [],
    })
  } catch (error) {
    throw normalizeError(error)
  }
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
  return {
    summary: {
      grossOrderValue,
      paidRevenue,
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

async function fetchCsvBlob(path, params = {}, fallbackName = 'export.csv', accept = 'text/csv') {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`

  const doFetch = (token) => {
    const headers = { Accept: accept }
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
    const payload = await response.json().catch(() => null)
    const error = payload?.error || {}
    throw new ApiClientError(
      normalizeApiErrorMessage(error, response.status),
      response.status,
      error.code || 'EXPORT_FAILED',
      error.details || [],
      parseRetryAfter(response.headers.get('Retry-After')),
    )
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
    q: filters.q,
    status: filters.status,
    from: filters.from,
    to: filters.to,
  }, 'orders.csv')
}

export async function exportCustomersCsv(filters = {}) {
  return fetchCsvBlob('/admin/reports/customers/export', {
    q: filters.q,
    status: filters.status,
    synthetic: filters.synthetic,
    emailVerified: filters.emailVerified,
  }, 'customers.csv')
}

/** CSV catalog export. The single-product JSON round-trip export is a separate flow. */
export async function exportFullProductCatalogCsv(options = {}) {
  const ids = options.ids
  const columns = options.columns
  const columnGroups = options.columnGroups
  return fetchCsvBlob('/admin/products/export.csv', {
    scope: options.scope || 'FILTERED',
    q: options.q,
    categoryId: options.categoryId,
    brandId: options.brandId,
    filter_gender: options.filterGender,
    publishStatus: options.publishStatus,
    stockState: options.stockState,
    includeDraft: options.includeDraft ? 'true' : undefined,
    includeTrash: options.includeTrash ? 'true' : undefined,
    ids: Array.isArray(ids) ? ids.join(',') : ids,
    preset: options.preset || 'PRICING',
    columns: Array.isArray(columns) && columns.length > 0 ? columns.join(',') : columns,
    columnGroups: Array.isArray(columnGroups) && columnGroups.length > 0 ? columnGroups.join(',') : columnGroups,
  }, 'sanpham.csv')
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
  const assignedUserCount = Number(r.assignedUserCount)
  return {
    id: String(r.id || ''),
    name: String(r.name || ''),
    description: String(r.description || ''),
    isSystem: r.isSystem === true,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
    assignedUserCount: Number.isFinite(assignedUserCount)
      ? Math.max(0, Math.trunc(assignedUserCount))
      : 0,
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
    // Tên khách + giá trị đơn nay nằm trong payload (AUD-026) → admin offline bắt kịp
    // vẫn thấy ai đặt, bao nhiêu tiền, không chỉ mã đơn.
    customerName: parsed.customerName || '',
    total: parsed.total != null ? Number(parsed.total) : undefined,
    status: parsed.status,
    paymentMethod: parsed.paymentMethod,
    handoffId: parsed.handoffId ? String(parsed.handoffId) : '',
    conversationId: parsed.conversationId ? String(parsed.conversationId) : '',
    questionSummary: safeChatString(parsed.questionSummary),
    customerKind: safeChatString(parsed.customerKind),
    contactPresent: parsed.contactPresent === true,
    products: Array.isArray(parsed.products)
      ? parsed.products.map((item) => ({
        slug: safeChatString(item?.slug),
        name: safeChatString(item?.name),
      })).filter((item) => item.slug || item.name).slice(0, 8)
      : [],
    waitingCount: Number(parsed.waitingCount ?? 0),
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

export async function markAllAdminNotificationsRead() {
  const payload = await requestJson('/admin/notifications/mark-all-read', { method: 'POST' })
  return payload?.data ?? { updated: 0 }
}
