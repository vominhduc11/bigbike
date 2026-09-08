import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
const originalScrollIntoView = Element.prototype.scrollIntoView

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
  afterEach(() => {
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
    if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
    else delete Element.prototype.scrollIntoView
  })
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

  it('shows direct-contact and closed states without staff reply controls', async () => {
    mocks.fetchChatConversation.mockResolvedValue({
      item: {
        ...conversation,
        endedReason: 'CLOSED',
        messages: [{ ...conversation.messages[0], source: 'CONTACT_FALLBACK' }],
      },
    })
    renderScreen()

    expect(await screen.findByText('chatAdmin.detail.sources.contact')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.detail.endStates.closed')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('chatAdmin.detail.live.send')).not.toBeInTheDocument()
  })

  it('focuses the selected receipt when opening another notification in the same conversation', async () => {
    const first = '00000000-0000-4000-8000-000000000001'
    const second = '00000000-0000-4000-8000-000000000002'
    mocks.fetchChatConversation.mockResolvedValue({
      item: {
        ...conversation,
        messages: [
          { ...conversation.messages[0], id: first, role: 'CUSTOMER', content: 'Biên lai 1' },
          { ...conversation.messages[0], id: second, role: 'CUSTOMER', content: 'Biên lai 2' },
        ],
      },
    })
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const content = (messageId) => (
      <QueryClientProvider client={client}>
        <ChatConversationDetailScreen
          conversationId="conversation-1"
          messageId={messageId}
          navigate={vi.fn()}
        />
      </QueryClientProvider>
    )
    window.history.replaceState({}, '', `/?message=${first}`)
    const view = render(content(first))
    await screen.findByText('Biên lai 1')
    expect(document.activeElement).toHaveAttribute('id', `chat-message-${first}`)

    window.history.replaceState({}, '', `/?message=${second}`)
    view.rerender(content(second))
    expect(document.activeElement).toHaveAttribute('id', `chat-message-${second}`)
    expect(scroll).toHaveBeenCalledTimes(2)
    expect(mocks.fetchChatConversation).toHaveBeenCalledTimes(1)
  })
})
