import { chromium } from 'playwright'

const BASE = 'http://localhost:4000'
const EMAIL = 'admin@bigbike.vn'
const PASSWORD = 'admin123'
const API = '/api/v1'
const REFRESH_COOKIE = 'bb_admin_refresh'
const route = '/admin/products/prod_7fa15ecf65ec475aaedeed6adde5afb0'
const outDir = 'C:\\Users\\vomin\\AppData\\Local\\Temp\\claude\\s--project-bigbike\\e3bb466a-9f44-4e93-ae4d-f64be7f08868\\scratchpad'

async function loginCookie(requestCtx) {
  for (let attempt = 0; ; attempt++) {
    const res = await requestCtx.post(`${BASE}${API}/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.status() === 429 && attempt < 6) { await new Promise((r) => setTimeout(r, 13_000 + attempt * 4_000)); continue }
    if (!res.ok()) throw new Error(`[login] ${res.status()}`)
    const state = await requestCtx.storageState()
    return state.cookies.find((x) => x.name === REFRESH_COOKIE).value
  }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: BASE, locale: 'vi-VN', viewport: { width: 1911, height: 917 } })
const host = new URL(BASE).hostname
const cookieVal = await loginCookie(context.request)
await context.addCookies([{ name: REFRESH_COOKIE, value: cookieVal, domain: host, path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])
const page = await context.newPage()
await page.goto(route, { waitUntil: 'domcontentloaded' })
await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})

await page.getByText('Xem trước', { exact: true }).first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: `${outDir}\\zindex_repro.png` })

const info = await page.evaluate(() => {
  function describe(el) {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      selector: el.tagName + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      position: cs.position,
      zIndex: cs.zIndex,
      transform: cs.transform,
    }
  }
  const topbar = document.querySelector('.bb-topbar')
  const aside = document.querySelectorAll('aside')[1] // second aside = preview panel
  const asideHeader = aside ? aside.querySelector('header') : null

  // walk ancestors of aside to find any with a transform/filter/will-change (containing-block hijack)
  const ancestorInfo = []
  let node = aside ? aside.parentElement : null
  while (node && node !== document.body) {
    const cs = getComputedStyle(node)
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.willChange === 'transform' || cs.perspective !== 'none' || cs.contain.includes('layout')) {
      ancestorInfo.push({ tag: node.tagName, cls: node.className, transform: cs.transform, filter: cs.filter, willChange: cs.willChange, contain: cs.contain })
    }
    node = node.parentElement
  }

  return {
    topbar: describe(topbar),
    aside: describe(aside),
    asideHeader: describe(asideHeader),
    transformedAncestorsOfAside: ancestorInfo,
  }
})
console.log(JSON.stringify(info, null, 2))

await browser.close()
