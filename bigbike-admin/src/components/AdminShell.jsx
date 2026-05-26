import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, HelpCircle, LogOut, Maximize2, Menu, Minimize2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { useNavBadges } from '../lib/useNavBadges'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmDialogProvider } from './ConfirmDialog'
import { GlobalSearch } from './GlobalSearch'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'

const APP_BUILD = 'v2.6.0 · production'
const FOCUS_MODE_STORAGE_KEY = 'bb-focus-mode'

function isRouteActive(activePath, candidatePath) {
  return (
    activePath === candidatePath ||
    activePath.startsWith(`${candidatePath}/`)
  )
}

function isFormRoute(activePath) {
  return (
    /^\/admin\/products\/[^/]+$/.test(activePath) ||
    /^\/admin\/content\/[^/]+\/[^/]+$/.test(activePath)
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
  const isDashboardRoot = !isDetail && match.path === '/admin/dashboard'

  return (
    <nav className="bb-breadcrumb" aria-label="Breadcrumb">
      {isDashboardRoot ? (
        <span className="current">{t('app.overview')}</span>
      ) : (
        <>
          <a
            href="/admin/dashboard"
            onClick={(e) => { e.preventDefault(); navigate('/admin/dashboard') }}
          >
            {t('app.overview')}
          </a>
          <span className="sep">/</span>
          {isDetail ? (
            <a href={match.path} onClick={(e) => { e.preventDefault(); navigate(match.path) }}>
              {match.label}
            </a>
          ) : (
            <span className="current">{match.label}</span>
          )}
          {isDetail && (
            <>
              <span className="sep">/</span>
              <span className="current">{isCreate ? t('app.createNew') : t('app.detail')}</span>
            </>
          )}
        </>
      )}
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

  const formRoute = isFormRoute(activePath)
  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === '1' } catch { return false }
  })

  const toggleFocus = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev
      try { localStorage.setItem(FOCUS_MODE_STORAGE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])

  useEffect(() => {
    if (!formRoute) return undefined
    const onKey = (e) => {
      if (e.key === 'F11' || ((e.metaKey || e.ctrlKey) && e.key === '\\')) {
        e.preventDefault()
        toggleFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formRoute, toggleFocus])

  const focusActive = focusMode && formRoute

  const visiblePaths = useMemo(
    () => new Set(navGroups.flatMap((group) => group.items.map((item) => item.path))),
    [navGroups],
  )
  const navBadges = useNavBadges(visiblePaths)

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

  const initials = useMemo(() => {
    const parts = (user.fullName || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'BB'
    const first = parts[parts.length - 1].charAt(0)
    const second = parts[0].charAt(0)
    return (first + second).toUpperCase()
  }, [user.fullName])

  return (
    <>
      <div
        className={[
          'bb-app',
          sidebarOpen ? 'sidebar-open' : '',
          focusActive ? 'focus-mode' : '',
        ].filter(Boolean).join(' ')}
        data-screen-label="BigBike Admin"
      >
        {/* Mobile sidebar overlay */}
        <div className="bb-sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />

        <aside className="bb-sidebar" aria-label={t('nav.sidebarLabel')}>
          <div className="bb-sidebar-brand">
            <p className="eyebrow">BigBike Motors</p>
            <h1>
              <span className="brand-dot" aria-hidden="true" />
              Admin
            </h1>
            <div className="build">{APP_BUILD}</div>
          </div>

          <nav className="bb-sidebar-nav" aria-label={t('nav.mainNav')}>
            <TooltipProvider delayDuration={400}>
              {navGroups.map((group) => (
                <div key={group.groupKey} className="bb-nav-group">
                  <span className="bb-nav-group-label">{group.label}</span>
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = isRouteActive(activePath, item.path)
                    const badgeCount = navBadges[item.path] || 0
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>
                          <a
                            href={item.path}
                            className={active ? 'bb-nav-link active' : 'bb-nav-link'}
                            onClick={(e) => handleNavClick(e, item.path)}
                            aria-current={active ? 'page' : undefined}
                          >
                            {Icon && <Icon size={15} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />}
                            <span className="label">{item.label}</span>
                            {badgeCount > 0 && (
                              <span
                                className={item.path === '/admin/orders' ? 'bb-nav-badge' : 'bb-nav-badge muted'}
                                aria-label={t('nav.pendingBadge', { count: badgeCount })}
                              >
                                {badgeCount > 99 ? '99+' : badgeCount}
                              </span>
                            )}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}{badgeCount > 0 ? ` (${badgeCount})` : ''}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </TooltipProvider>
          </nav>

          <div className="bb-sidebar-foot">
            <span className={`dot${isLive ? '' : ' offline'}`} aria-hidden="true" />
            <strong>{user.fullName}</strong>
            <span>{isLive ? t('auth.connectionLive') : t('auth.connectionOffline')}</span>
          </div>
        </aside>

        <div className="bb-main">
          <header className="bb-topbar">
            {/* Hamburger — mobile only (hidden on ≥900px via CSS) */}
            <button
              type="button"
              className="bb-icon-btn bb-hamburger"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? t('common.close') : t('nav.openMenu')}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {pageTitle && <div className="bb-topbar-title">{pageTitle}</div>}

            {/* Global search */}
            <GlobalSearch navigate={navigate} visiblePaths={visiblePaths} />

            <div className="bb-topbar-spacer" />

            {/* Connection status pill */}
            <span
              className={`bb-pill-live${isLive ? '' : ' bb-pill-offline'}`}
              aria-live="polite"
              title={!isLive ? t('auth.connectionOfflineTooltip') : undefined}
            >
              <span className="dot" aria-hidden="true" />
              <span>{isLive ? t('auth.connectionLive') : t('auth.connectionOffline')}</span>
            </span>

            <ThemeToggle />
            <LanguageSwitcher />
            <NotificationBell navigate={navigate} />

            {/* Focus-mode toggle — only on form routes */}
            {formRoute && (
              <button
                type="button"
                className="bb-icon-btn"
                onClick={toggleFocus}
                aria-pressed={focusMode}
                title={focusMode
                  ? t('app.focusExitTooltip', { defaultValue: 'Thoát chế độ tập trung (F11)' })
                  : t('app.focusEnterTooltip', { defaultValue: 'Bật chế độ tập trung — ẩn sidebar/topbar (F11)' })}
              >
                {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            )}

            <button className="bb-icon-btn" type="button" title={t('common.help', { defaultValue: 'Trợ giúp' })}>
              <HelpCircle size={18} />
            </button>

            {/* User dropdown */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="bb-user-chip"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span className="name">{user.fullName}</span>
                  <span className="role">{formatRoles(user.roles)}</span>
                </span>
                <ChevronDown size={13} aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <div className="bb-user-dropdown" role="menu">
                  <div className="bb-user-dropdown-header">
                    <strong>{user.fullName}</strong>
                    <span>{user.email || user.roles.join(', ')}</span>
                  </div>
                  <hr />
                  <button
                    type="button"
                    role="menuitem"
                    className="bb-user-dropdown-item danger"
                    onClick={() => { setUserMenuOpen(false); logout() }}
                  >
                    <LogOut size={14} aria-hidden="true" />
                    {t('common.logout')}
                  </button>
                </div>
              )}
            </div>
          </header>

          <Breadcrumb activePath={activePath} navGroups={navGroups} navigate={navigate} t={t} />

          <main className="bb-page-content">{children}</main>
        </div>
      </div>

      {/* Focus-mode exit FAB */}
      {focusActive && (
        <button
          type="button"
          className="bb-focus-fab"
          onClick={toggleFocus}
          title={t('app.focusExitTooltip', { defaultValue: 'Thoát chế độ tập trung (F11)' })}
        >
          <Minimize2 size={14} />
          <span>{t('app.focusExit', { defaultValue: 'Thoát tập trung' })}</span>
          <kbd>F11</kbd>
        </button>
      )}

      <ConfirmDialogProvider />
    </>
  )
}
