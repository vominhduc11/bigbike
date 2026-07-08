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

export function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Refetch sau khi upload (refreshKey/reloadKey bump) có thể chạy đua với lúc admin
// bấm confirm — giữ nguyên cờ isNewUpload của item vừa upload trong session này thay
// vì để bản mới fetch từ server (chưa kịp có isNewUpload) ghi đè mất.
export function mergeMediaCacheItem(cacheRef, item) {
  if (!item.publicUrl) return
  const existing = cacheRef.current.get(item.publicUrl)
  cacheRef.current.set(item.publicUrl, existing?.isNewUpload ? { ...item, isNewUpload: true } : item)
}
