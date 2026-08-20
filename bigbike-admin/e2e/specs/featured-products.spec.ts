import type { TestInfo } from '@playwright/test'
import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa, waitForScreenReady } from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'

const CAPTURE_VIEWPORTS = VIEWPORTS.filter((viewport) =>
  ['1440x900', '768x1024', '375x812'].includes(viewport.name),
)

async function captureResponsiveScreen(
  page: Parameters<typeof expectNoHorizontalOverflow>[0],
  testInfo: TestInfo,
) {
  for (const viewport of CAPTURE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Sản phẩm nổi bật ${viewport.name}`)
    const path = testInfo.outputPath(`featured-products-${viewport.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach(`Sản phẩm nổi bật ${viewport.name}`, {
      path,
      contentType: 'image/png',
    })
  }
}

test.describe('featured-products', () => {
  test('xem danh sách và hoàn tác thay đổi cục bộ mà không ghi vào trang chủ', async ({
    adminPage,
    collect,
  }, testInfo) => {
    await navigateSpa(adminPage, '/admin/featured-products')
    await waitForScreenReady(adminPage)

    await expect(
      adminPage.getByRole('heading', { name: 'Sản phẩm nổi bật', exact: true }),
    ).toBeVisible()
    await expect(adminPage.getByText(/^\d+ \/ 12$/)).toBeVisible()

    const saveButton = adminPage.getByRole('button', { name: 'Lưu thứ tự', exact: true })
    await expect(saveButton).toBeDisabled()

    const removeButtons = adminPage.getByRole('button', { name: 'Xóa khỏi danh sách', exact: true })
    if (await removeButtons.count()) {
      const firstRow = removeButtons
        .first()
        .locator('xpath=ancestor::div[./button[@aria-label="Xóa khỏi danh sách"]][1]')
      const firstProductName = (await firstRow.locator('p').first().innerText()).trim()

      await removeButtons.first().click()
      await expect(saveButton).toBeEnabled()
      await adminPage.getByRole('button', { name: 'Hoàn tác', exact: true }).click()

      await expect(adminPage.getByText(firstProductName, { exact: true })).toBeVisible()
      await expect(saveButton).toBeDisabled()
    } else {
      await adminPage.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click()
      await expect(
        adminPage.getByPlaceholder('Tìm sản phẩm để thêm vào danh sách...'),
      ).toBeFocused()
      await expect(saveButton).toBeDisabled()
    }

    await captureResponsiveScreen(adminPage, testInfo)
    expectRuntimeClean(collect)
  })
})
