import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardScreen } from './DashboardScreen'
import viLocale from '../locales/vi.json'
import enLocale from '../locales/en.json'

const mocks = vi.hoisted(() => ({
  fetchDashboardSummary: vi.fn(),
  fetchInventorySummary: vi.fn(),
  subscribeAdminWs: vi.fn(),
  navigate: vi.fn(),
  permissions: ['inventory.read', 'products.read', 'reports.read'],
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      if (key === 'dashboard.kpi.trendUp') return `trend ${values.value}`
      if (key === 'dashboard.kpi.trendDown') return `trend -${values.value}`
      return values.defaultValue ?? key
    },
    i18n: { language: 'vi' },
  }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchDashboardSummary: mocks.fetchDashboardSummary,
  fetchInventorySummary: mocks.fetchInventorySummary,
}))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Nguyễn Minh', permissions: mocks.permissions } }),
}))
vi.mock('../lib/useRecentItems', () => ({
  useRecentItems: () => [],
}))
vi.mock('../lib/adminWebSocket', () => ({
  subscribeAdminWs: mocks.subscribeAdminWs,
}))
vi.mock('./dashboard/charts', () => ({
  RevenueAreaChart: ({ revenueData }) => (
    <div data-testid="revenue-chart">{revenueData.length} points</div>
  ),
  OrderStatusPie: ({ pieDataWithTotal }) => (
    <div data-testid="status-chart">
      {pieDataWithTotal.map((item) => `${item.status}:${item.count}`).join('|')}
    </div>
  ),
}))
vi.mock('../components/RecentItemsChips', () => ({
  RecentItemsChips: () => null,
}))
vi.mock('../components/StatePanel', () => ({
  StatePanel: ({ title, description, actionLabel, onAction }) => (
    <div>
      {title ? <span>{title}</span> : null}
      {description ? <span>{description}</span> : null}
      {actionLabel ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
    </div>
  ),
}))

const BASE_DASHBOARD = {
  kpi: {
    todayRevenue: 1_000_000,
    todayPaidRevenue: 800_000,
    todayRevenuePct: 12.3456,
    todayOrders: 3,
    todayOrdersDelta: 1,
    pendingOrders: 2,
    activeProducts: 10,
  },
  revenueData: [],
  orderStatusBreakdown: [],
  recentOrders: [],
  topProducts: [],
}

function renderScreen(client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })) {
  const result = render(
    <QueryClientProvider client={client}>
      <DashboardScreen navigate={mocks.navigate} />
    </QueryClientProvider>,
  )
  return { ...result, client }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = ['inventory.read', 'products.read', 'reports.read']
  mocks.fetchDashboardSummary.mockResolvedValue({ data: BASE_DASHBOARD })
  mocks.fetchInventorySummary.mockResolvedValue({
    totalItems: 10,
    inStockCount: 10,
    outOfStockCount: 0,
  })
  mocks.subscribeAdminWs.mockReturnValue(() => {})
})

it('does not fetch or subscribe to inventory without inventory.read', async () => {
  mocks.permissions = ['orders.read']
  renderScreen()

  expect(await screen.findByText('dashboard.kpi.todayRevenue')).toBeInTheDocument()
  expect(mocks.fetchInventorySummary).not.toHaveBeenCalled()
  expect(mocks.subscribeAdminWs).not.toHaveBeenCalledWith('/topic/admin/inventory', expect.any(Function))
  expect(screen.queryByRole('button', { name: 'dashboard.kpi.activeProductsAria' })).not.toBeInTheDocument()
})

describe('DashboardScreen', () => {
  it('opens the pending-order KPI with the matching status filter', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'dashboard.kpi.pendingOrdersAria' }))

    expect(mocks.navigate).toHaveBeenCalledWith('/admin/orders?orderStatus=PENDING')
  })

  it('opens the active-product KPI with the published filter', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'dashboard.kpi.activeProductsAria' }))

    expect(mocks.navigate).toHaveBeenCalledWith('/admin/products?publishStatus=PUBLISHED')
  })

  it('does not claim everything is clear while inventory is still loading', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue({
      data: { ...BASE_DASHBOARD, kpi: { ...BASE_DASHBOARD.kpi, pendingOrders: 0 } },
    })
    mocks.fetchInventorySummary.mockReturnValue(new Promise(() => {}))
    renderScreen()

    expect(await screen.findByText('dashboard.kpi.todayRevenue')).toBeInTheDocument()
    expect(screen.queryByText('dashboard.attention.empty')).not.toBeInTheDocument()
  })

  it('shows an inventory warning without a false all-clear message when that request fails', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue({
      data: { ...BASE_DASHBOARD, kpi: { ...BASE_DASHBOARD.kpi, pendingOrders: 0 } },
    })
    mocks.fetchInventorySummary.mockRejectedValue(new Error('offline'))
    renderScreen()

    expect(await screen.findByText('dashboard.attention.inventoryWarn')).toBeInTheDocument()
    expect(screen.queryByText('dashboard.attention.empty')).not.toBeInTheDocument()
  })

  it('does not retry a forbidden inventory request until permission is restored', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 })
    mocks.fetchInventorySummary.mockRejectedValue(forbidden)

    renderScreen()

    expect(await screen.findByText('dashboard.attention.inventoryWarn')).toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchInventorySummary).toHaveBeenCalledTimes(1))
  })

  it('keeps cached inventory visible without showing a warning when a background refetch fails', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 } },
    })
    client.setQueryData(
      ['inventory-summary'],
      { totalItems: 10, inStockCount: 6, outOfStockCount: 4 },
      { updatedAt: 0 },
    )
    mocks.fetchInventorySummary.mockRejectedValue(new Error('offline'))

    renderScreen(client)

    expect(await screen.findByText('dashboard.attention.outOfStock.label')).toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchInventorySummary).toHaveBeenCalled())
    expect(screen.getByText('dashboard.attention.outOfStock.label')).toBeInTheDocument()
    expect(screen.queryByText('dashboard.attention.inventoryWarn')).not.toBeInTheDocument()
  })

  it('does not flash the inventory warning when returning with cached dashboard data', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 60_000 } },
    })
    mocks.fetchDashboardSummary.mockResolvedValue({
      data: { ...BASE_DASHBOARD, kpi: { ...BASE_DASHBOARD.kpi, pendingOrders: 0 } },
    })
    const firstRender = renderScreen(client)
    expect(await screen.findByText('dashboard.attention.empty')).toBeInTheDocument()
    firstRender.unmount()

    client.setQueryData(
      ['inventory-summary'],
      { totalItems: 10, inStockCount: 10, outOfStockCount: 0 },
      { updatedAt: 0 },
    )
    mocks.fetchInventorySummary.mockRejectedValue(new Error('offline'))
    renderScreen(client)

    expect(screen.queryByText('dashboard.attention.inventoryWarn')).not.toBeInTheDocument()
    await waitFor(() => expect(mocks.fetchInventorySummary).toHaveBeenCalled())
    expect(await screen.findByText('dashboard.attention.empty')).toBeInTheDocument()
  })

  it('handles malformed optional list sections as empty states instead of crashing', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue({
      data: {
        ...BASE_DASHBOARD,
        revenueData: {},
        orderStatusBreakdown: {},
        recentOrders: {},
        topProducts: {},
      },
    })
    renderScreen()

    expect(await screen.findByText('dashboard.revenueChart.empty')).toBeInTheDocument()
    expect(screen.getByText('dashboard.orderStatusChart.empty')).toBeInTheDocument()
    expect(screen.getByText('dashboard.recentOrders.empty')).toBeInTheDocument()
    expect(screen.getByText('dashboard.topProducts.empty')).toBeInTheDocument()
  })

  it('keeps an all-zero revenue series visible and explains that it is valid data', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue({
      data: {
        ...BASE_DASHBOARD,
        revenueData: [
          { date: '2026-07-29', revenue: 0, orders: 0 },
          { date: '2026-07-30', revenue: 0, orders: 0 },
        ],
      },
    })
    renderScreen()

    expect(await screen.findByTestId('revenue-chart')).toHaveTextContent('2 points')
    expect(screen.getByText('dashboard.revenueChart.allZeroNote')).toBeInTheDocument()
    expect(screen.queryByText('dashboard.revenueChart.empty')).not.toBeInTheDocument()
  })

  it('sorts order statuses by share and marks the largest group', async () => {
    mocks.fetchDashboardSummary.mockResolvedValue({
      data: {
        ...BASE_DASHBOARD,
        orderStatusBreakdown: [
          { status: 'PENDING', count: 2 },
          { status: 'COMPLETED', count: 8 },
          { status: 'CANCELLED', count: 1 },
        ],
      },
    })
    renderScreen()

    expect(await screen.findByTestId('status-chart')).toHaveTextContent(
      'COMPLETED:8|PENDING:2|CANCELLED:1',
    )
    expect(screen.getByText('dashboard.orderStatusChart.dominant')).toBeInTheDocument()
  })

  it('rounds the revenue trend to one decimal in the selected language', async () => {
    renderScreen()

    expect(await screen.findByText('trend 12,3')).toBeInTheDocument()
  })

  it('reloads the dashboard with the selected period', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'dashboard.period7d' }))

    await waitFor(() => expect(mocks.fetchDashboardSummary).toHaveBeenCalledWith('7d'))
  })

  it('uses contract-accurate KPI and empty-state copy in both languages', () => {
    expect(viLocale.dashboard.kpi.todayPaid).toBe('Đơn hoàn tất: {{amount}}')
    expect(enLocale.dashboard.kpi.todayPaid).toBe('Completed orders: {{amount}}')
    expect(enLocale.dashboard.kpi.todayOrdersHint).toBe('Cancelled orders excluded')
    expect(enLocale.dashboard.kpi.activeProductsHint).toBe('Published products')
    expect(viLocale.dashboard.topProducts.emptyDesc).toContain('đơn hàng hợp lệ')
    expect(enLocale.dashboard.topProducts.emptyDesc).toContain('valid orders')
    expect(viLocale.dashboard.revenueChart.title).toBe('Xu hướng doanh thu theo ngày')
    expect(viLocale.dashboard.orderStatusChart.title).toBe('Cơ cấu đơn hàng theo trạng thái')
    expect(viLocale.dashboard.revenueChart.subtitle).toContain('{{period}} gần nhất')
    expect(enLocale.dashboard.orderStatusChart.subtitle).toContain('{{period}}')
  })
})
