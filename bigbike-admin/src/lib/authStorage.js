// Thin localStorage wrapper. Centralised so the fetch interceptor and the
// AuthProvider read/write tokens through one place — easier to swap to
// session/cookie storage later without grepping the codebase.

const ACCESS_KEY = 'bigbike.admin.accessToken'
const REFRESH_KEY = 'bigbike.admin.refreshToken'

function safeStorage() {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function readTokens() {
  const storage = safeStorage()
  if (!storage) return { accessToken: null, refreshToken: null }
  return {
    accessToken: storage.getItem(ACCESS_KEY),
    refreshToken: storage.getItem(REFRESH_KEY),
  }
}

export function writeTokens({ accessToken, refreshToken }) {
  const storage = safeStorage()
  if (!storage) return
  if (accessToken) storage.setItem(ACCESS_KEY, accessToken)
  else storage.removeItem(ACCESS_KEY)
  if (refreshToken) storage.setItem(REFRESH_KEY, refreshToken)
  else storage.removeItem(REFRESH_KEY)
}

export function clearTokens() {
  const storage = safeStorage()
  if (!storage) return
  storage.removeItem(ACCESS_KEY)
  storage.removeItem(REFRESH_KEY)
}
