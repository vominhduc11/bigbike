const APP_BASE_URL = import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn'
const UNSAFE_SCHEME = /^(javascript|data|vbscript|file):/i
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

// Chỉ dùng để đọc/xem trước dữ liệu legacy. Không dùng các helper TikTok/Facebook
// này trong validation hoặc payload ghi mới (MEDIA_RULE_004).
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'])

// id video TikTok là chuỗi số (hiện ~19 chữ số) ở path /@user/video/{id}, /video/{id},
// /v/{id}.html, /embed/v2/{id}, /embed/{id}.
const TIKTOK_PATH_ID = /\/(?:video|v|embed\/v2|embed)\/(\d{6,30})/

// Host Facebook được duyệt. Link rút gọn fb.watch KHÔNG nằm đây (không xác định được video).
// Facebook nhúng CẢ đường link gốc (không tách id) qua plugins/video.php.
const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
])

function trimToNull(value) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseUrl(value) {
  try {
    return new URL(value, APP_BASE_URL)
  } catch {
    return null
  }
}

function hasUnsafePrefix(value) {
  return (
    UNSAFE_SCHEME.test(value) ||
    value.startsWith('//') ||
    value.startsWith('\\\\') ||
    value.includes('\\')
  )
}

function extractPathId(parts) {
  const candidate = parts.find((part) => /^[A-Za-z0-9_-]{11}$/.test(part))
  return candidate || null
}

export function validateSafePublicLink(value) {
  const normalized = trimToNull(value)
  if (!normalized) {
    return { valid: false, normalized: '', reason: 'required' }
  }
  if (hasUnsafePrefix(normalized)) {
    return { valid: false, normalized, reason: 'unsafe' }
  }
  if (normalized.startsWith('/')) {
    return { valid: true, normalized }
  }

  const parsed = parseUrl(normalized)
  if (!parsed || parsed.origin === 'null' || parsed.username || parsed.password) {
    return { valid: false, normalized, reason: 'malformed' }
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, normalized, reason: 'protocol' }
  }
  return { valid: true, normalized }
}

/** Ảnh ghi mới chỉ được phép từ kho media của BigBike hoặc đường legacy đã được server duyệt. */
export function validateSafeMediaImageUrl(value) {
  const normalized = trimToNull(value)
  if (!normalized) return { valid: true, normalized: '' }
  if (hasUnsafePrefix(normalized)) return { valid: false, normalized, reason: 'unsafe' }
  if (
    normalized.startsWith('/media/') ||
    normalized.startsWith('/media-proxy/') ||
    normalized.startsWith('/wp-content/uploads/') ||
    normalized.startsWith('/wp-content/themes/bigbike/')
  )
    return { valid: true, normalized }

  const parsed = parseUrl(normalized)
  if (
    !parsed ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    return { valid: false, normalized, reason: 'malformed' }
  }
  const allowedPath =
    parsed.pathname.includes('/bigbike-media/') ||
    parsed.pathname.startsWith('/media/') ||
    parsed.pathname.startsWith('/media-proxy/') ||
    parsed.pathname.startsWith('/wp-content/uploads/')
  return allowedPath
    ? { valid: true, normalized }
    : { valid: false, normalized, reason: 'unsupported' }
}

export function validateRedirectSource(value) {
  const normalized = trimToNull(value)
  if (!normalized) return { valid: false, normalized: '', reason: 'required' }
  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('?') ||
    normalized.includes('#')
  ) {
    return { valid: false, normalized, reason: 'invalid' }
  }
  return { valid: true, normalized }
}

/** Hợp đồng Redirect: đường dẫn nội bộ hoặc URL http(s) cùng tên miền BigBike. */
export function validateRedirectTarget(value) {
  const normalized = trimToNull(value)
  if (!normalized) return { valid: false, normalized: '', reason: 'required' }
  if (hasUnsafePrefix(normalized)) return { valid: false, normalized, reason: 'unsafe' }
  if (normalized.startsWith('/')) return { valid: true, normalized }

  const parsed = parseUrl(normalized)
  const storefront = parseUrl(APP_BASE_URL)
  if (
    !parsed ||
    !storefront ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    return { valid: false, normalized, reason: 'malformed' }
  }
  return parsed.origin === storefront.origin
    ? { valid: true, normalized }
    : { valid: false, normalized, reason: 'external' }
}

export function extractAllowedYouTubeId(value) {
  const normalized = trimToNull(value)
  if (!normalized || hasUnsafePrefix(normalized)) {
    return null
  }

  const parsed = parseUrl(normalized)
  if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null
  }

  if (parsed.hostname.toLowerCase() === 'youtu.be') {
    return extractPathId(parsed.pathname.split('/').filter(Boolean))
  }

  if (parsed.pathname === '/watch') {
    const candidate = parsed.searchParams.get('v')
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'v') {
    return extractPathId(segments.slice(1))
  }

  return null
}

export function extractAllowedTikTokId(value) {
  const normalized = trimToNull(value)
  if (!normalized || hasUnsafePrefix(normalized)) {
    return null
  }

  const parsed = parseUrl(normalized)
  if (!parsed || !TIKTOK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null
  }

  const match = parsed.pathname.match(TIKTOK_PATH_ID)
  return match ? match[1] : null
}

/** URL nhúng iframe chính thức của TikTok cho một id video. */
export function tiktokEmbedUrl(id) {
  return id ? `https://www.tiktok.com/embed/v2/${id}` : null
}

export function isAllowedFacebookVideoUrl(value) {
  const normalized = trimToNull(value)
  if (!normalized || hasUnsafePrefix(normalized)) {
    return false
  }

  const parsed = parseUrl(normalized)
  if (!parsed || !FACEBOOK_HOSTS.has(parsed.hostname.toLowerCase())) {
    return false
  }

  const path = parsed.pathname.toLowerCase()
  return (
    path.includes('/videos/') ||
    path.startsWith('/reel/') ||
    path === '/watch' ||
    path === '/watch/' ||
    path.includes('video.php')
  )
}

/** Khung nhúng iframe chính thức của Facebook cho một link video (giữ nguyên href gốc). */
export function facebookEmbedUrl(url) {
  if (!isAllowedFacebookVideoUrl(url)) return null
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.trim())}&show_text=false`
}

export function isAllowedMediaVideoUrl(value) {
  const normalized = trimToNull(value)
  if (!normalized || hasUnsafePrefix(normalized)) {
    return false
  }
  if (normalized.startsWith('/media/') || normalized.startsWith('/media-proxy/')) {
    return true
  }

  const parsed = parseUrl(normalized)
  if (
    !parsed ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    return false
  }

  return (
    parsed.pathname.includes('/bigbike-media/') ||
    parsed.pathname.startsWith('/media/') ||
    parsed.pathname.startsWith('/media-proxy/')
  )
}

export function validateHomeVideoUrl(value) {
  const normalized = trimToNull(value)
  if (!normalized) {
    return { valid: false, normalized: '', reason: 'required' }
  }
  if (extractAllowedYouTubeId(normalized)) {
    return { valid: true, normalized, source: 'youtube' }
  }
  if (isAllowedMediaVideoUrl(normalized)) {
    return { valid: true, normalized, source: 'upload' }
  }
  return {
    valid: false,
    normalized,
    reason: hasUnsafePrefix(normalized) ? 'unsafe' : 'unsupported',
  }
}
