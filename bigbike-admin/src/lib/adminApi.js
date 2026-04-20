import {
  normalizeBrand,
  normalizeCategory,
  normalizeContentItem,
  normalizePagination,
  normalizeProduct,
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
  queryMockProducts,
} from './mockData'

const API_BASE = (import.meta.env.VITE_ADMIN_API_BASE || '/api/v1').replace(/\/$/, '')
const FORCE_MOCK = import.meta.env.VITE_USE_ADMIN_MOCK === 'true'
const IS_DEV = Boolean(import.meta.env.DEV)
const DEFAULT_MOCK_ROLE = import.meta.env.VITE_ADMIN_ROLE || 'ADMIN'

class ApiClientError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
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

async function requestJson(endpoint, query) {
  const url = `${API_BASE}${endpoint}${toQueryString(query)}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const error = payload && payload.error ? payload.error : {}
    throw new ApiClientError(
      error.message || `Request failed with status ${response.status}`,
      response.status,
      error.code || 'REQUEST_FAILED',
    )
  }

  return payload
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
    const payload = await requestJson('/admin/products', buildProductQuery(query))
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

export async function fetchCategories(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Category list is served from typed mock layer (mock mode enabled).',
      queryMockCategories(query),
    )
  }

  try {
    const payload = await requestJson('/admin/categories', buildCategoryQuery(query))
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

export async function fetchBrands(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Brand list is served from typed mock layer (mock mode enabled).',
      queryMockBrands(query),
    )
  }

  try {
    const payload = await requestJson('/admin/brands', buildBrandQuery(query))
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

export async function fetchContent(query) {
  if (FORCE_MOCK) {
    return withMockFallback(
      'Content list is served from typed mock layer (mock mode enabled).',
      queryMockContent(query),
    )
  }

  try {
    const payload = await requestJson('/admin/content', buildContentQuery(query))
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

  try {
    const endpoint = `/admin/content/${contentType.toLowerCase()}/${contentId}`
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
