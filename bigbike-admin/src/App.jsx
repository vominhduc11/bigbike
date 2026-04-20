import { useCallback, useEffect, useState } from 'react'
import { AdminShell } from './components/AdminShell'
import { StatePanel } from './components/StatePanel'
import { fetchCurrentAdminUser } from './lib/adminApi'
import { BrandDetailScreen } from './screens/BrandDetailScreen'
import { BrandListScreen } from './screens/BrandListScreen'
import { CategoryDetailScreen } from './screens/CategoryDetailScreen'
import { CategoryListScreen } from './screens/CategoryListScreen'
import { ContentDetailScreen } from './screens/ContentDetailScreen'
import { ContentListScreen } from './screens/ContentListScreen'
import { ProductDetailScreen } from './screens/ProductDetailScreen'
import { ProductListScreen } from './screens/ProductListScreen'

const NAV_ITEMS = [
  { path: '/admin/products', label: 'Products', permission: 'products.read' },
  { path: '/admin/categories', label: 'Categories', permission: 'catalog.read' },
  { path: '/admin/brands', label: 'Brands', permission: 'catalog.read' },
  { path: '/admin/content', label: 'Content', permission: 'content.read' },
]

function normalizePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/'
  }

  const cleaned = pathname.replace(/\/+$/, '')
  return cleaned || '/'
}

function parseRoute(pathname) {
  const normalized = normalizePath(pathname)
  const effectivePath =
    normalized === '/' || normalized === '/admin'
      ? '/admin/products'
      : normalized
  const segments = effectivePath.split('/').filter(Boolean)

  if (segments[0] !== 'admin') {
    return { kind: 'not-found' }
  }

  if (segments[1] === 'products' && segments.length === 2) {
    return { kind: 'screen', name: 'products-list' }
  }

  if (segments[1] === 'products' && segments.length === 3) {
    return { kind: 'screen', name: 'product-detail', productId: segments[2] }
  }

  if (segments[1] === 'categories' && segments.length === 2) {
    return { kind: 'screen', name: 'categories-list' }
  }

  if (segments[1] === 'categories' && segments.length === 3) {
    return { kind: 'screen', name: 'category-detail', categoryId: segments[2] }
  }

  if (segments[1] === 'brands' && segments.length === 2) {
    return { kind: 'screen', name: 'brands-list' }
  }

  if (segments[1] === 'brands' && segments.length === 3) {
    return { kind: 'screen', name: 'brand-detail', brandId: segments[2] }
  }

  if (segments[1] === 'content' && segments.length === 2) {
    return { kind: 'screen', name: 'content-list' }
  }

  if (segments[1] === 'content' && segments.length === 4) {
    return {
      kind: 'screen',
      name: 'content-detail',
      contentType: segments[2],
      contentId: segments[3],
    }
  }

  return { kind: 'not-found' }
}

function routePermission(routeName) {
  switch (routeName) {
    case 'products-list':
    case 'product-detail':
      return 'products.read'
    case 'categories-list':
    case 'category-detail':
    case 'brands-list':
    case 'brand-detail':
      return 'catalog.read'
    case 'content-list':
    case 'content-detail':
      return 'content.read'
    default:
      return ''
  }
}

function firstAllowedPath(hasPermission) {
  const first = NAV_ITEMS.find((item) => hasPermission(item.permission))
  return first ? first.path : '/admin/products'
}

function App() {
  const [pathname, setPathname] = useState(() =>
    normalizePath(window.location.pathname),
  )
  const [authState, setAuthState] = useState({
    status: 'loading',
    user: null,
    mode: 'mock',
    error: '',
  })

  const navigate = useCallback((nextPath, options = {}) => {
    const normalized = normalizePath(nextPath)

    if (normalized === pathname) {
      return
    }

    if (options.replace) {
      window.history.replaceState({}, '', normalized)
    } else {
      window.history.pushState({}, '', normalized)
    }

    setPathname(normalized)
  }, [pathname])

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    let active = true

    fetchCurrentAdminUser()
      .then((response) => {
        if (!active) {
          return
        }

        setAuthState({
          status: 'success',
          user: response.user,
          mode: response.mode,
          error: '',
        })
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setAuthState({
          status: 'error',
          user: null,
          mode: 'mock',
          error: error.message,
        })
      })

    return () => {
      active = false
    }
  }, [])

  const route = parseRoute(pathname)
  const activePath =
    pathname === '/' || pathname === '/admin' ? '/admin/products' : pathname

  if (authState.status === 'loading') {
    return (
      <div className="full-page-state">
        <StatePanel
          tone="info"
          title="Loading admin session"
          description="Resolving current admin user and permissions."
        />
      </div>
    )
  }

  if (authState.status === 'error') {
    return (
      <div className="full-page-state">
        <StatePanel
          tone="danger"
          title="Failed to initialize admin"
          description={authState.error || 'Unknown authentication error.'}
        />
      </div>
    )
  }

  const permissions = new Set(authState.user.permissions || [])
  const hasPermission = (permission) =>
    permissions.has('*') || permissions.has(permission)

  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(item.permission))

  const fallbackPath = firstAllowedPath(hasPermission)

  if (route.kind === 'not-found') {
    return (
      <AdminShell
        navItems={visibleNav}
        activePath={activePath}
        navigate={navigate}
        user={authState.user}
        authMode={authState.mode}
      >
        <StatePanel
          tone="neutral"
          title="Route not found"
          description="Requested admin route is not available in Phase 4D foundation."
          actionLabel="Go to available module"
          onAction={() => navigate(fallbackPath)}
        />
      </AdminShell>
    )
  }

  if (route.kind !== 'screen') {
    return null
  }

  const requiredPermission = routePermission(route.name)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AdminShell
        navItems={visibleNav}
        activePath={activePath}
        navigate={navigate}
        user={authState.user}
        authMode={authState.mode}
      >
        <StatePanel
          tone="warning"
          title="Permission denied"
          description={`Missing permission: ${requiredPermission}`}
          actionLabel="Go to allowed module"
          onAction={() => navigate(fallbackPath)}
        />
      </AdminShell>
    )
  }

  let screen = null
  switch (route.name) {
    case 'products-list':
      screen = <ProductListScreen navigate={navigate} />
      break
    case 'product-detail':
      screen = (
        <ProductDetailScreen
          key={route.productId}
          productId={route.productId}
          navigate={navigate}
          canUpdate={hasPermission('products.update')}
        />
      )
      break
    case 'categories-list':
      screen = <CategoryListScreen navigate={navigate} />
      break
    case 'category-detail':
      screen = (
        <CategoryDetailScreen
          key={route.categoryId}
          categoryId={route.categoryId}
          navigate={navigate}
          canUpdate={hasPermission('catalog.update')}
        />
      )
      break
    case 'brands-list':
      screen = <BrandListScreen navigate={navigate} />
      break
    case 'brand-detail':
      screen = (
        <BrandDetailScreen
          key={route.brandId}
          brandId={route.brandId}
          navigate={navigate}
          canUpdate={hasPermission('catalog.update')}
        />
      )
      break
    case 'content-list':
      screen = <ContentListScreen navigate={navigate} />
      break
    case 'content-detail':
      screen = (
        <ContentDetailScreen
          key={`${route.contentType}:${route.contentId}`}
          contentType={route.contentType}
          contentId={route.contentId}
          navigate={navigate}
          canUpdate={hasPermission('content.update')}
        />
      )
      break
    default:
      screen = (
        <StatePanel
          tone="neutral"
          title="Module not available"
          description="The requested module is outside Phase 4D scope."
        />
      )
  }

  return (
    <AdminShell
      navItems={visibleNav}
      activePath={activePath}
      navigate={navigate}
      user={authState.user}
      authMode={authState.mode}
    >
      {screen}
    </AdminShell>
  )
}

export default App
