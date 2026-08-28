import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

const RUN_ID = Date.now()

function categoryName(kind: string, retry: number) {
  return `E2E_CATEGORY_MENU_${RUN_ID}${retry ? `_R${retry}` : ''}_${kind}`
}

function categorySlug(kind: string, retry: number) {
  return `e2e-category-menu-${RUN_ID}${retry ? `-r${retry}` : ''}-${kind.toLowerCase()}`
}

async function createCategory(page: Page, name: string, slug: string) {
  await navigateSpa(page, '/admin/categories/new')
  await page.locator('#category-form input[name="name"]').fill(name)
  await page.locator('#category-form input[name="slug"]').fill(slug)

  await page.locator('.lang-switcher').first().getByRole('button', { name: 'EN', exact: true }).click()
  await page.locator('#category-form input[name="translations.en.name"]').fill(`${name} English`)
  await page.locator('.lang-switcher').first().getByRole('button', { name: 'VI', exact: true }).click()

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/admin/categories')),
    page.getByRole('button', { name: 'Tạo danh mục', exact: true }).first().click(),
  ])
  expect(response.status(), 'API tạo danh mục thử nghiệm phải trả 2xx').toBeLessThan(300)
  await expect(page).toHaveURL(/\/admin\/categories\/[^/]+$/, { timeout: 15_000 })
  return page.url().match(/\/admin\/categories\/([^/?#]+)/)?.[1] ?? null
}

test.describe('E2E_CATEGORY_menu_icon', () => {
  test('ẩn biểu tượng ở danh mục con, lưu được và hiện lại khi bỏ cha', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(120_000)

    const parentName = categoryName('PARENT', testInfo.retry)
    const childName = categoryName('CHILD', testInfo.retry)
    let parentId: string | null = null
    let childId: string | null = null

    parentId = await createCategory(adminPage, parentName, categorySlug('parent', testInfo.retry))
    expect(parentId).toBeTruthy()
    childId = await createCategory(adminPage, childName, categorySlug('child', testInfo.retry))
    expect(childId).toBeTruthy()

    const menuField = adminPage.locator('[data-field="menuIconUrl"]')
    await expect(menuField).toBeVisible()
    await expect(adminPage.getByText('0/5', { exact: true })).toBeVisible()

    const parentSelect = adminPage.locator('#category-parent-select')
    await parentSelect.click()
    await adminPage.getByRole('option', { name: parentName, exact: true }).click()
    await expect(menuField).toHaveCount(0)
    await expect(adminPage.getByText('0/4', { exact: true })).toBeVisible()

    await adminPage.locator('#category-form input[name="name"]').fill(`${childName}_EDITED`)
    const [updateResponse] = await Promise.all([
      adminPage.waitForResponse((r) => r.request().method() === 'PATCH'
        && new URL(r.url()).pathname.endsWith(`/admin/categories/${childId}`)),
      adminPage.getByRole('button', { name: 'Lưu thay đổi', exact: true }).first().click(),
    ])
    expect(updateResponse.status(), 'API lưu danh mục con phải trả 2xx').toBeLessThan(300)
    await expect(menuField).toHaveCount(0)

    await navigateSpa(adminPage, '/admin/categories')
    await navigateSpa(adminPage, `/admin/categories/${childId}`)
    await expect(menuField).toHaveCount(0)
    await expect(adminPage.getByText('0/4', { exact: true })).toBeVisible()

    await parentSelect.click()
    await adminPage.getByRole('option', { name: /danh mục gốc/i }).click()
    await expect(menuField).toBeVisible()
    await expect(adminPage.getByText('0/5', { exact: true })).toBeVisible()

    expectRuntimeClean(collect)
  })
})
