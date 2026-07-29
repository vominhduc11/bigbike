import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity, AlignLeft, ArrowRightLeft, Award, BarChart2, FileText, Image, KeyRound, LayoutDashboard,
  Package, Settings, Shield, ShoppingCart, Star, Tag,
  Users,
} from 'lucide-react'
import { AdminShell } from './components/AdminShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OrderNotificationToast } from './components/OrderNotificationToast'
import { ScreenSkeleton } from './components/ScreenSkeleton'
import { StatePanel } from './components/StatePanel'
import { AuthProvider, useAuth } from './lib/auth'
import { readTokens } from './lib/authStorage'
import { connectAdminWs, disconnectAdminWs, setWsReconnectCallback } from './lib/adminWebSocket'
import { queryClient } from './lib/queryClient'
import { confirmNavigation } from './lib/navigationGuard'
import { lazyScreen } from './lib/lazyScreen'
import { LoginScreen } from './screens/LoginScreen'

const AcceptInviteScreen = lazyScreen(() => import('./screens/AcceptInviteScreen'), 'AcceptInviteScreen')
const DashboardScreen    = lazyScreen(() => import('./screens/DashboardScreen'),    'DashboardScreen')
const BrandDetailScreen  = lazyScreen(() => import('./screens/BrandDetailScreen'),  'BrandDetailScreen')
const BrandListScreen    = lazyScreen(() => import('./screens/BrandListScreen'),    'BrandListScreen')
const CategoryDetailScreen = lazyScreen(() => import('./screens/CategoryDetailScreen'), 'CategoryDetailScreen')
const CategoryListScreen = lazyScreen(() => import('./screens/CategoryListScreen'), 'CategoryListScreen')
const ContentDetailScreen = lazyScreen(() => import('./screens/ContentDetailScreen'), 'ContentDetailScreen')
const ContentListScreen  = lazyScreen(() => import('./screens/ContentListScreen'),  'ContentListScreen')
const CustomerDetailScreen = lazyScreen(() => import('./screens/CustomerDetailScreen'), 'CustomerDetailScreen')
const CustomerListScreen = lazyScreen(() => import('./screens/CustomerListScreen'), 'CustomerListScreen')
const MediaLibraryScreen = lazyScreen(() => import('./screens/MediaLibraryScreen'), 'MediaLibraryScreen')
const MenuScreen         = lazyScreen(() => import('./screens/MenuScreen'),         'MenuScreen')
const OrderDetailScreen  = lazyScreen(() => import('./screens/OrderDetailScreen'),  'OrderDetailScreen')
const OrderListScreen    = lazyScreen(() => import('./screens/OrderListScreen'),    'OrderListScreen')
const ProductDetailScreen = lazyScreen(() => import('./screens/ProductDetailScreen'), 'ProductDetailScreen')
const ProductListScreen  = lazyScreen(() => import('./screens/ProductListScreen'),  'ProductListScreen')
const ReviewListScreen   = lazyScreen(() => import('./screens/ReviewListScreen'),   'ReviewListScreen')
const ReviewDetailScreen = lazyScreen(() => import('./screens/ReviewDetailScreen'), 'ReviewDetailScreen')
const SettingsScreen     = lazyScreen(() => import('./screens/SettingsScreen'),     'SettingsScreen')
const SliderListScreen      = lazyScreen(() => import('./screens/SliderListScreen'),      'SliderListScreen')
const HomeVideoListScreen   = lazyScreen(() => import('./screens/HomeVideoListScreen'),   'HomeVideoListScreen')
const RedirectListScreen    = lazyScreen(() => import('./screens/RedirectListScreen'),    'RedirectListScreen')
const AdminUsersScreen   = lazyScreen(() => import('./screens/AdminUsersScreen'),   'AdminUsersScreen')
const AuditLogListScreen = lazyScreen(() => import('./screens/AuditLogListScreen'), 'AuditLogListScreen')
const ReportsScreen      = lazyScreen(() => import('./screens/ReportsScreen'),      'ReportsScreen')
const RolesScreen        = lazyScreen(() => import('./screens/RolesScreen'),        'RolesScreen')
const HomeHighlightsScreen       = lazyScreen(() => import('./screens/HomeHighlightsScreen'),       'HomeHighlightsScreen')
const FeaturedProductsScreen     = lazyScreen(() => import('./screens/FeaturedProductsScreen'),     'FeaturedProductsScreen')

// Dashboard: backend giới hạn theo VAI TRÒ (ADMIN/SUPER_ADMIN/SHOP_MANAGER) ngoài
// quyền orders.read — mirror ở frontend để người có orders.read nhưng khác vai trò
// không thấy mục rồi bị 403 (đồng bộ PERMISSION_MATRIX). Người có quyền '*' vẫn thấy.
const DASHBOARD_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SHOP_MANAGER']

// ── Grouped navigation definition ────────────────────────────────────────────
const NAV_GROUP_DEFS = [
  {
    groupKey: 'sales',
    labelKey: 'nav.group.sales',
    items: [
      { path: '/admin/dashboard',  labelKey: 'nav.dashboard',  permission: 'orders.read',    icon: LayoutDashboard, roles: DASHBOARD_ROLES },
      { path: '/admin/orders',     labelKey: 'nav.orders',     permission: 'orders.read',    icon: ShoppingCart },
      { path: '/admin/customers',  labelKey: 'nav.customers',  permission: 'customers.read', icon: Users },
      { path: '/admin/reviews',    labelKey: 'nav.reviews',    permission: 'reviews.read',   icon: Star },
    ],
  },
  {
    groupKey: 'products',
    labelKey: 'nav.group.products',
    items: [
      { path: '/admin/products',          labelKey: 'nav.products',          permission: 'products.read',  icon: Package },
      { path: '/admin/featured-products', labelKey: 'nav.featuredProducts',  permission: 'products.update', icon: Star },
      { path: '/admin/categories',        labelKey: 'nav.categories',        permission: 'catalog.read',   icon: Tag },
      { path: '/admin/brands',            labelKey: 'nav.brands',            permission: 'catalog.read',   icon: Award },
    ],
  },
  {
    groupKey: 'content',
    labelKey: 'nav.group.content',
    items: [
      { path: '/admin/content',    labelKey: 'nav.content',    permission: 'content.read',   icon: FileText },
      { path: '/admin/sliders',      labelKey: 'nav.sliders',      permission: 'sliders.read',      icon: BarChart2 },
      { path: '/admin/home-videos',     labelKey: 'nav.homeVideos',       permission: 'home_videos.read',    icon: BarChart2 },
      { path: '/admin/home-highlights', labelKey: 'nav.homeHighlights',   permission: 'home_highlights.read', icon: LayoutDashboard },
      { path: '/admin/redirects',       labelKey: 'nav.redirects',        permission: 'redirects.read',       icon: ArrowRightLeft },
      { path: '/admin/menus',      labelKey: 'nav.menus',      permission: 'menus.read',     icon: AlignLeft },
      { path: '/admin/media',      labelKey: 'nav.media',      permission: 'media.read',     icon: Image },
    ],
  },
  {
    groupKey: 'reports',
    labelKey: 'nav.group.reports',
    items: [
      { path: '/admin/reports',    labelKey: 'nav.reports',    permission: 'reports.read',   icon: BarChart2 },
    ],
  },
  {
    groupKey: 'system',
    labelKey: 'nav.group.system',
    items: [
      { path: '/admin/settings',     labelKey: 'nav.settings',    permission: 'settings.read',     icon: Settings },
      { path: '/admin/admin-users',  labelKey: 'nav.adminUsers',  permission: 'admin-users.read',  icon: Shield },
      { path: '/admin/roles',        labelKey: 'nav.roles',       permission: 'roles.read',        icon: KeyRound },
      { path: '/admin/audit-logs',   labelKey: 'nav.auditLogs',   permission: 'audit-logs.read',   icon: Activity },
    ],
  },
]

// Flat list for route matching utilities
const NAV_FLAT = NAV_GROUP_DEFS.flatMap((g) => g.items)

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  const cleaned = pathname.replace(/\/+$/, '')
  return cleaned || '/'
}

function parseRoute(pathname) {
  const normalized = normalizePath(pathname)
  const effectivePath =
    normalized === '/' || normalized === '/admin' ? '/admin/dashboard' : normalized
  const segments = effectivePath.split('/').filter(Boolean)

  if (segments[0] !== 'admin') return { kind: 'not-found' }

  const [, module, id, sub] = segments

  if (module === 'dashboard') return { kind: 'screen', name: 'dashboard' }

  if (module === 'products' && !id)          return { kind: 'screen', name: 'products-list' }
  if (module === 'products' && id === 'new') return { kind: 'screen', name: 'product-create' }
  if (module === 'products' && id)           return { kind: 'screen', name: 'product-detail', productId: id }
  if (module === 'categories' && !id)          return { kind: 'screen', name: 'categories-list' }
  if (module === 'categories' && id === 'new') return { kind: 'screen', name: 'category-create' }
  if (module === 'categories' && id)           return { kind: 'screen', name: 'category-detail', categoryId: id }
  if (module === 'brands' && !id)          return { kind: 'screen', name: 'brands-list' }
  if (module === 'brands' && id === 'new') return { kind: 'screen', name: 'brand-create' }
  if (module === 'brands' && id)           return { kind: 'screen', name: 'brand-detail', brandId: id }

  if (module === 'featured-products') return { kind: 'screen', name: 'featured-products' }

  // Module Nội dung chỉ còn BÀI VIẾT (Tin tức) — trang tĩnh đã gỡ khỏi admin (owner 2026-06-24).
  if (module === 'content' && !id) return { kind: 'screen', name: 'content-list' }
  if (module === 'content' && id && sub === 'new') return { kind: 'screen', name: 'content-create', contentType: 'ARTICLE' }
  if (module === 'content' && id && sub) return { kind: 'screen', name: 'content-detail', contentType: 'ARTICLE', contentId: sub }

  if (module === 'orders' && !id) return { kind: 'screen', name: 'orders-list' }
  if (module === 'orders' && id)  return { kind: 'screen', name: 'order-detail', orderId: id }

  if (module === 'customers' && !id) return { kind: 'screen', name: 'customers-list' }
  if (module === 'customers' && id)  return { kind: 'screen', name: 'customer-detail', customerId: id }

  if (module === 'reviews' && !id) return { kind: 'screen', name: 'reviews' }
  if (module === 'reviews' && id)  return { kind: 'screen', name: 'review-detail', reviewId: id }

  if (module === 'media')       return { kind: 'screen', name: 'media-library' }
  if (module === 'menus')       return { kind: 'screen', name: 'menus' }
  if (module === 'sliders')      return { kind: 'screen', name: 'sliders' }
  if (module === 'home-videos')      return { kind: 'screen', name: 'home-videos' }
  if (module === 'home-highlights')  return { kind: 'screen', name: 'home-highlights' }
  if (module === 'redirects')        return { kind: 'screen', name: 'redirects' }
  if (module === 'admin-users') return { kind: 'screen', name: 'admin-users' }
  if (module === 'settings')    return { kind: 'screen', name: 'settings' }
  if (module === 'audit-logs')  return { kind: 'screen', name: 'audit-logs' }
  if (module === 'reports')     return { kind: 'screen', name: 'reports' }
  if (module === 'roles')       return { kind: 'screen', name: 'roles' }

  return { kind: 'not-found' }
}

// Vai trò bắt buộc cho từng route (ngoài permission). Chỉ Dashboard cần, để khớp backend.
function routeRoles(routeName) {
  if (routeName === 'dashboard') return DASHBOARD_ROLES
  return null
}

function routePermission(routeName) {
  switch (routeName) {
    case 'dashboard':                    return 'orders.read'
    case 'products-list':
    case 'product-detail':               return 'products.read'
    case 'product-create':               return 'products.update'
    case 'category-create':
    case 'brand-create':                 return 'catalog.update'
    case 'categories-list':
    case 'category-detail':
    case 'brands-list':
    case 'brand-detail':                 return 'catalog.read'
    case 'featured-products':           return 'products.update'
    case 'content-create':               return 'content.update'
    case 'content-list':
    case 'content-detail':               return 'content.read'
    case 'orders-list':
    case 'order-detail':                 return 'orders.read'
    case 'customers-list':
    case 'customer-detail':              return 'customers.read'
    case 'media-library':                return 'media.read'
    case 'menus':                        return 'menus.read'
    case 'sliders':                      return 'sliders.read'
    case 'home-videos':                  return 'home_videos.read'
    case 'home-highlights':              return 'home_highlights.read'
    case 'redirects':                    return 'redirects.read'
    case 'reviews':                      return 'reviews.read'
    case 'review-detail':                return 'reviews.read'
    case 'admin-users':                  return 'admin-users.read'
    case 'settings':                     return 'settings.read'
    case 'audit-logs':                   return 'audit-logs.read'
    case 'reports':                      return 'reports.read'
    case 'roles':                        return 'roles.read'
    default:                             return ''
  }
}

function AdminApp() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname))
  const authState = useAuth()
  const { t } = useTranslation()

  const SCREEN_SUSPENSE_FALLBACK = <ScreenSkeleton />

  const navigate = useCallback((nextPath, options = {}) => {
    // F6: chặn rời trang khi đang có thay đổi chưa lưu (hỏi xác nhận).
    if (!confirmNavigation()) return
    const qIdx = nextPath.indexOf('?')
    const pathPart = qIdx === -1 ? nextPath : nextPath.slice(0, qIdx)
    const queryPart = qIdx === -1 ? '' : nextPath.slice(qIdx)
    const normalizedPath = normalizePath(pathPart)
    const fullUrl = normalizedPath + queryPart
    if (normalizedPath === pathname && !queryPart) return
    if (options.replace) {
      window.history.replaceState({}, '', fullUrl)
    } else {
      window.history.pushState({}, '', fullUrl)
    }
    setPathname(normalizedPath)
  }, [pathname])

  useEffect(() => {
    const handlePopState = () => setPathname(normalizePath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (authState.status !== 'authenticated') return
    connectAdminWs(() => readTokens().accessToken)
    // Sau mỗi lần (re)connect ta có thể đã bỏ lỡ event đơn khi offline → chỉ làm mới
    // các cache do luồng đơn chi phối, thay vì invalidate TẤT CẢ. Tránh việc mạng chập
    // chờn (reconnect 4s/lần) làm refetch toàn bộ màn hình.
    setWsReconnectCallback(() => {
      for (const queryKey of [
        ['orders'], ['order'], ['nav-badge'], ['dashboard'],
        ['inventory-summary'],
      ]) {
        queryClient.invalidateQueries({ queryKey })
      }
    })
    return () => disconnectAdminWs()
  }, [authState.status])

  const route = parseRoute(pathname)
  const activePath = pathname === '/' || pathname === '/admin' ? '/admin/dashboard' : pathname

  const permissions = useMemo(
    () => new Set(authState.user?.permissions || []),
    [authState.user],
  )
  const hasPermission = useCallback(
    (permission) => permissions.has('*') || permissions.has(permission),
    [permissions],
  )
  const canViewOrders = hasPermission('orders.read')
  const userRoles = useMemo(() => authState.user?.roles || [], [authState.user])
  // Route/nav không khai báo `roles` thì mọi vai trò đều qua; '*' luôn qua.
  const hasAnyRole = useCallback(
    (roles) => !roles || roles.length === 0 || permissions.has('*') || roles.some((r) => userRoles.includes(r)),
    [permissions, userRoles],
  )

  // Build grouped nav — only groups with at least one visible item
  const visibleNavGroups = useMemo(
    () => NAV_GROUP_DEFS
      .map((group) => ({
        groupKey: group.groupKey,
        label: t(group.labelKey),
        items: group.items
          .filter((item) => authState.status === 'authenticated' && hasPermission(item.permission) && hasAnyRole(item.roles))
          .map((item) => ({ path: item.path, label: t(item.labelKey), icon: item.icon })),
      }))
      .filter((group) => group.items.length > 0),
    [authState.status, hasPermission, hasAnyRole, t],
  )

  // Active page label for topbar
  const activePageLabel = useMemo(() => {
    const found = NAV_FLAT.find((item) =>
      activePath === item.path || activePath.startsWith(`${item.path}/`),
    )
    return found ? t(found.labelKey) : ''
  }, [activePath, t])

  const fallbackPath = useMemo(() => {
    const first = NAV_FLAT.find((item) => hasPermission(item.permission) && hasAnyRole(item.roles))
    return first ? first.path : '/admin/dashboard'
  }, [hasPermission, hasAnyRole])

  // Public, token-gated invite acceptance — rendered regardless of auth state.
  if (pathname === '/accept-invite') {
    return (
      <Suspense fallback={SCREEN_SUSPENSE_FALLBACK}>
        <AcceptInviteScreen />
      </Suspense>
    )
  }

  if (authState.status === 'initializing') {
    return (
      <div className="full-page-state">
        <StatePanel tone="info" title={t('app.loadingSession')} description={t('app.loadingSessionDesc')} />
      </div>
    )
  }

  if (authState.status === 'unauthenticated') {
    return <LoginScreen />
  }

  if (authState.status === 'error') {
    return (
      <div className="full-page-state">
        <StatePanel tone="danger" title={t('app.initFailed')} description={authState.error || t('app.initFailedDesc')} />
      </div>
    )
  }

  if (route.kind === 'not-found') {
    return (
      <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel}>
        <StatePanel tone="neutral" title={t('app.routeNotFound')} description={t('app.routeNotFoundDesc')}
          actionLabel={t('app.goToModule')} onAction={() => navigate(fallbackPath)} />
      </AdminShell>
    )
  }

  if (route.kind !== 'screen') return null

  const requiredPermission = routePermission(route.name)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel}>
        <StatePanel tone="warning" title={t('app.permissionDenied')} description={`${t('app.missingPermission')} ${requiredPermission}`}
          actionLabel={t('app.goToAllowedModule')} onAction={() => navigate(fallbackPath)} />
      </AdminShell>
    )
  }

  const requiredRoles = routeRoles(route.name)
  if (requiredRoles && !hasAnyRole(requiredRoles)) {
    return (
      <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel}>
        <StatePanel tone="warning" title={t('app.permissionDenied')}
          description={t('app.missingRole', { defaultValue: 'Trang này chỉ dành cho một số vai trò quản trị (Quản trị viên, Quản lý cửa hàng).' })}
          actionLabel={t('app.goToAllowedModule')} onAction={() => navigate(fallbackPath)} />
      </AdminShell>
    )
  }

  let screen = null
  switch (route.name) {
    case 'dashboard':
      screen = <DashboardScreen navigate={navigate} />; break
    case 'products-list':
      screen = <ProductListScreen navigate={navigate} canUpdate={hasPermission('products.update')} />; break
    case 'product-create':
      screen = <ProductDetailScreen key="product-create" productId={null} isCreate navigate={navigate} canUpdate={hasPermission('products.update')} />; break
    case 'product-detail':
      screen = <ProductDetailScreen key={route.productId} productId={route.productId} navigate={navigate} canUpdate={hasPermission('products.update')} />; break
    case 'categories-list':
      screen = <CategoryListScreen navigate={navigate} canUpdate={hasPermission('catalog.update')} />; break
    case 'category-create':
      screen = <CategoryDetailScreen key="category-create" categoryId={null} isCreate navigate={navigate} canUpdate={hasPermission('catalog.update')} />; break
    case 'category-detail':
      screen = <CategoryDetailScreen key={route.categoryId} categoryId={route.categoryId} navigate={navigate} canUpdate={hasPermission('catalog.update')} />; break
    case 'brands-list':
      screen = <BrandListScreen navigate={navigate} canUpdate={hasPermission('catalog.update')} />; break
    case 'brand-create':
      screen = <BrandDetailScreen key="brand-create" brandId={null} isCreate navigate={navigate} canUpdate={hasPermission('catalog.update')} />; break
    case 'brand-detail':
      screen = <BrandDetailScreen key={route.brandId} brandId={route.brandId} navigate={navigate} canUpdate={hasPermission('catalog.update')} />; break
    case 'content-list':
      screen = <ContentListScreen navigate={navigate} canUpdate={hasPermission('content.update')} />; break
    case 'content-create':
      screen = <ContentDetailScreen key={`content-create:${route.contentType}`} contentType={route.contentType} contentId={null} isCreate navigate={navigate} canUpdate={hasPermission('content.update')} />; break
    case 'content-detail':
      screen = <ContentDetailScreen key={`content:${route.contentType}:${route.contentId}`} contentType={route.contentType} contentId={route.contentId} navigate={navigate} canUpdate={hasPermission('content.update')} />; break
    case 'orders-list':
      screen = <OrderListScreen navigate={navigate} canUpdate={hasPermission('orders.write')} />; break
    case 'order-detail':
      screen = <OrderDetailScreen key={route.orderId} orderId={route.orderId} navigate={navigate} canUpdate={hasPermission('orders.write')} />; break
    case 'customers-list':
      screen = <CustomerListScreen navigate={navigate} canUpdate={hasPermission('customers.write')} />; break
    case 'customer-detail':
      screen = <CustomerDetailScreen key={route.customerId} customerId={route.customerId} navigate={navigate} canUpdate={hasPermission('customers.write')} />; break
    case 'media-library':
      screen = <MediaLibraryScreen canUpdate={hasPermission('media.write')} canHardDelete={hasPermission('*')} />; break
    case 'menus':
      screen = <MenuScreen canUpdate={hasPermission('menus.write')} />; break
    case 'sliders':
      screen = <SliderListScreen canUpdate={hasPermission('sliders.write')} />; break
    case 'home-videos':
      screen = <HomeVideoListScreen canUpdate={hasPermission('home_videos.write')} />; break
    case 'home-highlights':
      screen = <HomeHighlightsScreen canUpdate={hasPermission('home_highlights.write')} />; break
    case 'redirects':
      screen = <RedirectListScreen canUpdate={hasPermission('redirects.write')} />; break
    case 'reviews':
      screen = <ReviewListScreen navigate={navigate} canUpdate={hasPermission('reviews.write')} isSuperAdmin={userRoles.includes('SUPER_ADMIN')} />; break
    case 'review-detail':
      screen = <ReviewDetailScreen reviewId={route.reviewId} navigate={navigate} canUpdate={hasPermission('reviews.write')} isSuperAdmin={userRoles.includes('SUPER_ADMIN')} />; break
    case 'admin-users':
      screen = <AdminUsersScreen canUpdate={hasPermission('admin-users.write')} isSuperAdmin={hasPermission('*')} currentUserId={authState.user?.id} />; break
    case 'settings':
      screen = <SettingsScreen canUpdate={hasPermission('settings.write')} isSuperAdmin={hasPermission('*')} navigate={navigate} />; break
    case 'audit-logs':
      screen = <AuditLogListScreen />; break
    case 'reports':
      screen = <ReportsScreen />; break
    case 'roles':
      screen = <RolesScreen canUpdate={hasPermission('roles.write')} currentUserRoles={authState.user?.roles} />; break
    case 'featured-products':
      screen = <FeaturedProductsScreen canUpdate={hasPermission('products.update')} />; break
    default:
      screen = <StatePanel tone="neutral" title={t('app.moduleNotAvailable')} description={t('app.moduleNotAvailableDesc')} />
  }

  return (
    <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel}>
      <Suspense fallback={SCREEN_SUSPENSE_FALLBACK}>
        {screen}
      </Suspense>
      {canViewOrders ? (
        <OrderNotificationToast navigate={navigate} canViewOrders={canViewOrders} />
      ) : null}
    </AdminShell>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminApp />
      </AuthProvider>
    </ErrorBoundary>
  )
}
