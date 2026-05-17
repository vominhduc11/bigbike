import { Button } from '@/components/ui/button'

const TONE_CLASSES = {
  neutral: 'bg-surface-muted text-foreground',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger:  'bg-danger-bg text-danger',
  info:    'bg-info-bg text-info',
}

export function StatePanel({
  tone = 'neutral',
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <section
      className={`flex flex-col items-center justify-center gap-3 rounded-sm px-6 py-10 text-center ${TONE_CLASSES[tone] ?? TONE_CLASSES.neutral}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <h2 className="text-base font-semibold font-body">{title}</h2>
      {description ? <p className="text-sm opacity-80">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </section>
  )
}
