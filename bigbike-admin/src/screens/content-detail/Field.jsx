import { cn } from '@/lib/utils'

// Field shell — pass `full` to span both grid columns.
export function Field({ label, hint, error, count, countWarn, full, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {(label || count != null) && (
        <div className="flex items-center justify-between">
          {label && <label className="text-sm font-medium text-foreground/80">{label}</label>}
          {count != null && (
            <span className={cn('text-xs tabular-nums text-muted-foreground', countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold')}>
              {count}
            </span>
          )}
        </div>
      )}
      {children}
      {error
        ? <span className="text-xs text-[var(--admin-color-status-danger-text)] font-semibold">{error}</span>
        : hint
          ? <span className="text-xs text-muted-foreground">{hint}</span>
          : null}
    </div>
  )
}
