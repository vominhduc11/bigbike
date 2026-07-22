import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONE_CLASSES = {
  neutral: 'bg-surface-muted text-foreground',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger:  'bg-danger-bg text-danger',
  info:    'bg-info-bg text-info',
}

const TONE_ICONS = {
  neutral: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger:  XCircle,
  info:    Info,
}

export function StatePanel({
  tone = 'neutral',
  title,
  description,
  actionLabel,
  onAction,
  className,
}) {
  const ToneIcon = TONE_ICONS[tone] ?? TONE_ICONS.neutral
  return (
    <section
      className={cn('flex flex-col items-center justify-center gap-3 rounded-md px-6 py-10 text-center', TONE_CLASSES[tone] ?? TONE_CLASSES.neutral, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <ToneIcon className="h-6 w-6" aria-hidden="true" />
      {title ? <h2 className="text-base font-semibold font-body">{title}</h2> : null}
      {description ? <p className="text-sm opacity-80">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction} className="mt-1 min-h-11">
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}
