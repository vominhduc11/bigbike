import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bulkDeleteReviews,
  bulkUpdateReviewStatus,
  deleteReview,
  fetchReviewDetail,
  fetchReviewSummary,
  updateReviewStatus,
} from './adminApi'

function jsonResponse(payload = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

describe('admin review mutation contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends status with the rendered expectedVersion', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: { id: 12, status: 'APPROVED', version: 4 },
      }),
    )

    const result = await updateReviewStatus(12, 'APPROVED', 3)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/reviews/12/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'APPROVED', expectedVersion: 3 }),
      }),
    )
    expect(result.item.version).toBe(4)
    expect(result.item).not.toHaveProperty('authorEmail')
  })

  it('normalizes malformed partial review data without leaking object strings or invalid photos', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          id: 12,
          productId: {},
          productName: {},
          productNameEn: [],
          productSlug: null,
          authorName: ['Nguyễn Minh'],
          authorEmail: { value: 'minh@example.com' },
          rating: 'not-a-number',
          body: { text: 'Rất tốt' },
          photos: [
            null,
            '',
            'javascript:alert(1)',
            'https://cdn.example.com/review.jpg',
            '/media/reviews/../secret.jpg',
            '/media/reviews/%2e%2e%5csecret.jpg',
            '/media/reviews/review.jpg?token=leak',
            '/media/reviews/review.jpg',
          ],
          status: { value: 'PENDING' },
          version: 'invalid',
          createdAt: {},
          updatedAt: [],
        },
      }),
    )

    const result = await fetchReviewDetail(12)

    expect(result.item).toMatchObject({
      productId: '',
      productName: '',
      productNameEn: '',
      productSlug: '',
      authorName: '',
      authorEmail: '',
      rating: null,
      body: '',
      photos: ['/media/reviews/review.jpg'],
      status: '',
      version: 0,
      createdAt: '',
      updatedAt: '',
    })
    expect(JSON.stringify(result.item)).not.toContain('[object Object]')
  })

  it('sends expectedVersion as the hard-delete query parameter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, 204))

    await deleteReview(12, 3)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/reviews/12?expectedVersion=3',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('clamps malformed summary values to safe business ranges', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        data: {
          approved: {
            averageRating: 7,
            totalReviews: -2,
            ratingBreakdown: { 5: -1, 4.5: 2.5, 4: 3 },
          },
          pending: { totalReviews: '1.5', oneStarReviews: 2 },
        },
      }),
    )

    const result = await fetchReviewSummary()

    expect(result.approved.averageRating).toBe(0)
    expect(result.approved.totalReviews).toBe(0)
    expect(result.approved.ratingBreakdown).toMatchObject({ 5: 0, 4.5: 0, 4: 3 })
    expect(result.pending).toEqual({ totalReviews: 0, oneStarReviews: 2 })
  })

  it('sends versioned bulk items and preserves affected/skipped details', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            affected: 1,
            skipped: [{ id: 13, reason: 'VERSION_CONFLICT' }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            affected: 1,
            skipped: [{ id: 12, reason: 'NOT_IN_TRASH' }],
          },
        }),
      )
    const items = [
      { id: 12, expectedVersion: 3 },
      { id: 13, expectedVersion: 7 },
    ]

    const statusResult = await bulkUpdateReviewStatus(items, 'SPAM')
    const deleteResult = await bulkDeleteReviews(items)

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/reviews/bulk-status')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ items, status: 'SPAM' })
    expect(statusResult).toEqual({
      affected: 1,
      skipped: [{ id: 13, reason: 'VERSION_CONFLICT' }],
    })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/admin/reviews/bulk-delete')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ items })
    expect(deleteResult).toEqual({
      affected: 1,
      skipped: [{ id: 12, reason: 'NOT_IN_TRASH' }],
    })
  })
})
