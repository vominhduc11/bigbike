#!/usr/bin/env node
import { chromium } from 'playwright'

const BASE = process.env.ADMIN_BASE || 'http://localhost:4000'
const EMAIL = process.env.ADMIN_EMAIL || 'admin@bigbike.vn'
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const API = '/api/v1'
const REFRESH_COOKIE = 'bb_admin_refresh'

async function loginCookie(requestCtx) {
  for (let attempt = 0; ; attempt++) {
    const res = await requestCtx.post(`${BASE}${API}/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.status() === 429 && attempt < 6) {
      await new Promise((r) => setTimeout(r, 13_000 + attempt * 4_000))
      continue
    }
    if (!res.ok()) throw new Error(`[login] ${res.status()}`)
    const state = await requestCtx.storageState()
    return state.cookies.find((x) => x.name === REFRESH_COOKIE).value
  }
}

async function runOnce(browser, iter) {
  const context = await browser.newContext({ baseURL: BASE, locale: 'vi-VN', viewport: { width: 1440, height: 900 } })
  const host = new URL(BASE).hostname
  const cookieVal = await loginCookie(context.request)
  await context.addCookies([{ name: REFRESH_COOKIE, value: cookieVal, domain: host, path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])

  const page = await context.newPage()
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
  if (await page.locator('.bb-login-shell').count()) {
    const v = await loginCookie(context.request)
    await context.addCookies([{ name: REFRESH_COOKIE, value: v, domain: host, path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
  }
  await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {})
  await page.locator('.bb-page-content').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  // Match driver.mjs exactly: networkidle wait, THEN screenshot — no extra settle delay.
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})

  const detail = await page.evaluate(() => {
    const cards = document.querySelectorAll('.bb-grid-2-1 .bb-card')
    const pieCard = cards[1]
    const svg = pieCard?.querySelector('svg.recharts-surface')
    if (!svg) return { error: 'no svg' }
    const sectors = [...svg.querySelectorAll('path.recharts-sector')]
    return {
      sectorCount: sectors.length,
      sectors: sectors.map((p) => {
        const cs = getComputedStyle(p)
        const bbox = p.getBBox ? p.getBBox() : null
        return {
          fillAttr: p.getAttribute('fill'),
          dAttr: p.getAttribute('d'),
          computedOpacity: cs.opacity,
          bbox: bbox ? { width: bbox.width, height: bbox.height } : null,
        }
      }),
    }
  })

  await page.screenshot({ path: `shots/dashboard-diag-iter${iter}.png`, fullPage: false })
  await context.close()
  return detail
}

const browser = await chromium.launch({ headless: true })
for (let i = 0; i < 6; i++) {
  const detail = await runOnce(browser, i)
  const blank = !detail.sectors || detail.sectors.length === 0 || detail.sectors.every((s) => (s.bbox?.width ?? 0) < 1)
  console.log(`--- iter ${i} — ${blank ? 'BLANK/DEGENERATE' : 'rendered'} ---`)
  console.log(JSON.stringify(detail, null, 2))
  if (blank) {
    console.log(`>>> Caught a blank/degenerate render at iter ${i}, screenshot at shots/dashboard-diag-iter${i}.png`)
  }
}
await browser.close()
