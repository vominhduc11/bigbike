// Section card wrapper — matches the same shape used in ProductDetailScreen.
// Required sections get a subtle red asterisk after the title instead of a loud "BẮT BUỘC" badge.
export function SectionCard({ title, badge, required, children }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header">
        <h2>
          {title}
          {required && (
            <span
              className="ml-1 text-[var(--admin-color-status-danger-text)]"
              aria-label="bắt buộc"
              title="Bắt buộc"
            >*</span>
          )}
        </h2>
        {badge}
      </div>
      <div className="bb-card-body">{children}</div>
    </div>
  )
}
