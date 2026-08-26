import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    i18n: { resolvedLanguage: 'vi' },
    t: (key, values = {}) => ({
      'chatAdmin.guest': 'Khách vãng lai',
      'chatAdmin.columns.startedAt': 'Bắt đầu',
      'chatAdmin.columns.customer': 'Khách hàng',
      'chatAdmin.columns.language': 'Ngôn ngữ',
      'chatAdmin.columns.turns': 'Lượt hỏi',
      'chatAdmin.columns.assistedRevenue': 'Doanh thu hỗ trợ',
      'chatAdmin.columns.lead': 'Có liên hệ',
      'chatAdmin.columns.lastMessage': 'Tin cuối',
      'chatAdmin.today.title': 'Hôm nay',
      'chatAdmin.today.conversations': 'Hội thoại hôm nay',
      'chatAdmin.today.aiCalls': 'Lượt AI đã dùng',
      'chatAdmin.today.leads': 'Liên hệ mới hôm nay',
      'chatAdmin.today.cost': 'Tiền AI hôm nay',
      'chatAdmin.today.monthCost': 'Tiền AI tháng này',
      'chatAdmin.filters.from': 'Từ ngày',
      'chatAdmin.filters.to': 'Đến ngày',
      'chatAdmin.filters.lead': 'Tình trạng để lại liên hệ',
      'chatAdmin.filters.allLeads': 'Tất cả hội thoại',
      'chatAdmin.tableTitle': 'Danh sách hội thoại',
      'chatAdmin.tasks.title': 'Việc cần làm',
      'chatAdmin.dataGaps.title': 'Dữ liệu sản phẩm cần bổ sung',
      'chatAdmin.dataGaps.summary': 'Tóm tắt dữ liệu sản phẩm',
      'chatAdmin.dataGaps.columns.product': 'Sản phẩm',
      'chatAdmin.dataGaps.columns.gaps': 'Dữ liệu còn thiếu',
      'chatAdmin.dataGaps.columns.rawOptions': 'Màu/mẫu dạng mã',
      'chatAdmin.unanswered.title': 'Câu hỏi trợ lý chưa xử lý được',
      'chatAdmin.feedback.title': 'Khách đánh giá câu trả lời',
      'chatAdmin.feedback.summary': 'Đánh giá trong khoảng đã chọn',
      'chatAdmin.monthlyWarning.title': 'Chi phí AI tháng này đã chạm ngưỡng cảnh báo',
      'chatAdmin.quality.title': 'Chất lượng trả lời',
      'chatAdmin.quality.direct': 'Trả lời thẳng',
      'chatAdmin.quality.clarifications': 'Hỏi lại để làm rõ',
      'chatAdmin.quality.outOfScope': 'Ngoài phạm vi',
      'chatAdmin.quality.refusals': 'Từ chối nội dung',
      'chatAdmin.quality.fallbackRate': 'Tỉ lệ phải lùi về bản nhanh',
      'chatAdmin.salesFunnel.title': 'Phễu bán hàng từ chat',
      'chatAdmin.costs.title': 'Tiền AI đang tiêu',
      'chatAdmin.costs.averageConversation': 'Trung bình mỗi hội thoại',
      'chatAdmin.costs.text': 'Trả lời chữ trong khoảng đã chọn',
      'chatAdmin.costs.images': 'Đọc ảnh trong khoảng đã chọn',
      'chatAdmin.leadFunnel.title': 'Phễu liên hệ',
      'chatAdmin.leadFunnel.callbackFormOpened': 'Khách đã mở biểu mẫu',
      'chatAdmin.leadFunnel.accepted': 'Đã đồng ý',
      'chatAdmin.leadFunnel.declined': 'Đã từ chối',
      'chatAdmin.actions.title': 'Hiệu quả nút gợi ý',
      'chatAdmin.actions.types.CHECK_SIZE': 'Kiểm tra size',
    }[key] || values.defaultValue || key),
  }),
}))

const apiMocks = vi.hoisted(() => ({ fetchChatStats: vi.fn() }))

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
  fetchChatStats: apiMocks.fetchChatStats.mockResolvedValue({
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
  it('hiện đúng bố cục gọn, bảy cột và không đưa số kỹ thuật vào danh sách', async () => {
    renderScreen()

    expect(await screen.findAllByText('Khách vãng lai')).not.toHaveLength(0)
    expect(document.querySelectorAll('.bb-kpi')).toHaveLength(21)
    expect(screen.getByText('Hội thoại hôm nay')).toBeInTheDocument()
    expect(screen.getByText('Lượt AI đã dùng')).toBeInTheDocument()
    expect(screen.getByText('Liên hệ mới hôm nay')).toBeInTheDocument()
    expect(screen.getByText('Tiền AI hôm nay')).toBeInTheDocument()
    expect(screen.getByText('Tiền AI tháng này')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Bắt đầu' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Khách hàng' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Ngôn ngữ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Lượt hỏi' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Có liên hệ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Doanh thu hỗ trợ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tin cuối' })).toBeInTheDocument()
    expect(screen.getByTestId('chat-conversations-table').querySelectorAll('th')).toHaveLength(7)
    expect(screen.getByTestId('chat-conversations-table').querySelector('.overflow-auto')).toBeInTheDocument()
    expect(screen.getByText('Chi phí AI tháng này đã chạm ngưỡng cảnh báo')).toBeInTheDocument()
    expect(screen.getByText('Chất lượng trả lời')).toBeInTheDocument()
    expect(screen.getByText('Phễu bán hàng từ chat')).toBeInTheDocument()
    expect(screen.getByText('Tiền AI đang tiêu')).toBeInTheDocument()
    expect(screen.getByText('Trả lời thẳng')).toBeInTheDocument()
    expect(screen.getByText('Tỉ lệ phải lùi về bản nhanh')).toBeInTheDocument()
    expect(screen.getByText('Phễu liên hệ')).toBeInTheDocument()
    expect(screen.getByText('Khách đã mở biểu mẫu')).toBeInTheDocument()
    expect(screen.getByText('Đã đồng ý')).toBeInTheDocument()
    expect(screen.getByText('Hiệu quả nút gợi ý')).toBeInTheDocument()
    expect(screen.getAllByText('Kiểm tra size').length).toBeGreaterThan(0)
    expect(screen.getByText('Size M còn không?')).toBeInTheDocument()
    expect(screen.getByText('Size M còn hàng không?')).toBeInTheDocument()
    expect(screen.queryByText('Lượt gọi AI')).not.toBeInTheDocument()
    expect(screen.queryByText('Thời gian trả lời trung bình')).not.toBeInTheDocument()
    expect(screen.queryByText('Chi phí ước tính')).not.toBeInTheDocument()
    expect(screen.queryByText('Lời mời lần 2 đã hiện')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Từ ngày').compareDocumentPosition(screen.getByText('Hôm nay')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the Today snapshot query stable while changing the selected period query', async () => {
    const user = userEvent.setup()
    apiMocks.fetchChatStats.mockClear()
    renderScreen()

    await screen.findAllByText('Khách vãng lai')
    const initialInputs = apiMocks.fetchChatStats.mock.calls.map(([input]) => input)
    expect(initialInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: expect.any(String) }),
      expect.objectContaining({ date: expect.any(String), from: expect.any(String), to: expect.any(String) }),
    ]))

    const fromInput = screen.getByLabelText('Từ ngày')
    await user.clear(fromInput)
    await user.type(fromInput, '2026-08-01')

    await waitFor(() => expect(apiMocks.fetchChatStats.mock.calls.map(([input]) => input)).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: '2026-08-01', to: expect.any(String) }),
    ])))
    expect(apiMocks.fetchChatStats.mock.calls.some(([input]) => input.from == null && input.to == null)).toBe(true)
  })
})
