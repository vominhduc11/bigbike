import { chromium } from 'playwright'
const BASE = 'http://localhost:4000'; const API = '/api/v1'; const RC = 'bb_admin_refresh'
const PRODUCT = process.argv[2] || 'wp-prod-41359'
async function loginCookie(ctx) {
  for (let a = 0; ; a++) {
    const res = await ctx.post(`${BASE}${API}/auth/login`, { data: { email: 'admin@bigbike.vn', password: 'admin123' }, headers: { 'Content-Type': 'application/json' } })
    if (res.status() === 429 && a < 6) { await new Promise((r) => setTimeout(r, 13000)); continue }
    if (!res.ok()) throw new Error(`login ${res.status()}`); return (await ctx.storageState()).cookies.find((x) => x.name === RC).value
  }
}
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: BASE, locale: 'vi-VN', viewport: { width: 1440, height: 950 } })
await context.addCookies([{ name: RC, value: await loginCookie(context.request), domain: 'localhost', path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])
const errs = []; const page = await context.newPage()
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/DevTools|\[vite\]|favicon|WebSocket|Failed to load resource/i.test(t)) errs.push(t) } })
page.on('pageerror', (e) => errs.push(`${e.name}: ${e.message}`))
await page.goto(`/admin/products/${PRODUCT}`, { waitUntil: 'domcontentloaded' })
await page.locator('.bb-page-content').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
const tabs = ['Cơ bản & Giá', 'Hình ảnh & SEO', 'Nội dung & Thông số', 'Tin cậy & Liên kết']
const out = {}
for (const label of tabs) {
  await page.getByRole('tab', { name: label }).click({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(500)
  // chỉ lấy tiêu đề THẺ (SectionCard) — lọc theo class tiêu đề card nếu có, fallback h2/h3 ngắn ở cấp cao
  out[label] = await page.evaluate(() => [...document.querySelectorAll('form h2, form h3')].map((h) => h.textContent.trim()).filter((t) => t && t.length < 55))
}
console.log(JSON.stringify({ errors: errs, tabs: out }, null, 2))
await browser.close()
