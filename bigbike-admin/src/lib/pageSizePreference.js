const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100]
const SCREEN_PAGE_SIZE_OPTIONS = {
  media: [12, 24, 48, 96],
}

function currentPathname() {
  return typeof window === 'undefined' ? '' : window.location.pathname
}

function currentSearch() {
  return typeof window === 'undefined' ? '' : window.location.search
}

function currentStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function pageSizeScreen(pathname = currentPathname()) {
  const normalized = String(pathname || '').replace(/^\/+|\/+$/g, '')
  const segments = normalized.split('/').filter(Boolean)
  const adminIndex = segments.indexOf('admin')
  return segments[adminIndex + 1] || segments.at(-1) || 'default'
}

export function pageSizeStorageKey(pathname = currentPathname()) {
  return `page-size:${pageSizeScreen(pathname)}`
}

export function pageSizeOptions(pathname = currentPathname(), options) {
  if (Array.isArray(options) && options.length > 0) return options
  return SCREEN_PAGE_SIZE_OPTIONS[pageSizeScreen(pathname)] || DEFAULT_PAGE_SIZE_OPTIONS
}

export function isValidPageSize(value, { pathname = currentPathname(), options } = {}) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && pageSizeOptions(pathname, options).includes(numeric)
}

export function readPageSizePreference(
  fallback,
  {
    pathname = currentPathname(),
    search = currentSearch(),
    options,
    storage = currentStorage(),
  } = {},
) {
  const fromUrl = new URLSearchParams(search).get('pageSize')
  if (isValidPageSize(fromUrl, { pathname, options })) return Number(fromUrl)

  try {
    const stored = storage?.getItem(pageSizeStorageKey(pathname))
    if (isValidPageSize(stored, { pathname, options })) return Number(stored)
  } catch {
    // localStorage có thể bị trình duyệt/chính sách riêng tư chặn; dùng mặc định.
  }

  return fallback
}

export function persistPageSizePreference(
  value,
  {
    pathname = currentPathname(),
    options,
    storage = currentStorage(),
  } = {},
) {
  if (!isValidPageSize(value, { pathname, options })) return
  try {
    storage?.setItem(pageSizeStorageKey(pathname), String(Number(value)))
  } catch {
    // Ghi nhớ là tiện ích tăng trải nghiệm, không được làm gián đoạn thao tác chính.
  }
}
