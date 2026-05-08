/**
 * ScreenHeader — title block at the top of every screen.
 * Layout: eyebrow + title + description on the left, action slot on the right.
 */
export function ScreenHeader({ eyebrow, title, description, actions, badge }) {
  return (
    <header className="screen-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1>{title}</h1>
          {badge}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="screen-actions">{actions}</div> : null}
    </header>
  )
}
