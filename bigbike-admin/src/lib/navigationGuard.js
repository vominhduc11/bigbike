// Cổng chặn điều hướng nội bộ (in-app) khi có thay đổi chưa lưu (F6).
//
// Router của admin tự xây trên history API; mọi điều hướng đi qua `navigate()`
// trong App.jsx. Hook `useUnsavedChanges` đăng ký một getter trạng thái dirty;
// App.jsx gọi `confirmNavigation()` ở đầu `navigate()` để hỏi xác nhận trước khi
// rời trang. (beforeunload trong hook lo reload / đóng tab / điều hướng ra ngoài.)
//
// Dùng getter (đọc trạng thái dirty mới nhất) thay vì cờ tĩnh để khi lưu xong rồi
// điều hướng (create -> trang chi tiết) không bị hỏi nhầm — và `clearNavGuard()`
// có thể gọi tay ngay trước khi navigate sau khi lưu thành công.
let dirtyGetter = null
let guardMessage = null

const DEFAULT_MESSAGE = 'Bạn có thay đổi chưa lưu. Rời khỏi trang và bỏ các thay đổi?'

export function setNavGuard(getter, message) {
  dirtyGetter = typeof getter === 'function' ? getter : null
  guardMessage = message || DEFAULT_MESSAGE
}

export function clearNavGuard() {
  dirtyGetter = null
  guardMessage = null
}

export function confirmNavigation() {
  if (!dirtyGetter || !dirtyGetter()) return true
  return window.confirm(guardMessage)
}
