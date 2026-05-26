export function FilterBar({ children }) {
  return <div className="bb-filter-bar">{children}</div>
}

export function FilterField({ label, children, span }) {
  const style = span ? { gridColumn: `span ${span}` } : undefined
  return (
    <label style={style}>
      <span>{label}</span>
      {children}
    </label>
  )
}
