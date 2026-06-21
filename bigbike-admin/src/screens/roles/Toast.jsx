import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toast({ toast }) {
  if (!toast) return null
  const isSuccess = toast.kind === 'success'
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-20 right-6 z-[9000] flex items-center gap-2 max-w-sm px-5 py-3 rounded-sm text-sm font-medium shadow-md border',
        isSuccess
          ? 'bg-success-bg text-success border-success-border'
          : 'bg-danger-bg text-danger border-danger-border'
      )}
    >
      {isSuccess ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
      {toast.msg}
    </div>
  )
}
