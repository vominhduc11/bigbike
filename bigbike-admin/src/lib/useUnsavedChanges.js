import { useEffect } from 'react'
import { setNavGuard, clearNavGuard } from './navigationGuard'

/**
 * Cảnh báo khi rời trang lúc đang có thay đổi chưa lưu (F6).
 *
 * @param {boolean} when      true khi form đang "dirty" (có thay đổi chưa lưu).
 * @param {string}  [message] Nội dung hỏi xác nhận (tuỳ chọn).
 *
 * Khi `when` bật:
 *  - điều hướng nội bộ qua App.jsx `navigate` sẽ hỏi xác nhận,
 *  - `beforeunload` cảnh báo khi reload / đóng tab / điều hướng ra ngoài.
 *
 * `when` chỉ đổi false↔true vài lần (lần sửa đầu, lúc lưu) nên effect không churn.
 *
 * Lưu ý luồng "lưu xong rồi navigate" (vd tạo mới -> trang chi tiết): gọi
 * `clearNavGuard()` (export từ ./navigationGuard) ngay trước khi navigate trong
 * onSuccess để chắc chắn không bị hỏi nhầm.
 */
export function useUnsavedChanges(when, message) {
  useEffect(() => {
    if (!when) {
      clearNavGuard()
      return undefined
    }
    setNavGuard(() => true, message)
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      clearNavGuard()
    }
  }, [when, message])
}
