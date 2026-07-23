import { Children, isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CustomerDetailScreen } from './CustomerDetailScreen'

const mocks = vi.hoisted(() => ({
  fetchCustomerDetail: vi.fn(),
  updateCustomer: vi.fn(),
  updateCustomerStatus: vi.fn(),
  removeCustomerAvatar: vi.fn(),
  mapValidationErrors: vi.fn(() => ({})),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchCustomerDetail: mocks.fetchCustomerDetail,
  updateCustomer: mocks.updateCustomer,
  updateCustomerStatus: mocks.updateCustomerStatus,
  removeCustomerAvatar: mocks.removeCustomerAvatar,
  mapValidationErrors: mocks.mapValidationErrors,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('@/lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))

// Cùng polyfill + mock Select như CustomerListScreen.test.jsx — Radix Select cần
// hasPointerCapture/scrollIntoView, jsdom không có.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
globalThis.ResizeObserver ??= class { observe() {}; unobserve() {}; disconnect() {} }

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

const baseCustomer = {
  id: 'cust-1',
  fullName: 'Nguyen Van A',
  email: 'a@bigbike.test',
  phone: '0900000001',
  status: 'DISABLED',
  isSynthetic: false,
  orderCount: 2,
  totalSpent: 500000,
  avgOrderValue: 250000,
  segment: 'REGULAR',
  createdAt: '2026-07-01T00:00:00Z',
  addresses: [],
  latestOrders: [],
}

function renderScreen({ customer = baseCustomer, canUpdate = true } = {}) {
  mocks.fetchCustomerDetail.mockResolvedValue({ item: customer })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <CustomerDetailScreen customerId={customer.id} navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateCustomerStatus.mockResolvedValue({ item: { ...baseCustomer, status: 'ACTIVE' } })
})

describe('CustomerDetailScreen', () => {
  it('hiện trạng thái đang tải rồi hiện chi tiết khách hàng kèm huy hiệu nguồn tài khoản', async () => {
    renderScreen()

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()
    expect(screen.getByText('customers.sourceReal')).toBeInTheDocument()
  })

  it('hiện huy hiệu "Từ đơn hàng cũ" khi isSynthetic true', async () => {
    renderScreen({ customer: { ...baseCustomer, isSynthetic: true } })

    expect(await screen.findByText('customers.sourceSynthetic')).toBeInTheDocument()
  })

  it('hiện lỗi tải và cho phép Thử lại', async () => {
    mocks.fetchCustomerDetail.mockReset()
    mocks.fetchCustomerDetail.mockRejectedValueOnce(new Error('network down'))
    mocks.fetchCustomerDetail.mockResolvedValueOnce({ item: baseCustomer })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <CustomerDetailScreen customerId="cust-1" navigate={vi.fn()} canUpdate />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('customers.detail.error')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument()
  })

  it('hiện "Không tìm thấy khách hàng" khi API trả về rỗng', async () => {
    mocks.fetchCustomerDetail.mockResolvedValue({ item: null })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CustomerDetailScreen customerId="missing-id" navigate={vi.fn()} canUpdate />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('customers.detail.notFound')).toBeInTheDocument()
  })

  it('đổi trạng thái sang BLOCKED mở modal lý do — Hủy không gọi API', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const statusSelect = document.querySelector('select') // duy nhất 1 Select trong panel trạng thái
    await user.selectOptions(statusSelect, 'BLOCKED')

    expect(await screen.findByText('customers.detail.statusConfirmTitle')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.cancel' }))

    expect(mocks.updateCustomerStatus).not.toHaveBeenCalled()
  })

  it('đổi trạng thái sang BLOCKED — Xác nhận kèm lý do gọi updateCustomerStatus với lý do', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const statusSelect = document.querySelector('select')
    await user.selectOptions(statusSelect, 'BLOCKED')

    const reasonInput = await screen.findByLabelText('customers.detail.statusReasonLabel')
    await user.type(reasonInput, 'Khách báo cáo gian lận')
    await user.click(screen.getByRole('button', { name: 'customers.detail.statusConfirmOk' }))

    await waitFor(() => expect(mocks.updateCustomerStatus).toHaveBeenCalledWith(
      'cust-1', 'BLOCKED', 'Khách báo cáo gian lận',
    ))
  })

  it('mở form Sửa hồ sơ không lỗi, đủ field và lưu được', async () => {
    const user = userEvent.setup()
    mocks.updateCustomer.mockResolvedValue({ item: { ...baseCustomer, firstName: 'A' } })
    renderScreen()
    await screen.findByText('Nguyen Van A')

    await user.click(screen.getByRole('button', { name: 'common.edit' }))

    expect(screen.getByText('customers.detail.fieldDisplayName')).toBeInTheDocument()
    expect(screen.getByText('customers.detail.fieldFirstName')).toBeInTheDocument()
    expect(screen.getByText('customers.detail.fieldLastName')).toBeInTheDocument()
    expect(screen.getByText('customers.detail.fieldEmail')).toBeInTheDocument()
    expect(screen.getByText('customers.detail.fieldPhone')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() => expect(mocks.updateCustomer).toHaveBeenCalled())
  })
})
