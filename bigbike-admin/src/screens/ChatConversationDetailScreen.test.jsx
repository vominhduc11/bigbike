import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchChatConversation: vi.fn() }))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      if (key === 'chatAdmin.detail.messageTelemetry') {
        return `${values.tokens} token · ${values.requests} yêu cầu · ${values.latency} · ${values.cost}`
      }
      if (key === 'chatAdmin.detail.openOrder') return `Mở đơn ${values.id}`
      return (
        {
          'chatAdmin.detail.sources.contentRefusal': 'Từ chối nội dung không phù hợp',
          'chatAdmin.stats.noTelemetry': 'Dữ liệu cũ chưa có số đo',
          'chatAdmin.detail.assistedOrders': 'Đơn hàng được trợ lý hỗ trợ',
          'chatAdmin.detail.noLead': 'Khách chưa để lại thông tin liên hệ.',
        }[key] ||
        values.defaultValue ||
        key
      )
    },
  }),
}))

vi.mock('../lib/adminApi', () => ({ fetchChatConversation: mocks.fetchChatConversation }))

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
  messages: [
    {
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
    },
  ],
  orderAttributions: [
    {
      orderId: '12345678-1234-1234-1234-123456789012',
      orderLineItemId: 'line-1',
      attributedAmount: 1590000,
      createdAt: '2026-08-18T03:02:00Z',
    },
  ],
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
  beforeEach(() => mocks.fetchChatConversation.mockReset())

  it('hiện nguồn từ chối, số đo và đơn hàng được trợ lý hỗ trợ', async () => {
    mocks.fetchChatConversation.mockResolvedValue({ item: baseConversation })
    const navigate = renderScreen()

    expect(await screen.findByText('Từ chối nội dung không phù hợp')).toBeInTheDocument()
    expect(screen.getByText(/150 token · 2 yêu cầu · 1.5 s/)).toBeInTheDocument()
    const orderLink = screen.getByRole('button', { name: 'Mở đơn 12345678' })
    await userEvent.click(orderLink)
    expect(navigate).toHaveBeenCalledWith('/admin/orders/12345678-1234-1234-1234-123456789012')
  })

  it('hiện fallback rõ ràng cho hội thoại cũ chưa có telemetry', async () => {
    mocks.fetchChatConversation.mockResolvedValue({
      item: {
        ...baseConversation,
        hasTelemetry: false,
        orderAttributions: [],
        messages: [{ ...baseConversation.messages[0], providerRequestCount: null }],
      },
    })
    renderScreen()

    expect(await screen.findByText('Dữ liệu cũ chưa có số đo')).toBeInTheDocument()
  })
})
