export function ScreenHeader({ eyebrow, title, description, actions, badge }) {
  return (
    <header className="bb-screen-header">
      <div className="bb-screen-title">
        {eyebrow ? <p className="bb-screen-eyebrow">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1>{title}</h1>
          {badge}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="bb-screen-actions">{actions}</div> : null}
    </header>
  )
}
