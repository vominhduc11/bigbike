import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

const mocks = vi.hoisted(() => ({
  authState: {
    status: 'authenticated',
    user: { roles: ['CUSTOM'], permissions: [] },
  },
  featuredScreenRenderCount: 0,
  featuredScreenProps: null,
  statePanelAction: null,
  accessSubscriptionHandler: null,
  reconcileAccess: vi.fn().mockResolvedValue(false),
  invalidateSession: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue || key,
  }),
}))

vi.mock('./lib/auth', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    ...mocks.authState,
    reconcileAccess: mocks.reconcileAccess,
    invalidateSession: mocks.invalidateSession,
  }),
}))

vi.mock('./components/AdminShell', () => ({
  AdminShell: ({ navGroups, children }) => (
    <div data-testid="admin-shell">
      <nav>
        {navGroups.flatMap((group) => group.items).map((item) => (
          <a key={item.path} data-testid={`nav-${item.path}`} href={item.path}>{item.label}</a>
        ))}
      </nav>
      {children}
    </div>
  ),
}))

vi.mock('./components/StatePanel', () => ({
  StatePanel: ({ title, description, actionLabel, onAction }) => {
    mocks.statePanelAction = onAction || null
    return (
      <div data-testid="state-panel">
        <div data-testid="state-title">{title}</div>
        <div data-testid="state-description">{description}</div>
        {actionLabel && <button type="button" onClick={onAction}>{actionLabel}</button>}
      </div>
    )
  },
}))

vi.mock('./screens/FeaturedProductsScreen', () => ({
  FeaturedProductsScreen: (props) => {
    mocks.featuredScreenRenderCount += 1
    mocks.featuredScreenProps = props
    return <div data-testid="featured-screen">featured products</div>
  },
}))

vi.mock('./screens/ProductListScreen', () => ({
  ProductListScreen: () => <div data-testid="products-screen">products</div>,
}))

vi.mock('./screens/ProductDetailScreen', () => ({
  ProductDetailScreen: () => <div data-testid="product-detail-screen">product detail</div>,
}))

vi.mock('./screens/DashboardScreen', () => ({
  DashboardScreen: () => <div data-testid="dashboard-screen">dashboard</div>,
}))

vi.mock('./screens/LoginScreen', () => ({
  LoginScreen: () => <div data-testid="login-screen">login</div>,
}))

vi.mock('./lib/adminWebSocket', () => ({
  connectAdminWs: vi.fn(),
  disconnectAdminWs: vi.fn(),
  setWsAuthRejectedCallback: vi.fn(),
  setWsReconnectCallback: vi.fn(),
  subscribeAdminWs: vi.fn((destination, handler) => {
    if (destination === '/user/queue/admin/access') mocks.accessSubscriptionHandler = handler
    return () => { if (mocks.accessSubscriptionHandler === handler) mocks.accessSubscriptionHandler = null }
  }),
}))

vi.mock('./lib/authStorage', () => ({
  readTokens: () => ({ accessToken: 'test-token' }),
}))

vi.mock('./lib/navigationGuard', () => ({
  confirmNavigation: () => true,
}))

function renderFeaturedProductsApp(permissions, roles = ['CUSTOM']) {
  window.history.replaceState({}, '', '/admin/featured-products')
  mocks.authState = {
    status: 'authenticated',
    user: { roles, permissions },
  }
  return render(<App />)
}

beforeEach(() => {
  mocks.featuredScreenRenderCount = 0
  mocks.featuredScreenProps = null
  mocks.statePanelAction = null
  mocks.accessSubscriptionHandler = null
  mocks.reconcileAccess.mockClear()
  mocks.invalidateSession.mockClear()
})

describe('featured-products permission boundary', () => {
  it('with only products.read keeps Products visible and redirects away from a withdrawn Featured Products route', async () => {
    renderFeaturedProductsApp(['products.read'])

    expect(screen.getByTestId('nav-/admin/products')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-/admin/featured-products')).not.toBeInTheDocument()
    expect(await screen.findByTestId('products-screen')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/products')
    expect(mocks.featuredScreenRenderCount).toBe(0)
  })

  it('with only products.update hides and blocks Featured Products before mount', async () => {
    renderFeaturedProductsApp(['products.update'])

    expect(screen.queryByTestId('nav-/admin/featured-products')).not.toBeInTheDocument()
    expect(await screen.findByTestId('state-panel')).toBeInTheDocument()
    expect(screen.getByTestId('state-description')).toHaveTextContent('Tài khoản chưa được cấp quyền cần thiết để xem khu vực này')
    expect(mocks.featuredScreenRenderCount).toBe(0)
  })

  it('uses an allowed fallback automatically instead of leaving a hidden Featured Products route open', async () => {
    renderFeaturedProductsApp(['products.read'])

    await screen.findByTestId('products-screen')
    await waitFor(() => expect(window.location.pathname).toBe('/admin/products'))
    expect(window.location.pathname).not.toBe('/admin/featured-products')
  })

  it('with both permissions mounts Featured Products with update actions enabled', async () => {
    renderFeaturedProductsApp(['products.read', 'products.update'])

    expect(screen.getByTestId('nav-/admin/featured-products')).toBeInTheDocument()
    expect(await screen.findByTestId('featured-screen')).toBeInTheDocument()
    expect(mocks.featuredScreenProps).toMatchObject({ canUpdate: true })
  })
})

describe('default product-management roles', () => {
  it.each([
    ['ADMIN', ['products.read', 'products.update']],
    ['SHOP_MANAGER', ['products.read', 'products.update']],
  ])('%s can open Featured Products with both product permissions', async (role, permissions) => {
    renderFeaturedProductsApp(permissions, [role])

    expect(screen.getByTestId('nav-/admin/featured-products')).toBeInTheDocument()
    expect(await screen.findByTestId('featured-screen')).toBeInTheDocument()
    expect(mocks.featuredScreenProps).toMatchObject({ canUpdate: true })
  })
})

describe('central route and fallback policy', () => {
  it('allows a custom role with orders.read to open Dashboard', async () => {
    window.history.replaceState({}, '', '/admin/dashboard')
    mocks.authState = {
      status: 'authenticated',
      user: { roles: ['CUSTOM_OPERATIONS'], permissions: ['orders.read'] },
    }

    render(<App />)

    expect(screen.getByTestId('nav-/admin/dashboard')).toBeInTheDocument()
    expect(await screen.findByTestId('dashboard-screen')).toBeInTheDocument()
  })

  it('redirects root to the first genuinely accessible module', async () => {
    window.history.replaceState({}, '', '/admin')
    mocks.authState = {
      status: 'authenticated',
      user: { roles: ['CUSTOM_PRODUCTS'], permissions: ['products.read'] },
    }

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/admin/products'))
    expect(await screen.findByTestId('products-screen')).toBeInTheDocument()
  })

  it('shows a clear empty-permission state without a fake Dashboard action', async () => {
    window.history.replaceState({}, '', '/admin')
    mocks.authState = {
      status: 'authenticated',
      user: { roles: ['EMPTY'], permissions: [] },
    }

    render(<App />)

    expect(await screen.findByText('Tài khoản chưa được cấp quyền sử dụng khu vực nào')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin')
  })

  it('requires products.read, products.update and catalog.read before mounting create', async () => {
    window.history.replaceState({}, '', '/admin/products/new')
    mocks.authState = {
      status: 'authenticated',
      user: { roles: ['CUSTOM'], permissions: ['products.read', 'products.update'] },
    }

    render(<App />)

    expect(await screen.findByTestId('state-description')).toHaveTextContent('Tài khoản chưa được cấp quyền cần thiết để xem khu vực này')
    expect(screen.queryByTestId('product-detail-screen')).not.toBeInTheDocument()
  })
})

describe('admin access-change signal', () => {
  it('refreshes the canonical profile when an existing session receives a permission change', async () => {
    renderFeaturedProductsApp(['products.read', 'products.update'])

    await screen.findByTestId('featured-screen')
    await waitFor(() => expect(mocks.accessSubscriptionHandler).toBeTypeOf('function'))
    mocks.accessSubscriptionHandler({ reason: 'ROLE_CHANGED', forceReauthentication: false })

    expect(mocks.reconcileAccess).toHaveBeenCalled()
  })

  it('clears the local session path when the server forces reauthentication', async () => {
    renderFeaturedProductsApp(['products.read', 'products.update'])

    await screen.findByTestId('featured-screen')
    await waitFor(() => expect(mocks.accessSubscriptionHandler).toBeTypeOf('function'))
    mocks.accessSubscriptionHandler({ reason: 'DISABLED', forceReauthentication: true })

    expect(mocks.invalidateSession).toHaveBeenCalledWith({ broadcast: true })
  })
})
