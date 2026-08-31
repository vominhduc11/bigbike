import { useSyncExternalStore } from 'react'

// Ngôn ngữ NỘI DUNG (dữ liệu lấy từ server + bản song ngữ đang soạn ở màn
// hình chi tiết). Tách riêng khỏi ngôn ngữ GIAO DIỆN — giao diện admin luôn
// cố định tiếng Việt (xem i18n.js), nút VI/EN ở header chỉ đổi ngôn ngữ nội dung.

const STORAGE_KEY = 'bigbike-admin-content-lang'
const SUPPORTED = ['vi', 'en']

function readInitial() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return SUPPORTED.includes(stored) ? stored : 'vi'
}

let current = readInitial()
const listeners = new Set()

export function getContentLang() {
  return current
}

export function setContentLang(lang) {
  if (!SUPPORTED.includes(lang) || lang === current) return
  current = lang
  localStorage.setItem(STORAGE_KEY, lang)
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useContentLang() {
  return useSyncExternalStore(subscribe, getContentLang, getContentLang)
}

// Phủ tên tiếng Anh lên danh sách ĐẦY ĐỦ (tiếng Việt) cho các ô chọn/lọc nội dung
// phải liệt kê MỌI thực thể bất kể đã dịch hay chưa: mục đã dịch hiện tên Anh,
// mục chưa dịch giữ tên Việt thay vì biến mất (backend ẩn mục chưa dịch ở EN).
// fullItems: cây/danh sách lấy theo 'vi'; enItems: danh sách 'en' (chỉ mục đã dịch).
export function overlayEnNames(fullItems, enItems) {
  const enNameById = new Map((enItems ?? []).map((c) => [c.id, c.name]))
  return (fullItems ?? []).map((c) =>
    enNameById.has(c.id) ? { ...c, name: enNameById.get(c.id) } : c,
  )
}
