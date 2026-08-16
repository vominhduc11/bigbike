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
        items: [{ id: 'chat-1', locale: 'en', turnCount: 3, aiCallCount: 1, hasLead: true }],
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
    expect(result.items[0]).toMatchObject({ id: 'chat-1', locale: 'en', turnCount: 3, aiCallCount: 1, hasLead: true })
  })

  it('keeps the detail read-only and safely parses product cards from stored JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: {
        id: 'chat-1',
        locale: 'vi',
        messages: [{
          id: 'message-1',
          role: 'ASSISTANT',
          content: 'Gợi ý thật',
          productsJson: '[{"slug":"mu-34","price":1590000}]',
        }],
        lead: { id: 'lead-1', name: 'An', phone: '0900000000', source: 'ACCOUNT' },
      },
    }))

    const result = await fetchChatConversation('chat-1')

    expect(result.item.messages[0].products).toEqual([{ slug: 'mu-34', price: 1590000 }])
    expect(result.item.lead).toMatchObject({ name: 'An', phone: '0900000000', source: 'ACCOUNT' })
  })

  it('clamps malformed daily statistics to safe non-negative integers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: { date: '2026-08-09', aiCalls: -1, conversations: 2, leads: '3', unanswered: '4', dailyLimit: 60, remainingAiCalls: 57 },
    }))

    const result = await fetchChatStats('2026-08-09')

    expect(result).toMatchObject({ aiCalls: 0, conversations: 2, leads: 3, unanswered: 4, dailyLimit: 60, remainingAiCalls: 57 })
  })
})
