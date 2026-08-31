// Helper dùng chung giữa MediaPickerModal và VideoPickerModal.

export const REFERENCE_TYPE_KEYS = {
  PRODUCT: 'media.referenceType.PRODUCT',
  PRODUCT_GALLERY: 'media.referenceType.PRODUCT_GALLERY',
  PRODUCT_VARIANT: 'media.referenceType.PRODUCT_VARIANT',
  PRODUCT_VARIANT_GALLERY: 'media.referenceType.PRODUCT_VARIANT_GALLERY',
  CATEGORY: 'media.referenceType.CATEGORY',
  BRAND: 'media.referenceType.BRAND',
  HOME_VIDEO: 'media.referenceType.HOME_VIDEO',
  CONTENT: 'media.referenceType.CONTENT',
  CONTENT_PRODUCT_IMG: 'media.referenceType.CONTENT_PRODUCT_IMG',
  CONTENT_SEO_OG: 'media.referenceType.CONTENT_SEO_OG',
  SLIDER_DESKTOP: 'media.referenceType.SLIDER_DESKTOP',
  SLIDER_MOBILE: 'media.referenceType.SLIDER_MOBILE',
}

const REFERENCE_PATH_BUILDERS = {
  PRODUCT: (id) => `/admin/products/${id}`,
  PRODUCT_GALLERY: (id) => `/admin/products/${id}`,
  CATEGORY: (id) => `/admin/categories/${id}`,
  BRAND: (id) => `/admin/brands/${id}`,
  HOME_VIDEO: () => '/admin/home-videos',
  CONTENT: (id) => `/admin/content/ARTICLE/${id}`,
  CONTENT_PRODUCT_IMG: (id) => `/admin/content/ARTICLE/${id}`,
  CONTENT_SEO_OG: (id) => `/admin/content/ARTICLE/${id}`,
  SLIDER_DESKTOP: () => '/admin/sliders',
  SLIDER_MOBILE: () => '/admin/sliders',
}

const SAFE_REFERENCE_PATHS = [
  /^\/admin\/products\/[^/?#]+$/,
  /^\/admin\/categories\/[^/?#]+$/,
  /^\/admin\/brands\/[^/?#]+$/,
  /^\/admin\/content\/ARTICLE\/[^/?#]+$/,
  /^\/admin\/home-videos$/,
  /^\/admin\/sliders$/,
]

function normalizeLegacyAdminPath(path, type) {
  if (!path.startsWith('/') || path.startsWith('//')) return ''
  if (path.startsWith('/admin/')) return path
  if (path.startsWith('/products/')) return `/admin${path}`
  if (path.startsWith('/categories/')) return `/admin${path}`
  if (path.startsWith('/brands/')) return `/admin${path}`
  if (path === '/home-videos' || path === '/sliders') return `/admin${path}`
  if (
    (type === 'CONTENT' || type === 'CONTENT_PRODUCT_IMG' || type === 'CONTENT_SEO_OG') &&
    /^\/content\/[^/?#]+$/.test(path)
  ) {
    return path.replace('/content/', '/admin/content/ARTICLE/')
  }
  return ''
}

/**
 * Chỉ trả route nội bộ đã biết của admin. Với tham chiếu có đủ id, route được
 * dựng lại từ type thay vì tin vào adminPath do API cũ có thể trả route public.
 * Tham chiếu biến thể cần product id nên dùng adminPath, nhưng vẫn phải qua
 * allowlist trước khi render thành link.
 */
export function getMediaReferenceAdminPath(reference) {
  if (!reference || typeof reference !== 'object') return ''

  const type = typeof reference.type === 'string' ? reference.type.trim().toUpperCase() : ''
  const id = typeof reference.id === 'string' ? reference.id.trim() : ''
  const builder = REFERENCE_PATH_BUILDERS[type]
  if (builder) {
    const routeDoesNotNeedId = type === 'HOME_VIDEO' || type.startsWith('SLIDER_')
    if (!id && !routeDoesNotNeedId) return ''
    const encodedId = id ? encodeURIComponent(id) : ''
    const derivedPath = builder(encodedId)
    return SAFE_REFERENCE_PATHS.some((pattern) => pattern.test(derivedPath)) ? derivedPath : ''
  }

  const rawPath = typeof reference.adminPath === 'string' ? reference.adminPath.trim() : ''
  const normalizedPath = normalizeLegacyAdminPath(rawPath, type)
  return SAFE_REFERENCE_PATHS.some((pattern) => pattern.test(normalizedPath)) ? normalizedPath : ''
}

export function formatBytes(bytes) {
  // '—' là ký hiệu "không có giá trị" trung tính (giống nhau ở VI/EN) nên giữ nguyên.
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Dựng URL tuyệt đối để copy vào clipboard. CHỈ nối origin khi là đường dẫn tương
 * đối (vd "/media/..."); URL tuyệt đối (http/https) hoặc data:/blob: giữ nguyên —
 * tránh biến "https://cdn/..." thành "https://admin.../https://cdn/...".
 */
export function toClipboardUrl(path) {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  return window.location.origin + path
}

export function mergeMediaCacheItem(cacheRef, item) {
  if (!item.publicUrl) return
  cacheRef.current.set(item.publicUrl, item)
}
