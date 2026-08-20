#!/usr/bin/env node
/**
 * run-bigbike-admin driver.
 *
 * Drives the LIVE bigbike-admin SPA (nginx prod build, default http://localhost:4000)
 * with Playwright + the chromium that ships with the admin's node_modules.
 *
 * What it does, in order:
 *   1. API-login (admin@bigbike.vn / admin123 SUPER_ADMIN) to obtain the
 *      single-use `bb_admin_refresh` cookie (Path=/api/v1/auth).
 *   2. Inject that cookie into a fresh browser context. On first load the SPA
 *      calls /auth/refresh to mint the in-memory access token — so the app
 *      boots already authenticated, no form typing.
 *   3. Navigate to the requested route via SPA routing.
 *   4. Wait for the .bb-app shell, screenshot full-page to shots/<name>.png.
 *   5. Print a runtime report: console errors, uncaught page errors, API 4xx/5xx.
 *
 * Resolution of the `playwright` module relies on running with CWD inside
 * (or anywhere under) bigbike-admin so node finds bigbike-admin/node_modules.
 *
 * Usage:
 *   node driver.mjs                         # dashboard -> shots/dashboard.png
 *   node driver.mjs /admin/products         # -> shots/admin-products.png
 *   node driver.mjs /admin/products out.png # explicit screenshot path
 *
 * Env overrides:
 *   ADMIN_BASE      (default http://localhost:4000)
 *   ADMIN_EMAIL     (default admin@bigbike.vn)
 *   ADMIN_PASSWORD  (default admin123)
 *   ADMIN_VIEWPORT_WIDTH / ADMIN_VIEWPORT_HEIGHT (default 1440x900)
 *   ADMIN_CHAT_FIXTURE=1 use isolated read-only chat data for visual review
 *   HEADED=1        run with a visible window (default headless)
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// Must be `localhost` (not 127.0.0.1): the backend CORS/origin allowlist accepts
// http://localhost:4000 only — refresh from a 127.0.0.1 origin is rejected 403.
const BASE = process.env.ADMIN_BASE || 'http://localhost:4000'
const EMAIL = process.env.ADMIN_EMAIL || 'admin@bigbike.vn'
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const VIEWPORT_WIDTH = Number.parseInt(process.env.ADMIN_VIEWPORT_WIDTH || '1440', 10)
const VIEWPORT_HEIGHT = Number.parseInt(process.env.ADMIN_VIEWPORT_HEIGHT || '900', 10)
const USE_CHAT_FIXTURE = process.env.ADMIN_CHAT_FIXTURE === '1'
const API = '/api/v1'
const REFRESH_COOKIE = 'bb_admin_refresh'

const route = process.argv[2] || '/admin/dashboard'
const outArg = process.argv[3]
const slug = route.replace(/^\/+/, '').replace(/\/+$/, '').replace(/[/?=&]+/g, '-') || 'root'
const outPath = outArg ? resolve(outArg) : resolve(HERE, 'shots', `${slug}.png`)
mkdirSync(dirname(outPath), { recursive: true })

/** API login (LOGIN is rate-limited 5/min/IP) -> refresh cookie value. */
async function loginCookie(requestCtx) {
  for (let attempt = 0; ; attempt++) {
    const res = await requestCtx.post(`${BASE}${API}/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.status() === 429 && attempt < 6) {
      console.error(`[login] 429 rate-limited, backing off (attempt ${attempt + 1})`)
      await new Promise((r) => setTimeout(r, 13_000 + attempt * 4_000))
      continue
    }
    if (!res.ok()) throw new Error(`[login] ${res.status()}: ${(await res.text()).slice(0, 200)}`)
    const state = await requestCtx.storageState()
    const c = state.cookies.find((x) => x.name === REFRESH_COOKIE)
    if (!c) throw new Error('[login] no refresh cookie returned — check creds/backend')
    return c.value
  }
}

const consoleErrors = []
const pageErrors = []
const apiErrors = []

const browser = await chromium.launch({ headless: !process.env.HEADED })
const context = await browser.newContext({
  baseURL: BASE,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
  viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
})

const host = new URL(BASE).hostname
const cookieVal = await loginCookie(context.request)
await context.addCookies([{
  name: REFRESH_COOKIE, value: cookieVal, domain: host,
  path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax',
}])

const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (/Download the React DevTools|\[vite\]|ERR_ABORTED|favicon|WebSocket connection to .* failed|Failed to load resource/i.test(t)) return
  consoleErrors.push(t)
})
page.on('pageerror', (e) => pageErrors.push(`${e.name}: ${e.message}`))
page.on('response', (r) => {
  const u = r.url(); const s = r.status()
  if (s >= 400 && u.includes(API)) {
    if (s === 401 && /\/auth\/(me|refresh)/.test(u)) return
    apiErrors.push(`${r.request().method()} ${u} -> ${s}`)
  }
})

if (USE_CHAT_FIXTURE) {
  await page.route('**/api/v1/admin/maintenance', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { enabled: false } }),
  }))
  await page.route('**/api/v1/admin/chat/stats**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      date: '2026-08-20', aiCalls: 286, conversations: 94, leads: 18, unanswered: 7,
      dailyLimit: 400, remainingAiCalls: 114, inputTokens: 188420, outputTokens: 64110,
      thinkingTokens: 23480, providerRequests: 312, averageLatencyMs: 1840,
      estimatedCostUsd: 1.84, contentRefusals: 5, assistedOrders: 12, assistedRevenue: 28650000,
      quality: { answers: 168, productResults: 83, clarifications: 21, outOfScope: 9, contentRefusals: 5 },
      leadFunnel: { sequence1Viewed: 46, sequence2Viewed: 19, accepted: 18, declined: 11 },
      actionStats: [
        { actionType: 'CHECK_SIZE', clicks: 42, cartLines: 19, orders: 8, revenue: 18700000, conversionRate: 0.1905 },
        { actionType: 'CHECK_STOCK', clicks: 31, cartLines: 12, orders: 4, revenue: 9950000, conversionRate: 0.129 },
        { actionType: 'CHANGE_BUDGET', clicks: 17, cartLines: 3, orders: 0, revenue: 0, conversionRate: 0 },
      ],
      monthlyCostUsd: 12.46, monthlyCostWarningUsd: 10, monthlyCostWarningExceeded: true,
    } }),
  }))
  await page.route('**/api/v1/admin/chat/conversations**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      items: [
        { id: 'chat-e2e-1', locale: 'vi', customerDisplayName: 'Khách thử nghiệm A', turnCount: 8, aiCallCount: 7, hasLead: true, startedAt: '2026-08-20T02:10:00Z', lastMessageAt: '2026-08-20T02:18:00Z', providerRequests: 8, averageLatencyMs: 1720, estimatedCostUsd: 0.042, assistedOrders: 1, assistedRevenue: 3150000 },
        { id: 'chat-e2e-2', locale: 'vi', customerDisplayName: '', turnCount: 5, aiCallCount: 5, hasLead: false, startedAt: '2026-08-20T03:20:00Z', lastMessageAt: '2026-08-20T03:24:00Z', providerRequests: 5, averageLatencyMs: 1960, estimatedCostUsd: 0.031, assistedOrders: 0, assistedRevenue: 0 },
        { id: 'chat-e2e-3', locale: 'en', customerDisplayName: 'Test customer B', turnCount: 12, aiCallCount: 10, hasLead: true, startedAt: '2026-08-20T04:05:00Z', lastMessageAt: '2026-08-20T04:16:00Z', providerRequests: 11, averageLatencyMs: 1810, estimatedCostUsd: 0.057, assistedOrders: 2, assistedRevenue: 5720000 },
      ],
      page: 1, pageSize: 20, totalItems: 3, totalPages: 1,
    } }),
  }))
}

console.error(`[drive] ${BASE}${route}`)
await page.goto(route, { waitUntil: 'domcontentloaded' })

// Bounced to login? The rotating cookie was consumed — re-login and reload once.
if (await page.locator('.bb-login-shell').count()) {
  console.error('[drive] landed on login shell, re-seeding cookie')
  const v = await loginCookie(context.request)
  await context.addCookies([{
    name: REFRESH_COOKIE, value: v, domain: host,
    path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax',
  }])
  await page.goto(route, { waitUntil: 'domcontentloaded' })
}

await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {
  console.error('[drive] WARNING: .bb-app shell never attached (still on login? bad route?)')
})
await page.locator('.bb-page-content').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})

await page.screenshot({ path: outPath, fullPage: true })
console.error(`[drive] screenshot -> ${outPath}`)

const title = await page.title()
console.log(JSON.stringify({
  route, url: page.url(), title, screenshot: outPath,
  consoleErrors, pageErrors, apiErrors,
  clean: consoleErrors.length === 0 && pageErrors.length === 0 && apiErrors.length === 0,
}, null, 2))

await browser.close()
process.exit(pageErrors.length || consoleErrors.length ? 1 : 0)
