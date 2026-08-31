// Publish-status targets the admin API will accept, keyed by the persisted state.
// Mirrors AdminMutationValidators.validatePublishTransition on the backend so the
// product/content editor dropdowns never offer a transition the server will reject.
// TRASH is reached via the "move to trash" button, not the dropdown, for the 2 active
// states; the dropdown only surfaces TRASH -> DRAFT so a trashed item can be restored
// in place. Legacy source states keep one consistent escape path (DRAFT), plus TRASH so a
// stale legacy record can still be soft-deleted through the same dropdown fallback it
// always could.
//
// Shared by both Product (product-detail/constants.js re-exports this) and Content
// Article — the two rule sets are intentionally identical, so keep them merged here
// rather than re-forking.
//
// Evidence: bigbike-backend AdminMutationValidators.validatePublishTransition;
// docs/business/STATE_MACHINES.md §4/§12 transition tables.
export const PUBLISH_TRANSITIONS = {
  DRAFT: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['PUBLISHED', 'DRAFT'],
  TRASH: ['TRASH', 'DRAFT'],
  // Legacy source states (HIDDEN retired as an active state 2026-07-07; ARCHIVED/PENDING/
  // PRIVATE are WordPress-import artifacts). Kept so any residual pre-migration record can
  // still be edited back to an active state or soft-deleted.
  HIDDEN: ['HIDDEN', 'DRAFT', 'TRASH'],
  ARCHIVED: ['ARCHIVED', 'DRAFT', 'TRASH'],
  PENDING: ['PENDING', 'DRAFT', 'TRASH'],
  PRIVATE: ['PRIVATE', 'DRAFT', 'TRASH'],
}

const DEFAULT_OPTIONS = ['DRAFT', 'PUBLISHED']

// Returns the publish statuses selectable from `fromStatus`. On create there is no
// persisted state (pass null) so all standard targets are offered.
export function allowedPublishOptions(fromStatus) {
  if (!fromStatus || fromStatus === 'UNKNOWN') return DEFAULT_OPTIONS
  return PUBLISH_TRANSITIONS[fromStatus] || DEFAULT_OPTIONS
}
