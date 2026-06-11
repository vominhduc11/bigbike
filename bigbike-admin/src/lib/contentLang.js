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
