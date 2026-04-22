import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchCurrentAdminUser,
  hasStoredAccessToken,
  loginAdmin,
  logoutAdmin,
  setAuthErrorListener,
} from './adminApi'

const AuthContext = createContext(null)

const initialState = {
  status: 'initializing', // 'initializing' | 'unauthenticated' | 'authenticated' | 'error'
  user: null,
  mode: 'mock',
  error: '',
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState)
  // Lock used by the initial bootstrap so a 401 from the bootstrap call
  // doesn't race with the user clicking "log in" again.
  const aliveRef = useRef(true)

  const setUnauthenticated = useCallback(() => {
    setState({ status: 'unauthenticated', user: null, mode: 'mock', error: '' })
  }, [])

  // Wired into the fetch interceptor: when refresh ultimately fails, kick the
  // user back to the login screen. We do not call clearTokens here because the
  // interceptor has already done it.
  useEffect(() => {
    setAuthErrorListener(() => {
      if (!aliveRef.current) return
      setUnauthenticated()
    })
    return () => setAuthErrorListener(null)
  }, [setUnauthenticated])

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  // Bootstrap: if we have a token, validate it via /auth/me. If not, go
  // straight to the login screen — no point firing a guaranteed 401.
  const bootstrap = useCallback(async () => {
    if (!hasStoredAccessToken()) {
      setUnauthenticated()
      return
    }
    setState((prev) => ({ ...prev, status: 'initializing' }))
    try {
      const response = await fetchCurrentAdminUser()
      if (!aliveRef.current) return
      setState({
        status: 'authenticated',
        user: response.user,
        mode: response.mode || 'live',
        error: '',
      })
    } catch (error) {
      if (!aliveRef.current) return
      // /auth/me failed and refresh-retry inside the interceptor couldn't
      // recover. Treat as unauthenticated (not 'error' — show login form).
      setUnauthenticated()
    }
  }, [setUnauthenticated])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const login = useCallback(async ({ email, password }) => {
    await loginAdmin({ email, password })
    // After tokens are stored, call /auth/me to fetch the canonical profile
    // (permissions list), since the login response uses a different summary
    // shape than fetchCurrentAdminUser expects.
    const response = await fetchCurrentAdminUser()
    setState({
      status: 'authenticated',
      user: response.user,
      mode: response.mode || 'live',
      error: '',
    })
  }, [])

  const logout = useCallback(async () => {
    await logoutAdmin()
    setUnauthenticated()
  }, [setUnauthenticated])

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
