import { test as base, expect, request as apiRequest, type Page, type APIRequestContext } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL, API_BASE } from '../utils/env'

/**
 * Auth/session strategy (driven by hard backend constraints):
 *  - Access token lives only in JS memory → every full reload forces a cookie
 *    refresh; the refresh cookie is single-use (rotated + old one revoked).
 *  - Rate limits are PER-IP: login 5/min, refresh 30/min.
 *
 * Therefore: log in ONCE per worker, run workers=1, and hand the (rotating)
 * refresh cookie from test to test serially. Each test starts on a built-in
 * Playwright context (so trace/video/screenshot retain-on-failure work), gets
 * the current cookie injected, and navigates mostly via in-app SPA routing
 * (navigateSpa) so extra navigations cost zero refreshes.
 */

export interface ConsoleEntry { type: string; text: string; location: string }
export interface NetEntry { url: string; method: string; status?: number; failure?: string }
export interface Collectors {
  consoleErrors: ConsoleEntry[]
  consoleWarnings: ConsoleEntry[]
  pageErrors: string[]
  apiErrors: NetEntry[]
  wsIssues: NetEntry[]
  /** Browser "Failed to load resource" subresource errors (images/media etc.).
   *  Recorded + reported, but NOT part of the deterministic runtime gate — a
   *  single broken thumbnail is an asset/data issue, not a code defect, and
   *  should not flake the gate. */
  resourceErrors: string[]
}

const REFRESH_COOKIE = 'bb_admin_refresh'
const COOKIE_HOST = new URL(BASE_URL).hostname

/** console.error noise that is not a product defect. */
const CONSOLE_ERROR_ALLOW: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /ERR_ABORTED/i,
  /favicon/i,
  /WebSocket connection to .* failed/i, // push channel is non-critical for UI
]

function isWs(url: string) {
  return url.startsWith('ws://') || url.startsWith('wss://') || url.includes('/ws')
}
function emptyCollectors(): Collectors {
  return { consoleErrors: [], consoleWarnings: [], pageErrors: [], apiErrors: [], wsIssues: [], resourceErrors: [] }
}
export function resetCollectors(c: Collectors) {
  c.consoleErrors.length = c.consoleWarnings.length = c.pageErrors.length = 0
  c.apiErrors.length = c.wsIssues.length = c.resourceErrors.length = 0
}

function attachCollectors(page: Page, c: Collectors) {
  page.on('console', (msg) => {
    const text = msg.text()
    const loc = msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : ''
    if (msg.type() === 'error') {
      if (CONSOLE_ERROR_ALLOW.some((re) => re.test(text))) return
      // Subresource load failures (images/media) → soft bucket, not the gate.
      if (/Failed to load resource/i.test(text)) {
        c.resourceErrors.push(`${text}${loc ? ` @ ${loc}` : ''}`)
        return
      }
      c.consoleErrors.push({ type: 'error', text, location: loc })
    } else if (msg.type() === 'warning') {
      c.consoleWarnings.push({ type: 'warning', text, location: loc })
    }
  })
  page.on('pageerror', (err) => { c.pageErrors.push(`${err.name}: ${err.message}`) })
  page.on('requestfailed', (req) => {
    const url = req.url()
    const failure = req.failure()?.errorText || 'failed'
    if (failure.includes('ERR_ABORTED')) return
    const entry: NetEntry = { url, method: req.method(), failure }
    if (isWs(url)) c.wsIssues.push(entry)
    else if (url.includes(API_BASE)) c.apiErrors.push(entry)
  })
  page.on('response', (resp) => {
    const url = resp.url()
    const status = resp.status()
    if (status >= 400 && url.includes(API_BASE)) {
      if (status === 401 && /\/auth\/(me|refresh)/.test(url)) return
      c.apiErrors.push({ url, method: resp.request().method(), status })
    }
  })
}

/** Log in via API with 429 backoff (LOGIN is 5/min/IP); return the refresh cookie value. */
export async function apiLoginCookie(
  request: APIRequestContext,
  creds: { email?: string; password?: string } = {},
): Promise<string> {
  const email = creds.email ?? ADMIN_EMAIL
  const password = creds.password ?? ADMIN_PASSWORD
  for (let attempt = 0; ; attempt++) {
    const res = await request.post(`${BASE_URL}${API_BASE}/auth/login`, {
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.status() === 429 && attempt < 6) {
      await new Promise((r) => setTimeout(r, 13_000 + attempt * 4_000))
      continue
    }
    if (!res.ok()) throw new Error(`[apiLogin] ${res.status()}: ${(await res.text()).slice(0, 200)}`)
    const state = await request.storageState()
    const cookie = state.cookies.find((c) => c.name === REFRESH_COOKIE)
    if (!cookie) throw new Error('[apiLogin] no refresh cookie in response')
    return cookie.value
  }
}

interface AuthHolder { value: string }
type WorkerFixtures = { authHolder: AuthHolder }
type TestFixtures = { collect: Collectors; seedAuth: void; adminPage: Page }

export const testAnon = base.extend<TestFixtures>({
  collect: async ({ page }, use, testInfo) => {
    const c = emptyCollectors()
    attachCollectors(page, c)
    await use(c)
    if (c.consoleErrors.length || c.pageErrors.length || c.apiErrors.length || c.wsIssues.length || c.resourceErrors.length) {
      await testInfo.attach('diagnostics.json', { body: JSON.stringify(c, null, 2), contentType: 'application/json' })
    }
  },
  // testAnon has no auth seeding / pre-loaded page.
  seedAuth: [async ({}, use) => { await use() }, { auto: false }],
  adminPage: async ({ page }, use) => { await use(page) },
})

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // One login per worker; cookie value rotates and is carried forward by seedAuth.
  authHolder: [
    async ({}, use) => {
      const api = await apiRequest.newContext({ baseURL: BASE_URL })
      const value = await apiLoginCookie(api)
      await api.dispose()
      await use({ value })
    },
    { scope: 'worker' },
  ],

  // Inject the current refresh cookie before the test; capture the rotated one after.
  seedAuth: [
    async ({ context, authHolder }, use) => {
      await context.addCookies([{
        name: REFRESH_COOKIE,
        value: authHolder.value,
        domain: COOKIE_HOST,
        path: '/api/v1/auth',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      }])
      await use()
      // Persist the rotated cookie for the next test (serial → no race).
      const after = (await context.cookies()).find((c) => c.name === REFRESH_COOKIE)
      if (after?.value) authHolder.value = after.value
    },
    { auto: true },
  ],

  collect: async ({ page }, use, testInfo) => {
    const c = emptyCollectors()
    attachCollectors(page, c)
    await use(c)
    if (c.consoleErrors.length || c.pageErrors.length || c.apiErrors.length || c.wsIssues.length || c.resourceErrors.length) {
      await testInfo.attach('diagnostics.json', { body: JSON.stringify(c, null, 2), contentType: 'application/json' })
    }
  },

  // Pre-loaded, authenticated page on the dashboard with collectors reset, so a
  // test only measures its own navigation. Recovers via form login if bounced.
  adminPage: async ({ page, collect, context, authHolder }, use) => {
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    if (await page.locator('.bb-login-shell').count()) {
      // Rotating cookie died — re-login via API and re-seed, then reload.
      authHolder.value = await apiLoginCookie(context.request)
      await context.addCookies([{
        name: REFRESH_COOKIE, value: authHolder.value, domain: COOKIE_HOST,
        path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax',
      }])
      await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    }
    await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20_000 })
    await page.locator('.bb-page-content').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    resetCollectors(collect)
    await use(page)
  },
})

export { expect }

/** Hard-assert nothing seriously broke at runtime/network on this page. */
export function expectRuntimeClean(c: Collectors, opts: { allowApi?: boolean } = {}) {
  expect(c.pageErrors, `Uncaught page errors:\n${c.pageErrors.join('\n')}`).toEqual([])
  expect(
    c.consoleErrors,
    `Console errors:\n${c.consoleErrors.map((e) => `• ${e.text} (${e.location})`).join('\n')}`,
  ).toEqual([])
  if (!opts.allowApi) {
    expect(
      c.apiErrors,
      `API 4xx/5xx or failed requests:\n${c.apiErrors.map((e) => `• ${e.method} ${e.url} ${e.status ?? e.failure}`).join('\n')}`,
    ).toEqual([])
  }
}

export type { Page }
