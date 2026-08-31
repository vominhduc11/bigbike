import { test, testAnon, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { isOnLogin, waitForScreenReady } from '../utils/quality'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../utils/env'

// NOTE (backend, out of UI scope): on the anonymous bootstrap the SPA calls
// /api/v1/auth/refresh with no cookie and the backend replies HTTP 500 instead
// of 401. Handled gracefully by the UI (login shows), but logged as a finding.

test.describe('Auth flow', () => {
  testAnon('renders login, accepts valid credentials, and logs out', async ({ page, collect }) => {
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })

    // Unauthenticated → login shell.
    await expect(page.locator('.bb-login-shell')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()

    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()

    // Authenticated shell appears.
    await expect(page.locator('.bb-app')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.bb-sidebar')).toBeVisible()
    await waitForScreenReady(page)

    // Logout via the user menu.
    await page.locator('.bb-user-chip').click()
    const logoutItem = page.locator('.bb-user-dropdown-item.danger')
    await expect(logoutItem).toBeVisible()
    await logoutItem.click()
    await expect(page.locator('.bb-login-shell')).toBeVisible({ timeout: 15_000 })
  })

  testAnon(
    'rejects invalid credentials with a clear error and stays on login',
    async ({ page }) => {
      await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('.bb-login-shell')).toBeVisible()

      // Unknown account (avoids touching the real admin lockout counter).
      await page.fill('input[type="email"]', 'e2e-nobody@bigbike.vn')
      await page.fill('input[type="password"]', 'definitely-wrong')
      await page.locator('button[type="submit"]').click()

      const alert = page.locator('.bb-login-shell [role="alert"]').first()
      await expect(alert).toBeVisible({ timeout: 15_000 })
      await expect(alert).not.toBeEmpty()
      expect(await isOnLogin(page)).toBe(true)
    },
  )

  test('bootstraps an authenticated session from the refresh cookie', async ({
    adminPage,
    collect,
  }) => {
    // adminPage already loaded the shell from the rotating cookie.
    await expect(adminPage.locator('.bb-app')).toBeVisible()
    await expect(adminPage.locator('.bb-sidebar')).toBeVisible()
    expect(await isOnLogin(adminPage)).toBe(false)
    expectRuntimeClean(collect)
  })
})
