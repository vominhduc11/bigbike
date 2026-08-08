import { describe, expect, it } from 'vitest'
import {
  canPermanentlyDeleteReview,
  getAutoModerationCategories,
  getAutoModerationSkipReasonKey,
  getAutoModerationState,
  getAutoModerationTone,
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

describe('automatic moderation annotations (REVIEW_RULE_012)', () => {
  it('separates "never checked" from "checked and skipped"', () => {
    // These must not collapse into one state: an old review that predates the feature and
    // a review that slipped through because the AI was down need different responses.
    expect(getAutoModerationState({})).toBe('unchecked')
    expect(getAutoModerationState({ moderationSource: null })).toBe('unchecked')
    expect(getAutoModerationState({ moderationSource: 'SKIPPED', moderationReason: 'AI_UNAVAILABLE' }))
      .toBe('skipped')
  })

  it('reads the verdict, not the source, to decide blocked vs clean', () => {
    expect(getAutoModerationState({ moderationSource: 'AI', moderationVerdict: 'BLOCKED' })).toBe('blocked')
    expect(getAutoModerationState({ moderationSource: 'AI', moderationVerdict: 'CLEAN' })).toBe('clean')
    expect(getAutoModerationState({ moderationSource: 'RULE', moderationVerdict: 'BLOCKED' })).toBe('blocked')
  })

  it('maps each state to a stable tone so list and detail never disagree', () => {
    expect(getAutoModerationTone('blocked')).toBe('danger')
    expect(getAutoModerationTone('skipped')).toBe('warning')
    expect(getAutoModerationTone('clean')).toBe('success')
    expect(getAutoModerationTone('unchecked')).toBe('neutral')
    expect(getAutoModerationTone('something-else')).toBe('neutral')
  })

  it('falls back to a readable key when the backend sends an unknown skip reason', () => {
    expect(getAutoModerationSkipReasonKey('DISABLED')).toBe('DISABLED')
    expect(getAutoModerationSkipReasonKey('ai_unavailable')).toBe('AI_UNAVAILABLE')
    expect(getAutoModerationSkipReasonKey('BRAND_NEW_CODE')).toBe('UNKNOWN')
    expect(getAutoModerationSkipReasonKey(null)).toBe('UNKNOWN')
  })

  it('tolerates a missing or malformed category list', () => {
    expect(getAutoModerationCategories({ moderationCategories: ['PROFANITY', null] })).toEqual(['PROFANITY'])
    expect(getAutoModerationCategories({ moderationCategories: null })).toEqual([])
    expect(getAutoModerationCategories({})).toEqual([])
  })
})
