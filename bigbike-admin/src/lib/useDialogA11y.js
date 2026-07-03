import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
  'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Trợ năng cho hộp thoại/overlay TỰ DỰNG (không qua Radix Dialog) — A3.
 *
 * Áp cho container ref khi `active`:
 *  - đưa focus vào phần tử focus được đầu tiên (hoặc chính container — cần tabIndex={-1}),
 *  - bẫy Tab/Shift+Tab trong container,
 *  - Escape gọi `onClose`,
 *  - trả focus về phần tử trigger khi đóng/unmount.
 *
 * Lưu ý: container nên có `tabIndex={-1}` để nhận focus khi chưa có phần tử con.
 *
 * @param {{current: HTMLElement|null}} ref   container của dialog
 * @param {{active?: boolean, onClose?: () => void}} opts
 */
export function useDialogA11y(ref, { active = true, onClose } = {}) {
  // Callback đọc qua ref, KHÔNG đưa vào dependency array bên dưới: caller thường
  // truyền onClose dạng inline arrow (tham chiếu mới mỗi render cha). Nếu để trong
  // deps, effect setup/cleanup chạy lại mỗi lần cha render (vd mỗi keystroke của
  // form đang mở kèm dialog) — cleanup trả focus về "trước đó", setup lại cướp
  // focus vào dialog, làm mất focus của input NGOÀI dialog đang gõ dở.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return undefined
    const node = ref.current
    if (!node) return undefined
    const previouslyFocused = document.activeElement

    const focusables = () =>
      Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    const first = focusables()[0]
    ;(first || node).focus?.({ preventScroll: true })

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [ref, active])
}
