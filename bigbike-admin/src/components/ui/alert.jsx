import { cva } from 'class-variance-authority'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'flex items-start gap-2.5 border font-medium rounded-[var(--admin-radius-sm)]',
  {
    variants: {
      tone: {
        danger: 'bg-danger-bg border-danger-border text-danger',
        warning: 'bg-warning-bg border-warning-border text-warning',
        success: 'bg-success-bg border-success-border text-success',
        info: 'bg-info-bg border-info-border text-info',
      },
      size: {
        sm: 'px-3 py-2 text-xs',
        md: 'px-4 py-3 text-sm',
      },
    },
    defaultVariants: { tone: 'danger', size: 'md' },
  },
)

const TONE_ICON = {
  danger: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
}

/**
 * Alert — inline notice box.
 *
 * tone: danger | warning | success | info
 * size: sm | md
 * icon: true (tone icon) | false | a lucide component to override
 * dismissible + onDismiss: render a close button
 */
export function Alert({
  tone = 'danger',
  size = 'md',
  icon = true,
  dismissible = false,
  onDismiss,
  className,
  children,
  ...props
}) {
  const { t } = useTranslation()
  const ToneIcon = icon === true ? TONE_ICON[tone] : icon
  const iconSize = size === 'sm' ? 14 : 16
  // Chỉ danger/warning cần thông báo khẩn (role=alert, assertive); info/success dùng role=status (polite).
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status'

  return (
    <div role={role} className={cn(alertVariants({ tone, size }), className)} {...props}>
      {ToneIcon ? <ToneIcon size={iconSize} className="shrink-0 mt-px" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {dismissible ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('common.close')}
          className="-m-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--admin-radius-control)] opacity-70 transition-opacity hover:opacity-100"
        >
          <X size={iconSize} />
        </button>
      ) : null}
    </div>
  )
}

export { alertVariants }
