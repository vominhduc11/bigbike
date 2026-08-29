import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchChatConversation: vi.fn(),
  fetchChatHandoffs: vi.fn(),
  claimChatHandoff: vi.fn(),
  sendChatStaffMessage: vi.fn(),
  returnChatToAi: vi.fn(),
  closeChatHandoff: vi.fn(),
  fetchAdminChatImageBlob: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ i18n: { resolvedLanguage: 'vi' }, t: (key, values = {}) => values.defaultValue || key }),
}))
vi.mock('../lib/adminApi', () => mocks)
vi.mock('../lib/auth', () => ({ useAuth: () => ({ user: { id: 'admin-1' } }), useHasPermission: () => () => true }))
vi.mock('../lib/adminWebSocket', () => ({ subscribeAdminWs: () => () => {} }))

const { ChatConversationDetailScreen } = await import('./ChatConversationDetailScreen')

const conversation = {
  id: 'conversation-1', locale: 'vi', turnCount: 2, aiCallCount: 1,
  startedAt: '2026-08-29T03:00:00Z', lastMessageAt: '2026-08-29T03:01:00Z', endedReason: null,
  messages: [{ id: 'message-1', role: 'ASSISTANT', content: 'Mẫu này còn hàng.', source: 'AI', createdAt: '2026-08-29T03:01:00Z' }],
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><ChatConversationDetailScreen conversationId="conversation-1" navigate={vi.fn()} /></QueryClientProvider>)
}

describe('ChatConversationDetailScreen', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.fetchChatConversation.mockResolvedValue({ item: conversation })
    mocks.fetchChatHandoffs.mockResolvedValue({ items: [] })
  })

  it('shows the transcript and staff-handoff summary', async () => {
    renderScreen()

    expect(await screen.findByText('Mẫu này còn hàng.')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.detail.sources.ai')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.detail.handoffSummary')).toBeInTheDocument()
    expect(screen.getByTestId('chat-detail-summary').querySelectorAll('dt')).toHaveLength(6)
  })

  it('lets the assigned staff member send a reply, return to AI, or close the handoff', async () => {
    const user = userEvent.setup()
    mocks.fetchChatHandoffs.mockResolvedValue({ items: [{ id: 'handoff-1', conversationId: 'conversation-1', status: 'ACTIVE', assignedAdminId: 'admin-1', assignedDisplayName: 'Minh' }] })
    mocks.sendChatStaffMessage.mockResolvedValue({})
    mocks.returnChatToAi.mockResolvedValue({})
    mocks.closeChatHandoff.mockResolvedValue({})
    renderScreen()

    const input = await screen.findByRole('textbox', { name: 'chatAdmin.detail.live.replyLabel' })
    await user.type(input, 'Em kiểm tra size cho anh/chị ngay ạ.')
    await user.click(screen.getByRole('button', { name: 'chatAdmin.detail.live.send' }))
    expect(mocks.sendChatStaffMessage).toHaveBeenCalledWith('conversation-1', 'Em kiểm tra size cho anh/chị ngay ạ.')
    await user.click(screen.getByRole('button', { name: /chatAdmin.detail.live.returnToAi/ }))
    await user.click(screen.getByRole('button', { name: /chatAdmin.detail.live.close/ }))
    expect(mocks.returnChatToAi).toHaveBeenCalledWith('handoff-1', 'vi')
    expect(mocks.closeChatHandoff).toHaveBeenCalledWith('handoff-1', 'vi')
  })
})
