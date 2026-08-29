import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ i18n: { resolvedLanguage: 'vi' }, t: (key, values = {}) => values.defaultValue || key }),
}))

const api = vi.hoisted(() => ({
  fetchChatConversations: vi.fn().mockResolvedValue({
    items: [{ id: 'conversation-1', locale: 'vi', customerDisplayName: '', turnCount: 3, handoffStatus: 'WAITING', lastResultKind: 'PRODUCT_RESULTS', startedAt: '2026-08-29T03:00:00Z', lastMessageAt: '2026-08-29T03:05:00Z' }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  }),
  fetchChatStats: vi.fn().mockResolvedValue({
    used: 12, limit: 400, remaining: 388, conversations: 4,
    quality: { answers: 2, productResults: 1, clarifications: 1, outOfScope: 0, contentRefusals: 0 },
  }),
  fetchChatHandoffs: vi.fn().mockResolvedValue({ waitingCount: 1, items: [{ id: 'handoff-1', conversationId: 'conversation-1', status: 'WAITING', customerKind: 'GUEST', questionSummary: 'Còn size M không?', products: [], waitingSeconds: 60 }] }),
  claimChatHandoff: vi.fn().mockResolvedValue({}),
}))

vi.mock('../lib/adminApi', () => api)
vi.mock('../lib/auth', () => ({ useHasPermission: () => () => true }))
vi.mock('../lib/adminWebSocket', () => ({ subscribeAdminWs: () => () => {} }))

const { ChatConversationListScreen } = await import('./ChatConversationListScreen')

function renderScreen(navigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><ChatConversationListScreen navigate={navigate} /></QueryClientProvider>)
  return navigate
}

describe('ChatConversationListScreen', () => {
  it('keeps the daily quota, conversation queue and staff handoff workbench', async () => {
    renderScreen()

    expect(await screen.findByText('chatAdmin.quota.title')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.quota.used')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.quota.remaining')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.handoffs.title')).toBeInTheDocument()
    expect(await screen.findByText('Còn size M không?')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'chatAdmin.columns.handoff' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'chatAdmin.columns.result' })).toBeInTheDocument()
  })

  it('claims a waiting handoff from the date-filtered queue', async () => {
    const user = userEvent.setup()
    renderScreen()

    await screen.findByText('Còn size M không?')
    await user.click(screen.getByRole('button', { name: 'chatAdmin.handoffs.claim' }))
    await waitFor(() => expect(api.claimChatHandoff).toHaveBeenCalledWith('handoff-1'))
  })
})
