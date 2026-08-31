import { chromium } from 'playwright'

const BASE = 'http://localhost:4000'
const EMAIL = 'admin@bigbike.vn'
const PASSWORD = 'admin123'
const API = '/api/v1'
const REFRESH_COOKIE = 'bb_admin_refresh'
const route = '/admin/products/wp-prod-36772'
const outDir =
  'C:\\Users\\vomin\\AppData\\Local\\Temp\\claude\\s--project-bigbike\\e3bb466a-9f44-4e93-ae4d-f64be7f08868\\scratchpad'

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
const context = await browser.newContext({
  baseURL: BASE,
  locale: 'vi-VN',
  viewport: { width: 1911, height: 917 },
})
const host = new URL(BASE).hostname
const cookieVal = await loginCookie(context.request)
await context.addCookies([
  {
    name: REFRESH_COOKIE,
    value: cookieVal,
    domain: host,
    path: '/api/v1/auth',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  },
])
const page = await context.newPage()
await page.goto(route, { waitUntil: 'domcontentloaded' })
await page
  .locator('.bb-app')
  .waitFor({ state: 'attached', timeout: 20_000 })
  .catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})

// Scroll the outer page down a bit BEFORE opening preview, like the user might have while editing a long form.
await page.mouse.wheel(0, 600)
await page.waitForTimeout(300)

await page.getByText('Xem trước', { exact: true }).first().click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${outDir}\\overlap_t0_immediate.png` })
await page.waitForTimeout(800)
await page.screenshot({ path: `${outDir}\\overlap_t1_800ms.png` })
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}\\overlap_t2_2300ms.png` })

// Inspect: is the outer document actually scrolled? does the aside still sit at viewport top=0?
const info = await page.evaluate(() => {
  const aside = document.querySelectorAll('aside')[1]
  const r = aside ? aside.getBoundingClientRect() : null
  return {
    scrollY: window.scrollY,
    docScrollTop: document.scrollingElement ? document.scrollingElement.scrollTop : null,
    asideTop: r ? r.top : null,
    asideHeight: r ? r.height : null,
  }
})
console.log(JSON.stringify(info, null, 2))

await browser.close()
