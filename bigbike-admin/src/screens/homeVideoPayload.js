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
