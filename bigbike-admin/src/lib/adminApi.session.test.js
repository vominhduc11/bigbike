import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const reply = (status, data = null) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(),
  json: async () => (status === 200 ? { data } : { error: { code: 'UNAUTHORIZED' } }),
  blob: async () => new Blob(['download']),
})

async function tab() {
  vi.resetModules()
  const api = await import('./adminApi')
  const storage = await import('./authStorage')
  const expired = vi.fn()
  api.setAuthErrorListener(expired)
  return { api, storage, expired }
}

describe('Admin session renewal', () => {
  beforeEach(() => {
    let queue = Promise.resolve()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: vi.fn((_name, _options, callback) => {
          const pending = queue.then(callback)
          queue = pending.catch(() => {})
          return pending
        }),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete navigator.locks
  })

  it('serializes independent tabs and reload bootstrap using only the current shared cookie', async () => {
    const first = await tab()
    const second = await tab()
    first.storage.writeTokens({ accessToken: 'expired-a', refreshToken: 'obsolete-a' })
    // second represents a reloaded tab: neither token exists in memory.
    let cookieVersion = 0
    let active = 0
    let maximum = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        expect(url).toMatch(/auth\/refresh$/)
        expect(options.credentials).toBe('include')
        expect(JSON.parse(options.body)).toEqual({})
        const sentCookieVersion = cookieVersion
        maximum = Math.max(maximum, ++active)
        await Promise.resolve()
        active--
        if (sentCookieVersion !== cookieVersion) return reply(401)
        cookieVersion++
        return reply(200, { accessToken: `renewed-${cookieVersion}` })
      }),
    )
    await expect(
      Promise.all([first.api.refreshAccessToken(), second.api.refreshAccessToken()]),
    ).resolves.toEqual(['renewed-1', 'renewed-2'])
    expect(maximum).toBe(1)
    expect(first.expired).not.toHaveBeenCalled()
    expect(second.expired).not.toHaveBeenCalled()
  })

  it('coalesces simultaneous 401s and reuses a new token for a delayed old 401', async () => {
    const { api, storage, expired } = await tab()
    storage.writeTokens({ accessToken: 'old' })
    const late = deferred()
    let oldRequests = 0
    let refreshes = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        if (url.endsWith('/refresh')) {
          refreshes++
          await Promise.resolve()
          return reply(200, { accessToken: 'new' })
        }
        if (options.headers.Authorization === 'Bearer old') {
          oldRequests++
          if (oldRequests === 3) await late.promise
          return reply(401)
        }
        expect(options.headers.Authorization).toBe('Bearer new')
        return reply(200, { id: 'operator', permissions: [] })
      }),
    )
    const a = api.fetchCurrentAdminUser()
    const b = api.fetchCurrentAdminUser()
    const c = api.fetchCurrentAdminUser()
    await Promise.all([a, b])
    late.resolve()
    await c
    expect(refreshes).toBe(1)
    expect(expired).not.toHaveBeenCalled()
  })

  it.each(['network', 500, 503, 429, 403, 'malformed'])(
    'preserves tokens and does not broadcast logout on temporary refresh failure: %s',
    async (failure) => {
      const { api, storage, expired } = await tab()
      storage.writeTokens({ accessToken: 'old' })
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url) => {
          if (!url.endsWith('/refresh')) return reply(401)
          if (failure === 'network') throw new TypeError('Failed to fetch')
          if (failure === 'malformed') return reply(200, {})
          return reply(failure)
        }),
      )
      await expect(api.fetchCurrentAdminUser()).rejects.toMatchObject({
        code: 'SESSION_REFRESH_UNAVAILABLE',
      })
      expect(storage.readTokens().accessToken).toBe('old')
      expect(expired).not.toHaveBeenCalled()
    },
  )

  it('clears a truly revoked session exactly once for concurrent requests', async () => {
    const { api, storage, expired } = await tab()
    storage.writeTokens({ accessToken: 'revoked' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply(401)),
    )
    const outcomes = await Promise.allSettled([
      api.fetchCurrentAdminUser(),
      api.fetchCurrentAdminUser(),
    ])
    expect(outcomes.every((result) => result.status === 'rejected')).toBe(true)
    expect(storage.readTokens().accessToken).toBeNull()
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('does not replay more than once when the renewed access token is rejected', async () => {
    const { api, storage, expired } = await tab()
    storage.writeTokens({ accessToken: 'old' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        url.endsWith('/refresh') ? reply(200, { accessToken: 'renewed' }) : reply(401),
      ),
    )
    await expect(api.fetchCurrentAdminUser()).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(expired).toHaveBeenCalledTimes(1)
  })

  it('handles authenticated downloads with the same temporary failure rules', async () => {
    const { api, storage, expired } = await tab()
    storage.writeTokens({ accessToken: 'old' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => reply(url.endsWith('/refresh') ? 503 : 401)),
    )
    await expect(api.exportProductJson('test-product')).rejects.toMatchObject({ status: 503 })
    expect(storage.readTokens().accessToken).toBe('old')
    expect(expired).not.toHaveBeenCalled()
  })

  it('does not resurrect a session invalidated while renewal is pending', async () => {
    const { api, storage, expired } = await tab()
    storage.writeTokens({ accessToken: 'old' })
    const pending = deferred()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    )
    const refresh = api.refreshAccessToken()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    storage.clearTokens()
    pending.resolve(reply(200, { accessToken: 'too-late' }))
    await expect(refresh).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(storage.readTokens().accessToken).toBeNull()
    expect(expired).not.toHaveBeenCalled()
  })

  it('fails safely without cross-tab lock support', async () => {
    const { api, storage, expired } = await tab()
    storage.writeTokens({ accessToken: 'old' })
    delete navigator.locks
    vi.stubGlobal('fetch', vi.fn())
    await expect(api.refreshAccessToken()).rejects.toMatchObject({
      code: 'AUTH_COORDINATION_UNAVAILABLE',
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(storage.readTokens().accessToken).toBe('old')
    expect(expired).not.toHaveBeenCalled()
  })

  it('still sends explicit server logout when lock support is unavailable', async () => {
    const { api, storage } = await tab()
    storage.writeTokens({ accessToken: 'old', refreshToken: 'obsolete' })
    delete navigator.locks
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        expect(options.credentials).toBe('include')
        expect(options.body).toBe('{}')
        return reply(200)
      }),
    )
    await api.logoutAdmin()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(storage.readTokens().accessToken).toBeNull()
  })

  it('waits for renewal to finish before revoking the rotated cookie during logout', async () => {
    const { api, storage } = await tab()
    storage.writeTokens({ accessToken: 'old' })
    const pending = deferred()
    const order = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (url.endsWith('/refresh')) {
          order.push('refresh')
          return pending.promise
        }
        order.push('logout')
        return reply(200)
      }),
    )
    const refresh = api.refreshAccessToken().catch((error) => error)
    await vi.waitFor(() => expect(order).toEqual(['refresh']))
    const logout = api.logoutAdmin()
    expect(order).toEqual(['refresh'])
    pending.resolve(reply(200, { accessToken: 'late' }))
    await logout
    expect(await refresh).toMatchObject({ code: 'SESSION_CHANGED' })
    expect(order).toEqual(['refresh', 'logout'])
    expect(storage.readTokens().accessToken).toBeNull()
  })
})
