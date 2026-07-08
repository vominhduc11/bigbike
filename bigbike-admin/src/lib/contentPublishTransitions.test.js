import { describe, it, expect } from 'vitest'
import { allowedPublishOptions } from './contentPublishTransitions'

// These cases mirror the backend AdminMutationValidators.validatePublishTransition
// rules (shared by Product and Content). If the backend rules change, both must move together.
describe('allowedPublishOptions', () => {
  it('offers all standard targets on create (no persisted state)', () => {
    expect(allowedPublishOptions(null)).toEqual(['DRAFT', 'PUBLISHED'])
    expect(allowedPublishOptions(undefined)).toEqual(['DRAFT', 'PUBLISHED'])
    expect(allowedPublishOptions('UNKNOWN')).toEqual(['DRAFT', 'PUBLISHED'])
  })

  it('allows PUBLISHED -> DRAFT directly (no longer requires a HIDDEN stepping stone)', () => {
    expect(allowedPublishOptions('PUBLISHED')).toEqual(['PUBLISHED', 'DRAFT'])
  })

  it('allows DRAFT to publish (HIDDEN is no longer offered)', () => {
    expect(allowedPublishOptions('DRAFT')).toEqual(['DRAFT', 'PUBLISHED'])
  })

  it('only allows restoring a trashed item to DRAFT', () => {
    expect(allowedPublishOptions('TRASH')).toEqual(['TRASH', 'DRAFT'])
  })

  it('keeps legacy states (including retired HIDDEN) escaping only to DRAFT/TRASH — never PUBLISHED', () => {
    for (const from of ['HIDDEN', 'ARCHIVED', 'PENDING', 'PRIVATE']) {
      expect(allowedPublishOptions(from)).toContain(from)
      expect(allowedPublishOptions(from)).toContain('DRAFT')
      expect(allowedPublishOptions(from)).toContain('TRASH')
      expect(allowedPublishOptions(from)).not.toContain('PUBLISHED')
    }
  })

  it('never surfaces TRASH as a forward target from active states (use the trash button instead)', () => {
    for (const from of ['DRAFT', 'PUBLISHED']) {
      expect(allowedPublishOptions(from)).not.toContain('TRASH')
    }
  })

  it('always includes the current status so the Select trigger renders it', () => {
    for (const from of ['DRAFT', 'PUBLISHED', 'TRASH', 'HIDDEN', 'ARCHIVED', 'PENDING', 'PRIVATE']) {
      expect(allowedPublishOptions(from)).toContain(from)
    }
  })
})
