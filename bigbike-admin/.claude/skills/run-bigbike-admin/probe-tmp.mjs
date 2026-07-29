import { chromium } from 'playwright'

const BASE = 'http://localhost:4000'
const API = '/api/v1'
const REFRESH_COOKIE = 'bb_admin_refresh'

async function loginCookie(requestCtx) {
  for (let attempt = 0; ; attempt++) {
    const res = await requestCtx.post(`${BASE}${API}/auth/login`, {
      data: { email: 'admin@bigbike.vn', password: 'admin123' },
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.status() === 429 && attempt < 6) {
      await new Promise((r) => setTimeout(r, 13000 + attempt * 4000))
      continue
    }
    if (!res.ok()) throw new Error(`[login] ${res.status()}`)
    const state = await requestCtx.storageState()
    const c = state.cookies.find((x) => x.name === REFRESH_COOKIE)
    return c.value
  }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } })
const host = new URL(BASE).hostname
const cookieVal = await loginCookie(context.request)
await context.addCookies([{ name: REFRESH_COOKIE, value: cookieVal, domain: host, path: '/api/v1/auth', httpOnly: true, secure: false, sameSite: 'Lax' }])

const page = await context.newPage()
await page.addInitScript(() => {
  window.__snapshots = []
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => 1,
    onCommitFiberRoot: (id, root) => {
      try {
        const results = []
        const seen = new Set()
        function looksLikeForm(v) {
          return v && typeof v === 'object' && !Array.isArray(v) &&
            'slug' in v && 'title' in v && 'publishStatus' in v
        }
        function walkHooks(fiber) {
          let hook = fiber.memoizedState
          let i = 0
          while (hook && i < 40) {
            const val = hook.memoizedState
            if (looksLikeForm(val)) {
              results.push({ publishStatus: val.publishStatus, slug: val.slug, title: val.title })
            }
            hook = hook.next
            i++
          }
        }
        function walk(fiber, depth) {
          if (!fiber || seen.has(fiber) || depth > 4000) return
          seen.add(fiber)
          try { walkHooks(fiber) } catch (e) {}
          if (fiber.child) walk(fiber.child, depth + 1)
          if (fiber.sibling) walk(fiber.sibling, depth + 1)
        }
        walk(root.current, 0)
        if (results.length) window.__snapshots.push({ t: Date.now(), results })
      } catch (e) {}
    },
    onCommitFiberUnmount: () => {},
    onScheduleFiberRoot: () => {},
    checkDCE: () => {},
  }
})

await page.goto('/admin/content/article/wp-art-8118', { waitUntil: 'domcontentloaded' })
await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
await page.waitForTimeout(1000)

const snaps = await page.evaluate(() => window.__snapshots)
console.log('SNAPSHOT_COUNT:', snaps.length)
console.log('ALL_SNAPSHOTS:', JSON.stringify(snaps, null, 2))

await browser.close()
