// Helper dùng chung giữa MediaPickerModal và VideoPickerModal.

export function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Refetch sau khi upload (refreshKey/reloadKey bump) có thể chạy đua với lúc admin
// bấm confirm — giữ nguyên cờ isNewUpload của item vừa upload trong session này thay
// vì để bản mới fetch từ server (chưa kịp có isNewUpload) ghi đè mất.
export function mergeMediaCacheItem(cacheRef, item) {
  if (!item.publicUrl) return
  const existing = cacheRef.current.get(item.publicUrl)
  cacheRef.current.set(item.publicUrl, existing?.isNewUpload ? { ...item, isNewUpload: true } : item)
}
