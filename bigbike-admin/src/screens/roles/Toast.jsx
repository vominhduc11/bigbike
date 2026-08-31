import { Check, AlertCircle, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Tone mapping cho toast của màn Phân quyền. `info` TRƯỚC ĐÂY rơi vào nhánh mặc định
// nên hiển thị NỀN ĐỎ (danger) dù chỉ là thông báo trung tính — nay tách rõ 3 tone.
const TOAST_TONES = {
  success: {
    role: 'status',
    live: 'polite',
    cls: 'bg-success-bg text-success border-success-border',
    Icon: Check,
  },
  info: {
    role: 'status',
    live: 'polite',
    cls: 'bg-info-bg text-info border-info-border',
    Icon: Info,
  },
  error: {
    role: 'alert',
    live: 'assertive',
    cls: 'bg-danger-bg text-danger border-danger-border',
    Icon: AlertCircle,
  },
}

export function Toast({ toast, onClose }) {
  const { t } = useTranslation()
  if (!toast) return null
  const tone = TOAST_TONES[toast.kind] || TOAST_TONES.error
  const { role, live, cls, Icon } = tone
  // Toast thành công tự ẩn nên bỏ nút đóng; info/lỗi cho đóng thủ công.
  const dismissible = toast.kind !== 'success'
  return (
    <div
      role={role}
      aria-live={live}
      className={cn(
        'fixed top-20 right-6 z-[var(--admin-z-toast)] flex items-center gap-2 max-w-sm px-5 py-3 rounded-sm text-sm font-medium shadow-md border',
        cls,
      )}
    >
      <Icon size={16} aria-hidden className="shrink-0" />
      <span className="flex-1">{toast.msg}</span>
      {dismissible && onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={t('roles.toastClose', { defaultValue: 'Đóng thông báo' })}
          className="shrink-0 h-7 w-7 -mr-2"
        >
          <X size={14} aria-hidden />
        </Button>
      )}
    </div>
  )
}
