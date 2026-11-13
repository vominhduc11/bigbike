// The cookie jar is shared by tabs. Hold this lock until Set-Cookie and the
// response body have both been processed. Never fall back to a racy storage lease.
export async function withAuthSessionLock(callback) {
  if (!globalThis.navigator?.locks?.request) {
    throw new Error('AUTH_COORDINATION_UNAVAILABLE')
  }
  return navigator.locks.request('bigbike-admin-auth-session', { mode: 'exclusive' }, callback)
}

export const SESSION_ENDING_EVENT = 'bigbike-admin-session-ending'
