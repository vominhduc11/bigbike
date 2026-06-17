// Publish-status targets the admin API will accept, keyed by the persisted state.
// Mirrors AdminMutationValidators.validatePublishTransition on the backend so the
// content editor dropdown never offers a transition the server will reject
// (e.g. PUBLISHED -> DRAFT). TRASH is reached via the "move to trash" button, not
// the dropdown; the dropdown only surfaces TRASH -> DRAFT so a trashed item can be
// restored in place.
//
// Evidence: bigbike-backend AdminMutationValidators.validatePublishTransition;
// docs/business/STATE_MACHINES.md content transition table.
export const PUBLISH_TRANSITIONS = {
  DRAFT:     ['DRAFT', 'PUBLISHED', 'HIDDEN'],
  PUBLISHED: ['PUBLISHED', 'HIDDEN'],
  HIDDEN:    ['HIDDEN', 'PUBLISHED', 'DRAFT'],
  TRASH:     ['TRASH', 'DRAFT'],
  // Legacy WP-import states keep their backend escape paths when they are the source.
  ARCHIVED:  ['ARCHIVED', 'DRAFT', 'HIDDEN'],
  PENDING:   ['PENDING', 'DRAFT', 'PUBLISHED'],
  PRIVATE:   ['PRIVATE', 'DRAFT', 'PUBLISHED', 'HIDDEN'],
}

const DEFAULT_OPTIONS = ['DRAFT', 'PUBLISHED', 'HIDDEN']

// Returns the publish statuses selectable from `fromStatus`. On create there is no
// persisted state (pass null) so all standard targets are offered.
export function allowedPublishOptions(fromStatus) {
  if (!fromStatus || fromStatus === 'UNKNOWN') return DEFAULT_OPTIONS
  return PUBLISH_TRANSITIONS[fromStatus] || DEFAULT_OPTIONS
}
