// In-memory tokens only. Browser refresh/logout exclusively use the shared
// httpOnly cookie; a tab's refresh token can become stale as another tab rotates it.

let _accessToken = null
let _refreshToken = null
let revision = 0

export function tokenRevision() {
  return revision
}

export function readTokens() {
  return { accessToken: _accessToken, refreshToken: _refreshToken }
}

export function writeTokens({ accessToken, refreshToken }) {
  revision++
  if (accessToken !== undefined) _accessToken = accessToken || null
  if (refreshToken !== undefined) _refreshToken = refreshToken || null
}

export function clearTokens() {
  revision++
  _accessToken = null
  _refreshToken = null
}

export function hasAccessToken() {
  return _accessToken !== null
}
