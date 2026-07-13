// `headingLevel` (2|3|4, mặc định 2) cho phép cấp tiêu đề khớp ngữ cảnh phân cấp.
// CSS `.detail-section-header :is(h2,h3,h4)` giữ nguyên style ở mọi cấp.
export function DetailSection({ title, description, headingLevel = 2, children }) {
  const Heading = `h${headingLevel}`
  return (
    <section className="detail-section">
      <header className="detail-section-header">
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="detail-section-content">{children}</div>
    </section>
  )
}
