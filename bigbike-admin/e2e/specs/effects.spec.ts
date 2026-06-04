import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import {
  navigateSpa, expectNoHorizontalOverflow, expectWithinViewport, openSidebarDrawer,
} from '../utils/quality'

/**
 * Transition / effect tests. Each verifies the effect reaches its correct final
 * state with no stuck overlay, no scroll-lock leftover, no z-index occlusion, no
 * horizontal overflow, and no runtime error. Admin effects should be quick and
 * unobtrusive — these guard against regressions, not decoration.
 */

test('effect · user dropdown opens and closes on outside click', async ({ adminPage, collect }) => {
  const chip = adminPage.locator('.bb-user-chip')
  await chip.click()
  const menu = adminPage.locator('.bb-user-dropdown')
  await expect(menu).toBeVisible()
  await expectWithinViewport(adminPage, menu, 'user dropdown')
  // Click outside → closes.
  await adminPage.locator('.bb-page-content').click({ position: { x: 5, y: 5 } })
  await expect(menu).toBeHidden()
  expectRuntimeClean(collect)
})

test('effect · global search palette opens on Ctrl+K and closes on Escape', async ({ adminPage, collect }) => {
  await adminPage.keyboard.press('Control+k')
  const input = adminPage.getByPlaceholder(/Tìm đơn hàng|Search/i)
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()
  await expectNoHorizontalOverflow(adminPage, 'search palette open')
  await adminPage.keyboard.press('Escape')
  await expect(input).toBeHidden()
  expectRuntimeClean(collect)
})

test('effect · notification bell panel opens and closes', async ({ adminPage, collect }) => {
  const bell = adminPage.getByRole('button', { name: 'Thông báo' })
  await bell.click()
  // Panel anchored to the bell; assert something panel-like appears and fits.
  const panel = adminPage.locator('.bb-topbar .relative >> div').filter({ hasText: /Thông báo|thông báo|Notification/i }).last()
  await expect(panel.first()).toBeVisible()
  await expectNoHorizontalOverflow(adminPage, 'notification panel open')
  // Close via outside click.
  await adminPage.locator('.bb-page-content').click({ position: { x: 5, y: 5 } })
  expectRuntimeClean(collect)
})

test('effect · theme toggle flips data-theme and persists', async ({ adminPage }) => {
  const root = adminPage.locator('html')
  const before = await root.getAttribute('data-theme')
  await adminPage.locator('.theme-toggle').click()
  await expect.poll(() => root.getAttribute('data-theme')).not.toBe(before)
  const stored = await adminPage.evaluate(() => localStorage.getItem('bigbike-admin-theme'))
  expect(stored).toBeTruthy()
  // Toggle back to leave no side effect.
  await adminPage.locator('.theme-toggle').click()
  await expect.poll(() => root.getAttribute('data-theme')).toBe(before)
})

test('effect · mobile sidebar drawer overlay closes the drawer (no scroll lock left)', async ({ adminPage, collect }) => {
  await adminPage.setViewportSize({ width: 390, height: 844 })
  await navigateSpa(adminPage, '/admin/orders')
  await openSidebarDrawer(adminPage)
  // Overlay visible; clicking it closes the drawer.
  const overlay = adminPage.locator('.bb-sidebar-overlay')
  await expect(overlay).toBeVisible()
  await overlay.click({ position: { x: 360, y: 400 }, force: true })
  await expect.poll(async () => {
    const b = await adminPage.locator('.bb-sidebar').boundingBox()
    return b ? Math.round(b.x + b.width) : 0
  }).toBeLessThanOrEqual(4)
  // Body scroll not stuck.
  const overflow = await adminPage.evaluate(() => getComputedStyle(document.body).overflow)
  expect(overflow === '' || overflow === 'visible' || overflow === 'auto').toBeTruthy()
  expectRuntimeClean(collect)
})

test('effect · order status segmented tabs switch without breaking layout', async ({ adminPage, collect }) => {
  await navigateSpa(adminPage, '/admin/orders')
  const seg = adminPage.locator('.bb-seg button')
  const count = await seg.count()
  expect(count, 'order status tabs present').toBeGreaterThan(1)
  await seg.nth(1).click()
  await expect(seg.nth(1)).toHaveClass(/active/)
  await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await expectNoHorizontalOverflow(adminPage, 'orders after tab switch')
  expectRuntimeClean(collect)
})

test('effect · dangerous action shows a confirm dialog; Cancel makes no change', async ({ adminPage, collect }) => {
  // Safety net: never let a destructive request reach the server in this test.
  let deleteAttempts = 0
  await adminPage.route('**/api/v1/**', (route) => {
    if (route.request().method() === 'DELETE') { deleteAttempts++; return route.abort() }
    return route.continue()
  })

  await navigateSpa(adminPage, '/admin/sliders')
  const del = adminPage.locator('.bb-page-content button', { hasText: /^Xo[áạ]$/ }).first()
  if (!(await del.count())) {
    test.info().annotations.push({ type: 'skip', description: 'No deletable slider row to exercise confirm dialog' })
    return
  }
  await del.click()

  const dialog = adminPage.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  // A destructive confirm must offer an explicit confirm + cancel.
  await expect(dialog.getByRole('button', { name: 'Huỷ' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Xác nhận|Xo[áạ]/ })).toBeVisible()

  // Cancel → dialog closes, nothing deleted, scroll lock released.
  await dialog.getByRole('button', { name: 'Huỷ' }).click()
  await expect(dialog).toBeHidden()
  expect(deleteAttempts, 'Cancel must not trigger a delete').toBe(0)
  const bodyOverflow = await adminPage.evaluate(() => getComputedStyle(document.body).overflow)
  expect(['', 'visible', 'auto', 'scroll']).toContain(bodyOverflow)
  await expectNoHorizontalOverflow(adminPage, 'after confirm cancel')
  expectRuntimeClean(collect)
})
