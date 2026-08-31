import { toast as sonnerToast } from 'sonner'

// Facade thông báo dùng chung.
//
// N1: thông báo LỖI không được tự biến mất — chủ shop/nhân viên cần đủ thời gian
// đọc lỗi mạng/500/ràng buộc. Toaster (main.jsx) đã bật `closeButton` nên lỗi vẫn
// đóng được bằng tay. Mọi method khác của sonner (success/warning/info/promise/
// loading/dismiss/custom/message…) giữ nguyên hành vi.
const toast = (...args) => sonnerToast(...args)
Object.assign(toast, sonnerToast)

toast.error = (message, options) => sonnerToast.error(message, { duration: Infinity, ...options })

export { toast }
