/**
 * SummaryCardGrid — auto-fit grid wrapping SummaryCard children.
 */
export function SummaryCardGrid({ children }) {
  return <div className="summary-card-grid">{children}</div>
}

/**
 * SummaryCard — KPI / metric card.
 *
 * If `onClick` is provided, the card renders as a <button> and acts as a
 * filter shortcut. If `active` is true, the card is highlighted.
 *
 * tone: brand | success | warning | danger | info | neutral
 */
export function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  onClick,
  active = false,
  ariaLabel,
}) {
  const className = [
    'summary-card',
    active ? 'is-active' : null,
  ].filter(Boolean).join(' ')

  const inner = (
    <>
      <div className="summary-card-head">
        {icon ? (
          <span className={`summary-card-icon summary-card-icon--${tone}`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="summary-card-value">{value}</div>
      {hint ? <div className="summary-card-hint">{hint}</div> : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-pressed={active}
        aria-label={ariaLabel}
      >
        {inner}
      </button>
    )
  }

  return <div className={className}>{inner}</div>
}
