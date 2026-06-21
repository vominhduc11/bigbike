export function DetailSection({ title, description, children }) {
  return (
    <section className="detail-section">
      <header className="detail-section-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="detail-section-content">{children}</div>
    </section>
  )
}
