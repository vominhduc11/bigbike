import { useEffect } from 'react'

/**
 * Phím tắt Ctrl/Cmd+S để lưu (O3) — dùng chung cho form/detail screen có thao tác
 * lưu, thay vì mỗi màn tự viết listener riêng.
 *
 * Global listener trên `window`, nhất quán với các phím tắt khác đã có trong admin
 * (Ctrl+K của GlobalSearch, F11/Ctrl+\ của AdminShell). Không lọc theo phần tử đang
 * focus — bấm Ctrl+S khi con trỏ đang ở trong ô input của form vẫn phải lưu được,
 * đúng kỳ vọng người dùng.
 *
 * @param {boolean} enabled   chỉ gắn listener khi true (vd form đang ở chế độ sửa).
 * @param {(e: KeyboardEvent) => void} onSave   gọi khi bắt được Ctrl/Cmd+S; nhận
 *   nguyên keyboard event (đã preventDefault để chặn hộp thoại "Lưu trang" của
 *   trình duyệt) — có thể truyền thẳng handler onSubmit sẵn có của form.
 */
export function useSaveShortcut(enabled, onSave) {
  useEffect(() => {
    if (!enabled) return undefined
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        onSave?.(e)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, onSave])
}
