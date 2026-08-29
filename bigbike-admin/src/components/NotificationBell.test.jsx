import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAdminNotifications: vi.fn(),
  markAllAdminNotificationsRead: vi.fn(),
  subscribeAdminWs: vi.fn(),
  registerAdminWsReconnectListener: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal()),
  useTranslation: () => ({
    i18n: { language: 'vi' },
    t: (key) => key,
  }),
}))

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { email: 'chat@bigbike.test' } }),
  useHasPermission: () => (permission) => permission === 'chat.read',
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

describe('NotificationBell chat handoff', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.markAllAdminNotificationsRead.mockResolvedValue({ unreadCount: 0 })
    mocks.subscribeAdminWs.mockReturnValue(() => {})
    mocks.registerAdminWsReconnectListener.mockReturnValue(() => {})
    mocks.fetchAdminNotifications.mockResolvedValue({
      unreadCount: 1,
      items: [{
        id: 'notification-1',
        type: 'CHAT_HANDOFF_WAITING',
        handoffId: 'handoff-1',
        conversationId: 'conversation-1',
        questionSummary: 'Size M còn không?',
        customerKind: 'GUEST',
        products: [],
        at: Date.now(),
        read: false,
      }],
    })
  })

  it('shows chat notifications to chat-only staff and opens the waiting conversation', async () => {
    const user = userEvent.setup()
    render(<NotificationBell navigate={mocks.navigate} />)

    await waitFor(() => expect(mocks.subscribeAdminWs)
      .toHaveBeenCalledWith('/topic/admin/chat', expect.any(Function)))
    expect(mocks.subscribeAdminWs).not.toHaveBeenCalledWith('/topic/admin/orders', expect.any(Function))

    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.chatHandoff')).toBeInTheDocument()
    expect(screen.getByText('Size M còn không?')).toBeInTheDocument()

    await user.click(screen.getByText('notifications.chatHandoff'))
    expect(mocks.navigate).toHaveBeenCalledWith('/admin/chat/conversation-1')
  })

  it('shows the exact server unread count beyond the 30 displayed rows', async () => {
    mocks.fetchAdminNotifications.mockResolvedValue({
      unreadCount: 42,
      items: Array.from({ length: 30 }, (_, index) => ({
        id: `notification-${index}`,
        type: 'CHAT_HANDOFF_WAITING',
        handoffId: `handoff-${index}`,
        conversationId: `conversation-${index}`,
        questionSummary: `Câu hỏi ${index}`,
        customerKind: 'GUEST',
        products: [],
        at: Date.now() - index,
        read: false,
      })),
    })

    render(<NotificationBell navigate={mocks.navigate} />)

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.queryByText('9+')).not.toBeInTheDocument()
  })

  it('keeps cleared notifications gone after a later reload', async () => {
    // "Xoá tất cả" chỉ dọn được phía trình duyệt (kho dùng chung mọi admin) — mốc xoá
    // phải chặn đúng phần cũ khi nạp lại, nếu không nút trông như không ăn.
    const user = userEvent.setup()
    const { unmount } = render(<NotificationBell navigate={mocks.navigate} />)

    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.chatHandoff')).toBeInTheDocument()
    await user.click(screen.getByText('notifications.clearAll'))
    expect(screen.queryByText('notifications.chatHandoff')).not.toBeInTheDocument()
    unmount()

    // Tải lại trang: máy chủ vẫn trả đúng thông báo cũ đó.
    render(<NotificationBell navigate={mocks.navigate} />)
    await waitFor(() => expect(mocks.fetchAdminNotifications).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: 'notifications.bellLabel' }))
    expect(await screen.findByText('notifications.empty')).toBeInTheDocument()
    expect(screen.queryByText('notifications.chatHandoff')).not.toBeInTheDocument()
  })

  it('reloads the stored inbox after the realtime connection comes back', async () => {
    // Sự kiện phát ra lúc mất kết nối không được gửi bù → phải nạp lại kho thông báo.
    render(<NotificationBell navigate={mocks.navigate} />)
    await waitFor(() => expect(mocks.registerAdminWsReconnectListener).toHaveBeenCalled())
    expect(mocks.fetchAdminNotifications).toHaveBeenCalledTimes(1)

    const onReconnect = mocks.registerAdminWsReconnectListener.mock.calls[0][0]
    await act(async () => { await onReconnect() })

    expect(mocks.fetchAdminNotifications).toHaveBeenCalledTimes(2)
  })
})
