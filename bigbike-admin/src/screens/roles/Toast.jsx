import { Check, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toast({ toast, onClose }) {
  if (!toast) return null
  const isSuccess = toast.kind === 'success'
  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={cn(
        'fixed top-20 right-6 z-[var(--admin-z-toast)] flex items-center gap-2 max-w-sm px-5 py-3 rounded-sm text-sm font-medium shadow-md border',
        isSuccess
          ? 'bg-success-bg text-success border-success-border'
          : 'bg-danger-bg text-danger border-danger-border'
      )}
    >
      {isSuccess
        ? <Check size={16} aria-hidden className="shrink-0" />
        : <AlertCircle size={16} aria-hidden className="shrink-0" />}
      <span className="flex-1">{toast.msg}</span>
      {/* Toast lỗi không tự ẩn — luôn có nút đóng để người dùng tự tắt. */}
      {!isSuccess && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="shrink-0 -mr-1.5 p-1 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bb-primary)]"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
