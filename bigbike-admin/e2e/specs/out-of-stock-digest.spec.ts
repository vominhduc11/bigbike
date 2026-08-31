import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, expectWithinViewport } from '../utils/quality'

/**
 * Read-only production verification for the morning after the migration is deployed.
 * It uses the real persisted bulletin, never creates or edits products, and intentionally
 * fails when no digest exists so an empty/failed scheduled run cannot look successful.
 */
test('inventory · the morning digest opens both complete product sections', async ({
  adminPage,
  collect,
}) => {
  await adminPage.getByRole('button', { name: /Thông báo|Notifications/i }).click()

  const digestItem = adminPage
    .getByRole('menuitem')
    .filter({ hasText: /Bản tin hết hàng|Out-of-stock digest/i })
    .first()
  await expect(
    digestItem,
    'No persisted out-of-stock digest is available in the bell',
  ).toBeVisible()
  await digestItem.click()

  const dialog = adminPage.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expectWithinViewport(adminPage, dialog, 'out-of-stock digest dialog')
  await expect(dialog.getByRole('heading', { name: /Hết sạch|Fully out of stock/i })).toBeVisible()
  await expect(
    dialog.getByRole('heading', { name: /Thiếu cỡ hoặc màu|Missing size or colour/i }),
  ).toBeVisible()

  const expectedDate = process.env.E2E_STOCK_DIGEST_DATE
  if (expectedDate) {
    await expect(dialog).toContainText(expectedDate)
  }

  const productLinks = dialog.locator('a[href^="/admin/products/"]')
  expect(
    await productLinks.count(),
    'Digest should contain direct product-edit links',
  ).toBeGreaterThan(0)
  await expect(productLinks.first()).toHaveAttribute('href', /^\/admin\/products\/[A-Za-z0-9_-]+$/)
  await expect(dialog).toContainText(/Hết hôm nay|ngày|Out today|days/i)

  await expectNoHorizontalOverflow(adminPage, 'out-of-stock digest')
  expectRuntimeClean(collect)
})
