import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './auth'

const mocks = vi.hoisted(() => ({
  fetchCurrentAdminUser: vi.fn(),
  hasStoredAccessToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
  clearTokens: vi.fn(),
  queryClientClear: vi.fn(),
  setAuthErrorListener: vi.fn(),
  setAuthorizationErrorListener: vi.fn(),
}))

vi.mock('./adminApi', () => ({
  fetchCurrentAdminUser: mocks.fetchCurrentAdminUser,
  hasStoredAccessToken: mocks.hasStoredAccessToken,
  loginAdmin: mocks.loginAdmin,
  logoutAdmin: mocks.logoutAdmin,
  refreshAccessToken: mocks.refreshAccessToken,
  setAuthErrorListener: mocks.setAuthErrorListener,
  setAuthorizationErrorListener: mocks.setAuthorizationErrorListener,
}))

vi.mock('./authStorage', () => ({
  clearTokens: mocks.clearTokens,
}))

vi.mock('./queryClient', () => ({
  queryClient: {
    clear: mocks.queryClientClear,
    invalidateQueries: vi.fn(),
  },
}))

function Probe() {
  const { status, user, reconcileAccess, retrySession, invalidateSession } = useAuth()

  return (
    <div>
      <div data-testid="auth-status">{status}</div>
      <div data-testid="auth-user">{user?.fullName || ''}</div>
      <button type="button" onClick={() => reconcileAccess()} data-testid="refresh-access">
        refresh
      </button>
      <button onClick={retrySession}>retry session</button>
      <button onClick={() => invalidateSession({ broadcast: true })}>invalidate session</button>
      {status === 'authenticated' && <input aria-label="unsaved" defaultValue="" />}
    </div>
  )
}

describe('AuthProvider access reconciliation', () => {
  beforeEach(() => {
    mocks.fetchCurrentAdminUser.mockReset()
    mocks.hasStoredAccessToken.mockReset()
    mocks.refreshAccessToken.mockReset()
    mocks.loginAdmin.mockReset()
    mocks.logoutAdmin.mockReset()
    mocks.clearTokens.mockReset()
    mocks.queryClientClear.mockReset()
    mocks.setAuthErrorListener.mockReset()
    mocks.setAuthorizationErrorListener.mockReset()

    mocks.hasStoredAccessToken.mockReturnValue(true)
    mocks.fetchCurrentAdminUser.mockResolvedValue({
      mode: 'live',
      user: {
        fullName: 'Admin User',
        roles: ['ADMIN'],
        permissions: ['orders.read'],
      },
    })
  })

  it('keeps the query cache intact when the profile is refreshed successfully', async () => {
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'),
    )
    expect(mocks.fetchCurrentAdminUser).toHaveBeenCalledTimes(1)
    expect(mocks.queryClientClear).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('refresh-access'))

    await waitFor(() => expect(mocks.fetchCurrentAdminUser).toHaveBeenCalledTimes(2))
    expect(mocks.queryClientClear).not.toHaveBeenCalled()
    expect(screen.getByTestId('auth-user')).toHaveTextContent('Admin User')
  })

  it('keeps the query cache intact during the scheduled 30-second access refresh', async () => {
    let scheduledRefresh
    const realSetInterval = window.setInterval.bind(window)
    const setIntervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation((callback, delay, ...args) => {
        if (delay === 30_000) {
          scheduledRefresh = callback
          return 123
        }
        return realSetInterval(callback, delay, ...args)
      })

    const view = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'),
    )
    await waitFor(() => expect(scheduledRefresh).toBeTypeOf('function'))

    await act(async () => {
      scheduledRefresh()
    })

    await waitFor(() => expect(mocks.fetchCurrentAdminUser).toHaveBeenCalledTimes(2))
    expect(mocks.queryClientClear).not.toHaveBeenCalled()
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated')

    view.unmount()
    setIntervalSpy.mockRestore()
  })

  it.each([503, 429, 403, 0])(
    'preserves the mounted editor on temporary reconciliation failure %s',
    async (status) => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      )
      const input = await screen.findByRole('textbox', { name: 'unsaved' })
      await userEvent.type(input, 'unfinished product')
      mocks.fetchCurrentAdminUser.mockRejectedValueOnce({ status })
      await userEvent.click(screen.getByTestId('refresh-access'))
      expect(screen.getByRole('textbox', { name: 'unsaved' })).toHaveValue('unfinished product')
      expect(mocks.clearTokens).not.toHaveBeenCalled()
      expect(mocks.queryClientClear).not.toHaveBeenCalled()
    },
  )

  it('offers bootstrap retry after network failure instead of treating it as a missing session', async () => {
    mocks.hasStoredAccessToken.mockReturnValue(false)
    mocks.refreshAccessToken.mockRejectedValueOnce({ status: 503, message: 'Temporary failure' })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('error'))
    expect(mocks.clearTokens).not.toHaveBeenCalled()
    mocks.refreshAccessToken.mockResolvedValueOnce('new')
    await userEvent.click(screen.getByText('retry session'))
    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'),
    )
  })

  it('shows login when bootstrap confirms a missing or revoked refresh cookie', async () => {
    mocks.hasStoredAccessToken.mockReturnValue(false)
    mocks.refreshAccessToken.mockRejectedValueOnce({ status: 401 })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated'),
    )
  })

  it('does not restore authentication from an old profile response after forced sign-out', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByRole('textbox', { name: 'unsaved' })
    let resolveProfile
    mocks.fetchCurrentAdminUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve
        }),
    )
    await userEvent.click(screen.getByTestId('refresh-access'))
    await userEvent.click(screen.getByText('invalidate session'))
    await act(async () => resolveProfile({ user: { fullName: 'Old profile' } }))
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
  })

  it('flushes opted-in form recovery before clearing session data and removing the editor', async () => {
    const flush = vi.fn(() => {
      expect(screen.getByRole('textbox', { name: 'unsaved' })).toBeInTheDocument()
      expect(mocks.queryClientClear).not.toHaveBeenCalled()
    })
    window.addEventListener('bigbike-admin-session-ending', flush)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByRole('textbox', { name: 'unsaved' })
    await userEvent.click(screen.getByText('invalidate session'))
    expect(flush).toHaveBeenCalledTimes(1)
    expect(mocks.queryClientClear).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated')
    window.removeEventListener('bigbike-admin-session-ending', flush)
  })
})
