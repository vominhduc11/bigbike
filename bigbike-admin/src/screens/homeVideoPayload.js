export function buildHomeVideoThumbnail(form) {
  const url = form.thumbnailUrl?.trim()
  if (!url) return null
  return {
    url,
    alt: form.thumbnailAlt?.trim() || null,
    width: Number.isFinite(form.thumbnailWidth) ? form.thumbnailWidth : null,
    height: Number.isFinite(form.thumbnailHeight) ? form.thumbnailHeight : null,
    mimeType: form.thumbnailMimeType?.trim() || null,
  }
}

export function isValidYouTubeChannelUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return true

  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:'
      || !['youtube.com', 'www.youtube.com'].includes(host)
      || url.username || url.password
      || (url.port && url.port !== '443')
      || url.hash) return false

    if (url.search && url.search !== '?sub_confirmation=1') {
      return false
    }

    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '')
    if (/^\/@[^/\s]{1,100}$/u.test(path)) return true
    return /^\/channel\/UC[A-Za-z0-9_-]{22}$/.test(path)
  } catch {
    return false
  }
}
