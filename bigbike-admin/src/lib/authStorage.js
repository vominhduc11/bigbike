// In-memory token store — both tokens live only in JS memory (cleared on page reload).
// The server also sets a httpOnly refresh cookie as a fallback. On page reload,
// performTokenRefresh() sends the stored refreshToken in the request body (per spec) and
// also includes credentials so the httpOnly cookie acts as a secondary fallback.

let _accessToken = null
let _refreshToken = null

export function readTokens() {
  return { accessToken: _accessToken, refreshToken: _refreshToken }
}

export function writeTokens({ accessToken, refreshToken }) {
  if (accessToken !== undefined) _accessToken = accessToken || null
  if (refreshToken !== undefined) _refreshToken = refreshToken || null
}

export function clearTokens() {
  _accessToken = null
  _refreshToken = null
}

export function hasAccessToken() {
  return _accessToken !== null
}
