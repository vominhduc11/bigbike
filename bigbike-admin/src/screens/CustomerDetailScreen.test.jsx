import { Children, isValidElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
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
  displayName: 'Nguyen Van A',
  firstName: 'Van A',
  lastName: 'Nguyen',
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

  it('tài khoản từ đơn hàng cũ vẫn sửa hồ sơ nhưng không có điều khiển đổi trạng thái', async () => {
    renderScreen({ customer: { ...baseCustomer, isSynthetic: true } })

    expect(await screen.findByText('customers.sourceSynthetic')).toBeInTheDocument()
    expect(document.querySelector('select')).not.toBeInTheDocument()
    expect(screen.getByText('customers.detail.syntheticStatusReadOnly')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeEnabled()
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

  it('hiện trạng thái không tìm thấy thay vì lỗi chung khi API trả 404', async () => {
    const notFoundError = new Error('Customer not found.')
    notFoundError.status = 404
    mocks.fetchCustomerDetail.mockRejectedValue(notFoundError)

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CustomerDetailScreen customerId="missing-id" navigate={vi.fn()} canUpdate />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('customers.detail.notFound')).toBeInTheDocument()
    expect(screen.queryByText('customers.detail.error')).not.toBeInTheDocument()
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

  it('cho phép chuyển sang PENDING sau cảnh báo thu hồi phiên đăng nhập', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('Nguyen Van A')

    const statusSelect = document.querySelector('select')
    expect(statusSelect.querySelector('option[value="PENDING"]')).toBeInTheDocument()
    await user.selectOptions(statusSelect, 'PENDING')

    expect(await screen.findByText('customers.detail.statusConfirmBody')).toBeInTheDocument()
  })

  it('chỉ cho sửa tên hiển thị và số điện thoại; nút Lưu chỉ bật khi có thay đổi', async () => {
    const user = userEvent.setup()
    mocks.updateCustomer.mockResolvedValue({ item: { ...baseCustomer, displayName: 'Nguyen Van B', fullName: 'Nguyen Van B' } })
    renderScreen()
    await screen.findByText('Nguyen Van A')

    // firstName/lastName/email remain visible in the read-only account section.
    expect(screen.getByText('Van A')).toBeInTheDocument()
    expect(screen.getByText('Nguyen')).toBeInTheDocument()
    expect(screen.getAllByText('a@bigbike.test').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'common.edit' }))

    const displayNameInput = screen.getByLabelText('customers.detail.fieldDisplayName')
    expect(screen.getByLabelText('customers.detail.fieldPhone')).toBeInTheDocument()
    expect(screen.queryByLabelText('customers.detail.fieldFirstName')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('customers.detail.fieldLastName')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('customers.detail.fieldEmail')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled()

    await user.clear(displayNameInput)
    await user.type(displayNameInput, 'Nguyen Van B')
    expect(screen.getByRole('button', { name: 'common.save' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'common.save' }))
    await waitFor(() => expect(mocks.updateCustomer).toHaveBeenCalledWith('cust-1', {
      displayName: 'Nguyen Van B',
    }))
  })

  it('gắn lỗi trùng số điện thoại vào đúng ô khi backend trả 409', async () => {
    const user = userEvent.setup()
    const conflict = new Error('Số điện thoại đã được sử dụng.')
    conflict.status = 409
    mocks.updateCustomer.mockRejectedValue(conflict)
    mocks.mapValidationErrors.mockReturnValueOnce({ phone: 'Số điện thoại đã được sử dụng.' })
    renderScreen()
    await screen.findByText('Nguyen Van A')

    await user.click(screen.getByRole('button', { name: 'common.edit' }))
    const phoneInput = screen.getByLabelText('customers.detail.fieldPhone')
    await user.clear(phoneInput)
    await user.type(phoneInput, '0900000002')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Số điện thoại đã được sử dụng.')
    expect(mocks.toast.error).toHaveBeenCalledWith('Số điện thoại đã được sử dụng.')
  })

  it('gửi chuỗi rỗng để xoá số điện thoại theo hợp đồng cập nhật hồ sơ', async () => {
    const user = userEvent.setup()
    mocks.updateCustomer.mockResolvedValue({ item: { ...baseCustomer, phone: undefined } })
    renderScreen()
    await screen.findByText('Nguyen Van A')

    await user.click(screen.getByRole('button', { name: 'common.edit' }))
    await user.clear(screen.getByLabelText('customers.detail.fieldPhone'))
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.updateCustomer).toHaveBeenCalledWith('cust-1', {
      phone: '',
    }))
  })

  it('chấp nhận số điện thoại có dấu phân cách, so sánh theo dạng chuẩn hoá và chỉ gửi trường đã đổi', async () => {
    const user = userEvent.setup()
    mocks.updateCustomer.mockResolvedValue({ item: { ...baseCustomer, phone: '0900000002' } })
    renderScreen()
    await screen.findByText('Nguyen Van A')

    await user.click(screen.getByRole('button', { name: 'common.edit' }))
    const phoneInput = screen.getByLabelText('customers.detail.fieldPhone')
    const saveButton = screen.getByRole('button', { name: 'common.save' })

    await user.clear(phoneInput)
    await user.type(phoneInput, '(090) 000-0001')
    expect(saveButton).toBeDisabled()

    await user.clear(phoneInput)
    await user.type(phoneInput, '+84 (90) 000-0002')
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    await waitFor(() => expect(mocks.updateCustomer).toHaveBeenCalledWith('cust-1', {
      phone: '0900000002',
    }))
  })

  it('khóa mọi thao tác ghi và chặn Ctrl/Cmd+S gửi lặp trong khi đang lưu hồ sơ', async () => {
    const user = userEvent.setup()
    let resolveUpdate
    mocks.updateCustomer.mockImplementationOnce(() => new Promise((resolve) => {
      resolveUpdate = resolve
    }))
    renderScreen({ customer: { ...baseCustomer, avatarUrl: '/media/customer-avatar.jpg' } })
    await screen.findByText('Nguyen Van A')

    await user.click(screen.getByRole('button', { name: 'common.edit' }))
    const displayNameInput = screen.getByLabelText('customers.detail.fieldDisplayName')
    await user.clear(displayNameInput)
    await user.type(displayNameInput, 'Nguyen Van B')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.updateCustomer).toHaveBeenCalledTimes(1))
    expect(document.querySelector('select')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'customers.detail.removeAvatar' })).toBeDisabled()

    await user.keyboard('{Control>}s{/Control}')
    expect(mocks.updateCustomer).toHaveBeenCalledTimes(1)
    expect(mocks.updateCustomerStatus).not.toHaveBeenCalled()
    expect(mocks.removeCustomerAvatar).not.toHaveBeenCalled()

    await act(async () => {
      resolveUpdate({ item: { ...baseCustomer, displayName: 'Nguyen Van B', fullName: 'Nguyen Van B' } })
    })
    expect(await screen.findByRole('button', { name: 'common.edit' })).toBeEnabled()
  })

  it('quyền chỉ đọc khóa sửa hồ sơ và không hiển thị điều khiển đổi trạng thái', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('customers.detail.readOnlyHint')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeDisabled()
    expect(document.querySelector('select')).not.toBeInTheDocument()
  })
})
