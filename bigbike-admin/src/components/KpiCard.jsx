import { cn } from '../lib/utils'

export function KpiCard({
  label,
  value,
  icon,
  tone = 'info',
  detail,
  footer,
  headerExtra,
  money = false,
  compact = false,
  clickable = false,
  active = false,
  ariaLabel,
  onClick,
  className,
}) {
  const interactive = clickable && typeof onClick === 'function'

  function handleKeyDown(event) {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick()
  }

  return (
    <article
      className={cn('bb-kpi', interactive && 'clickable', active && 'active', className)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <div className="bb-kpi-head">
        <span className="inline-flex min-w-0 items-center gap-1">
          {label}
          {headerExtra}
        </span>
        {icon ? <span className={`bb-kpi-icon ${tone}`}>{icon}</span> : null}
      </div>
      <div
        className={cn(
          compact
            ? 'flex min-h-7 items-center text-sm font-semibold text-foreground'
            : 'bb-kpi-value',
          money && !compact && 'bb-kpi-value--money',
        )}
      >
        {value}
      </div>
      {footer || detail ? (
        <div className="bb-kpi-foot">
          {footer}
          {detail ? <span className="bb-kpi-foot-label">{detail}</span> : null}
        </div>
      ) : null}
    </article>
  )
}
