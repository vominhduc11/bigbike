import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchCurrentAdminUser,
  hasStoredAccessToken,
  loginAdmin,
  logoutAdmin,
  refreshAccessToken,
  setAuthorizationErrorListener,
  setAuthErrorListener,
} from './adminApi'
import { clearTokens } from './authStorage'
import { queryClient } from './queryClient'

const AuthContext = createContext(null)

const initialState = {
  status: 'initializing', // 'initializing' | 'unauthenticated' | 'authenticated' | 'error'
  user: null,
  mode: 'live',
  error: '',
}

const ACCESS_SYNC_CHANNEL = 'bigbike-admin-access'

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState)
  // Lock used by the initial bootstrap so a 401 from the bootstrap call
  // doesn't race with the user clicking "log in" again.
  const aliveRef = useRef(true)
  const reconcileInFlightRef = useRef(null)
  const channelRef = useRef(null)
  const stateRef = useRef(initialState)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const setUnauthenticated = useCallback(() => {
    setState({ status: 'unauthenticated', user: null, mode: 'live', error: '' })
  }, [])

  const broadcastAccessSignal = useCallback((type) => {
    channelRef.current?.postMessage({ type })
  }, [])

  const invalidateSession = useCallback(
    ({ broadcast = false } = {}) => {
      clearTokens()
      queryClient.clear()
      setUnauthenticated()
      if (broadcast) broadcastAccessSignal('FORCE_REAUTH')
    },
    [broadcastAccessSignal, setUnauthenticated],
  )

  const reconcileAccess = useCallback(
    async ({ broadcast = true } = {}) => {
      if (stateRef.current.status !== 'authenticated') return false
      if (reconcileInFlightRef.current) return reconcileInFlightRef.current

      reconcileInFlightRef.current = (async () => {
        try {
          const response = await fetchCurrentAdminUser()
          if (!aliveRef.current) return false
          // Keep the React Query cache warm here.
          // This path runs on focus and on a 30s interval, so clearing the entire
          // cache would turn a harmless access refresh into visible full-screen flicker.
          setState({
            status: 'authenticated',
            user: response.user,
            mode: response.mode || 'live',
            error: '',
          })
          if (broadcast) broadcastAccessSignal('PROFILE_REFRESH')
          return true
        } catch (error) {
          // Network failures must not incorrectly sign an operator out. Authentication failures do.
          if (error?.status === 401 || error?.status === 403) {
            invalidateSession({ broadcast })
          }
          return false
        } finally {
          reconcileInFlightRef.current = null
        }
      })()
      return reconcileInFlightRef.current
    },
    [broadcastAccessSignal, invalidateSession],
  )

  // Wired into the fetch interceptor: when refresh ultimately fails, kick the
  // user back to the login screen. We do not call clearTokens here because the
  // interceptor has already done it.
  useEffect(() => {
    setAuthErrorListener(() => {
      if (!aliveRef.current) return
      invalidateSession({ broadcast: true })
    })
    return () => setAuthErrorListener(null)
  }, [invalidateSession])

  useEffect(() => {
    setAuthorizationErrorListener(() => {
      if (aliveRef.current) reconcileAccess()
    })
    return () => setAuthorizationErrorListener(null)
  }, [reconcileAccess])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // Bootstrap: on page load the in-memory access token is gone, so try a
  // silent refresh via the httpOnly cookie first. If that also fails, show login.
  const bootstrap = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'initializing' }))

    if (!hasStoredAccessToken()) {
      // Attempt silent refresh using the httpOnly refresh cookie.
      const newToken = await refreshAccessToken()
      if (!aliveRef.current) return
      if (!newToken) {
        setUnauthenticated()
        return
      }
    }

    try {
      const response = await fetchCurrentAdminUser()
      if (!aliveRef.current) return
      setState({
        status: 'authenticated',
        user: response.user,
        mode: response.mode || 'live',
        error: '',
      })
    } catch {
      if (!aliveRef.current) return
      setUnauthenticated()
    }
  }, [setUnauthenticated])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    const channel = new BroadcastChannel(ACCESS_SYNC_CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event) => {
      const type = event?.data?.type
      if (type === 'FORCE_REAUTH') {
        invalidateSession()
      } else if (type === 'PROFILE_REFRESH') {
        reconcileAccess({ broadcast: false })
      }
    }
    return () => {
      if (channelRef.current === channel) channelRef.current = null
      channel.close()
    }
  }, [invalidateSession, reconcileAccess])

  useEffect(() => {
    if (state.status !== 'authenticated') return undefined
    const reconcileVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        reconcileAccess()
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconcileAccess()
    }
    window.addEventListener('focus', reconcileVisible)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const timer = window.setInterval(reconcileVisible, 30_000)
    return () => {
      window.removeEventListener('focus', reconcileVisible)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(timer)
    }
  }, [state.status, reconcileAccess])

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
    invalidateSession({ broadcast: true })
  }, [invalidateSession])

  const value = useMemo(
    () => ({ ...state, login, logout, reconcileAccess, invalidateSession }),
    [state, login, logout, reconcileAccess, invalidateSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// Permission checker usable by any component (mirrors App.jsx's hasPermission):
// a wildcard '*' grants everything, otherwise the exact permission must be present.
// eslint-disable-next-line react-refresh/only-export-components
export function useHasPermission() {
  const context = useContext(AuthContext)
  const user = context?.user
  return useCallback(
    (permission) => {
      const perms = user?.permissions || []
      return perms.includes('*') || perms.includes(permission)
    },
    [user],
  )
}
