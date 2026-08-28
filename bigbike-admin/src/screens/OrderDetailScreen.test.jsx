import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderDetailScreen } from './OrderDetailScreen'

const mocks = vi.hoisted(() => ({
  fetchOrderAllowedTransitions: vi.fn(),
  fetchOrderAuditTrail: vi.fn(),
  fetchOrderDetail: vi.fn(),
  updateOrderStatus: vi.fn(),
  showConfirm: vi.fn(),
  subscribeAdminWs: vi.fn(() => vi.fn()),
  wsHandlers: new Map(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      const unknownDynamicKeys = new Set([
        'status.paymentMethod.LEGACY_PAY',
        'status.paymentRecord.LEGACY_STATE',
        'orders.audit.action.LEGACY_EVENT',
        'orders.audit.actor.SERVICE',
      ])
      if (unknownDynamicKeys.has(key) && values.defaultValue !== undefined) {
        return values.defaultValue
      }
      if (key === 'orders.audit.transition') return `${values.from} → ${values.to}`
      if (key === 'orders.audit.cancelReason') return `Lý do huỷ: ${values.reason}`
      return key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
    },
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchOrderAllowedTransitions: mocks.fetchOrderAllowedTransitions,
  fetchOrderAuditTrail: mocks.fetchOrderAuditTrail,
  fetchOrderDetail: mocks.fetchOrderDetail,
  updateOrderStatus: mocks.updateOrderStatus,
}))

vi.mock('../lib/adminWebSocket', () => ({
  subscribeAdminWs: mocks.subscribeAdminWs,
}))

vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../lib/useUnsavedChanges', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../lib/useAdminPresence', () => ({
  useAdminPresence: () => ({ activeAdminCount: 0, hasOtherAdmin: false }),
}))

vi.mock('../lib/formatters', () => ({
  formatCurrencyVnd: (value) => value == null ? '—' : `${value} ₫`,
  formatDateTime: (value) => value ? `date:${value}` : '—',
  formatText: (value, fallback = '—') => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
  ),
}))

vi.mock('../components/layout', () => ({
  Screen: ({ children, ...props }) => <main {...props}>{children}</main>,
  ScreenHeader: ({ title, description, actions }) => (
    <header><h1>{title}</h1><div>{description}</div>{actions}</header>
  ),
  Modal: ({ open, title, children }) => open
    ? <section role="dialog" aria-label={title}>{children}</section>
    : null,
  StickyActionBar: ({ ariaLabel, children }) => (
    <div role="toolbar" aria-label={ariaLabel}>{children}</div>
  ),
}))

const baseAddress = {
  fullName: 'Nguyễn Văn A',
  phone: '0900000001',
  addressLine1: '12 Nguyễn Trãi',
  addressLine2: '',
  ward: 'Phường Bến Thành',
  district: 'Quận 1',
  province: 'TP. Hồ Chí Minh',
}

const baseOrder = {
  id: 'order-1',
  orderNumber: 'BB-1001',
  orderStatus: 'PENDING',
  createdAt: '2026-07-25T01:00:00Z',
  placedAt: '2026-07-25T01:00:00Z',
  paymentMethod: 'COD',
  customerName: 'Nguyễn Văn A',
  customerEmail: 'a@bigbike.test',
  customerPhone: '0900000001',
  customerNote: '',
  shippingAddress: baseAddress,
  billingAddress: { ...baseAddress },
  items: [{
    id: 'item-1',
    productName: 'Mũ bảo hiểm LS2',
    variantName: 'Đen / L',
    unitPrice: 1000000,
    quantity: 1,
    lineTotal: 1000000,
    productThumbnailUrl: null,
  }],
  payments: [],
  subtotal: 1000000,
  shippingFee: 30000,
  discount: 0,
  feeAmount: 0,
  taxAmount: 0,
  total: 1030000,
}

function renderScreen({ orderId = 'order-1', canUpdate = true } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  const navigate = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <OrderDetailScreen orderId={orderId} navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { ...view, navigate, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchOrderDetail.mockResolvedValue({ item: baseOrder })
  mocks.fetchOrderAllowedTransitions.mockResolvedValue({
    orderId: baseOrder.id,
    currentStatus: baseOrder.orderStatus,
    transitions: ['PROCESSING', 'CANCELLED'],
  })
  mocks.fetchOrderAuditTrail.mockResolvedValue([])
  mocks.updateOrderStatus.mockResolvedValue({
    item: { ...baseOrder, orderStatus: 'PROCESSING' },
  })
  mocks.showConfirm.mockResolvedValue(true)
  mocks.wsHandlers = new Map()
  mocks.subscribeAdminWs.mockImplementation((_destination, handler) => {
    mocks.wsHandlers.set(_destination, handler)
    return vi.fn()
  })
})

describe('OrderDetailScreen', () => {
  it('hiển thị khung tải trong lúc chờ dữ liệu đơn hàng', () => {
    mocks.fetchOrderDetail.mockReturnValue(new Promise(() => {}))

    const { container } = renderScreen()

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('orders.detail.loading')
    expect(mocks.fetchOrderDetail).toHaveBeenCalledWith('order-1')
  })

  it('hiển thị lỗi tải và cho phép thử lại', async () => {
    mocks.fetchOrderDetail
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ item: baseOrder })
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('orders.detail.loadError')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.retry' }))

    expect(await screen.findByText('BB-1001')).toBeInTheDocument()
    expect(mocks.fetchOrderDetail).toHaveBeenCalledTimes(2)
  })

  it('hiển thị không tìm thấy và quay về danh sách', async () => {
    mocks.fetchOrderDetail.mockResolvedValue({ item: null })
    const user = userEvent.setup()
    const { navigate } = renderScreen({ orderId: 'missing-order' })

    expect(await screen.findByText('orders.detail.notFound')).toBeInTheDocument()
    expect(screen.getByText('ID: missing-order')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.back' }))

    expect(navigate).toHaveBeenCalledWith('/admin/orders')
    expect(mocks.fetchOrderAllowedTransitions).not.toHaveBeenCalled()
  })

  it.each([
    [404, 'orders.detail.notFound'],
    [403, 'orders.detail.loadForbidden'],
  ])('phân biệt lỗi tải ban đầu HTTP %s', async (status, expectedTitle) => {
    mocks.fetchOrderDetail.mockRejectedValue(Object.assign(new Error('Backend message'), { status }))
    const user = userEvent.setup()
    const { navigate } = renderScreen()

    expect(await screen.findByText(expectedTitle)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.back' }))
    expect(navigate).toHaveBeenCalledWith('/admin/orders')
  })

  it('giữ dữ liệu cũ, khoá thao tác và cho thử lại khi làm mới nền thất bại', async () => {
    mocks.fetchOrderDetail
      .mockResolvedValueOnce({ item: baseOrder })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ item: baseOrder })
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('BB-1001')).toBeInTheDocument()
    await act(async () => {
      mocks.wsHandlers.get('/topic/admin/orders')({ orderId: 'order-1' })
    })

    expect(await screen.findByText('orders.detail.refreshError')).toBeInTheDocument()
    expect(screen.getByText('BB-1001')).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: 'orders.detail.actionProcessing' })) {
      expect(button).toBeDisabled()
    }

    await user.click(screen.getByRole('button', { name: 'common.retry' }))
    await waitFor(() => expect(screen.queryByText('orders.detail.refreshError')).not.toBeInTheDocument())
    expect(mocks.fetchOrderDetail).toHaveBeenCalledTimes(3)
  })

  it('hiển thị cảnh báo chỉ xem và không tải hành động chuyển trạng thái', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('BB-1001')).toBeInTheDocument()
    expect(screen.getByText('readOnly.prefix')).toBeInTheDocument()
    expect(screen.getByText('orders.readOnlyWarning')).toBeInTheDocument()
    expect(mocks.fetchOrderAllowedTransitions).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'orders.detail.actionProcessing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'orders.detail.actionCancelled' })).not.toBeInTheDocument()
  })

  it('chỉ hiện chuyển trạng thái backend cho phép và gửi đúng trạng thái được chọn', async () => {
    const user = userEvent.setup()
    renderScreen()

    const processingButtons = await screen.findAllByRole('button', {
      name: 'orders.detail.actionProcessing',
    })
    expect(processingButtons).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'orders.detail.actionCancelled' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'orders.detail.actionCompleted' })).not.toBeInTheDocument()

    await user.click(processingButtons[0])

    await waitFor(() => {
      expect(mocks.updateOrderStatus).toHaveBeenCalledWith('order-1', 'PROCESSING', undefined)
    })
    expect(mocks.showConfirm).not.toHaveBeenCalled()
    expect(mocks.toast.success).toHaveBeenCalledWith('orders.detail.statusUpdated')
  })

  it('tự tải dữ liệu mới sau xung đột trạng thái 409', async () => {
    const user = userEvent.setup()
    mocks.fetchOrderDetail
      .mockResolvedValueOnce({ item: baseOrder })
      .mockResolvedValue({ item: { ...baseOrder, orderStatus: 'PROCESSING' } })
    mocks.fetchOrderAllowedTransitions
      .mockResolvedValueOnce({ transitions: ['PROCESSING', 'CANCELLED'] })
      .mockResolvedValue({ transitions: ['COMPLETED', 'CANCELLED'] })
    mocks.updateOrderStatus.mockRejectedValue(
      Object.assign(new Error('Conflict'), { status: 409 }),
    )
    renderScreen()

    const processingButtons = await screen.findAllByRole('button', {
      name: 'orders.detail.actionProcessing',
    })
    await user.click(processingButtons[0])

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('orders.detail.errorConflict'))
    expect(await screen.findAllByRole('button', {
      name: 'orders.detail.actionCompleted',
    })).toHaveLength(2)
    expect(mocks.fetchOrderDetail.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('quay về danh sách khi cập nhật báo đơn hàng không còn tồn tại', async () => {
    const user = userEvent.setup()
    mocks.updateOrderStatus.mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 }),
    )
    const { navigate } = renderScreen()

    const processingButtons = await screen.findAllByRole('button', {
      name: 'orders.detail.actionProcessing',
    })
    await user.click(processingButtons[0])

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('orders.detail.errorNotFound'))
    expect(navigate).toHaveBeenCalledWith('/admin/orders')
  })

  it('cho phép thử lại khi không tải được danh sách chuyển trạng thái', async () => {
    mocks.fetchOrderAllowedTransitions
      .mockRejectedValueOnce(new Error('transition network down'))
      .mockResolvedValueOnce({
        orderId: baseOrder.id,
        currentStatus: baseOrder.orderStatus,
        transitions: ['PROCESSING'],
      })
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('orders.detail.transitionsLoadError')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'orders.detail.actionCancelled' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.retry' }))

    expect(await screen.findAllByRole('button', {
      name: 'orders.detail.actionProcessing',
    })).toHaveLength(2)
    expect(mocks.fetchOrderAllowedTransitions).toHaveBeenCalledTimes(2)
  })

  it('bắt buộc nhập lý do khi hủy và gửi lý do đã loại khoảng trắng thừa', async () => {
    const user = userEvent.setup()
    mocks.updateOrderStatus.mockResolvedValue({
      item: {
        ...baseOrder,
        orderStatus: 'CANCELLED',
        cancelReason: 'Khách yêu cầu đổi sản phẩm',
      },
    })
    renderScreen()

    const cancelButtons = await screen.findAllByRole('button', {
      name: 'orders.detail.actionCancelled',
    })
    await user.click(cancelButtons[0])

    expect(screen.getByRole('dialog', {
      name: 'orders.detail.confirmCancelTitle',
    })).toBeInTheDocument()
    await user.click(screen.getByRole('button', {
      name: 'orders.detail.confirmCancelTitle',
    }))
    expect(await screen.findByRole('alert')).toHaveTextContent('orders.detail.reasonRequired')
    expect(mocks.updateOrderStatus).not.toHaveBeenCalled()

    await user.type(
      screen.getByLabelText(/orders\.detail\.reasonLabel/),
      '  Khách yêu cầu đổi sản phẩm  ',
    )
    await user.click(screen.getByRole('button', {
      name: 'orders.detail.confirmCancelTitle',
    }))

    await waitFor(() => {
      expect(mocks.updateOrderStatus).toHaveBeenCalledWith(
        'order-1',
        'CANCELLED',
        'Khách yêu cầu đổi sản phẩm',
      )
    })
  })

  it('không hiện hành động khi đơn đã ở trạng thái kết thúc', async () => {
    mocks.fetchOrderDetail.mockResolvedValue({
      item: { ...baseOrder, orderStatus: 'COMPLETED' },
    })
    mocks.fetchOrderAllowedTransitions.mockResolvedValue({
      orderId: baseOrder.id,
      currentStatus: 'COMPLETED',
      transitions: [],
    })
    renderScreen()

    expect(await screen.findByText('orders.detail.noActionQuiet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'orders.detail.actionProcessing' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'orders.detail.actionCompleted' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'orders.detail.actionCancelled' })).not.toBeInTheDocument()
  })

  it('hiển thị nhật ký và dùng nhãn an toàn cho hành động hoặc người thực hiện chưa biết', async () => {
    mocks.fetchOrderAuditTrail.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'ORDER_STATUS_UPDATED',
        actorType: 'ADMIN',
        beforeData: '{"status":"PENDING"}',
        afterData: '{"status":"CANCELLED","cancelReason":"Khách đổi ý"}',
        createdAt: '2026-07-25T02:00:00Z',
        ipAddress: '127.0.0.1',
      },
      {
        id: 'audit-2',
        action: 'LEGACY_EVENT',
        actorType: 'SERVICE',
        createdAt: null,
      },
    ])
    renderScreen()

    expect(await screen.findByText('orders.audit.action.ORDER_STATUS_UPDATED')).toBeInTheDocument()
    expect(screen.getByText(/orders\.audit\.actor\.ADMIN/)).toBeInTheDocument()
    expect(screen.getByText('status.order.PENDING → status.order.CANCELLED')).toBeInTheDocument()
    expect(screen.getByText('Lý do huỷ: Khách đổi ý')).toBeInTheDocument()
    expect(screen.getAllByText('common.unknown')).toHaveLength(2)
    expect(screen.queryByText('orders.audit.action.LEGACY_EVENT')).not.toBeInTheDocument()
    expect(screen.queryByText('orders.audit.actor.SERVICE')).not.toBeInTheDocument()
  })

  it('cho phép thử lại khi nhật ký đơn hàng tải lỗi', async () => {
    mocks.fetchOrderAuditTrail
      .mockRejectedValueOnce(new Error('audit network down'))
      .mockResolvedValueOnce([{
        id: 'audit-1',
        action: 'ORDER_STATUS_UPDATED',
        actorType: 'ADMIN',
      }])
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('orders.audit.error')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'orders.audit.title' }))
    await user.click(screen.getByRole('button', { name: 'common.retry' }))

    expect(await screen.findByText('orders.audit.action.ORDER_STATUS_UPDATED')).toBeInTheDocument()
    expect(mocks.fetchOrderAuditTrail).toHaveBeenCalledTimes(2)
  })

  it('dùng số điện thoại dự phòng và chỉ hiện địa chỉ thanh toán khi khác địa chỉ giao hàng', async () => {
    mocks.fetchOrderDetail.mockResolvedValue({
      item: {
        ...baseOrder,
        customerPhone: '0909999999',
        shippingAddress: {
          ...baseAddress,
          phone: '',
        },
        billingAddress: {
          fullName: 'Trần Thị B',
          phone: '0911111111',
          addressLine1: '25 Lê Lợi',
          addressLine2: '',
          ward: '',
          district: 'Quận Hải Châu',
          province: 'Đà Nẵng',
        },
      },
    })
    renderScreen()

    expect(await screen.findByText('0909999999')).toBeInTheDocument()
    expect(screen.getByText('12 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh')).toBeInTheDocument()
    expect(screen.getByText((_, element) => (
      element.tagName === 'DD'
      && element.textContent.includes('Trần Thị B')
      && element.textContent.includes('25 Lê Lợi, Quận Hải Châu, Đà Nẵng')
    ))).toBeInTheDocument()
  })

  it('không lộ enum thanh toán lạ và có giá trị dự phòng khi dữ liệu thanh toán thiếu', async () => {
    mocks.fetchOrderDetail.mockResolvedValue({
      item: {
        ...baseOrder,
        paymentMethod: 'LEGACY_PAY',
        payments: [
          {
            id: 'payment-1',
            paymentMethod: 'LEGACY_PAY',
            status: 'LEGACY_STATE',
            amount: 1030000,
            paidAt: null,
          },
          {
            id: 'payment-2',
            paymentMethod: null,
            status: null,
            amount: null,
            paidAt: null,
          },
        ],
      },
    })
    renderScreen()

    expect((await screen.findAllByText('common.unknown')).length).toBeGreaterThanOrEqual(7)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('status.paymentMethod.LEGACY_PAY')).not.toBeInTheDocument()
    expect(screen.queryByText('status.paymentRecord.LEGACY_STATE')).not.toBeInTheDocument()
  })

  it('hiển thị trạng thái thanh toán thành công trên cả bảng máy tính và thẻ di động', async () => {
    mocks.fetchOrderDetail.mockResolvedValue({
      item: {
        ...baseOrder,
        payments: [{
          id: 'payment-succeeded',
          paymentMethod: 'BANK_TRANSFER',
          status: 'SUCCEEDED',
          amount: 1030000,
          paidAt: '2026-07-25T02:00:00Z',
        }],
      },
    })

    renderScreen()

    expect(await screen.findAllByText('status.paymentRecord.SUCCEEDED')).toHaveLength(2)
  })
})
