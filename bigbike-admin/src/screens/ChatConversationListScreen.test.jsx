import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'vi' },
    t: (key, values = {}) => ({
      'chatAdmin.guest': 'Khách vãng lai',
      'chatAdmin.columns.turns': 'Lượt hỏi',
      'chatAdmin.columns.aiCalls': 'Lượt gọi AI',
      'chatAdmin.stats.unanswered': 'Câu chưa trả lời được trong ngày',
      'chatAdmin.stats.averageLatency': 'Thời gian trả lời trung bình',
      'chatAdmin.stats.tokens': 'Token đã dùng',
      'chatAdmin.stats.estimatedCost': 'Chi phí ước tính',
      'chatAdmin.stats.contentRefusals': 'Nội dung bị từ chối',
      'chatAdmin.stats.assistedOrders': 'Đơn được trợ lý hỗ trợ',
      'chatAdmin.monthlyWarning.title': 'Chi phí AI tháng này đã chạm ngưỡng cảnh báo',
      'chatAdmin.quality.title': 'Chất lượng trả lời',
      'chatAdmin.quality.direct': 'Trả lời thẳng',
      'chatAdmin.leadFunnel.title': 'Phễu liên hệ',
      'chatAdmin.leadFunnel.callbackFormOpened': 'Khách đã mở biểu mẫu',
      'chatAdmin.leadFunnel.sequence2': 'Lời mời lần 2 đã hiện',
      'chatAdmin.actions.title': 'Hiệu quả nút gợi ý',
      'chatAdmin.actions.types.CHECK_SIZE': 'Kiểm tra size',
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
      providerRequests: 2,
      averageLatencyMs: 1500,
      estimatedCostUsd: 0.0002,
      assistedRevenue: 1590000,
      hasTelemetry: true,
    }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  }),
  fetchChatStats: vi.fn().mockResolvedValue({
    date: '2026-08-09',
    aiCalls: 2,
    conversations: 1,
    leads: 1,
    unanswered: 4,
    dailyLimit: 120,
    remainingAiCalls: 118,
    inputTokens: 100,
    outputTokens: 50,
    thinkingTokens: 20,
    providerRequests: 3,
    averageLatencyMs: 1500,
    estimatedCostUsd: 0.0002,
    contentRefusals: 2,
    assistedOrders: 1,
    assistedRevenue: 1590000,
    quality: { answers: 3, productResults: 2, clarifications: 1, outOfScope: 1, contentRefusals: 2 },
    leadFunnel: { callbackFormOpened: 6, sequence1Viewed: 4, sequence2Viewed: 2, accepted: 1, declined: 1 },
    actionStats: [{ actionType: 'CHECK_SIZE', clicks: 3, cartLines: 2, orders: 1, revenue: 1590000, conversionRate: 1 / 3 }],
    monthlyCostUsd: 12,
    monthlyCostWarningUsd: 10,
    monthlyCostWarningExceeded: true,
    hasTelemetry: true,
  }),
  fetchChatFunnel: vi.fn().mockResolvedValue({
    conversations: 10,
    productViews: 6,
    cartAdds: 3,
    orders: 1,
    revenue: 1590000,
    conversationToViewRate: 0.6,
    viewToCartRate: 0.5,
    cartToOrderRate: 1 / 3,
    matureThrough: '2026-08-02T00:00:00Z',
    complete: false,
  }),
  fetchChatHandoffs: vi.fn().mockResolvedValue({
    waitingCount: 1,
    items: [{
      id: 'handoff-1',
      conversationId: '11111111-1111-1111-1111-111111111111',
      customerKind: 'SIGNED_IN',
      contactPresent: false,
      questionSummary: 'Size M còn không?',
      products: [{ slug: 'mu-test', name: 'Mũ test' }],
      requestedAt: '2026-08-09T03:00:00Z',
      waitingSeconds: 60,
    }],
  }),
  claimChatHandoff: vi.fn().mockResolvedValue({}),
  fetchChatUnanswered: vi.fn().mockResolvedValue({ items: [] }),
  fetchChatDataGaps: vi.fn().mockResolvedValue({
    missingSizeGuides: 131,
    missingSpecifications: 119,
    rawOptionProducts: 20,
    missingAccessoryLinks: 176,
    items: [],
  }),
  fetchChatFeedback: vi.fn().mockResolvedValue({
    helpful: 5,
    unhelpful: 2,
    issues: [{ topicCode: 'STOCK', reason: 'MISSING_INFORMATION', total: 2 }],
    weeklyTrend: [{ weekStart: '2026-08-03', helpful: 5, unhelpful: 2 }],
    samples: [{
      feedbackId: 'feedback-1',
      conversationId: '11111111-1111-1111-1111-111111111111',
      messageId: 'message-1',
      question: 'Size M còn hàng không?',
      answer: 'Câu trả lời cũ',
      topicCode: 'STOCK',
      reason: 'MISSING_INFORMATION',
      createdAt: '2026-08-09T03:00:00Z',
      total: 2,
    }],
  }),
  fetchChatFeedbackTemplatePrefill: vi.fn(),
}))

vi.mock('../lib/auth', () => ({
  useHasPermission: () => () => true,
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
    expect(screen.getByText('Câu chưa trả lời được trong ngày')).toBeInTheDocument()
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
    expect(screen.getByText('Thời gian trả lời trung bình')).toBeInTheDocument()
    expect(screen.getByText('Chi phí ước tính')).toBeInTheDocument()
    expect(screen.getByText('Nội dung bị từ chối')).toBeInTheDocument()
    expect(screen.getByText('Đơn được trợ lý hỗ trợ')).toBeInTheDocument()
    expect(screen.getByText('Chi phí AI tháng này đã chạm ngưỡng cảnh báo')).toBeInTheDocument()
    expect(screen.getByText('Chất lượng trả lời')).toBeInTheDocument()
    expect(screen.getByText('Trả lời thẳng')).toBeInTheDocument()
    expect(screen.getByText('Phễu liên hệ')).toBeInTheDocument()
    expect(screen.getByText('Khách đã mở biểu mẫu')).toBeInTheDocument()
    expect(screen.getByText('Lời mời lần 2 đã hiện')).toBeInTheDocument()
    expect(screen.getByText('Hiệu quả nút gợi ý')).toBeInTheDocument()
    expect(screen.getAllByText('Kiểm tra size').length).toBeGreaterThan(0)
    expect(screen.getByText('Size M còn không?')).toBeInTheDocument()
    expect(screen.getByText('Size M còn hàng không?')).toBeInTheDocument()
    expect(screen.getByText('chatAdmin.feedback.weeklyTrend')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('131')).toBeInTheDocument()
  })
})
