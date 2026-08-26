import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchAdminNotifications: vi.fn(),
  markAllAdminNotificationsRead: vi.fn(),
  subscribeAdminWs: vi.fn(),
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
}))

vi.mock('../lib/toast', () => ({ toast: { error: vi.fn() } }))

const { NotificationBell } = await import('./NotificationBell')

describe('NotificationBell chat handoff', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.markAllAdminNotificationsRead.mockResolvedValue({ unreadCount: 0 })
    mocks.subscribeAdminWs.mockReturnValue(() => {})
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
})
