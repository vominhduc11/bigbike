// In-memory token store — access token lives only in JS memory (cleared on page reload).
// Refresh token is stored exclusively as a server-side httpOnly cookie so XSS cannot read it.
// On page reload the AuthProvider calls performTokenRefresh() which uses the httpOnly cookie
// to silently obtain a new access token without requiring the user to log in again.

let _accessToken = null

export function readTokens() {
  return { accessToken: _accessToken, refreshToken: null }
}

export function writeTokens({ accessToken }) {
  if (accessToken !== undefined) {
    _accessToken = accessToken || null
  }
  // refreshToken is intentionally ignored — it lives in the httpOnly cookie managed by the server.
}

export function clearTokens() {
  _accessToken = null
}

export function hasAccessToken() {
  return _accessToken !== null
}
