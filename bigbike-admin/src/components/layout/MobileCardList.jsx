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

  const Wrapper = onClick ? 'button' : 'div'
  const wrapperProps = onClick
    ? { type: 'button', onClick, className: 'mobile-card', style: { textAlign: 'left', width: '100%', font: 'inherit' } }
    : { className: 'mobile-card' }

  return (
    <Wrapper {...wrapperProps}>
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
      {actions ? <div className="mobile-card-actions">{actions}</div> : null}
    </Wrapper>
  )
}
