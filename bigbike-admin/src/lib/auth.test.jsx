import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  const { status, user, reconcileAccess } = useAuth()

  return (
    <div>
      <div data-testid="auth-status">{status}</div>
      <div data-testid="auth-user">{user?.fullName || ''}</div>
      <button type="button" onClick={() => reconcileAccess()} data-testid="refresh-access">
        refresh
      </button>
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

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'))
    expect(mocks.fetchCurrentAdminUser).toHaveBeenCalledTimes(1)
    expect(mocks.queryClientClear).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('refresh-access'))

    await waitFor(() => expect(mocks.fetchCurrentAdminUser).toHaveBeenCalledTimes(2))
    expect(mocks.queryClientClear).not.toHaveBeenCalled()
    expect(screen.getByTestId('auth-user')).toHaveTextContent('Admin User')
  })
})
