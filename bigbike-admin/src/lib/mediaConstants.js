export const IMAGE_MEDIA_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

export const VIDEO_MEDIA_MIME_TYPES = Object.freeze(['video/mp4'])

export const MEDIA_UPLOAD_MIME_TYPES = Object.freeze([
  ...IMAGE_MEDIA_MIME_TYPES,
  ...VIDEO_MEDIA_MIME_TYPES,
])

// Canonical Admin Media Library limit. Keep aligned with
// AdminMediaService.MAX_UPLOAD_BYTES and Spring's 200 MB multipart limit.
export const MAX_MEDIA_UPLOAD_BYTES = 200 * 1024 * 1024
