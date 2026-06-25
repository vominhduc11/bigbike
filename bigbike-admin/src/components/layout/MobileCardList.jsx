/**
 * MobileCardList — list-as-cards layout for narrow screens.
 *
 * The wrapper itself is .show-on-mobile, so on desktop and tablet it is
 * hidden and the table view shows instead. Use alongside an AdminTable
 * wrapped in .hide-on-mobile.
 */
export function MobileCardList({ children, className }) {
  const cls = ['mobile-card-list', 'show-on-mobile', className].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}

/**
 * MobileCard — single card representing one row.
 *
 * Slots:
 *  - title / subtitle: head row
 *  - status: rendered on the right of the head row (typically a status badge)
 *  - meta: array of { label, value, tone? } pairs rendered as a 2-column grid
 *  - actions: action button row (rendered with top border)
 */
export function MobileCard({ title, subtitle, status, meta = [], actions, onClick }) {
  function valueClass(tone) {
    if (tone === 'strong') return 'mobile-card-meta-value mobile-card-meta-value--strong'
    if (tone === 'danger') return 'mobile-card-meta-value mobile-card-meta-value--danger'
    return 'mobile-card-meta-value'
  }

  // Body = head + meta. Khi có onClick, chỉ bọc PHẦN BODY trong <button> để
  // tránh nút lồng nút (actions chứa <button> riêng) — DOM hợp lệ + a11y đúng.
  const body = (
    <>
      {(title || status) && (
        <div className="mobile-card-head">
          <div>
            {title ? <p className="mobile-card-title">{title}</p> : null}
            {subtitle ? <p className="mobile-card-subtitle">{subtitle}</p> : null}
          </div>
          {status}
        </div>
      )}
      {meta.length > 0 && (
        <div className="mobile-card-meta">
          {meta.map((m, i) => (
            <div key={i} className="mobile-card-meta-row">
              <span className="mobile-card-meta-label">{m.label}</span>
              <span className={valueClass(m.tone)}>{m.value ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="mobile-card">
      {onClick
        ? (
          <button
            type="button"
            onClick={onClick}
            className="mobile-card-main"
            style={{ textAlign: 'left', width: '100%', font: 'inherit', display: 'block', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }}
          >
            {body}
          </button>
        )
        : body}
      {actions ? <div className="mobile-card-actions">{actions}</div> : null}
    </div>
  )
}
