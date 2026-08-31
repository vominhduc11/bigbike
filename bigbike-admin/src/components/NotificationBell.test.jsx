import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAdminNotifications: vi.fn(),
  markAllAdminNotificationsRead: vi.fn(),
  subscribeAdminWs: vi.fn(),
  registerAdminWsReconnectListener: vi.fn(),
  navigate: vi.fn(),
  permissions: new Set(['orders.read']),
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslation: () => ({
    i18n: { language: 'vi' },
    t: (key) => key,
  }),
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { email: 'orders@bigbike.test' } }),
  useHasPermission: () => (permission) => mocks.permissions.has(permission),
}))

vi.mock('../lib/adminApi', () => ({
  fetchAdminNotifications: mocks.fetchAdminNotifications,
  markAllAdminNotificationsRead: mocks.markAllAdminNotificationsRead,
}))

vi.mock('../lib/adminWebSocket', () => ({
  subscribeAdminWs: mocks.subscribeAdminWs,
  registerAdminWsReconnectListener: mocks.registerAdminWsReconnectListener,
}))

vi.mock('../lib/toast', () => ({ toast: { error: vi.fn() } }))

const { NotificationBell } = await import('./NotificationBell')

function orderNotification(index = 0) {
  return {
    id: `notification-${index}`,
    type: index === 0 ? 'NEW_ORDER' : 'ORDER_UPDATED',
    orderId: `order-${index}`,
    orderNumber: `BB-${index}`,
    customerName: 'Khách BigBike',
    at: Date.now() - index,
    read: false,
  }
}

describe('NotificationBell order notifications', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.permissions.clear()
    mocks.permissions.add('orders.read')
    mocks.markAllAdminNotificationsRead.mockResolvedValue({ unreadCount: 0 })
    mocks.subscribeAdminWs.mockReturnValue(() => {})
    mocks.registerAdminWsReconnectListener.mockReturnValue(() => {})
    mocks.fetchAdminNotifications.mockResolvedValue({
      unreadCount: 1,
      items: [orderNotification()],
    })
  })

  it('lets an inventory-only staff member open both complete digest sections and every long-list row', async () => {
    mocks.permissions.clear()
    mocks.permissions.add('inventory.read')
    const full = Array.from({ length: 80 }, (_, index) => ({
      productId: `full-${index}`,
      nameVi: `Sản phẩm ${index}`,
      nameEn: `Product ${index}`,
      sku: `SKU-${index}`,
      editPath: `/admin/products/full-${index}`,
      outOfStockDays: index,
      outOfStockSinceEstimated: index === 0,
    }))
    const partial = [{
      productId: 'partial-1',
      nameVi: 'Áo giáp còn thiếu cỡ',
      nameEn: 'Armour missing sizes',
      sku: 'PARTIAL-1',
      editPath: '/admin/products/partial-1',
      outOfStockDays: 4,
      outOfStockSinceEstimated: false,
      unavailableVariants: [{
        variantId: 'variant-xl',
        nameVi: 'Đen - XL',
        nameEn: 'Black - XL',
        sku: 'PARTIAL-XL',
        outOfStockDays: 4,
        outOfStockSinceEstimated: false,
      }],
    }]
    mocks.fetchAdminNotifications.mockResolvedValue({
      unreadCount: 1,
      items: [{
        id: 'inventory-digest-1',
        type: 'INVENTORY_OUT_OF_STOCK_DIGEST',
        digest: {
          digestDate: '2026-08-31',
          counts: {
            fullyOutOfStockProducts: 80,
            partiallyOutOfStockProducts: 1,
            unavailableVariants: 1,
          },
          fullyOutOfStock: full,
          partiallyOutOfStock: partial,
        },
        at: Date.now(),
        read: false,
      }],
    })
    const user = userEvent.setup()
    render(<NotificationBell navigate={mocks.navigate} />)

    await waitFor(() => expect(mocks.subscribeAdminWs)
      .toHaveBeenCalledWith('/topic/admin/inventory', expect.any(Function)))
    expect(mocks.subscribeAdminWs).not.toHaveBeenCalledWith('/topic/admin/orders', expect.any(Function))
    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    await user.click(await screen.findByText('notifications.inventoryDigest'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Sản phẩm 0')).toBeInTheDocument()
    expect(within(dialog).getByText('Sản phẩm 79')).toBeInTheDocument()
    expect(within(dialog).getByText('Áo giáp còn thiếu cỡ')).toBeInTheDocument()
    expect(within(dialog).getByText('Đen - XL')).toBeInTheDocument()

    await user.click(within(dialog).getByText('Sản phẩm 79'))
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/products/full-79')
  })

  it('shows order notifications only and opens the order', async () => {
    const user = userEvent.setup()
    render(<NotificationBell navigate={mocks.navigate} />)

    await waitFor(() => expect(mocks.subscribeAdminWs)
      .toHaveBeenCalledWith('/topic/admin/orders', expect.any(Function)))
    expect(mocks.subscribeAdminWs).not.toHaveBeenCalledWith('/topic/admin/chat', expect.any(Function))

    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.newOrder')).toBeInTheDocument()
    expect(screen.getByText(/BB-0/)).toBeInTheDocument()
    expect(screen.queryByText(/waiting for staff|handoff/i)).not.toBeInTheDocument()

    await user.click(screen.getByText('notifications.newOrder'))
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/orders/order-0')
  })

  it('shows one overdue-order digest and opens the operational overdue filter', async () => {
    mocks.fetchAdminNotifications.mockResolvedValue({
      unreadCount: 1,
      items: [{
        id: 'overdue-digest-1',
        type: 'ORDER_OVERDUE_DIGEST',
        count: 2,
        thresholdDays: 2,
        cutoffAt: '2026-08-29T21:20:00Z',
        at: Date.now(),
        read: false,
      }],
    })
    const user = userEvent.setup()
    render(<NotificationBell navigate={mocks.navigate} />)

    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.overdueDigestTitle')).toBeInTheDocument()
    expect(screen.getByText('notifications.overdueDigestDescription')).toBeInTheDocument()

    await user.click(screen.getByText('notifications.overdueDigestTitle'))
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/admin/orders?orderScope=OPERATIONAL&orderStatus=PENDING&attention=OVERDUE',
    )
  })

  it('shows the exact server unread count beyond the 30 displayed rows', async () => {
    mocks.fetchAdminNotifications.mockResolvedValue({
      unreadCount: 42,
      items: Array.from({ length: 30 }, (_, index) => orderNotification(index)),
    })

    render(<NotificationBell navigate={mocks.navigate} />)

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.queryByText('9+')).not.toBeInTheDocument()
  })

  it('keeps cleared notifications gone after a later reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<NotificationBell navigate={mocks.navigate} />)

    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.newOrder')).toBeInTheDocument()
    await user.click(screen.getByText('notifications.clearAll'))
    expect(screen.queryByText('notifications.newOrder')).not.toBeInTheDocument()
    unmount()

    render(<NotificationBell navigate={mocks.navigate} />)
    await waitFor(() => expect(mocks.fetchAdminNotifications).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.empty')).toBeInTheDocument()
  })

  it('reloads the stored order inbox after the realtime connection comes back', async () => {
    render(<NotificationBell navigate={mocks.navigate} />)
    await waitFor(() => expect(mocks.registerAdminWsReconnectListener).toHaveBeenCalled())
    expect(mocks.fetchAdminNotifications).toHaveBeenCalledTimes(1)

    const onReconnect = mocks.registerAdminWsReconnectListener.mock.calls[0][0]
    await act(async () => { await onReconnect() })

    expect(mocks.fetchAdminNotifications).toHaveBeenCalledTimes(2)
  })
})
