import { test, testAnon, expect } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

/**
 * Basic visual regression — scoped to low-dynamism surfaces so snapshots stay
 * stable against live data: the login page, a create form, the sidebar chrome
 * (badges masked), and the confirm dialog. Data-heavy screens (dashboard, lists)
 * are intentionally excluded from pixel snapshots; their layout is covered by
 * the responsive + smoke specs instead.
 *
 * First run writes baselines under e2e/__screenshots__ (the run reports them as
 * "failing — writing baseline"); re-run to verify stability.
 */

testAnon.describe('Visual · login', () => {
  for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
    testAnon(`login ${vp.n}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h })
      await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('.bb-login-shell')).toBeVisible()
      await expect(page).toHaveScreenshot(`login-${vp.n}.png`, { fullPage: true })
    })
  }
})

test('visual · category create form (desktop)', async ({ adminPage }) => {
  await navigateSpa(adminPage, '/admin/categories/new')
  await expect(adminPage.locator('.bb-screen-header h1')).toBeVisible()
  // The form body, masking the rich-text editor (its toolbar/placeholder can shift).
  await expect(adminPage.locator('.bb-page-content')).toHaveScreenshot('category-create-form.png', {
    mask: [adminPage.locator('.ProseMirror, [contenteditable="true"]')],
  })
})

test('visual · sidebar chrome (desktop)', async ({ adminPage }) => {
  await expect(adminPage.locator('.bb-sidebar')).toHaveScreenshot('sidebar.png', {
    // Pending-count badges are live data.
    mask: [adminPage.locator('.bb-nav-badge')],
  })
})

test('visual · confirm dialog', async ({ adminPage }) => {
  // Block destructive requests as a safety net.
  await adminPage.route('**/api/v1/**', (route) =>
    route.request().method() === 'DELETE' ? route.abort() : route.continue())

  await navigateSpa(adminPage, '/admin/sliders')
  const del = adminPage.locator('.bb-page-content button', { hasText: /^Xo[áạ]$/ }).first()
  if (!(await del.count())) {
    test.info().annotations.push({ type: 'skip', description: 'No deletable slider row for dialog snapshot' })
    return
  }
  await del.click()
  const dialog = adminPage.locator('[role="dialog"]')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveScreenshot('confirm-dialog.png')
  await dialog.getByRole('button', { name: 'Huỷ' }).click()
})
