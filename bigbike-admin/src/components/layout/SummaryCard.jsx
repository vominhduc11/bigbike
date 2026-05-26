export function SummaryCardGrid({ children }) {
  return <div className="bb-kpi-grid">{children}</div>
}

export function SummaryCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone = 'neutral',
  onClick,
  active = false,
  ariaLabel,
}) {
  const cls = [
    'bb-kpi',
    onClick ? 'clickable' : '',
    active ? 'active' : '',
  ].filter(Boolean).join(' ')

  const inner = (
    <>
      <div className="bb-kpi-head">
        <span>{label}</span>
        {icon ? (
          <span className={`bb-kpi-icon ${tone}`} aria-hidden="true">{icon}</span>
        ) : null}
      </div>
      <div className="bb-kpi-value">{value}</div>
      {trend ? <div className="bb-kpi-trend">{trend}</div> : null}
      {hint ? <div className="bb-cell-sub">{hint}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active} aria-label={ariaLabel}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}
