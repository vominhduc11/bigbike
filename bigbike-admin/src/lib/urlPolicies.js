const APP_BASE_URL = 'https://bigbike.vn'
const UNSAFE_SCHEME = /^(javascript|data|vbscript|file):/i
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
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
    UNSAFE_SCHEME.test(value)
    || value.startsWith('//')
    || value.startsWith('\\\\')
    || value.includes('\\')
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

export function isAllowedMediaVideoUrl(value) {
  const normalized = trimToNull(value)
  if (!normalized || hasUnsafePrefix(normalized)) {
    return false
  }
  if (normalized.startsWith('/media/') || normalized.startsWith('/media-proxy/')) {
    return true
  }

  const parsed = parseUrl(normalized)
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    return false
  }

  return (
    parsed.pathname.includes('/bigbike-media/')
    || parsed.pathname.startsWith('/media/')
    || parsed.pathname.startsWith('/media-proxy/')
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
  return { valid: false, normalized, reason: hasUnsafePrefix(normalized) ? 'unsafe' : 'unsupported' }
}
