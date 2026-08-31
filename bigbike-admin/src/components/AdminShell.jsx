import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { useNavBadges } from '../lib/useNavBadges'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmDialogProvider } from './ConfirmDialog'
import { GlobalSearch } from './GlobalSearch'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'

// Màn form (sản phẩm/tin tức) báo AdminShell tự ẩn sidebar khi mở panel Xem trước —
// cả 2 chiếm chỗ ngang cùng lúc nên màn dễ chật. Tự động theo trạng thái preview,
// chỉ ẩn sidebar, không nhớ qua lần sau.
const PreviewSidebarContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useAutoHideSidebar(active) {
  const setPreviewActive = useContext(PreviewSidebarContext)
  useEffect(() => {
    if (!setPreviewActive) return undefined
    setPreviewActive(active)
    return () => setPreviewActive(false)
  }, [active, setPreviewActive])
}

function isRouteActive(activePath, candidatePath) {
  return (
    activePath === candidatePath ||
    activePath.startsWith(`${candidatePath}/`)
  )
}

function Breadcrumb({ activePath, navGroups, navigate, homePath, t }) {
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
  const homeItem = navGroups
    .flatMap((group) => group.items)
    .find((item) => item.path === homePath)
  const isHomeRoot = !isDetail && match.path === homePath
  const homeLabel = homePath === '/admin/dashboard'
    ? t('app.overview')
    : homeItem?.label

  return (
    <nav className="bb-breadcrumb" aria-label="Breadcrumb">
      <ol className="bb-breadcrumb-inner">
        {isHomeRoot ? (
          <li><span className="current" aria-current="page">{homeLabel || match.label}</span></li>
        ) : (
          <>
            {homePath && homeLabel ? (
              <>
                <li>
                  <a
                    href={homePath}
                    onClick={(e) => { e.preventDefault(); navigate(homePath) }}
                  >
                    {homeLabel}
                  </a>
                </li>
                <li className="sep" aria-hidden="true">/</li>
              </>
            ) : null}
            {isDetail ? (
              <li>
                <a href={match.path} onClick={(e) => { e.preventDefault(); navigate(match.path) }}>
                  {match.label}
                </a>
              </li>
            ) : (
              <li><span className="current" aria-current="page">{match.label}</span></li>
            )}
            {isDetail && (
              <>
                <li className="sep" aria-hidden="true">/</li>
                <li><span className="current" aria-current="page">{isCreate ? t('app.createNew') : t('app.detail')}</span></li>
              </>
            )}
          </>
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
  pageTitle,
  homePath,
  preloadPath,
  children,
}) {
  const { logout } = useAuth()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [previewActive, setPreviewActive] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const userChipRef = useRef(null)
  const hamburgerRef = useRef(null)
  const sidebarRef = useRef(null)

  // Drawer breakpoint (khớp @media max-width:900px trong admin-prototype.css): dưới
  // ngưỡng này sidebar là drawer trượt; trên ngưỡng là cột cố định luôn hiển thị.
  const [isDrawerViewport, setIsDrawerViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const onChange = (e) => setIsDrawerViewport(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  // Drawer đóng trên mobile → loại nội dung sidebar khỏi thứ tự Tab + cây a11y
  // (chỉ CSS `pointer-events:none` không đủ, phím Tab vẫn lọt vào link ẩn).
  const drawerHidden = isDrawerViewport && !sidebarOpen

  const visiblePaths = useMemo(
    () => new Set(navGroups.flatMap((group) => group.items.map((item) => item.path))),
    [navGroups],
  )
  const navBadges = useNavBadges(visiblePaths)

  useEffect(() => {
    if (!visiblePaths.has('/admin/orders')) return undefined
    return subscribeAdminWs('/topic/admin/orders', () => {
      queryClient.invalidateQueries({ queryKey: ['nav-badge', 'orders-pending'] })
    })
  }, [queryClient, visiblePaths])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  // Mobile drawer: đóng bằng Escape + đưa focus vào drawer khi mở, trả focus về
  // nút hamburger khi đóng — cho người dùng bàn phím/screen reader trên tablet.
  useEffect(() => {
    if (!sidebarOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') { setSidebarOpen(false); hamburgerRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    sidebarRef.current?.querySelector('a.bb-nav-link')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  function handleNavClick(e, path) {
    e.preventDefault()
    navigate(path)
    closeSidebar()
  }

  // L8 — ArrowUp/ArrowDown nhảy nhanh giữa các mục menu (xuyên nhóm), giữ
  // nguyên Tab/Enter/click hiện có.
  function handleSidebarKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const links = Array.from(e.currentTarget.querySelectorAll('a.bb-nav-link'))
    const currentIndex = links.indexOf(document.activeElement)
    if (currentIndex === -1) return
    e.preventDefault()
    const nextIndex = e.key === 'ArrowDown'
      ? Math.min(links.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1)
    links[nextIndex]?.focus()
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

  // A3 — user dropdown: đóng bằng Escape + trả focus về nút trigger (.bb-user-chip)
  // khi đóng, cùng pattern với mobile drawer (đóng bằng Escape + trả focus ở trên).
  useEffect(() => {
    if (!userMenuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') { setUserMenuOpen(false); userChipRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [userMenuOpen])

  function formatRoles(roles) {
    return (roles ?? []).map(r => t(`roles.roleLabel_${r}`, { defaultValue: t('common.unknown') })).join(', ')
  }

  const initials = useMemo(() => {
    const parts = (user?.fullName || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'BB'
    const first = parts[parts.length - 1].charAt(0)
    const second = parts[0].charAt(0)
    return (first + second).toUpperCase()
  }, [user?.fullName])

  return (
    <PreviewSidebarContext.Provider value={setPreviewActive}>
      <div
        className={[
          'bb-app',
          sidebarOpen ? 'sidebar-open' : '',
          previewActive ? 'preview-active' : '',
        ].filter(Boolean).join(' ')}
        data-screen-label="BigBike Admin"
      >
        {/* A5: bỏ qua tới nội dung — ẩn ngoài màn hình, hiện khi focus bằng bàn phím */}
        <a href="#bb-main-content" className="bb-skip-link">
          {t('nav.skipToContent', { defaultValue: 'Bỏ qua tới nội dung' })}
        </a>

        {/* Mobile sidebar overlay */}
        <div className="bb-sidebar-overlay" onClick={() => { setSidebarOpen(false); hamburgerRef.current?.focus() }} aria-hidden="true" />

        <aside
          ref={sidebarRef}
          id="bb-mobile-sidebar"
          className="bb-sidebar"
          aria-label={t('nav.sidebarLabel')}
          inert={drawerHidden || undefined}
          aria-hidden={drawerHidden || undefined}
        >
          <div className="bb-sidebar-brand">
            <span className="bb-brand-mark" aria-hidden="true">BB</span>
            <div className="bb-brand-meta">
              <span className="bb-brand-name">BigBike</span>
              <span className="bb-brand-sub">Admin</span>
            </div>
          </div>

          <nav className="bb-sidebar-nav" aria-label={t('nav.mainNav')} onKeyDown={handleSidebarKeyDown}>
            <TooltipProvider delayDuration={400}>
              {navGroups.map((group) => {
                const groupLabelId = `bb-nav-group-${group.groupKey}`
                return (
                <div key={group.groupKey} className="bb-nav-group" role="group" aria-labelledby={groupLabelId}>
                  <span id={groupLabelId} className="bb-nav-group-label">{group.label}</span>
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
                            onPointerEnter={() => preloadPath?.(item.path)}
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
                )
              })}
            </TooltipProvider>
          </nav>

          <div className="bb-sidebar-foot">
            <strong>{user?.fullName}</strong>
          </div>
        </aside>

        <div className="bb-main">
          <header className="bb-topbar">
            {/* Hamburger — mobile only (hidden on ≥900px via CSS) */}
            <Button
              ref={hamburgerRef}
              type="button"
              variant="ghost"
              size="icon"
              className="bb-hamburger"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? t('common.close') : t('nav.openMenu')}
              aria-expanded={sidebarOpen}
              aria-controls="bb-mobile-sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>

            {pageTitle && <div className="bb-topbar-title">{pageTitle}</div>}

            {/* Global search */}
            <GlobalSearch navigate={navigate} visiblePaths={visiblePaths} />

            <div className="bb-topbar-spacer" />

            <ThemeToggle />
            <LanguageSwitcher />
            <NotificationBell navigate={navigate} />

            {/* User dropdown */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <Button
                ref={userChipRef}
                type="button"
                variant="ghost"
                className="bb-user-chip"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span className="name">{user?.fullName}</span>
                  <span className="role">{formatRoles(user?.roles)}</span>
                </span>
                <ChevronDown size={13} aria-hidden="true" />
              </Button>

              {userMenuOpen && (
                <div className="bb-user-dropdown" role="menu">
                  <div className="bb-user-dropdown-header">
                    <strong>{user?.fullName}</strong>
                    <span>{user?.email || (user?.roles ?? []).join(', ')}</span>
                  </div>
                  <hr />
                  <div className="bb-user-dropdown-lang">
                    <span className="bb-user-dropdown-lang-label">{t('nav.contentLangLabel', { defaultValue: 'Ngôn ngữ nội dung' })}</span>
                    <LanguageSwitcher />
                  </div>
                  <Button
                    type="button"
                    role="menuitem"
                    variant="ghost"
                    className="bb-user-dropdown-item danger"
                    onClick={() => { setUserMenuOpen(false); logout() }}
                  >
                    <LogOut size={14} aria-hidden="true" />
                    {t('common.logout')}
                  </Button>
                </div>
              )}
            </div>
          </header>

          <Breadcrumb activePath={activePath} navGroups={navGroups} navigate={navigate} homePath={homePath} t={t} />

          <main id="bb-main-content" tabIndex={-1} className="bb-page-content">{children}</main>
        </div>
      </div>

      <ConfirmDialogProvider />
    </PreviewSidebarContext.Provider>
  )
}
