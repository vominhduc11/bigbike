import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'vi' },
    t: (key, values = {}) => values.defaultValue || key,
  }),
}))

const api = vi.hoisted(() => ({
  fetchChatConversations: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'conversation-1',
        locale: 'vi',
        customerDisplayName: '',
        turnCount: 3,
        lastResultKind: 'PRODUCT_RESULTS',
        startedAt: '2026-08-29T03:00:00Z',
        lastMessageAt: '2026-08-29T03:05:00Z',
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  }),
  fetchChatStats: vi.fn().mockResolvedValue({
    used: 12,
    limit: 400,
    remaining: 388,
    conversations: 4,
    quality: {
      answers: 2,
      productResults: 1,
      clarifications: 1,
      outOfScope: 0,
      contentRefusals: 0,
    },
  }),
}))

vi.mock('../lib/adminApi', () => api)

const { ChatConversationListScreen } = await import('./ChatConversationListScreen')

function renderScreen(navigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ChatConversationListScreen navigate={navigate} />
    </QueryClientProvider>,
  )
}

describe('ChatConversationListScreen', () => {
  it('keeps the quota, read-only transcript list and quality counters', async () => {
    renderScreen()

    expect(await screen.findByText('chatAdmin.quota.title')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.quota.used')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.quota.remaining')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'chatAdmin.columns.result' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/handoff|waiting for staff/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /handoff/i })).not.toBeInTheDocument()
  })
})
