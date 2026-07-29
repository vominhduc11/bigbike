import { describe, expect, it } from 'vitest'
import {
  canPermanentlyDeleteReview,
  getReviewStatusTargets,
  hasReviewStatusTarget,
  toVersionedReviewItems,
} from './reviewModeration'

describe('reviewModeration', () => {
  it('mirrors REVIEW_RULE_009 transitions', () => {
    expect(getReviewStatusTargets('PENDING')).toEqual(['APPROVED', 'SPAM', 'TRASH'])
    expect(getReviewStatusTargets('APPROVED')).toEqual(['PENDING'])
    expect(getReviewStatusTargets('SPAM')).toEqual(['PENDING'])
    expect(getReviewStatusTargets('TRASH')).toEqual(['PENDING'])
    expect(getReviewStatusTargets('UNKNOWN')).toEqual([])
  })

  it('allows permanent deletion only for a super admin looking at trash', () => {
    expect(canPermanentlyDeleteReview({ status: 'TRASH' }, true)).toBe(true)
    expect(canPermanentlyDeleteReview({ status: 'PENDING' }, true)).toBe(false)
    expect(canPermanentlyDeleteReview({ status: 'TRASH' }, false)).toBe(false)
  })

  it('deduplicates bulk items and keeps each rendered version', () => {
    expect(toVersionedReviewItems([
      { id: 12, version: 3 },
      { id: 12, version: 4 },
      { id: 13, version: 2 },
      { id: 14, version: -1 },
    ])).toEqual([
      { id: 12, expectedVersion: 3 },
      { id: 13, expectedVersion: 2 },
    ])
  })

  it('detects whether a mixed selection has an eligible transition', () => {
    expect(hasReviewStatusTarget([{ status: 'PENDING' }, { status: 'TRASH' }], 'APPROVED')).toBe(true)
    expect(hasReviewStatusTarget([{ status: 'APPROVED' }, { status: 'SPAM' }], 'APPROVED')).toBe(false)
  })
})
