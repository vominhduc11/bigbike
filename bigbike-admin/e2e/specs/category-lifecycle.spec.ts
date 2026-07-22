import type { TestInfo } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'

const RUN_ID = Date.now()

function categoryName(retry: number) {
  return `E2E_CATEGORY_${RUN_ID}${retry ? `_r${retry}` : ''}`
}

function categorySlug(retry: number) {
  return `e2e-category-${RUN_ID}${retry ? `-r${retry}` : ''}`
}

async function findCategoryRow(page: Page, name: string) {
  const search = page.locator('input[type="search"]')
  await search.fill(name)
  const row = page.locator('tbody tr').filter({ hasText: name })
  await expect(row, `Không tìm thấy danh mục thử nghiệm ${name}`).toHaveCount(1, { timeout: 10_000 })
  return row
}

async function selectTrashFilter(page: Page, value: 'Hoạt động' | 'Thùng rác') {
  const statusFilter = page.getByRole('combobox').first()
  await statusFilter.click()
  await page.getByRole('option', { name: value, exact: true }).click()
}

async function confirmDialog(page: Page, action: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: action, exact: true }).click()
}

async function captureCategoryScreens(page: Page, testInfo: TestInfo, label: string) {
  const viewports = [
    { name: '1440', width: 1440, height: 1000 },
    { name: '768', width: 768, height: 1024 },
    { name: '375', width: 375, height: 812 },
  ]

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Category ${label} ${viewport.name}px`)
    const path = testInfo.outputPath(`category-${label}-${viewport.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach(`Category ${label} ${viewport.name}px`, { path, contentType: 'image/png' })
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
}

async function purgePriorE2ECategories(page: Page) {
  // Failed runs can leave records behind. This guard deliberately searches for
  // the E2E_CATEGORY_ prefix and never operates on any other shop category.
  await navigateSpa(page, '/admin/categories')
  await page.getByRole('tab', { name: 'Dạng danh sách', exact: true }).click()
  const search = page.locator('input[type="search"]')
  await search.fill('E2E_CATEGORY_')

  let rows = page.locator('tbody tr').filter({ hasText: 'E2E_CATEGORY_' })
  while (await rows.count()) {
    const previousCount = await rows.count()
    const row = rows.first()
    await row.getByRole('button', { name: 'Xoá', exact: true }).click()
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'DELETE'
        && /\/admin\/categories\/[^/]+$/.test(new URL(r.url()).pathname)),
      confirmDialog(page, 'Xoá'),
    ])
    await expect(rows).toHaveCount(previousCount - 1)
    rows = page.locator('tbody tr').filter({ hasText: 'E2E_CATEGORY_' })
  }

  await selectTrashFilter(page, 'Thùng rác')
  rows = page.locator('tbody tr').filter({ hasText: 'E2E_CATEGORY_' })
  while (await rows.count()) {
    const previousCount = await rows.count()
    const row = rows.first()
    await row.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'DELETE'
        && new URL(r.url()).pathname.endsWith('/permanent')),
      confirmDialog(page, 'Xóa vĩnh viễn'),
    ])
    await expect(rows).toHaveCount(previousCount - 1)
    rows = page.locator('tbody tr').filter({ hasText: 'E2E_CATEGORY_' })
  }
}

test.describe('E2E_CATEGORY_lifecycle', () => {
  test('tạo song ngữ, ẩn, xóa mềm, khôi phục và xóa vĩnh viễn danh mục thử nghiệm', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(120_000)

    const name = categoryName(testInfo.retry)
    const slug = categorySlug(testInfo.retry)
    let categoryId: string | null = null

    await purgePriorE2ECategories(adminPage)

    await test.step('tạo song ngữ, mặc định không gửi vị trí Trang chủ khi chưa bật', async () => {
      await navigateSpa(adminPage, '/admin/categories/new')
      await adminPage.locator('#category-form input[name="name"]').fill(name)
      await adminPage.locator('#category-form input[name="slug"]').fill(slug)

      const homepageCheckbox = adminPage.locator('#category-form [role="checkbox"]')
      await expect(homepageCheckbox).toHaveAttribute('data-state', 'unchecked')

      await adminPage.locator('.lang-switcher').first().getByRole('button', { name: 'EN', exact: true }).click()
      await adminPage.locator('#category-form input[name="translations.en.name"]').fill(`${name} English`)
      await adminPage.locator('.lang-switcher').first().getByRole('button', { name: 'VI', exact: true }).click()

      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/admin/categories')),
        adminPage.getByRole('button', { name: 'Tạo danh mục', exact: true }).click(),
      ])
      expect(response.status(), 'API tạo danh mục phải trả 2xx').toBeLessThan(300)
      expect(response.request().postDataJSON()).not.toHaveProperty('showOnHomepage')
      await expect(adminPage).toHaveURL(/\/admin\/categories\/[^/]+$/, { timeout: 15_000 })
      categoryId = adminPage.url().match(/\/admin\/categories\/([^/?#]+)/)?.[1] ?? null
      expect(categoryId, 'Không lấy được id danh mục vừa tạo').toBeTruthy()

      await captureCategoryScreens(adminPage, testInfo, 'detail')
    })

    await test.step('xem cây và danh sách ở ba kích thước', async () => {
      await navigateSpa(adminPage, '/admin/categories')
      await adminPage.getByRole('tab', { name: 'Dạng cây', exact: true }).click()
      await captureCategoryScreens(adminPage, testInfo, 'tree')
      await adminPage.getByRole('tab', { name: 'Dạng danh sách', exact: true }).click()
      await captureCategoryScreens(adminPage, testInfo, 'list')
    })

    await test.step('ẩn khỏi website là thao tác riêng, không chuyển vào Thùng rác', async () => {
      const row = await findCategoryRow(adminPage, name)
      await row.getByRole('button', { name: 'Ẩn', exact: true }).click()
      await expect(adminPage.getByRole('dialog')).toContainText('không bị chuyển vào Thùng rác')
      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'PATCH' && new URL(r.url()).pathname.endsWith(`/admin/categories/${categoryId}`)),
        confirmDialog(adminPage, 'Ẩn khỏi website'),
      ])
      expect(response.status(), 'Ẩn danh mục phải trả 2xx').toBeLessThan(300)
    })

    await test.step('xóa mềm, khôi phục từ Thùng rác và xem trước xóa vĩnh viễn', async () => {
      let row = await findCategoryRow(adminPage, name)
      await row.getByRole('button', { name: 'Xoá', exact: true }).click()
      const [softDeleteResponse] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.endsWith(`/admin/categories/${categoryId}`)),
        confirmDialog(adminPage, 'Xoá'),
      ])
      expect(softDeleteResponse.status(), 'Xóa mềm phải trả 2xx').toBeLessThan(300)

      await selectTrashFilter(adminPage, 'Thùng rác')
      row = await findCategoryRow(adminPage, name)
      await row.getByRole('button', { name: 'Khôi phục', exact: true }).click()
      const [restoreResponse] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/admin/categories/${categoryId}/restore`)),
        confirmDialog(adminPage, 'Khôi phục'),
      ])
      expect(restoreResponse.status(), 'Khôi phục phải trả 2xx').toBeLessThan(300)

      await selectTrashFilter(adminPage, 'Hoạt động')
      row = await findCategoryRow(adminPage, name)
      await row.getByRole('button', { name: 'Xoá', exact: true }).click()
      await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.endsWith(`/admin/categories/${categoryId}`)),
        confirmDialog(adminPage, 'Xoá'),
      ])

      await selectTrashFilter(adminPage, 'Thùng rác')
      row = await findCategoryRow(adminPage, name)
      await row.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
      await expect(adminPage.getByRole('dialog')).toContainText('sản phẩm sẽ bị gỡ liên kết')
      await expect(adminPage.getByRole('dialog')).toContainText('sản phẩm không còn danh mục nào')
      const [permanentDeleteResponse] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.endsWith(`/admin/categories/${categoryId}/permanent`)),
        confirmDialog(adminPage, 'Xóa vĩnh viễn'),
      ])
      expect(permanentDeleteResponse.status(), 'Xóa vĩnh viễn phải trả 2xx').toBeLessThan(300)
    })

    // The lifecycle permanently deletes the sole E2E_CATEGORY_* record. Any
    // cleanup added later must retain the prefix guard and never touch shop data.
    expectRuntimeClean(collect)
  })
})
