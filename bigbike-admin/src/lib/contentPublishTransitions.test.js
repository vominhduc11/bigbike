import { describe, it, expect } from 'vitest'
import { allowedPublishOptions } from './contentPublishTransitions'

// These cases mirror the backend AdminMutationValidators.validatePublishTransition
// rules for content. If the backend rules change, both must move together.
describe('allowedPublishOptions', () => {
  it('offers all standard targets on create (no persisted state)', () => {
    expect(allowedPublishOptions(null)).toEqual(['DRAFT', 'PUBLISHED', 'HIDDEN'])
    expect(allowedPublishOptions(undefined)).toEqual(['DRAFT', 'PUBLISHED', 'HIDDEN'])
    expect(allowedPublishOptions('UNKNOWN')).toEqual(['DRAFT', 'PUBLISHED', 'HIDDEN'])
  })

  it('does NOT allow PUBLISHED -> DRAFT (backend rejects it)', () => {
    expect(allowedPublishOptions('PUBLISHED')).not.toContain('DRAFT')
    expect(allowedPublishOptions('PUBLISHED')).toEqual(['PUBLISHED', 'HIDDEN'])
  })

  it('allows DRAFT to publish or hide', () => {
    expect(allowedPublishOptions('DRAFT')).toEqual(['DRAFT', 'PUBLISHED', 'HIDDEN'])
  })

  it('allows HIDDEN back to published or draft', () => {
    expect(allowedPublishOptions('HIDDEN')).toEqual(['HIDDEN', 'PUBLISHED', 'DRAFT'])
  })

  it('only allows restoring a trashed item to DRAFT', () => {
    expect(allowedPublishOptions('TRASH')).toEqual(['TRASH', 'DRAFT'])
  })

  it('keeps legacy states selectable so stale records can escape to active states', () => {
    expect(allowedPublishOptions('ARCHIVED')).toContain('ARCHIVED')
    expect(allowedPublishOptions('PENDING')).toContain('PENDING')
    expect(allowedPublishOptions('PRIVATE')).toContain('PRIVATE')
  })

  it('never surfaces TRASH as a forward target from active states (use the trash button instead)', () => {
    for (const from of ['DRAFT', 'PUBLISHED', 'HIDDEN']) {
      expect(allowedPublishOptions(from)).not.toContain('TRASH')
    }
  })

  it('always includes the current status so the Select trigger renders it', () => {
    for (const from of ['DRAFT', 'PUBLISHED', 'HIDDEN', 'TRASH', 'ARCHIVED', 'PENDING', 'PRIVATE']) {
      expect(allowedPublishOptions(from)).toContain(from)
    }
  })
})
