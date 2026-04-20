function isRouteActive(activePath, candidatePath) {
  return (
    activePath === candidatePath ||
    activePath.startsWith(`${candidatePath}/`)
  )
}

export function AdminShell({
  navItems,
  activePath,
  navigate,
  user,
  authMode,
  children,
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="sidebar-brand">
          <p className="brand-eyebrow">BigBike</p>
          <h1>Admin</h1>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className={
                isRouteActive(activePath, item.path)
                  ? 'sidebar-link active'
                  : 'sidebar-link'
              }
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div>
            <strong>{user.fullName}</strong>
            <p>{user.roles.join(', ')}</p>
          </div>
          <div className="mode-pill" aria-live="polite">
            {authMode === 'live' ? 'Live API' : 'Mock fallback'}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
