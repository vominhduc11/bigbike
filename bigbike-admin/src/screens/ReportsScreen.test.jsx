import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportsScreen } from './ReportsScreen'
import viLocale from '../locales/vi.json'
import enLocale from '../locales/en.json'

const mocks = vi.hoisted(() => ({
  fetchAnalytics: vi.fn(),
  exportOrdersCsv: vi.fn(),
  exportCustomersCsv: vi.fn(),
  hasPermission: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => values.defaultValue ?? key,
    i18n: { language: 'vi' },
  }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchAnalytics: mocks.fetchAnalytics,
  exportOrdersCsv: mocks.exportOrdersCsv,
  exportCustomersCsv: mocks.exportCustomersCsv,
}))
vi.mock('../lib/auth', () => ({
  useHasPermission: () => mocks.hasPermission,
}))
vi.mock('@/lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}))
vi.mock('../components/ExportButton', () => ({
  ExportButton: ({ disabled, title, onExport, children }) => (
    <button type="button" disabled={disabled} title={title} onClick={onExport}>
      {children}
    </button>
  ),
}))
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows }) => <div data-testid="rank-table">{rows.length}</div>,
}))
vi.mock('../components/ReadOnlyBanner', () => ({
  ReadOnlyBanner: ({ warning }) => <div role="status">{warning}</div>,
}))
vi.mock('../components/StatePanel', () => ({
  StatePanel: ({ title, description, actionLabel, onAction }) => (
    <div>
      {title ? <span>{title}</span> : null}
      {description ? <span>{description}</span> : null}
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  ),
}))
vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  BarChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

const ANALYTICS = {
  summary: {
    grossOrderValue: 1_000_000,
    paidRevenue: 800_000,
    orderCount: 4,
    avgOrderValue: 250_000,
  },
  dailyRevenue: [],
  topProducts: [],
  topCustomers: [],
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const result = render(
    <QueryClientProvider client={client}>
      <ReportsScreen />
    </QueryClientProvider>,
  )
  return { ...result, client }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/reports')
  mocks.hasPermission.mockImplementation((permission) => permission === 'reports.export')
  mocks.fetchAnalytics.mockResolvedValue({ data: ANALYTICS })
  mocks.exportOrdersCsv.mockResolvedValue({})
  mocks.exportCustomersCsv.mockResolvedValue({})
})

describe('ReportsScreen', () => {
  it('blocks ranges over 90 days and does not offer a retry that would bypass the guardrail', async () => {
    window.history.replaceState(
      {},
      '',
      '/admin/reports?preset=custom&from=2026-01-01&to=2026-07-01',
    )
    renderScreen()

    expect(await screen.findByText('reports.maxRangeError')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.retry' })).not.toBeInTheDocument()
    expect(mocks.fetchAnalytics).not.toHaveBeenCalled()
    expect(screen.getByLabelText('reports.customFrom')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'reports.exportOrders' })).toBeDisabled()
  })

  it('repairs an inverted custom range before fetching', async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      {},
      '',
      '/admin/reports?preset=custom&from=2026-07-10&to=2026-07-01',
    )
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'common.retry' }))

    await waitFor(() =>
      expect(mocks.fetchAnalytics).toHaveBeenCalledWith('2026-07-01', '2026-07-10'),
    )
  })

  it('normalizes an impossible URL date into the designed incomplete-range state', async () => {
    window.history.replaceState(
      {},
      '',
      '/admin/reports?preset=custom&from=2026-02-30&to=2026-03-01',
    )
    renderScreen()

    expect(await screen.findByText('reports.customPendingTitle')).toBeInTheDocument()
    expect(mocks.fetchAnalytics).not.toHaveBeenCalled()
  })

  it('keeps all exports disabled without the export permission', async () => {
    mocks.hasPermission.mockReturnValue(false)
    renderScreen()

    await screen.findByText('reports.kpiGmv')
    expect(screen.getByRole('button', { name: 'reports.exportOrders' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'reports.exportCustomers' })).toBeDisabled()
  })

  it('allows full customer export while a custom analytics range is incomplete', async () => {
    window.history.replaceState({}, '', '/admin/reports?preset=custom&from=2026-07-01')
    renderScreen()

    expect(await screen.findByText('reports.customPendingTitle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'reports.exportOrders' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'reports.exportCustomers' })).toBeEnabled()
  })

  it('exports orders with the exact selected inclusive dates and reports success', async () => {
    const user = userEvent.setup()
    window.history.replaceState(
      {},
      '',
      '/admin/reports?preset=custom&from=2026-07-01&to=2026-07-10',
    )
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'reports.exportOrders' }))

    await waitFor(() =>
      expect(mocks.exportOrdersCsv).toHaveBeenCalledWith({
        from: '2026-07-01',
        to: '2026-07-10',
        orderScope: 'ALL',
      }),
    )
    expect(mocks.toastSuccess).toHaveBeenCalledWith('export.success')
  })

  it('reports an export failure without showing a false success message', async () => {
    const user = userEvent.setup()
    mocks.exportCustomersCsv.mockRejectedValue(new Error('offline'))
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'reports.exportCustomers' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('export.error'))
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('uses metric labels that match the documented completed-order and cancellation rules', () => {
    expect(viLocale.reports.kpiPaidRevenue).toBe('Doanh thu đơn hoàn tất')
    expect(enLocale.reports.kpiPaidRevenue).toBe('Completed-order revenue')
    expect(viLocale.reports.kpiPaidRevenueHint).toContain('không phải số giao dịch thanh toán')
    expect(enLocale.reports.kpiPaidRevenueHint).toContain('not confirmed payment transactions')
    expect(viLocale.reports.kpiOrderCountHint).toContain('không tính đơn đã huỷ')
    expect(enLocale.reports.kpiAovHint).toContain('cancelled orders are excluded')
    expect(viLocale.reports.historyScopeDisclosure).toContain('có tính đơn lịch sử')
    expect(enLocale.reports.historyScopeDisclosure).toContain('includes historical orders')
  })
})
