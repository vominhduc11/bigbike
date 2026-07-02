import { useState } from 'react'

const MAX_ITEMS = 8

function readList(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    const saved = raw ? JSON.parse(raw) : []
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

// O9 — ghi 1 "item vừa xem" (gọi trong useEffect khi màn hình chi tiết mount).
// item: { id, label, href }
export function recordRecentItem(storageKey, item) {
  if (!item?.id) return
  try {
    const next = [item, ...readList(storageKey).filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS)
    localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // localStorage không khả dụng (private mode...) — bỏ qua, chỉ mất persist.
  }
}

// Đọc danh sách "vừa xem" cho màn hình danh sách. Không cần phản ứng real-time
// (chỉ đọc khi mount) vì mount lại đúng lúc quay từ trang chi tiết về danh sách.
export function useRecentItems(storageKey) {
  const [items] = useState(() => readList(storageKey))
  return items
}
