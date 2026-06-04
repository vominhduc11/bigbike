import { expect, type Page, type Locator } from '@playwright/test'

/**
 * Shared admin UI-quality assertions. Structural (semantic) selectors are used
 * wherever possible; the legacy shell uses `bb-*` classes (admin-prototype.css).
 */

/** Navigate to an admin path via a full reload (costs one token refresh). */
export async function gotoAdmin(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await waitForScreenReady(page)
}

/**
 * Navigate WITHIN the SPA via history.pushState + popstate (App.jsx listens for
 * popstate). No reload → the in-memory access token survives → zero refresh
 * cost. This is also how a real admin moves between screens.
 */
export async function navigateSpa(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await waitForScreenReady(page)
}

/** Wait for the shell + page content, and for the Suspense/loading panel to clear. */
export async function waitForScreenReady(page: Page) {
  // The authenticated shell.
  await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20_000 })
  await page.locator('.bb-page-content').waitFor({ state: 'visible', timeout: 20_000 })
  // Let lazy chunk + first data fetch settle.
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  // The lazy-screen Suspense fallback renders a status panel with the loading
  // copy; ensure we are not still showing it.
  const loading = page.locator('.bb-page-content [role="status"]', { hasText: /Đang tải|Loading|Vui lòng/i })
  await loading.first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
}

/** True if the SPA is showing the login screen (unauthenticated). */
export async function isOnLogin(page: Page) {
  return (await page.locator('.bb-login-shell').count()) > 0
}

/**
 * Page-level horizontal overflow check. The whole document must not scroll
 * sideways. Returns offenders (page-level, i.e. not inside a scroll container)
 * to aid debugging.
 */
export async function getHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement
    const vw = window.innerWidth
    const overflow = Math.max(de.scrollWidth - de.clientWidth, document.body.scrollWidth - de.clientWidth)

    function inScrollContainer(el: Element) {
      let p = el.parentElement
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true
        p = p.parentElement
      }
      return false
    }

    const offenders: Array<{ tag: string; cls: string; right: number; width: number }> = []
    if (overflow > 1) {
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.right > vw + 1 && r.left < vw && !inScrollContainer(el)) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: String((el as HTMLElement).className || '').slice(0, 90),
            right: Math.round(r.right),
            width: Math.round(r.width),
          })
        }
      }
    }
    return { vw, overflow: Math.round(overflow), offenders: offenders.slice(0, 10) }
  })
}

/** Assert no page-level horizontal scrolling (allow 1px rounding). */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { vw, overflow, offenders } = await getHorizontalOverflow(page)
  expect(
    overflow,
    `Horizontal overflow ${overflow}px at viewport ${vw}px on ${label}.\n` +
      (offenders.length
        ? `Likely offenders:\n${offenders.map((o) => `• <${o.tag} class="${o.cls}"> right=${o.right} width=${o.width}`).join('\n')}`
        : '(no page-level offender isolated — check a wide fixed/absolute element)'),
  ).toBeLessThanOrEqual(2)
}

/** Assert the topbar header does not overlap the first row of page content. */
export async function expectHeaderNotOverlappingContent(page: Page, label: string) {
  const topbar = page.locator('.bb-topbar')
  const content = page.locator('.bb-page-content')
  if ((await topbar.count()) === 0 || (await content.count()) === 0) return
  const tb = await topbar.boundingBox()
  const ct = await content.boundingBox()
  if (!tb || !ct) return
  // Content top should start at or below the topbar bottom (small tolerance).
  expect(ct.y, `Topbar overlaps page content on ${label} (topbar bottom=${Math.round(tb.y + tb.height)}, content top=${Math.round(ct.y)})`).toBeGreaterThanOrEqual(tb.y + tb.height - 4)
}

/** Assert a locator's box is fully within the viewport (modals/drawers). */
export async function expectWithinViewport(page: Page, locator: Locator, label: string) {
  const box = await locator.boundingBox()
  expect(box, `${label}: element has no box`).not.toBeNull()
  if (!box) return
  const vp = page.viewportSize()!
  expect(box.x, `${label}: overflows left edge`).toBeGreaterThanOrEqual(-2)
  expect(box.y, `${label}: overflows top edge`).toBeGreaterThanOrEqual(-2)
  expect(box.x + box.width, `${label}: overflows right edge (vw=${vp.width})`).toBeLessThanOrEqual(vp.width + 2)
  // Height may exceed viewport for scrollable dialogs; only flag if it starts above.
}

/** Does a visible page-level error/permission/not-found panel exist? */
export async function getPageLevelErrorPanel(page: Page): Promise<string | null> {
  const alert = page.locator('.bb-page-content > [role="alert"], .bb-page-content section[role="alert"]').first()
  if ((await alert.count()) === 0) return null
  if (!(await alert.isVisible())) return null
  return (await alert.innerText()).trim().slice(0, 200)
}

/** The sidebar drawer should be off-canvas (not visible) by default on mobile. */
export async function expectSidebarDrawerClosed(page: Page) {
  const sidebar = page.locator('.bb-sidebar')
  const box = await sidebar.boundingBox()
  // Off-canvas => translated left, so its right edge is <= 0 (or no box).
  if (!box) return
  expect(box.x + box.width, 'Sidebar drawer should be off-canvas when closed').toBeLessThanOrEqual(4)
}

/** Open the mobile sidebar drawer via the hamburger and assert it is on-screen. */
export async function openSidebarDrawer(page: Page) {
  const hamburger = page.locator('.bb-hamburger')
  await expect(hamburger, 'Hamburger should be visible on mobile').toBeVisible()
  await hamburger.click()
  const sidebar = page.locator('.bb-sidebar')
  await expect.poll(async () => {
    const box = await sidebar.boundingBox()
    return box ? Math.round(box.x) : -9999
  }, { message: 'Sidebar should slide fully on-screen' }).toBeGreaterThanOrEqual(-2)
}

/**
 * Standard per-screen structural audit (shell intact, correct active nav, no
 * page-level error panel, no overflow/overlap). Throws on the first problem.
 * Runtime/network cleanliness is asserted separately via expectRuntimeClean.
 */
export async function auditScreen(page: Page, route: { path: string; id: string }) {
  await expect(page.locator('.bb-app'), `${route.id}: shell missing`).toBeVisible()
  await expect(page.locator('.bb-topbar'), `${route.id}: topbar missing`).toBeVisible()
  await expect(page.locator('.bb-page-content'), `${route.id}: content missing`).toBeVisible()

  const errPanel = await getPageLevelErrorPanel(page)
  expect(errPanel, `${route.id}: page-level error panel present → "${errPanel}"`).toBeNull()

  const activeNav = await page.locator('.bb-sidebar .bb-nav-link.active, .bb-sidebar [aria-current="page"]').count()
  expect(activeNav, `${route.id}: no active sidebar highlight`).toBeGreaterThan(0)

  await expectNoHorizontalOverflow(page, route.id)
  await expectHeaderNotOverlappingContent(page, route.id)
}

/** Count visible primary action buttons within the page content. */
export async function primaryActionVisible(page: Page) {
  const primaries = page.locator('.bb-page-content .bb-btn-primary, .bb-page-content button[data-variant="default"], .bb-screen-actions button')
  const n = await primaries.count()
  for (let i = 0; i < n; i++) {
    if (await primaries.nth(i).isVisible()) return true
  }
  return false
}
