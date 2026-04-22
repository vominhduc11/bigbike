import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from './components/AdminShell'
import { StatePanel } from './components/StatePanel'
import { AuthProvider, useAuth } from './lib/auth'
import { LoginScreen } from './screens/LoginScreen'
// fetchCurrentAdminUser is now owned by AuthProvider — no direct import here.
import { BrandDetailScreen } from './screens/BrandDetailScreen'
import { BrandListScreen } from './screens/BrandListScreen'
import { CategoryDetailScreen } from './screens/CategoryDetailScreen'
import { CategoryListScreen } from './screens/CategoryListScreen'
import { ContentDetailScreen } from './screens/ContentDetailScreen'
import { ContentListScreen } from './screens/ContentListScreen'
import { CouponListScreen } from './screens/CouponListScreen'
import { CustomerDetailScreen } from './screens/CustomerDetailScreen'
import { CustomerListScreen } from './screens/CustomerListScreen'
import { MediaLibraryScreen } from './screens/MediaLibraryScreen'
import { MenuScreen } from './screens/MenuScreen'
import { OrderDetailScreen } from './screens/OrderDetailScreen'
import { OrderListScreen } from './screens/OrderListScreen'
import { ProductDetailScreen } from './screens/ProductDetailScreen'
import { ProductListScreen } from './screens/ProductListScreen'
import { RedirectListScreen } from './screens/RedirectListScreen'
import { SettingsScreen } from './screens/SettingsScreen'

const NAV_ITEMS = [
  { path: '/admin/products', label: 'Products', permission: 'products.read' },
  { path: '/admin/categories', label: 'Categories', permission: 'catalog.read' },
  { path: '/admin/brands', label: 'Brands', permission: 'catalog.read' },
  { path: '/admin/content', label: 'Content', permission: 'content.read' },
  { path: '/admin/orders', label: 'Orders', permission: 'orders.read' },
  { path: '/admin/customers', label: 'Customers', permission: 'customers.read' },
  { path: '/admin/media', label: 'Media', permission: 'media.read' },
  { path: '/admin/coupons', label: 'Coupons', permission: 'coupons.read' },
  { path: '/admin/redirects', label: 'Redirects', permission: 'redirects.read' },
  { path: '/admin/menus', label: 'Menus', permission: 'menus.read' },
  { path: '/admin/settings', label: 'Settings', permission: 'settings.read' },
]

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/'
  const cleaned = pathname.replace(/\/+$/, '')
  return cleaned || '/'
}

function parseRoute(pathname) {
  const normalized = normalizePath(pathname)
  const effectivePath =
    normalized === '/' || normalized === '/admin' ? '/admin/products' : normalized
  const segments = effectivePath.split('/').filter(Boolean)

  if (segments[0] !== 'admin') return { kind: 'not-found' }

  const [, module, id, sub] = segments

  // ── Catalog ──
  if (module === 'products' && !id) return { kind: 'screen', name: 'products-list' }
  if (module === 'products' && id === 'new') return { kind: 'screen', name: 'product-create' }
  if (module === 'products' && id) return { kind: 'screen', name: 'product-detail', productId: id }
  if (module === 'categories' && !id) return { kind: 'screen', name: 'categories-list' }
  if (module === 'categories' && id === 'new') return { kind: 'screen', name: 'category-create' }
  if (module === 'categories' && id) return { kind: 'screen', name: 'category-detail', categoryId: id }
  if (module === 'brands' && !id) return { kind: 'screen', name: 'brands-list' }
  if (module === 'brands' && id === 'new') return { kind: 'screen', name: 'brand-create' }
  if (module === 'brands' && id) return { kind: 'screen', name: 'brand-detail', brandId: id }

  // ── Content ──
  if (module === 'content' && !id) return { kind: 'screen', name: 'content-list' }
  if (module === 'content' && id && sub === 'new') return { kind: 'screen', name: 'content-create', contentType: id.toUpperCase() === 'PAGES' || id.toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE' }
  if (module === 'content' && id && sub) return { kind: 'screen', name: 'content-detail', contentType: id.toUpperCase() === 'PAGES' || id.toUpperCase() === 'PAGE' ? 'PAGE' : 'ARTICLE', contentId: sub }

  // ── Orders ──
  if (module === 'orders' && !id) return { kind: 'screen', name: 'orders-list' }
  if (module === 'orders' && id) return { kind: 'screen', name: 'order-detail', orderId: id }

  // ── Customers ──
  if (module === 'customers' && !id) return { kind: 'screen', name: 'customers-list' }
  if (module === 'customers' && id) return { kind: 'screen', name: 'customer-detail', customerId: id }

  // ── Other modules ──
  if (module === 'media') return { kind: 'screen', name: 'media-library' }
  if (module === 'coupons') return { kind: 'screen', name: 'coupons-list' }
  if (module === 'redirects') return { kind: 'screen', name: 'redirects-list' }
  if (module === 'menus') return { kind: 'screen', name: 'menus' }
  if (module === 'settings') return { kind: 'screen', name: 'settings' }

  return { kind: 'not-found' }
}

function routePermission(routeName) {
  switch (routeName) {
    case 'products-list': case 'product-detail': return 'products.read'
    case 'product-create': return 'products.update'
    case 'category-create': case 'brand-create': return 'catalog.update'
    case 'categories-list': case 'category-detail': case 'brands-list': case 'brand-detail': return 'catalog.read'
    case 'content-create': return 'content.update'
    case 'content-list': case 'content-detail': return 'content.read'
    case 'orders-list': case 'order-detail': return 'orders.read'
    case 'customers-list': case 'customer-detail': return 'customers.read'
    case 'media-library': return 'media.read'
    case 'coupons-list': return 'coupons.read'
    case 'redirects-list': return 'redirects.read'
    case 'menus': return 'menus.read'
    case 'settings': return 'settings.read'
    default: return ''
  }
}

function firstAllowedPath(hasPermission) {
  const first = NAV_ITEMS.find((item) => hasPermission(item.permission))
  return first ? first.path : '/admin/products'
}

function AdminApp() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname))
  const authState = useAuth()

  const navigate = useCallback((nextPath, options = {}) => {
    const normalized = normalizePath(nextPath)
    if (normalized === pathname) return
    if (options.replace) {
      window.history.replaceState({}, '', normalized)
    } else {
      window.history.pushState({}, '', normalized)
    }
    setPathname(normalized)
  }, [pathname])

  useEffect(() => {
    const handlePopState = () => setPathname(normalizePath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const route = parseRoute(pathname)
  const activePath = pathname === '/' || pathname === '/admin' ? '/admin/products' : pathname

  if (authState.status === 'initializing') {
    return (
      <div className="full-page-state">
        <StatePanel tone="info" title="Loading admin session" description="Resolving current admin user and permissions." />
      </div>
    )
  }

  if (authState.status === 'unauthenticated') {
    return <LoginScreen />
  }

  if (authState.status === 'error') {
    return (
      <div className="full-page-state">
        <StatePanel tone="danger" title="Failed to initialize admin" description={authState.error || 'Unknown authentication error.'} />
      </div>
    )
  }

  const permissions = new Set(authState.user.permissions || [])
  const hasPermission = (permission) => permissions.has('*') || permissions.has(permission)
  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(item.permission))
  const fallbackPath = firstAllowedPath(hasPermission)

  if (route.kind === 'not-found') {
    return (
      <AdminShell navItems={visibleNav} activePath={activePath} navigate={navigate} user={authState.user} authMode={authState.mode}>
        <StatePanel tone="neutral" title="Route not found" description="Requested admin route is not available."
          actionLabel="Go to available module" onAction={() => navigate(fallbackPath)} />
      </AdminShell>
    )
  }

  if (route.kind !== 'screen') return null

  const requiredPermission = routePermission(route.name)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AdminShell navItems={visibleNav} activePath={activePath} navigate={navigate} user={authState.user} authMode={authState.mode}>
        <StatePanel tone="warning" title="Permission denied" description={`Missing permission: ${requiredPermission}`}
          actionLabel="Go to allowed module" onAction={() => navigate(fallbackPath)} />
      </AdminShell>
    )
  }

  let screen = null
  switch (route.name) {
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
      screen = <OrderListScreen navigate={navigate} canUpdate={hasPermission('orders.update')} />; break
    case 'order-detail':
      screen = <OrderDetailScreen key={route.orderId} orderId={route.orderId} navigate={navigate} canUpdate={hasPermission('orders.update')} />; break
    case 'customers-list':
      screen = <CustomerListScreen navigate={navigate} canUpdate={hasPermission('customers.update')} />; break
    case 'customer-detail':
      screen = <CustomerDetailScreen key={route.customerId} customerId={route.customerId} navigate={navigate} canUpdate={hasPermission('customers.update')} />; break
    case 'media-library':
      screen = <MediaLibraryScreen canUpdate={hasPermission('media.update')} />; break
    case 'coupons-list':
      screen = <CouponListScreen canUpdate={hasPermission('coupons.update')} />; break
    case 'redirects-list':
      screen = <RedirectListScreen canUpdate={hasPermission('redirects.update')} />; break
    case 'menus':
      screen = <MenuScreen canUpdate={hasPermission('menus.update')} />; break
    case 'settings':
      screen = <SettingsScreen canUpdate={hasPermission('settings.update')} />; break
    default:
      screen = <StatePanel tone="neutral" title="Module not available" description="The requested module is not in this version." />
  }

  return (
    <AdminShell navItems={visibleNav} activePath={activePath} navigate={navigate} user={authState.user} authMode={authState.mode}>
      {screen}
    </AdminShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AdminApp />
    </AuthProvider>
  )
}
