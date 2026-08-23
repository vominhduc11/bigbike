/**
 * Screen — page container with consistent vertical rhythm.
 * Replaces the ad-hoc <div className="page-inner"> wrapper.
 */
export function Screen({ children }) {
  return (
    <div className="screen">
      {children}
    </div>
  )
}
