import { Children, isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomerListScreen } from './CustomerListScreen'
import { normalizeCustomer } from '../lib/contracts'
import viMessages from '../locales/vi.json'
import enMessages from '../locales/en.json'

const mocks = vi.hoisted(() => ({
  fetchCustomers: vi.fn(),
  fetchCustomerSummary: vi.fn(),
  updateCustomerStatus: vi.fn(),
  exportCustomersCsv: vi.fn(),
  hasPermission: vi.fn(() => false),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
    i18n: { language: 'vi' },
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchCustomers: mocks.fetchCustomers,
  fetchCustomerSummary: mocks.fetchCustomerSummary,
  updateCustomerStatus: mocks.updateCustomerStatus,
  exportCustomersCsv: mocks.exportCustomersCsv,
}))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('@/lib/auth', () => ({ useHasPermission: () => mocks.hasPermission }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns }) => (
    <div data-testid="customer-table">
      {rows.map((row) => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          {columns.map((column) => <div key={column.key}>{column.render ? column.render(row) : row[column.key]}</div>)}
        </div>
      ))}
    </div>
  ),
}))

// Radix Select cần hasPointerCapture/scrollIntoView — jsdom không có, polyfill tối thiểu
// (cùng cách BrandDetailScreen.test.jsx polyfill ResizeObserver cho Radix Checkbox).
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

// Thay Radix Select bằng <select> gốc — giữ đúng hợp đồng value/onValueChange/disabled,
// bỏ qua chi tiết hiển thị (SelectTrigger/SelectValue) để test tương tác ổn định trong
// jsdom. aria-label được "kéo" từ SelectTrigger con lên <select> để có thể query theo tên.
function extractAriaLabel(children) {
  let label
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.props?.['aria-label']) label = child.props['aria-label']
  })
  return label
}
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }) => (
    <select
      aria-label={extractAriaLabel(children)}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}))

const realCustomer = {
  id: 'cust-real-1',
  fullName: 'Nguyen Van A',
  email: 'a@bigbike.test',
  phone: '0900000001',
  status: 'DISABLED',
  isSynthetic: false,
  orderCount: 5,
  totalSpent: 500000,
  createdAt: '2026-07-01T00:00:00Z',
}
const syntheticCustomer = {
  id: 'cust-synth-1',
  fullName: 'Tran Thi B',
  email: 'b@bigbike.test',
  phone: '0900000002',
  status: 'ACTIVE',
  isSynthetic: true,
  orderCount: 3,
  totalSpent: 200000,
  createdAt: '2026-06-01T00:00:00Z',
}

function renderScreen(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <CustomerListScreen navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/customers')
  mocks.fetchCustomers.mockResolvedValue({
    items: [realCustomer, syntheticCustomer],
    pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
  })
  mocks.fetchCustomerSummary.mockResolvedValue({ total: 2, vip: 0, newLast30Days: 1, active: 1 })
  mocks.updateCustomerStatus.mockResolvedValue({ item: { ...realCustomer, status: 'ACTIVE' } })
  mocks.exportCustomersCsv.mockResolvedValue({ filename: 'customers.csv' })
  mocks.hasPermission.mockReturnValue(false)
})

describe('CustomerListScreen', () => {
  it('hiển thị danh sách khách hàng và số liệu KPI tổng quan', async () => {
    renderScreen()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('Tran Thi B')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // KPI total
  })

  it('thẻ KPI đang hoạt động lọc đúng tài khoản đăng ký, không lẫn hồ sơ từ đơn hàng', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    await user.click(screen.getByRole('button', { name: 'customers.kpi.activeFilterAria' }))

    await waitFor(() => expect(mocks.fetchCustomers).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ACTIVE', synthetic: 'false' }),
    ))
  })

  it('lọc theo nguồn khách hàng gửi đúng tham số synthetic cho fetchCustomers', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const sourceSelect = document.querySelector('select[aria-label="customers.filterSource"]')
    await user.selectOptions(sourceSelect, 'true')

    await waitFor(() => expect(mocks.fetchCustomers).toHaveBeenLastCalledWith(
      expect.objectContaining({ synthetic: 'true' }),
    ))
  })

  it('lọc theo xác thực email gửi đúng tham số emailVerified cho fetchCustomers', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const verificationSelect = document.querySelector('select[aria-label="customers.filterEmailVerified"]')
    await user.selectOptions(verificationSelect, 'true')

    await waitFor(() => expect(mocks.fetchCustomers).toHaveBeenLastCalledWith(
      expect.objectContaining({ emailVerified: 'true' }),
    ))
  })

  it('đổi trạng thái sang ACTIVE gọi thẳng updateCustomerStatus, không cần lý do', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const row = screen.getByTestId('row-cust-real-1')
    const statusSelect = row.querySelector('select[aria-label="customers.colStatus"]')
    await user.selectOptions(statusSelect, 'ACTIVE')

    await waitFor(() => expect(mocks.updateCustomerStatus).toHaveBeenCalledWith('cust-real-1', 'ACTIVE', undefined))
  })

  it('đổi trạng thái sang BLOCKED mở modal lý do — Hủy không gọi API', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const row = screen.getByTestId('row-cust-real-1')
    const statusSelect = row.querySelector('select[aria-label="customers.colStatus"]')
    await user.selectOptions(statusSelect, 'BLOCKED')

    expect(await screen.findByText('customers.detail.statusConfirmTitle')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.cancel' }))

    expect(mocks.updateCustomerStatus).not.toHaveBeenCalled()
  })

  it('đổi trạng thái sang BLOCKED — Xác nhận kèm lý do gọi updateCustomerStatus với lý do', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const row = screen.getByTestId('row-cust-real-1')
    const statusSelect = row.querySelector('select[aria-label="customers.colStatus"]')
    await user.selectOptions(statusSelect, 'BLOCKED')

    const reasonInput = await screen.findByLabelText('customers.detail.statusReasonLabel')
    expect(reasonInput).toHaveAttribute('maxLength', '1000')
    await user.type(reasonInput, 'Khách báo cáo gian lận')
    await user.click(screen.getByRole('button', { name: 'customers.detail.statusConfirmOk' }))

    await waitFor(() => expect(mocks.updateCustomerStatus).toHaveBeenCalledWith(
      'cust-real-1', 'BLOCKED', 'Khách báo cáo gian lận',
    ))
  })

  it('cho phép chọn PENDING và cảnh báo thu hồi phiên trước khi cập nhật', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const row = screen.getByTestId('row-cust-real-1')
    const statusSelect = row.querySelector('select[aria-label="customers.colStatus"]')
    expect(statusSelect.querySelector('option[value="PENDING"]')).toBeInTheDocument()
    await user.selectOptions(statusSelect, 'PENDING')

    expect(await screen.findByText('customers.detail.statusConfirmBody')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'customers.detail.statusConfirmOk' }))

    await waitFor(() => expect(mocks.updateCustomerStatus).toHaveBeenCalledWith(
      'cust-real-1', 'PENDING', '',
    ))
  })

  it('không cho đổi trạng thái tài khoản tạo từ đơn hàng cũ', async () => {
    renderScreen()
    await screen.findByText('Tran Thi B')

    const row = screen.getByTestId('row-cust-synth-1')
    expect(row.querySelector('select[aria-label="customers.colStatus"]')).not.toBeInTheDocument()
    expect(row).toHaveTextContent('status.customer.ACTIVE')
  })

  it('quyền chỉ đọc ẩn Select đổi trạng thái, chỉ hiện huy hiệu', async () => {
    renderScreen(false)
    await screen.findByText('Nguyen Van A')

    const row = screen.getByTestId('row-cust-real-1')
    expect(row.querySelector('select[aria-label="customers.colStatus"]')).not.toBeInTheDocument()
    expect(screen.getByText('customers.readOnlyHint')).toBeInTheDocument()
  })

  it('dùng email thay tên, không hiển thị chuỗi fallback tiếng Anh khi dữ liệu thiếu', async () => {
    const customer = normalizeCustomer({
      id: 'cust-no-name',
      email: 'missing-name@bigbike.test',
      status: 'ACTIVE',
    })
    mocks.fetchCustomers.mockResolvedValue({
      items: [customer],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })

    renderScreen()

    expect(await screen.findByText('missing-name@bigbike.test')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('nhãn bộ lọc trạng thái ở cả hai ngôn ngữ luôn chứa giá trị đã chọn', () => {
    expect(viMessages.customers.filterChipStatus).toContain('{{value}}')
    expect(enMessages.customers.filterChipStatus).toContain('{{value}}')
  })

  it('copy KPI phân biệt tài khoản đăng ký với hồ sơ tạo từ đơn hàng', () => {
    expect(viMessages.customers.kpi.totalHint).toContain('gồm cả hồ sơ từ đơn hàng')
    expect(viMessages.customers.kpi.new30dHint).toContain('Chỉ tài khoản đăng ký')
    expect(viMessages.customers.kpi.new30dHint).toContain('không tính hồ sơ từ đơn hàng')
    expect(viMessages.customers.kpi.activeHint).toContain('Chỉ tài khoản đăng ký')
    expect(enMessages.customers.kpi.totalHint).toContain('including order-created profiles')
    expect(enMessages.customers.kpi.new30dHint).toContain('Registered accounts only')
    expect(enMessages.customers.kpi.activeHint).toContain('excludes order-created profiles')
  })

  it('xuất CSV với đủ bộ lọc hiện tại và không cảnh báo giới hạn dòng', async () => {
    const user = userEvent.setup()
    mocks.hasPermission.mockImplementation((permission) => permission === 'reports.export')
    mocks.exportCustomersCsv.mockResolvedValue({ filename: 'customers.csv', truncated: true, maxRows: 1 })
    window.history.replaceState(
      {},
      '',
      '/admin/customers?search=Nguyen&status=ACTIVE&synthetic=false&emailVerified=true',
    )

    renderScreen()
    await screen.findByText('Nguyen Van A')
    await user.click(screen.getByRole('button', { name: 'common.exportCsv' }))

    await waitFor(() => expect(mocks.exportCustomersCsv).toHaveBeenCalledWith({
      q: 'Nguyen',
      status: 'ACTIVE',
      synthetic: 'false',
      emailVerified: 'true',
    }))
    expect(mocks.toast.warning).not.toHaveBeenCalled()
  })
})
