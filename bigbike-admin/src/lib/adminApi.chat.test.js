import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchChatConversation, fetchChatConversations, fetchChatStats } from './adminApi'

function jsonResponse(payload = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

describe('admin chat read contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends the date and lead filters and normalizes a paged conversation list', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: {
        items: [{
          id: 'chat-1', locale: 'en', turnCount: 3, aiCallCount: 1, hasLead: true,
          inputTokens: 120, outputTokens: 40, thinkingTokens: 10, providerRequests: 2,
          averageLatencyMs: 1450, estimatedCostUsd: 0.0002, assistedOrders: 1, assistedRevenue: 1590000,
        }],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    }))

    const result = await fetchChatConversations({
      page: 1,
      pageSize: 20,
      from: '2026-08-01',
      to: '2026-08-09',
      hasLead: 'true',
    })

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/chat/conversations?')
    expect(fetchMock.mock.calls[0][0]).toContain('hasLead=true')
    expect(fetchMock.mock.calls[0][0]).toContain('from=2026-08-01')
    expect(result.items[0]).toMatchObject({
      id: 'chat-1', locale: 'en', turnCount: 3, aiCallCount: 1, hasLead: true,
      providerRequests: 2, averageLatencyMs: 1450, assistedOrders: 1, assistedRevenue: 1590000,
      hasTelemetry: true,
    })
  })

  it('keeps the detail read-only and safely parses product cards from stored JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: {
        id: 'chat-1',
        locale: 'vi',
        messages: [
          { id: 'message-0', role: 'CUSTOMER', content: 'Tìm mũ giúp tôi' },
          {
            id: 'message-1', role: 'ASSISTANT', content: 'Gợi ý thật', source: 'AI',
            answerFormat: 'MARKDOWN', resultKind: 'PRODUCT_RESULTS', providerRequestCount: 2,
            productsJson: '[{"slug":"mu-34","price":1590000}]',
          },
        ],
        orderAttributions: [{
          orderId: 'order-1', orderLineItemId: 'line-1', attributedAmount: 1590000, currency: 'VND',
        }],
        lead: { id: 'lead-1', name: 'An', phone: '0900000000', source: 'ACCOUNT' },
      },
    }))

    const result = await fetchChatConversation('chat-1')

    expect(result.item.messages[1].products).toEqual([{ slug: 'mu-34', price: 1590000 }])
    expect(result.item.messages[0].role).toBe('USER')
    expect(result.item.messages[1]).toMatchObject({ source: 'AI', answerFormat: 'MARKDOWN', resultKind: 'PRODUCT_RESULTS' })
    expect(result.item.orderAttributions).toEqual([expect.objectContaining({ orderId: 'order-1', attributedAmount: 1590000 })])
    expect(result.item.lead).toMatchObject({ name: 'An', phone: '0900000000', source: 'ACCOUNT' })
  })

  it('clamps malformed daily statistics to safe non-negative integers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: {
        date: '2026-08-09', aiCalls: -1, conversations: 2, leads: '3', unanswered: '4',
        contentRefusals: '2', dailyLimit: 120, remainingAiCalls: 118,
        inputTokens: 100, outputTokens: 50, thinkingTokens: 20, providerRequests: 3,
        averageLatencyMs: 2400, estimatedCostUsd: 0.0005, assistedOrders: 1, assistedRevenue: 1590000,
        quality: { answers: 5, productResults: 2, clarifications: 1, outOfScope: 3, contentRefusals: 2 },
        leadFunnel: { sequence1Viewed: 8, sequence2Viewed: 4, accepted: 2, declined: 1 },
        actionStats: [{ actionType: 'CHECK_SIZE', clicks: 5, cartLines: 3, orders: 2, revenue: 3180000, conversionRate: 0.4 }],
        monthlyCostUsd: 12.5, monthlyCostWarningUsd: 10, monthlyCostWarningExceeded: true,
      },
    }))

    const result = await fetchChatStats('2026-08-09')

    expect(result).toMatchObject({
      aiCalls: 0, conversations: 2, leads: 3, unanswered: 4, contentRefusals: 2,
      dailyLimit: 120, remainingAiCalls: 118, providerRequests: 3, averageLatencyMs: 2400,
      assistedOrders: 1, assistedRevenue: 1590000, hasTelemetry: true,
      quality: { answers: 5, productResults: 2, clarifications: 1, outOfScope: 3, contentRefusals: 2 },
      leadFunnel: { sequence1Viewed: 8, sequence2Viewed: 4, accepted: 2, declined: 1 },
      actionStats: [expect.objectContaining({ actionType: 'CHECK_SIZE', clicks: 5, orders: 2, conversionRate: 0.4 })],
      monthlyCostUsd: 12.5, monthlyCostWarningUsd: 10, monthlyCostWarningExceeded: true,
    })
  })
})
