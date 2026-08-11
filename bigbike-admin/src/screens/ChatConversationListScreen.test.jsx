import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => ({
      'chatAdmin.guest': 'Khách vãng lai',
      'chatAdmin.columns.turns': 'Lượt hỏi',
      'chatAdmin.columns.aiCalls': 'Lượt gọi AI',
    }[key] || values.defaultValue || key),
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchChatConversations: vi.fn().mockResolvedValue({
    items: [{
      id: '11111111-1111-1111-1111-111111111111',
      locale: 'vi',
      customerDisplayName: '',
      turnCount: 3,
      aiCallCount: 2,
      hasLead: true,
      startedAt: '2026-08-09T03:00:00Z',
      lastMessageAt: '2026-08-09T03:05:00Z',
      endedReason: '',
    }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  }),
  fetchChatStats: vi.fn().mockResolvedValue({
    date: '2026-08-09',
    aiCalls: 2,
    conversations: 1,
    leads: 1,
    dailyLimit: 300,
    remainingAiCalls: 298,
  }),
}))

vi.mock('../lib/adminWebSocket', () => ({
  subscribeAdminWs: () => () => {},
}))

const { ChatConversationListScreen } = await import('./ChatConversationListScreen')

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ChatConversationListScreen navigate={() => {}} />
    </QueryClientProvider>,
  )
}

describe('ChatConversationListScreen', () => {
  // Regression: thẻ mobile từng nhận `meta` dạng chuỗi, làm sập cả trang qua ErrorBoundary
  // ngay khi hội thoại đầu tiên hiện ra.
  it('hiện danh sách hội thoại kèm thẻ mobile mà không sập', async () => {
    renderScreen()

    expect(await screen.findAllByText('Khách vãng lai')).not.toHaveLength(0)
    expect(screen.getAllByText('Lượt hỏi').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lượt gọi AI').length).toBeGreaterThan(0)
  })
})
