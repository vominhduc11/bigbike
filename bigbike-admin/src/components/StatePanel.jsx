export function StatePanel({
  tone = 'neutral',
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <section className={`state-panel state-panel-${tone}`} role="status">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="btn btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
