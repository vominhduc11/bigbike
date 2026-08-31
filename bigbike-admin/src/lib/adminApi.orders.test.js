import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOrders } from './adminApi'

function jsonResponse(payload = {}, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

describe('fetchOrders operational scope', () => {
  afterEach(() => vi.restoreAllMocks())

  it('defaults the admin order list to operational orders', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      }),
    )

    await fetchOrders({ page: 1, pageSize: 20 })

    expect(fetchMock.mock.calls[0][0]).toContain('orderScope=OPERATIONAL')
    expect(fetchMock.mock.calls[0][0]).not.toContain('attention=')
  })

  it('sends the selected historical scope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      }),
    )

    await fetchOrders({
      page: 1,
      pageSize: 20,
      orderScope: 'HISTORICAL',
      attention: 'ALL',
    })

    expect(fetchMock.mock.calls[0][0]).toContain('orderScope=HISTORICAL')
    expect(fetchMock.mock.calls[0][0]).not.toContain('attention=')
  })

  it('sends the selected operational attention filter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      }),
    )

    await fetchOrders({
      page: 1,
      pageSize: 20,
      orderScope: 'OPERATIONAL',
      attention: 'OVERDUE',
    })

    expect(fetchMock.mock.calls[0][0]).toContain('orderScope=OPERATIONAL')
    expect(fetchMock.mock.calls[0][0]).toContain('attention=OVERDUE')
  })
})
