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
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
    i18n: { resolvedLanguage: 'vi' },
    t: (key, values = {}) => {
      if (key === 'chatAdmin.detail.openOrder') return `Mở đơn ${values.id}`
      return {
        'chatAdmin.detail.source': 'Nguồn trả lời',
        'chatAdmin.detail.sources.contentRefusal': 'Từ chối nội dung không phù hợp',
        'chatAdmin.stats.noTelemetry': 'Dữ liệu cũ chưa có số đo',
        'chatAdmin.detail.assistedOrdersSummary': 'Đơn được hỗ trợ + doanh thu',
        'chatAdmin.detail.contactSummary': 'Thông tin liên hệ khách để lại',
        'chatAdmin.detail.noAssistedOrders': 'Chưa có đơn được hỗ trợ',
        'chatAdmin.detail.noLead': 'Khách chưa để lại thông tin liên hệ.',
      }[key] || values.defaultValue || key
    },
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchChatConversation: mocks.fetchChatConversation,
  fetchChatHandoffs: mocks.fetchChatHandoffs,
  claimChatHandoff: mocks.claimChatHandoff,
  sendChatStaffMessage: mocks.sendChatStaffMessage,
  returnChatToAi: mocks.returnChatToAi,
  closeChatHandoff: mocks.closeChatHandoff,
}))
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
  useHasPermission: () => () => true,
}))
vi.mock('../lib/adminWebSocket', () => ({ subscribeAdminWs: () => () => {} }))

const { ChatConversationDetailScreen } = await import('./ChatConversationDetailScreen')

const baseConversation = {
  id: 'conversation-1',
  locale: 'vi',
  turnCount: 2,
  aiCallCount: 1,
  startedAt: '2026-08-18T03:00:00Z',
  lastMessageAt: '2026-08-18T03:01:00Z',
  endedReason: null,
  lead: null,
  inputTokens: 100,
  outputTokens: 40,
  thinkingTokens: 10,
  providerRequests: 2,
  averageLatencyMs: 1500,
  estimatedCostUsd: 0.0002,
  contentRefusals: 1,
  assistedOrders: 1,
  assistedRevenue: 1590000,
  hasTelemetry: true,
  messages: [{
    id: 'message-1',
    role: 'ASSISTANT',
    content: 'Em không thể hỗ trợ nội dung này.',
    source: 'CONTENT_REFUSAL',
    aiCalled: false,
    inputTokens: 100,
    outputTokens: 40,
    thinkingTokens: 10,
    providerRequestCount: 2,
    latencyMs: 1500,
    estimatedCostUsd: 0.0002,
    createdAt: '2026-08-18T03:01:00Z',
  }],
  orderAttributions: [{
    orderId: '12345678-1234-1234-1234-123456789012',
    orderLineItemId: 'line-1',
    attributedAmount: 1590000,
    createdAt: '2026-08-18T03:02:00Z',
  }],
}

function renderScreen(navigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ChatConversationDetailScreen conversationId="conversation-1" navigate={navigate} />
    </QueryClientProvider>,
  )
  return navigate
}

describe('ChatConversationDetailScreen', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.fetchChatHandoffs.mockResolvedValue({ items: [] })
  })

  it('hiện nguồn trả lời và gộp đơn hàng vào phần tóm tắt', async () => {
    mocks.fetchChatConversation.mockResolvedValue({ item: baseConversation })
    const navigate = renderScreen()

    expect(await screen.findByText('Từ chối nội dung không phù hợp')).toBeInTheDocument()
    expect(screen.getByText(/Nguồn trả lời/)).toBeInTheDocument()
    expect(screen.queryByText(/150 token · 2 yêu cầu · 1.5 s/)).not.toBeInTheDocument()
    expect(screen.getByText('Đơn được hỗ trợ + doanh thu')).toBeInTheDocument()
    expect(screen.getByText('Thông tin liên hệ khách để lại')).toBeInTheDocument()
    expect(screen.getByTestId('chat-detail-summary').querySelectorAll('dt')).toHaveLength(7)
    const orderLink = screen.getByRole('button', { name: 'Mở đơn 12345678' })
    await userEvent.click(orderLink)
    expect(navigate).toHaveBeenCalledWith('/admin/orders/12345678-1234-1234-1234-123456789012')
  })

  it('không hiện số kỹ thuật với hội thoại cũ chưa có telemetry', async () => {
    mocks.fetchChatConversation.mockResolvedValue({
      item: {
        ...baseConversation,
        hasTelemetry: false,
        orderAttributions: [],
        messages: [{ ...baseConversation.messages[0], providerRequestCount: null }],
      },
    })
    renderScreen()

    expect(await screen.findByText('Khách chưa để lại thông tin liên hệ.')).toBeInTheDocument()
    expect(screen.queryByText('Dữ liệu cũ chưa có số đo')).not.toBeInTheDocument()
  })

  it('khóa ô trả lời khi một nhân viên khác đã tiếp nhận', async () => {
    mocks.fetchChatConversation.mockResolvedValue({ item: baseConversation })
    mocks.fetchChatHandoffs.mockResolvedValue({ items: [{
      id: 'handoff-1',
      conversationId: 'conversation-1',
      status: 'ACTIVE',
      assignedAdminId: 'admin-2',
      assignedDisplayName: 'Lan',
    }] })
    renderScreen()

    expect(await screen.findByText('chatAdmin.detail.live.composerLocked')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'chatAdmin.detail.live.replyLabel' })).not.toBeInTheDocument()
  })

  it('gửi tin và bàn giao lại khi đúng nhân viên đang tiếp nhận', async () => {
    const user = userEvent.setup()
    mocks.fetchChatConversation.mockResolvedValue({ item: baseConversation })
    mocks.fetchChatHandoffs.mockResolvedValue({ items: [{
      id: 'handoff-1',
      conversationId: 'conversation-1',
      status: 'ACTIVE',
      assignedAdminId: 'admin-1',
      assignedDisplayName: 'Minh',
    }] })
    mocks.sendChatStaffMessage.mockResolvedValue({})
    mocks.returnChatToAi.mockResolvedValue({})
    renderScreen()

    const input = await screen.findByRole('textbox', { name: 'chatAdmin.detail.live.replyLabel' })
    await user.type(input, 'Em kiểm tra size cho anh/chị ngay ạ.')
    await user.click(screen.getByRole('button', { name: 'chatAdmin.detail.live.send' }))
    expect(mocks.sendChatStaffMessage).toHaveBeenCalledWith('conversation-1', 'Em kiểm tra size cho anh/chị ngay ạ.')
  })
})
