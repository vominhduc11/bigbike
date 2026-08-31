import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAdminChatImageBlob,
  fetchChatConversation,
  fetchChatConversations,
  fetchChatStats,
} from './adminApi'

function jsonResponse(payload = {}, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

describe('admin chat contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists conversations with date filters and no staff-assignment fields', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: {
      items: [{ id: 'chat-1', locale: 'en', turnCount: 3, aiCallCount: 1, lastResultKind: 'PRODUCT_RESULTS' }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
    } }))

    const result = await fetchChatConversations({ page: 1, pageSize: 20, from: '2026-08-01', to: '2026-08-09' })

    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/chat/conversations?')
    expect(fetchMock.mock.calls[0][0]).toContain('from=2026-08-01')
    expect(result.items[0]).toEqual(expect.objectContaining({ id: 'chat-1', lastResultKind: 'PRODUCT_RESULTS' }))
    expect(result.items[0]).not.toHaveProperty('handoffStatus')
  })

  it('keeps read-only transcripts, product cards and private image metadata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: {
      id: 'chat-1', locale: 'vi', messages: [{
        id: 'message-1', role: 'ASSISTANT', content: 'Gợi ý phù hợp', source: 'AI', answerFormat: 'MARKDOWN', resultKind: 'PRODUCT_RESULTS',
        productsJson: '[{"slug":"mu-34","price":1590000}]',
        images: [{ id: 'image-1', mimeType: 'image/jpeg', width: 800, height: 600, sizeBytes: 12345 }],
      }],
    } }))

    const result = await fetchChatConversation('chat-1')

    expect(result.item.messages[0].products).toEqual([{ slug: 'mu-34', price: 1590000 }])
    expect(result.item.messages[0].images).toEqual([expect.objectContaining({ id: 'image-1', mimeType: 'image/jpeg' })])
    expect(result.item).not.toHaveProperty('handoff')
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

  it('keeps private image content behind the read-only image endpoint', async () => {
    const blob = new Blob(['private-image'], { type: 'image/jpeg' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, blob: async () => blob })

    await expect(fetchAdminChatImageBlob('image-1')).resolves.toBe(blob)
  })
})
