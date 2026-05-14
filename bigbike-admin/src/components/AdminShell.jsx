import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Menu, User, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { ConfirmDialogProvider } from './ConfirmDialog'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { Button } from '@/components/ui/button'

function isRouteActive(activePath, candidatePath) {
  return (
    activePath === candidatePath ||
    activePath.startsWith(`${candidatePath}/`)
  )
}

function Breadcrumb({ activePath, navGroups, navigate, t }) {
  let match = null
  for (const group of navGroups) {
    for (const item of group.items) {
      if (activePath === item.path || activePath.startsWith(`${item.path}/`)) {
        match = item
        break
      }
    }
    if (match) break
  }

  if (!match) return null

  const isDetail = activePath !== match.path
  const isCreate = activePath.endsWith('/new') || activePath.includes('/new/')

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <a href="/admin/dashboard" onClick={(e) => { e.preventDefault(); navigate('/admin/dashboard') }}>
            {t('app.overview')}
          </a>
        </li>
        <li aria-current={!isDetail ? 'page' : undefined}>
          {isDetail ? (
            <a href={match.path} onClick={(e) => { e.preventDefault(); navigate(match.path) }}>
              {match.label}
            </a>
          ) : (
            <span>{match.label}</span>
          )}
        </li>
        {isDetail && (
          <li aria-current="page">
            <span>{isCreate ? t('app.createNew') : t('app.detail')}</span>
          </li>
        )}
      </ol>
    </nav>
  )
}

export function AdminShell({
  navGroups,
  activePath,
  navigate,
  user,
  authMode,
  pageTitle,
  children,
}) {
  const { logout } = useAuth()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  function handleNavClick(e, path) {
    e.preventDefault()
    navigate(path)
    closeSidebar()
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  const isLive = authMode === 'live'

  function formatRoles(roles) {
    return roles.map(r => t(`roles.roleLabel_${r}`, { defaultValue: r.replace(/_/g, ' ') })).join(', ')
  }

  return (
    <>
      <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>

        {/* Mobile overlay */}
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />

        <aside className="sidebar" aria-label={t('nav.sidebarLabel')}>
          <div className="sidebar-brand">
            <p className="brand-eyebrow">BigBike</p>
            <h1>Admin</h1>
          </div>

          <nav className="sidebar-nav" aria-label={t('nav.mainNav')}>
            {navGroups.map((group) => (
              <div key={group.groupKey} className="sidebar-group">
                <p className="sidebar-group-label">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isRouteActive(activePath, item.path)
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      className={active ? 'sidebar-link active' : 'sidebar-link'}
                      onClick={(e) => handleNavClick(e, item.path)}
                      aria-current={active ? 'page' : undefined}
                    >
                      {Icon && <Icon size={16} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />}
                      <span>{item.label}</span>
                    </a>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Sidebar footer: user info on mobile */}
          <div style={{
            padding: 'var(--admin-space-4)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 'var(--admin-text-sm)', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {user.fullName}
            </div>
            <div style={{ fontSize: 'var(--admin-text-xs)', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {formatRoles(user.roles)}
            </div>
          </div>
        </aside>

        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              {/* Hamburger — visible only on mobile via CSS */}
              <Button variant="secondary" className="hamburger-btn"
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label={sidebarOpen ? t('common.close') : t('nav.openMenu')}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </Button>

              {pageTitle && (
                <span className="topbar-page-title">{pageTitle}</span>
              )}
            </div>

            <div className="topbar-actions">
              {/* Connection status pill */}
              <span
                className={`mode-pill ${isLive ? 'mode-pill-live' : 'mode-pill-mock'}`}
                aria-live="polite"
                title={!isLive ? t('auth.connectionOfflineTooltip') : undefined}
              >
                {isLive ? t('auth.connectionLive') : t('auth.connectionOffline')}
              </span>

              <ThemeToggle />
              <LanguageSwitcher />

              {/* User dropdown */}
              <div className="topbar-user-menu" ref={userMenuRef}>
                <Button variant="secondary" className="topbar-user-btn"
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="topbar-user-avatar" aria-hidden="true">
                    <User size={14} />
                  </span>
                  <span className="topbar-user-info">
                    <strong>{user.fullName}</strong>
                    <span>{formatRoles(user.roles)}</span>
                  </span>
                  <ChevronDown size={13} className={`topbar-chevron${userMenuOpen ? ' open' : ''}`} aria-hidden="true" />
                </Button>

                {userMenuOpen && (
                  <div className="user-dropdown" role="menu">
                    <div className="user-dropdown-header">
                      <strong>{user.fullName}</strong>
                      <span>{user.email || user.roles.join(', ')}</span>
                    </div>
                    <hr className="user-dropdown-divider" />
                    <button
                      type="button"
                      role="menuitem"
                      className="user-dropdown-item user-dropdown-item-danger"
                      onClick={() => { setUserMenuOpen(false); logout() }}
                    >
                      <LogOut size={14} aria-hidden="true" />
                      {t('common.logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Breadcrumb */}
          <Breadcrumb activePath={activePath} navGroups={navGroups} navigate={navigate} t={t} />

          <main className="page-content">{children}</main>
        </div>
      </div>
      <ConfirmDialogProvider />
    </>
  )
}
