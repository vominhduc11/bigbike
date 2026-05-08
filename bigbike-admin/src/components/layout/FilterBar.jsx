/**
 * FilterBar — wraps search, selects, and filter buttons in a consistent row.
 *
 * Children are rendered inside a CSS grid that auto-fits 160px+ columns.
 * Each child is typically a <label> + <input/select>.
 */
export function FilterBar({ children }) {
  return <div className="filter-bar">{children}</div>
}

/**
 * FilterField — label + control inside a FilterBar.
 */
export function FilterField({ label, children, span }) {
  const style = span ? { gridColumn: `span ${span}` } : undefined
  return (
    <label style={style}>
      <span>{label}</span>
      {children}
    </label>
  )
}
