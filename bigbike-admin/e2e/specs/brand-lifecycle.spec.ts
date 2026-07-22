import type { TestInfo } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'

const RUN_ID = Date.now()

function brandName(retry: number) {
  return `E2E_BRAND_${RUN_ID}${retry ? `_r${retry}` : ''}`
}

function brandSlug(retry: number) {
  return `e2e-brand-${RUN_ID}${retry ? `-r${retry}` : ''}`
}

async function findBrandRow(page: Page, name: string) {
  const search = page.locator('input[type="search"]')
  await search.fill(name)
  const row = page.locator('tbody tr').filter({ hasText: name })
  await expect(row, `Không tìm thấy thương hiệu thử nghiệm ${name}`).toHaveCount(1, { timeout: 10_000 })
  return row
}

async function selectVisibility(page: Page, label: 'Đang hiển thị' | 'Thùng rác') {
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function confirmDialog(page: Page, action: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: action, exact: true }).click()
}

async function captureResponsiveList(page: Page, testInfo: TestInfo) {
  const viewports = [
    { name: '1440', width: 1440, height: 1000 },
    { name: '768', width: 768, height: 1024 },
    { name: '375', width: 375, height: 812 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Brand list ${viewport.name}px`)
    const path = testInfo.outputPath(`brand-list-after-${viewport.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach(`Brand list after ${viewport.name}px`, { path, contentType: 'image/png' })
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
}

test.describe('brand-lifecycle', () => {
  test('tạo, ẩn, khôi phục và xóa vĩnh viễn thương hiệu thử nghiệm', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(120_000)

    const name = brandName(testInfo.retry)
    const slug = brandSlug(testInfo.retry)
    let brandId: string | null = null

    await test.step('tạo thương hiệu, không hiện ở trang chủ', async () => {
      await navigateSpa(adminPage, '/admin/brands/new')
      const formInputs = adminPage.locator('#brand-form input:not([type="checkbox"])')
      await formInputs.nth(0).fill(name)
      await formInputs.nth(1).fill(slug)

      const homepageCheckbox = adminPage.locator('#brand-form [role="checkbox"]')
      await expect(homepageCheckbox).toHaveAttribute('data-state', 'checked')
      await homepageCheckbox.click()
      await expect(homepageCheckbox).toHaveAttribute('data-state', 'unchecked')

      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/admin/brands')),
        adminPage.getByRole('button', { name: 'Tạo thương hiệu', exact: true }).click(),
      ])
      expect(response.status(), 'API tạo thương hiệu phải trả 2xx').toBeLessThan(300)
      await expect(adminPage).toHaveURL(/\/admin\/brands\/[^/]+$/, { timeout: 15_000 })
      brandId = adminPage.url().match(/\/admin\/brands\/([^/?#]+)/)?.[1] ?? null
      expect(brandId, 'Không lấy được id thương hiệu vừa tạo').toBeTruthy()
      await expect(adminPage.getByText('Tạo thương hiệu thành công.')).toBeVisible()
      await expect(adminPage.getByText('Không', { exact: true }).first()).toBeVisible()
    })

    await test.step('ẩn mềm và kiểm tra nội dung xác nhận', async () => {
      await navigateSpa(adminPage, '/admin/brands')
      await captureResponsiveList(adminPage, testInfo)
      const row = await findBrandRow(adminPage, name)
      await row.getByRole('button', { name: 'Chuyển vào Thùng rác', exact: true }).click()
      await expect(adminPage.getByRole('dialog')).toContainText('xóa mềm')
      await expect(adminPage.getByRole('dialog')).toContainText('Thùng rác')
      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.endsWith(`/admin/brands/${brandId}`)),
        confirmDialog(adminPage, 'Chuyển vào Thùng rác'),
      ])
      expect(response.status(), 'API ẩn mềm phải trả 2xx').toBeLessThan(300)
    })

    await test.step('khôi phục từ Thùng rác', async () => {
      await selectVisibility(adminPage, 'Thùng rác')
      const row = await findBrandRow(adminPage, name)
      await row.getByRole('button', { name: 'Khôi phục', exact: true }).click()
      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/admin/brands/${brandId}/restore`)),
        confirmDialog(adminPage, 'Khôi phục'),
      ])
      expect(response.status(), 'API khôi phục phải trả 2xx').toBeLessThan(300)
    })

    await test.step('ẩn lần nữa rồi xóa vĩnh viễn, xác nhận số sản phẩm chuyển thương hiệu', async () => {
      await selectVisibility(adminPage, 'Đang hiển thị')
      let row = await findBrandRow(adminPage, name)
      await row.getByRole('button', { name: 'Chuyển vào Thùng rác', exact: true }).click()
      const [hideResponse] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.endsWith(`/admin/brands/${brandId}`)),
        confirmDialog(adminPage, 'Chuyển vào Thùng rác'),
      ])
      expect(hideResponse.status(), 'API ẩn mềm trước khi xóa vĩnh viễn phải trả 2xx').toBeLessThan(300)

      await selectVisibility(adminPage, 'Thùng rác')
      row = await findBrandRow(adminPage, name)
      await row.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
      await expect(adminPage.getByRole('dialog')).toContainText('Không thể hoàn tác')
      await expect(adminPage.getByRole('dialog')).toContainText('Chưa phân loại')
      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.endsWith(`/admin/brands/${brandId}/permanent`)),
        confirmDialog(adminPage, 'Xóa vĩnh viễn'),
      ])
      expect(response.status(), 'API xóa vĩnh viễn phải trả 2xx').toBeLessThan(300)
      await expect(adminPage.getByText(/0 sản phẩm.*Chưa phân loại/)).toBeVisible()
    })

    expectRuntimeClean(collect)
  })
})
