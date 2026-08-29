import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  claimChatHandoff,
  closeChatHandoff,
  fetchChatConversation,
  fetchChatConversations,
  fetchChatHandoffs,
  fetchChatStats,
  returnChatToAi,
  sendChatStaffMessage,
} from './adminApi'

function jsonResponse(payload = {}, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

describe('admin chat contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists conversations with date filters and handoff status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: {
      items: [{ id: 'chat-1', locale: 'en', turnCount: 3, aiCallCount: 1, handoffStatus: 'WAITING', lastResultKind: 'PRODUCT_RESULTS' }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
    } }))

    const result = await fetchChatConversations({ page: 1, pageSize: 20, from: '2026-08-01', to: '2026-08-09' })

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/chat/conversations?')
    expect(fetchMock.mock.calls[0][0]).toContain('from=2026-08-01')
    expect(result.items[0]).toEqual(expect.objectContaining({ id: 'chat-1', handoffStatus: 'WAITING', lastResultKind: 'PRODUCT_RESULTS' }))
  })

  it('keeps transcripts, product cards, images and handoff state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: {
      id: 'chat-1', locale: 'vi',
      handoff: { id: 'handoff-1', conversationId: 'chat-1', status: 'ACTIVE', products: [] },
      messages: [{
        id: 'message-1', role: 'ASSISTANT', content: 'Gợi ý phù hợp', source: 'AI', answerFormat: 'MARKDOWN', resultKind: 'PRODUCT_RESULTS',
        productsJson: '[{"slug":"mu-34","price":1590000}]',
        images: [{ id: 'image-1', mimeType: 'image/jpeg', width: 800, height: 600, sizeBytes: 12345 }],
      }],
    } }))

    const result = await fetchChatConversation('chat-1')

    expect(result.item.messages[0].products).toEqual([{ slug: 'mu-34', price: 1590000 }])
    expect(result.item.messages[0].images).toEqual([expect.objectContaining({ id: 'image-1', mimeType: 'image/jpeg' })])
    expect(result.item.handoff).toEqual(expect.objectContaining({ id: 'handoff-1', status: 'ACTIVE' }))
  })

  it('shows only the quota, conversation total and answer-quality counters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: {
      date: '2026-08-29', periodFrom: '2026-08-23', periodTo: '2026-08-29',
      used: 12, limit: 400, remaining: 388, conversations: 7,
      quality: { answers: 5, productResults: 2, clarifications: 1, outOfScope: 3, contentRefusals: 2 },
    } }))

    const result = await fetchChatStats({ date: '2026-08-29', from: '2026-08-23', to: '2026-08-29' })

    expect(fetchMock.mock.calls[0][0]).toContain('date=2026-08-29')
    expect(result).toMatchObject({ used: 12, limit: 400, remaining: 388, conversations: 7, quality: { answers: 5, productResults: 2 } })
  })

  it('retains the staff handoff queue and its claim, reply, return and close actions', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
      const value = String(url)
      if (value.endsWith('/admin/chat/handoffs')) return jsonResponse({ data: {
        waitingCount: 1,
        items: [{ id: 'handoff-1', conversationId: 'chat-1', customerKind: 'SIGNED_IN', questionSummary: 'Size M còn không?', products: [{ slug: 'mu-a', name: 'Mũ A' }] }],
      } })
      if (value.includes('/claim')) return jsonResponse({ data: { id: 'handoff-1', conversationId: 'chat-1', status: 'ACTIVE', products: [] } })
      if (value.includes('/messages')) {
        expect(options.method).toBe('POST')
        expect(JSON.parse(options.body)).toMatchObject({ content: 'Mẫu này còn hàng.' })
        return jsonResponse({ data: { id: 'message-1' } })
      }
      if (value.includes('/return-to-ai')) return jsonResponse({ data: { id: 'handoff-1', conversationId: 'chat-1', status: 'RETURNED_TO_AI', products: [] } })
      if (value.includes('/close')) return jsonResponse({ data: { id: 'handoff-1', conversationId: 'chat-1', status: 'CLOSED', products: [] } })
      throw new Error(`Unexpected URL: ${value}`)
    })

    const [queue, claimed, sent, returned, closed] = await Promise.all([
      fetchChatHandoffs(),
      claimChatHandoff('handoff-1'),
      sendChatStaffMessage('chat-1', 'Mẫu này còn hàng.', 'request-1'),
      returnChatToAi('handoff-1'),
      closeChatHandoff('handoff-1'),
    ])

    expect(queue.items[0]).toEqual(expect.objectContaining({ id: 'handoff-1', products: [{ slug: 'mu-a', name: 'Mũ A' }] }))
    expect(claimed.status).toBe('ACTIVE')
    expect(sent).toEqual(expect.objectContaining({ id: 'message-1' }))
    expect(returned.status).toBe('RETURNED_TO_AI')
    expect(closed.status).toBe('CLOSED')
  })
})
