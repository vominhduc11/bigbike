#!/usr/bin/env node
/**
 * One-off diagnostic: inspect OrderStatusPie's ResponsiveContainer/svg DOM state
 * right after the Dashboard mounts, to confirm/refute the "measures 0x0 on first
 * layout pass" hypothesis. Reuses the run-bigbike-admin driver's login flow.
 */
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
      console.error(`[login] 429, backing off (attempt ${attempt + 1})`)
      await new Promise((r) => setTimeout(r, 13_000 + attempt * 4_000))
      continue
    }
    if (!res.ok()) throw new Error(`[login] ${res.status()}: ${(await res.text()).slice(0, 200)}`)
    const state = await requestCtx.storageState()
    const c = state.cookies.find((x) => x.name === REFRESH_COOKIE)
    if (!c) throw new Error('[login] no refresh cookie returned')
    return c.value
  }
}

function describeChart(cardIndex) {
  return `(() => {
    const cards = document.querySelectorAll('.bb-grid-2-1 .bb-card');
    const card = cards[${cardIndex}];
    if (!card) return { error: 'card not found', cardCount: cards.length };
    const rc = card.querySelector('.recharts-responsive-container');
    if (!rc) return { error: 'no .recharts-responsive-container in card' };
    const rcRect = rc.getBoundingClientRect();
    const svg = rc.querySelector('svg.recharts-surface');
    const svgRect = svg ? svg.getBoundingClientRect() : null;
    const pieGroup = svg ? svg.querySelector('g.recharts-pie, .recharts-pie-sector, path.recharts-sector') : null;
    const areaPath = svg ? svg.querySelector('path.recharts-area-area, path.recharts-curve') : null;
    return {
      containerInlineStyle: rc.getAttribute('style'),
      containerRect: { width: rcRect.width, height: rcRect.height },
      svgPresent: !!svg,
      svgAttrs: svg ? { width: svg.getAttribute('width'), height: svg.getAttribute('height'), viewBox: svg.getAttribute('viewBox') } : null,
      svgRect: svgRect ? { width: svgRect.width, height: svgRect.height } : null,
      hasPieContent: !!pieGroup,
      hasAreaContent: !!areaPath,
      svgChildCount: svg ? svg.childElementCount : 0,
    };
  })()`
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  baseURL: BASE, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
  viewport: { width: 1440, height: 900 },
})
const host = new URL(BASE).hostname
const cookieVal = await loginCookie(context.request)
await context.addCookies([{ name: REFRESH_COOKIE, value: cookieVal, domain: host, path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])

const page = await context.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()) })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))

console.error('[diag] navigating to /admin/dashboard (no networkidle wait — catch it early)')
await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
if (await page.locator('.bb-login-shell').count()) {
  const v = await loginCookie(context.request)
  await context.addCookies([{ name: REFRESH_COOKIE, value: v, domain: host, path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
}
await page.locator('.bb-page-content').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})

// Sample repeatedly right after the charts row appears, at short intervals,
// to catch the transient 0x0 state before/around Suspense reveal.
await page.locator('.bb-grid-2-1').waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {
  console.error('[diag] .bb-grid-2-1 never attached')
})

const samples = []
for (let i = 0; i < 12; i++) {
  const revenue = await page.evaluate(describeChart(0)).catch((e) => ({ error: String(e) }))
  const pie = await page.evaluate(describeChart(1)).catch((e) => ({ error: String(e) }))
  samples.push({ t_ms: i * 150, revenue, pie })
  await page.waitForTimeout(150)
}

console.log(JSON.stringify(samples, null, 2))

// Final state after full settle
await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
await page.waitForTimeout(500)
const finalRevenue = await page.evaluate(describeChart(0)).catch((e) => ({ error: String(e) }))
const finalPie = await page.evaluate(describeChart(1)).catch((e) => ({ error: String(e) }))
console.error('[diag] FINAL STATE after networkidle+settle:')
console.error(JSON.stringify({ finalRevenue, finalPie }, null, 2))

// Resize-heal test: nudge viewport while (potentially) blank, see if it recovers.
await page.setViewportSize({ width: 1441, height: 900 })
await page.waitForTimeout(300)
await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(300)
const afterResizePie = await page.evaluate(describeChart(1)).catch((e) => ({ error: String(e) }))
console.error('[diag] PIE STATE after resize nudge:')
console.error(JSON.stringify(afterResizePie, null, 2))

await page.screenshot({ path: 'shots/dashboard-diag.png', fullPage: false })
await browser.close()
