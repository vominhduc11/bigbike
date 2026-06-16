export function FilterBar({ children }) {
  return <div className="bb-filter-bar">{children}</div>
}

export function FilterField({ label, children }) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  )
}
