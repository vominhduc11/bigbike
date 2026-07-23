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

const browser = await chromium.launch({ headless: true })
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
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
await page.waitForTimeout(800)

const detail = await page.evaluate(() => {
  const cards = document.querySelectorAll('.bb-grid-2-1 .bb-card')
  const pieCard = cards[1]
  const svg = pieCard.querySelector('svg.recharts-surface')
  const sectors = [...svg.querySelectorAll('path')]
  const legendDots = [...document.querySelectorAll('.bb-card-body .flex.items-center.gap-2.text-xs span[style]')]
  return {
    svgOuterHTMLLength: svg.outerHTML.length,
    svgOuterHTML: svg.outerHTML,
    sectorCount: sectors.length,
    sectors: sectors.map((p) => {
      const cs = getComputedStyle(p)
      return {
        class: p.getAttribute('class'),
        fillAttr: p.getAttribute('fill'),
        strokeAttr: p.getAttribute('stroke'),
        dAttr: p.getAttribute('d'),
        computedFill: cs.fill,
        computedOpacity: cs.opacity,
        computedDisplay: cs.display,
        computedVisibility: cs.visibility,
      }
    }),
    legendDotBackgrounds: legendDots.map((s) => ({
      inlineStyle: s.getAttribute('style'),
      computedBg: getComputedStyle(s).backgroundColor,
    })),
  }
})

console.log(JSON.stringify(detail, null, 2))
await browser.close()
