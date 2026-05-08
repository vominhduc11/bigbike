/**
 * Screen — page container with consistent vertical rhythm.
 * Replaces the ad-hoc <div className="page-inner"> wrapper.
 */
export function Screen({ children, maxWidth }) {
  const style = maxWidth ? { maxWidth } : undefined
  return (
    <div className="screen" style={style}>
      {children}
    </div>
  )
}
