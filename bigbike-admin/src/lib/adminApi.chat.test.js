import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acknowledgeChatHandoff,
  createAssistantEvaluationDraft,
  fetchAssistantEvaluationDatasets,
  fetchAssistantEvaluationRuns,
  fetchAssistantModels,
  fetchChatConversation,
  fetchChatConversations,
  fetchChatDataGaps,
  fetchChatFunnel,
  fetchChatHandoffs,
  fetchChatStats,
  fetchChatUnanswered,
  startAssistantEvaluation,
  updateAssistantModel,
} from './adminApi'

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
          {
            id: 'message-0', role: 'CUSTOMER', content: 'Tìm mũ giúp tôi',
            images: [{
              id: 'image-1', contentPath: '/api/v1/chat/images/image-1/content',
              mimeType: 'image/jpeg', width: 800, height: 600, sizeBytes: 12345,
              status: 'READY', createdAt: '2026-08-26T08:00:00Z',
            }],
          },
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
    expect(result.item.messages[0].images).toEqual([expect.objectContaining({
      id: 'image-1', mimeType: 'image/jpeg', width: 800, height: 600,
    })])
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
        leadFunnel: { callbackFormOpened: 10, sequence1Viewed: 8, sequence2Viewed: 4, accepted: 2, declined: 1 },
        actionStats: [{ actionType: 'CHECK_SIZE', clicks: 5, cartLines: 3, orders: 2, revenue: 3180000, conversionRate: 0.4 }],
        monthlyCostUsd: 12.5, monthlyCostWarningUsd: 10, monthlyCostWarningExceeded: true,
        costs: {
          todayUsd: 0.03, monthUsd: 12.5, averagePerConversationUsd: 0.25,
          textTodayUsd: 0.01, textMonthUsd: 8,
          imageTodayUsd: 0.02, imageMonthUsd: 4.5,
          indexTodayUsd: 0, indexMonthUsd: 0,
          evaluationTodayUsd: 0, evaluationMonthUsd: 0,
        },
        fallbacks: {
          today: 2, month: 5, rate: 0.08, lastReason: 'TIMEOUT',
          giveUpCount14Days: 4, replyCount14Days: 60, giveUpRate14Days: 0.066667,
          baselineGiveUpRate: 0.09, p50LatencyMs14Days: 2200, p95LatencyMs14Days: 5100,
        },
        modelUsage: [{ modelId: 'gemini-2.5-flash', uses: 58, costUsd: 8 }],
      },
    }))

    const result = await fetchChatStats('2026-08-09')

    expect(result).toMatchObject({
      aiCalls: 0, conversations: 2, leads: 3, unanswered: 4, contentRefusals: 2,
      dailyLimit: 120, remainingAiCalls: 118, providerRequests: 3, averageLatencyMs: 2400,
      assistedOrders: 1, assistedRevenue: 1590000, hasTelemetry: true,
      quality: { answers: 5, productResults: 2, clarifications: 1, outOfScope: 3, contentRefusals: 2 },
      leadFunnel: { callbackFormOpened: 10, sequence1Viewed: 8, sequence2Viewed: 4, accepted: 2, declined: 1 },
      actionStats: [expect.objectContaining({ actionType: 'CHECK_SIZE', clicks: 5, orders: 2, conversionRate: 0.4 })],
      monthlyCostUsd: 12.5, monthlyCostWarningUsd: 10, monthlyCostWarningExceeded: true,
      costs: {
        todayUsd: 0.03, monthUsd: 12.5, averagePerConversationUsd: 0.25,
        textTodayUsd: 0.01, textMonthUsd: 8,
        imageTodayUsd: 0.02, imageMonthUsd: 4.5,
      },
      fallbacks: {
        today: 2, month: 5, rate: 0.08, lastReason: 'TIMEOUT',
        giveUpCount14Days: 4, replyCount14Days: 60, giveUpRate14Days: 0.066667,
        baselineGiveUpRate: 0.09, p50LatencyMs14Days: 2200, p95LatencyMs14Days: 5100,
      },
      modelUsage: [{ modelId: 'gemini-2.5-flash', uses: 58, costUsd: 8 }],
    })
  })

  it('uses the live model catalog, changes only the assistant model and normalizes evaluation history', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const value = String(url)
      if (value.includes('/admin/chat/models')) return jsonResponse({ data: {
        currentModel: 'gemini-2.5-flash',
        fallbackModel: 'gemini-2.5-flash-lite',
        reviewModerationModel: 'gemini-2.5-pro',
        refreshedAt: '2026-08-26T08:00:00Z', stale: false,
        models: [{
          id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', selectable: true,
          available: true, inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5,
          speedDescriptionVi: 'Nhanh', speedDescriptionEn: 'Fast',
          costDescriptionVi: 'Vừa phải', costDescriptionEn: 'Moderate',
        }],
      } })
      if (value.endsWith('/admin/chat/model')) {
        expect(options.method).toBe('PUT')
        expect(JSON.parse(options.body)).toEqual({ modelId: 'gemini-2.5-flash-lite' })
        return jsonResponse({ data: {
          currentModel: 'gemini-2.5-flash-lite',
          fallbackModel: 'gemini-2.5-flash-lite',
          reviewModerationModel: 'gemini-2.5-pro', models: [],
        } })
      }
      if (value.endsWith('/admin/chat/evaluations/datasets')) return jsonResponse({ data: [{
        version: 'phase4-acceptance-v1', checksum: 'abc', caseCount: 12,
        acceptanceCheckCount: 85,
        realConversationCaseCount: 0, acceptanceCoverage: ['PHASE1-01', 'PHASE4-22'],
        acceptanceRegistryComplete: true, needsRealQuestionReview: true,
      }] })
      if (value.endsWith('/admin/chat/evaluations/runs') && options.method === 'POST') {
        expect(JSON.parse(options.body)).toMatchObject({
          datasetVersion: 'phase4-acceptance-v1',
          modelIds: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        })
        return jsonResponse({ data: {
          id: 'run-new', modelIds: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
          maxCostUsd: 2, actualCostUsd: 0, status: 'PENDING', results: [],
        } })
      }
      if (value.endsWith('/admin/chat/evaluations/runs')) return jsonResponse({ data: [{
        id: 'run-1', modelIds: ['gemini-2.5-flash'], status: 'COMPLETED',
        results: [{
          modelId: 'gemini-2.5-flash', totalCases: 12, passedCases: 11,
          numericAccuracy: 1, intentAccuracy: 0.92, nonFabricationRate: 1,
          giveUpRate: 0.08, p50LatencyMs: 800, p95LatencyMs: 1500,
          estimatedCostUsd: 0.02, averageCostUsd: 0.0017,
        }],
      }] })
      if (value.endsWith('/admin/chat/evaluations/dataset-draft')) return jsonResponse({ data: {
        sanitizedQuestionCount: 141, draftJson: '{"cases":[]}',
        notice: 'Owner phải kiểm tra lại PII và đáp án.',
      } })
      throw new Error(`Unexpected URL: ${value}`)
    })

    const [catalog, updated, datasets, runs, started, draft] = await Promise.all([
      fetchAssistantModels(true),
      updateAssistantModel('gemini-2.5-flash-lite'),
      fetchAssistantEvaluationDatasets(),
      fetchAssistantEvaluationRuns(),
      startAssistantEvaluation({
        datasetVersion: 'phase4-acceptance-v1',
        modelIds: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        maxCostUsd: 2,
      }),
      createAssistantEvaluationDraft(),
    ])

    expect(catalog).toMatchObject({
      currentModel: 'gemini-2.5-flash', reviewModerationModel: 'gemini-2.5-pro',
      models: [expect.objectContaining({ id: 'gemini-2.5-flash', selectable: true })],
    })
    expect(updated).toMatchObject({
      currentModel: 'gemini-2.5-flash-lite', reviewModerationModel: 'gemini-2.5-pro',
    })
    expect(Array.isArray(datasets)).toBe(true)
    expect(Array.isArray(runs)).toBe(true)
    expect(datasets[0]).toMatchObject({
      version: 'phase4-acceptance-v1', caseCount: 12, acceptanceCheckCount: 85,
      acceptanceRegistryComplete: true,
      needsRealQuestionReview: true,
    })
    expect(runs[0].results[0]).toMatchObject({
      modelId: 'gemini-2.5-flash', passedCases: 11, p95LatencyMs: 1500,
      nonFabricationRate: 1,
    })
    expect(started).toMatchObject({ id: 'run-new', status: 'PENDING' })
    expect(draft).toEqual(expect.objectContaining({
      sanitizedQuestionCount: 141,
      notice: 'Owner phải kiểm tra lại PII và đáp án.',
    }))
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('normalizes the handoff queue, funnel, unanswered list and product data gaps', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const value = String(url)
      if (value.includes('/handoffs/handoff-1/acknowledge')) {
        expect(options.method).toBe('POST')
        return jsonResponse({ data: { id: 'handoff-1', conversationId: 'chat-1', status: 'ACTIVE' } })
      }
      if (value.endsWith('/admin/chat/handoffs')) return jsonResponse({ data: {
        waitingCount: '1',
        items: [{
          id: 'handoff-1', conversationId: 'chat-1', customerKind: 'SIGNED_IN',
          questionSummary: 'Size M còn không?', contactPresent: true,
          requestedAt: '2026-08-24T08:00:00Z', waitingSeconds: -5,
          products: [{ slug: 'mu-a', name: 'Mũ A' }, { slug: '', name: 'invalid' }],
        }],
      } })
      if (value.includes('/admin/chat/funnel')) return jsonResponse({ data: {
        conversations: 10, productViews: 6, cartAdds: 3, orders: 1, revenue: 1590000,
        conversationToViewRate: 0.6, viewToCartRate: 0.5, cartToOrderRate: 1 / 3,
        matureThrough: '2026-08-17T08:00:00Z', complete: false,
      } })
      if (value.includes('/admin/chat/unanswered')) return jsonResponse({ data: [{
        conversationId: 'chat-1', assistantMessageId: 'message-1',
        customerQuestion: 'Bảng size đâu?', reason: 'MISSING_SIZE_GUIDE',
        createdAt: '2026-08-24T08:00:00Z',
      }] })
      if (value.endsWith('/admin/chat/data-gaps')) return jsonResponse({ data: {
        affectedProducts: 2, missingSizeGuides: 2, missingSpecifications: 1,
        rawOptionProducts: 1, missingAccessoryLinks: 2,
        items: [{ productId: 'product-1', slug: 'mu-a', name: 'Mũ A',
          gaps: ['MISSING_SIZE_GUIDE', 'RAW_OPTION'], rawOptions: ['ronin-red'] }],
      } })
      throw new Error(`Unexpected URL: ${value}`)
    })

    const [handoffs, funnel, unanswered, gaps, acknowledged] = await Promise.all([
      fetchChatHandoffs(),
      fetchChatFunnel({ from: '2026-08-01', to: '2026-08-24' }),
      fetchChatUnanswered({ from: '2026-08-01', to: '2026-08-24' }),
      fetchChatDataGaps(),
      acknowledgeChatHandoff('handoff-1'),
    ])

    expect(handoffs).toMatchObject({ waitingCount: 1, items: [{
      id: 'handoff-1', customerKind: 'SIGNED_IN', contactPresent: true,
      waitingSeconds: 0, products: [{ slug: 'mu-a', name: 'Mũ A' }],
    }] })
    expect(funnel).toMatchObject({ conversations: 10, productViews: 6, cartAdds: 3, orders: 1, complete: false })
    expect(unanswered.items[0]).toMatchObject({ customerQuestion: 'Bảng size đâu?', reason: 'MISSING_SIZE_GUIDE' })
    expect(gaps).toMatchObject({ missingSizeGuides: 2, items: [{ rawOptions: ['ronin-red'] }] })
    expect(acknowledged.status).toBe('ACTIVE')
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
