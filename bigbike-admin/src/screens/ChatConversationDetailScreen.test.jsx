import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchChatConversation: vi.fn(),
  fetchAdminChatImageBlob: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'vi' },
    t: (key, values = {}) => values.defaultValue || key,
  }),
}))
vi.mock('../lib/adminApi', () => mocks)

const { ChatConversationDetailScreen } = await import('./ChatConversationDetailScreen')

const conversation = {
  id: 'conversation-1',
  locale: 'vi',
  turnCount: 2,
  aiCallCount: 1,
  startedAt: '2026-08-29T03:00:00Z',
  lastMessageAt: '2026-08-29T03:01:00Z',
  endedReason: null,
  messages: [
    {
      id: 'message-1',
      role: 'ASSISTANT',
      content: 'Mẫu này còn hàng.',
      source: 'AI',
      createdAt: '2026-08-29T03:01:00Z',
    },
  ],
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ChatConversationDetailScreen conversationId="conversation-1" navigate={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe('ChatConversationDetailScreen', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.fetchChatConversation.mockResolvedValue({ item: conversation })
  })

  it('shows the transcript as a view-only history', async () => {
    renderScreen()

    expect(await screen.findByText('Mẫu này còn hàng.')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.detail.sources.ai')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.detail.readOnly')).toBeInTheDocument()
    expect(screen.getByTestId('chat-detail-summary').querySelectorAll('dt')).toHaveLength(5)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /send|gửi|reply|trả lời/i }),
    ).not.toBeInTheDocument()
  })
})
