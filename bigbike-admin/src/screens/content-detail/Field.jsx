import { cloneElement, isValidElement, useId } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Field shell — pass `full` to span both grid columns.
// Liên kết label↔control và gắn aria-invalid + aria-describedby vào control khi có lỗi.
export function Field({ label, hint, error, count, countWarn, full, children }) {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-describedby': cn(children.props['aria-describedby'], describedBy) || undefined,
      })
    : children

  return (
    <div className={cn('flex flex-col gap-1.5', full && 'md:col-span-2')}>
      {(label || count != null) && (
        <div className="flex items-center justify-between">
          {label && <label htmlFor={fieldId} className="text-sm font-medium text-foreground/80">{label}</label>}
          {count != null && (
            <span className={cn('text-xs tabular-nums text-muted-foreground', countWarn && 'text-[var(--admin-color-status-warning-text)] font-semibold')}>
              {count}
            </span>
          )}
        </div>
      )}
      {control}
      {error
        ? (
          <span id={errorId} className="flex items-center gap-1 text-xs text-[var(--admin-color-status-danger-text)] font-semibold" role="alert">
            <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
            {error}
          </span>
        )
        : hint
          ? <span id={hintId} className="text-xs text-muted-foreground">{hint}</span>
          : null}
    </div>
  )
}
