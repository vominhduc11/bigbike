export function ScreenHeader({ eyebrow, title, description, actions, badge }) {
  return (
    <header className="screen-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1>{title}</h1>
          {badge}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="screen-actions">{actions}</div> : null}
    </header>
  )
}
