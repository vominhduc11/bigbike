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
import {
  connectAdminWs,
  disconnectAdminWs,
  setWsAuthRejectedCallback,
  setWsReconnectCallback,
  subscribeAdminWs,
} from './lib/adminWebSocket'
import { queryClient } from './lib/queryClient'
import { confirmNavigation } from './lib/navigationGuard'
import { lazyScreen } from './lib/lazyScreen'
import {
  canAccessPolicy,
  missingPolicyPermissions,
  policyForRoute,
} from './lib/adminAccessPolicy'
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
// ── Grouped navigation definition ────────────────────────────────────────────
const NAV_GROUP_DEFS = [
  {
    groupKey: 'sales',
    labelKey: 'nav.group.sales',
    items: [
      { path: '/admin/dashboard',  labelKey: 'nav.dashboard',  policyKey: 'dashboard', icon: LayoutDashboard },
      { path: '/admin/orders',     labelKey: 'nav.orders',     policyKey: 'ordersRead', icon: ShoppingCart },
      { path: '/admin/customers',  labelKey: 'nav.customers',  policyKey: 'customersRead', icon: Users },
      { path: '/admin/reviews',    labelKey: 'nav.reviews',    policyKey: 'reviewsRead', icon: Star },
    ],
  },
  {
    groupKey: 'products',
    labelKey: 'nav.group.products',
    items: [
      { path: '/admin/products',          labelKey: 'nav.products',          policyKey: 'productsRead', icon: Package },
      { path: '/admin/featured-products', labelKey: 'nav.featuredProducts',  policyKey: 'featuredProducts', icon: Star },
      { path: '/admin/categories',        labelKey: 'nav.categories',        policyKey: 'catalogRead', icon: Tag },
      { path: '/admin/brands',            labelKey: 'nav.brands',            policyKey: 'catalogRead', icon: Award },
    ],
  },
  {
    groupKey: 'content',
    labelKey: 'nav.group.content',
    items: [
      { path: '/admin/content',    labelKey: 'nav.content',    policyKey: 'contentRead', icon: FileText },
      { path: '/admin/sliders',      labelKey: 'nav.sliders',      policyKey: 'slidersRead', icon: BarChart2 },
      { path: '/admin/home-videos',     labelKey: 'nav.homeVideos',       policyKey: 'homeVideosRead', icon: BarChart2 },
      { path: '/admin/home-highlights', labelKey: 'nav.homeHighlights',   policyKey: 'homeHighlightsRead', icon: LayoutDashboard },
      { path: '/admin/redirects',       labelKey: 'nav.redirects',        policyKey: 'redirectsRead', icon: ArrowRightLeft },
      { path: '/admin/menus',      labelKey: 'nav.menus',      policyKey: 'menusRead', icon: AlignLeft },
      { path: '/admin/media',      labelKey: 'nav.media',      policyKey: 'mediaRead', icon: Image },
    ],
  },
  {
    groupKey: 'reports',
    labelKey: 'nav.group.reports',
    items: [
      { path: '/admin/reports',    labelKey: 'nav.reports',    policyKey: 'reportsRead', icon: BarChart2 },
    ],
  },
  {
    groupKey: 'system',
    labelKey: 'nav.group.system',
    items: [
      { path: '/admin/settings',     labelKey: 'nav.settings',    policyKey: 'settingsRead', icon: Settings },
      { path: '/admin/admin-users',  labelKey: 'nav.adminUsers',  policyKey: 'adminUsersRead', icon: Shield },
      { path: '/admin/roles',        labelKey: 'nav.roles',       policyKey: 'rolesRead', icon: KeyRound },
      { path: '/admin/audit-logs',   labelKey: 'nav.auditLogs',   policyKey: 'auditLogsRead', icon: Activity },
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
  if (normalized === '/' || normalized === '/admin') return { kind: 'root' }
  const segments = normalized.split('/').filter(Boolean)

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
function AdminApp() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname))
  const authState = useAuth()
  const {
    status: authStatus,
    reconcileAccess,
    invalidateSession,
  } = authState
  const { t } = useTranslation()
  const canReadInventory = authState.user?.permissions?.includes('*')
    || authState.user?.permissions?.includes('inventory.read')

  const SCREEN_SUSPENSE_FALLBACK = <ScreenSkeleton />

  const navigate = useCallback((nextPath, options = {}) => {
    // F6: chặn rời trang khi đang có thay đổi chưa lưu (hỏi xác nhận).
    if (!options.force && !confirmNavigation()) return
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
    if (authStatus !== 'authenticated') return
    const unsubscribeAccess = subscribeAdminWs('/user/queue/admin/access', (event) => {
      queryClient.clear()
      if (event?.forceReauthentication) {
        invalidateSession({ broadcast: true })
      } else {
        reconcileAccess()
      }
    })
    connectAdminWs(() => readTokens().accessToken)
    // Sau mỗi lần (re)connect ta có thể đã bỏ lỡ event khi offline → chỉ làm mới
    // các cache do những luồng có topic WS chi phối (đơn, khách hàng, đánh giá),
    // thay vì invalidate TẤT CẢ. Tránh việc mạng chập chờn (reconnect 4s/lần) làm
    // refetch toàn bộ màn hình.
    setWsReconnectCallback(async () => {
      await reconcileAccess({ broadcast: false })
      for (const queryKey of [
        ['orders'], ['order'], ['nav-badge'], ['dashboard'],
        ['inventory-summary'], ['customers'], ['customer-summary'],
        ['reviews'], ['review-summary'],
      ]) {
        if (queryKey[0] === 'inventory-summary' && !canReadInventory) continue
        queryClient.invalidateQueries({ queryKey })
      }
    })
    setWsAuthRejectedCallback(async () => {
      const restored = await reconcileAccess()
      if (restored) connectAdminWs(() => readTokens().accessToken)
    })
    return () => {
      unsubscribeAccess()
      disconnectAdminWs()
    }
  }, [authStatus, reconcileAccess, invalidateSession, canReadInventory])

  const route = parseRoute(pathname)
  const activePath = pathname

  const permissions = useMemo(
    () => new Set(authState.user?.permissions || []),
    [authState.user],
  )
  const hasPermission = useCallback(
    (permission) => permissions.has('*') || permissions.has(permission),
    [permissions],
  )
  const canAccess = useCallback(
    (policyKey) => canAccessPolicy(policyKey, hasPermission),
    [hasPermission],
  )
  const canViewOrders = hasPermission('orders.read')
  const userRoles = useMemo(() => authState.user?.roles || [], [authState.user])
  // Route/nav không khai báo `roles` thì mọi vai trò đều qua; '*' luôn qua.
  // Build grouped nav — only groups with at least one visible item
  const visibleNavGroups = useMemo(
    () => NAV_GROUP_DEFS
      .map((group) => ({
        groupKey: group.groupKey,
        label: t(group.labelKey),
        items: group.items
          .filter((item) => authState.status === 'authenticated' && canAccess(item.policyKey))
          .map((item) => ({ path: item.path, label: t(item.labelKey), icon: item.icon })),
      }))
      .filter((group) => group.items.length > 0),
    [authState.status, canAccess, t],
  )

  // Active page label for topbar
  const activePageLabel = useMemo(() => {
    const found = NAV_FLAT.find((item) =>
      activePath === item.path || activePath.startsWith(`${item.path}/`),
    )
    return found ? t(found.labelKey) : ''
  }, [activePath, t])

  const fallbackPath = useMemo(() => {
    const first = NAV_FLAT.find((item) => canAccess(item.policyKey))
    return first?.path || null
  }, [canAccess])

  const routePolicyKey = useMemo(
    () => (route.kind === 'screen' ? policyForRoute(route.name) : null),
    [route.kind, route.name],
  )
  const missingPermissions = useMemo(
    () => (routePolicyKey ? missingPolicyPermissions(routePolicyKey, hasPermission) : []),
    [routePolicyKey, hasPermission],
  )

  useEffect(() => {
    if (authState.status !== 'authenticated' || route.kind !== 'root' || !fallbackPath) return
    // Root is a real redirect target: replace the URL once the authenticated
    // permission set has selected its first accessible module.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    navigate(fallbackPath, { replace: true })
  }, [authState.status, route.kind, fallbackPath, navigate])

  useEffect(() => {
    if (authState.status !== 'authenticated'
      || route.kind !== 'screen'
      || missingPermissions.length === 0
      || !fallbackPath) return
    // Access was withdrawn while this tab was open. Do not leave an editable stale form in
    // place or ask about unsaved changes: the server has already changed the authorization.
    const timer = window.setTimeout(
      () => navigate(fallbackPath, { replace: true, force: true }),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [authState.status, route.kind, missingPermissions, fallbackPath, navigate])

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

  if (route.kind === 'root') {
    return (
      <AdminShell
        navGroups={visibleNavGroups}
        activePath={activePath}
        navigate={navigate}
        user={authState.user}
        pageTitle={activePageLabel}
        homePath={fallbackPath}
      >
        <StatePanel
          tone={fallbackPath ? 'info' : 'neutral'}
          title={fallbackPath
            ? t('app.loadingSession')
            : t('app.noAllowedModules', { defaultValue: 'Tài khoản chưa được cấp quyền sử dụng khu vực nào' })}
          description={fallbackPath
            ? t('app.loadingSessionDesc')
            : t('app.noAllowedModulesDesc', { defaultValue: 'Liên hệ người quản trị để được cấp quyền phù hợp với công việc.' })}
        />
      </AdminShell>
    )
  }

  if (route.kind === 'not-found') {
    return (
      <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel} homePath={fallbackPath}>
        <StatePanel
          tone="neutral"
          title={t('app.routeNotFound')}
          description={fallbackPath
            ? t('app.routeNotFoundDesc')
            : t('app.noAllowedModules', { defaultValue: 'Tài khoản chưa được cấp quyền sử dụng khu vực nào' })}
          actionLabel={fallbackPath ? t('app.goToModule') : undefined}
          onAction={fallbackPath ? () => navigate(fallbackPath) : undefined}
        />
      </AdminShell>
    )
  }

  if (route.kind !== 'screen') return null

  if (missingPermissions.length > 0) {
    return (
      <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel} homePath={fallbackPath}>
        <StatePanel tone="warning" title={t('app.permissionDenied')} description={t('app.missingPermissionDesc', { defaultValue: 'Tài khoản chưa được cấp quyền cần thiết để xem khu vực này. Hãy liên hệ người quản trị để được hỗ trợ.' })}
          actionLabel={fallbackPath ? t('app.goToAllowedModule') : undefined}
          onAction={fallbackPath ? () => navigate(fallbackPath) : undefined} />
      </AdminShell>
    )
  }

  let screen = null
  switch (route.name) {
    case 'dashboard':
      screen = <DashboardScreen navigate={navigate} />; break
    case 'products-list':
      screen = <ProductListScreen navigate={navigate} canUpdate={canAccess('productsWrite')} canReadCatalog={hasPermission('catalog.read')} />; break
    case 'product-create':
      screen = <ProductDetailScreen key="product-create" productId={null} isCreate navigate={navigate} canUpdate={canAccess('productsWrite')} canReadCatalog={hasPermission('catalog.read')} />; break
    case 'product-detail':
      screen = <ProductDetailScreen key={route.productId} productId={route.productId} navigate={navigate} canUpdate={canAccess('productsWrite')} canReadCatalog={hasPermission('catalog.read')} />; break
    case 'categories-list':
      screen = <CategoryListScreen navigate={navigate} canUpdate={canAccess('catalogWrite')} />; break
    case 'category-create':
      screen = <CategoryDetailScreen key="category-create" categoryId={null} isCreate navigate={navigate} canUpdate={canAccess('catalogWrite')} canReadProducts={hasPermission('products.read')} />; break
    case 'category-detail':
      screen = <CategoryDetailScreen key={route.categoryId} categoryId={route.categoryId} navigate={navigate} canUpdate={canAccess('catalogWrite')} canReadProducts={hasPermission('products.read')} />; break
    case 'brands-list':
      screen = <BrandListScreen navigate={navigate} canUpdate={canAccess('catalogWrite')} />; break
    case 'brand-create':
      screen = <BrandDetailScreen key="brand-create" brandId={null} isCreate navigate={navigate} canUpdate={canAccess('catalogWrite')} />; break
    case 'brand-detail':
      screen = <BrandDetailScreen key={route.brandId} brandId={route.brandId} navigate={navigate} canUpdate={canAccess('catalogWrite')} />; break
    case 'content-list':
      screen = <ContentListScreen navigate={navigate} canUpdate={canAccess('contentWrite')} />; break
    case 'content-create':
      screen = <ContentDetailScreen key={`content-create:${route.contentType}`} contentType={route.contentType} contentId={null} isCreate navigate={navigate} canUpdate={canAccess('contentWrite')} />; break
    case 'content-detail':
      screen = <ContentDetailScreen key={`content:${route.contentType}:${route.contentId}`} contentType={route.contentType} contentId={route.contentId} navigate={navigate} canUpdate={canAccess('contentWrite')} />; break
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
      screen = <MenuScreen canUpdate={canAccess('menusWrite')} canReadCatalog={hasPermission('catalog.read')} />; break
    case 'sliders':
      screen = <SliderListScreen canUpdate={canAccess('slidersWrite')} canFullEdit={canAccess('slidersFullEdit')} />; break
    case 'home-videos':
      screen = <HomeVideoListScreen canUpdate={hasPermission('home_videos.write')} />; break
    case 'home-highlights':
      screen = <HomeHighlightsScreen canUpdate={canAccess('homeHighlightsWrite')} />; break
    case 'redirects':
      screen = <RedirectListScreen canUpdate={hasPermission('redirects.write')} />; break
    case 'reviews':
      screen = <ReviewListScreen navigate={navigate} canUpdate={hasPermission('reviews.write')} isSuperAdmin={userRoles.includes('SUPER_ADMIN')} />; break
    case 'review-detail':
      screen = <ReviewDetailScreen reviewId={route.reviewId} navigate={navigate} canUpdate={hasPermission('reviews.write')} isSuperAdmin={userRoles.includes('SUPER_ADMIN')} />; break
    case 'admin-users':
      screen = <AdminUsersScreen canUpdate={canAccess('adminUsersWrite')} canReadRoles={hasPermission('roles.read')} canAssignRoles={canAccess('adminUsersAssignRole')} isSuperAdmin={hasPermission('*')} currentUserId={authState.user?.id} />; break
    case 'settings':
      screen = <SettingsScreen canUpdate={hasPermission('settings.write')} isSuperAdmin={hasPermission('*')} navigate={navigate} />; break
    case 'audit-logs':
      screen = <AuditLogListScreen />; break
    case 'reports':
      screen = <ReportsScreen />; break
    case 'roles':
      screen = <RolesScreen canUpdate={hasPermission('roles.write')} currentUserRoles={authState.user?.roles} />; break
    case 'featured-products':
      screen = <FeaturedProductsScreen canUpdate={canAccess('featuredProducts')} />; break
    default:
      screen = <StatePanel tone="neutral" title={t('app.moduleNotAvailable')} description={t('app.moduleNotAvailableDesc')} />
  }

  return (
    <AdminShell navGroups={visibleNavGroups} activePath={activePath} navigate={navigate} user={authState.user} pageTitle={activePageLabel} homePath={fallbackPath}>
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
