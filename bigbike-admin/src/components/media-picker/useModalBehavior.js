import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus trap + Escape-to-close + Tab-cycle + khôi phục focus khi đóng, dùng chung
 * cho MediaPickerModal/VideoPickerModal.
 */
export function useModalFocusTrap({ modalRef, onClose }) {
  const previousFocusRef = useRef(null)
  // Giữ onClose trong ref: caller thường truyền arrow inline (tham chiếu mới mỗi
  // render, vd `attemptClose` có guard). Nếu để onClose trong deps, effect
  // setup/cleanup chạy lại mỗi render → trap khởi tạo lại và cướp focus khỏi ô
  // tìm kiếm đang gõ. modalRef là ref nên effect chỉ chạy 1 lần.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const modal = modalRef.current
    const initialFocusTarget = modal?.querySelector(FOCUSABLE_SELECTOR)
    if (initialFocusTarget) initialFocusTarget.focus()

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const currentModal = modalRef.current
      if (!currentModal) return
      const focusables = Array.from(currentModal.querySelectorAll(FOCUSABLE_SELECTOR))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [modalRef])
}

/** Khoá scroll nền trong lúc modal mở, trả lại giá trị cũ khi đóng. */
export function useBodyScrollLock() {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
}
