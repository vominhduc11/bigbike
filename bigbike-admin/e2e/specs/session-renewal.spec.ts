import { testAnon as test, expect, apiLoginSession } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

// Real backend auth/cookies, source production preview, no store data writes or cleanup.
// Keep credentials and auth response bodies out of traces, videos and screenshots.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

test('two tabs renew together, keep edits on temporary failures, and sign out together on revocation', async ({
  context,
  page,
}) => {
  test.setTimeout(120_000)
  await apiLoginSession(context.request)
  await context.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || /^\/api\/v1\/auth\//.test(path)) {
      await route.continue()
    } else {
      // Suppress presence/notification acknowledgements as well as business writes.
      await route.fulfill({ status: 200, json: { data: null } })
    }
  })
  const second = await context.newPage()
  const pages = [page, second]
  const pageErrors: string[] = []
  const refreshStatuses: number[] = []
  for (const tab of pages) {
    tab.on('pageerror', (error) => pageErrors.push(error.name))
    tab.on('response', (response) => {
      if (new URL(response.url()).pathname === '/api/v1/auth/refresh')
        refreshStatuses.push(response.status())
    })
  }

  // Cold bootstrap: two independent JS heaps sharing the same rotating cookie.
  await Promise.all(pages.map((tab) => tab.goto('/admin/products/new')))
  await Promise.all(pages.map((tab) => expect(tab.locator('.bb-app')).toBeVisible()))
  await Promise.all(
    pages.map((tab) => expect(tab.locator('input[maxlength="255"]').first()).toBeVisible()),
  )
  expect(refreshStatuses).toEqual([200, 200])

  let armed = new Set(pages)
  for (const tab of pages) {
    await tab.route('**/api/v1/auth/me', async (route) => {
      if (armed.delete(tab)) {
        await route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } })
      } else await route.continue()
    })
  }
  await Promise.all(
    pages.map((tab) =>
      tab.evaluate(() => {
        // Simulate two visible windows: a background headless tab otherwise
        // intentionally skips the application's visibility-gated focus handler.
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        })
        window.dispatchEvent(new Event('focus'))
      }),
    ),
  )
  await expect.poll(() => refreshStatuses.length).toBe(4)
  expect(refreshStatuses).toEqual([200, 200, 200, 200])
  await Promise.all(pages.map((tab) => expect(tab.locator('.bb-app')).toBeVisible()))

  await page.bringToFront()
  await navigateSpa(page, '/admin/products/new')
  const name = page.locator('input[maxlength="255"]').first()
  await expect(name).toBeVisible()
  const draft = `E2E_SESSION_${Date.now()}`
  await name.fill(draft)

  for (const failure of ['network', 'server']) {
    armed = new Set([page])
    let attempts = 0
    await page.route('**/api/v1/auth/refresh', async (route) => {
      attempts++
      if (failure === 'network') await route.abort('failed')
      else await route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE' } } })
    })
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect.poll(() => attempts).toBe(1)
    await expect
      .poll(() => page.evaluate(async () => (await navigator.locks.query()).held?.length))
      .toBe(0)
    await expect(name).toHaveValue(draft)
    await expect(page.locator('.bb-login-shell')).toHaveCount(0)
    await expect(second.locator('.bb-app')).toBeVisible()
    await page.unroute('**/api/v1/auth/refresh')
  }

  // Revoke only this isolated test browser's refresh session; no account changes.
  const revokedCookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'bb_admin_refresh',
  )
  expect(Boolean(revokedCookie)).toBe(true)
  const logout = await context.request.post('/api/v1/auth/logout', { data: {} })
  expect(logout.ok()).toBe(true)
  // Retain the revoked cookie to test a real rejection, not just a missing cookie.
  await context.addCookies([revokedCookie!])
  await name.fill(`${draft}_LATEST`)
  armed = new Set([page])
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await Promise.all(pages.map((tab) => expect(tab.locator('.bb-login-shell')).toBeVisible()))
  expect(refreshStatuses.at(-1)).toBe(401)
  const recovered = await page.evaluate(() => {
    const value = localStorage.getItem('product-autosave:new')
    return value ? JSON.parse(value).form.name : null
  })
  expect(recovered).toBe(`${draft}_LATEST`)
  await page.evaluate(() => localStorage.removeItem('product-autosave:new'))
  expect(pageErrors).toEqual([])
})
