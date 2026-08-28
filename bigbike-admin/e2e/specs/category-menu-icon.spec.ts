import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

const RUN_ID = Date.now()
const PREFIX = `E2E_CATEGORY_MENU_${RUN_ID}`

function categoryName(kind: string) {
  return `${PREFIX}_${kind}`
}

function categorySlug(kind: string) {
  return `e2e-category-menu-${RUN_ID}-${kind.toLowerCase()}`
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

async function confirmDialog(page: Page, action: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: action, exact: true }).click()
}

async function openRowMenu(page: Page, name: string, action: string) {
  const row = page.locator('tbody tr').filter({ hasText: name })
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: 'Thao tác', exact: true }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

async function selectStatus(page: Page, label: RegExp) {
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: label }).click()
}

async function cleanupCategories(page: Page) {
  await navigateSpa(page, '/admin/categories')
  await page.getByRole('tab', { name: 'Dạng danh sách', exact: true }).click()
  const search = page.locator('input[type="search"]')

  async function findRow(name: string) {
    await search.fill(name)
    // Wait for the debounced query to replace the previous result before
    // deciding whether this E2E record still exists.
    await expect(page.getByText(`Tìm: "${name}"`, { exact: true })).toBeVisible()
    return page.locator('tbody tr').filter({ hasText: name })
  }

  // Delete child before parent so the cleanup remains safe if the API cascades
  // descendants when a parent is moved to Trash.
  for (const name of [categoryName('CHILD'), categoryName('PARENT')]) {
    const row = await findRow(name)
    if (await row.count() === 0) continue
    await openRowMenu(page, name, 'Xoá')
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'DELETE'
        && /\/admin\/categories\/[^/]+$/.test(new URL(r.url()).pathname)),
      confirmDialog(page, 'Chuyển vào Thùng rác'),
    ])
  }

  await selectStatus(page, /Thùng rác/)
  for (const name of [categoryName('CHILD'), categoryName('PARENT')]) {
    const row = await findRow(name)
    if (await row.count() === 0) continue
    await openRowMenu(page, name, 'Xoá vĩnh viễn')
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === 'DELETE'
        && new URL(r.url()).pathname.endsWith('/permanent')),
      confirmDialog(page, 'Xoá vĩnh viễn'),
    ])
  }
}

test.describe('E2E_CATEGORY_menu_icon', () => {
  test('ẩn biểu tượng ở danh mục con, lưu được và hiện lại khi bỏ cha', async ({ adminPage, collect }) => {
    test.setTimeout(120_000)

    const parentName = categoryName('PARENT')
    const childName = categoryName('CHILD')
    let parentId: string | null = null
    let childId: string | null = null

    try {
      parentId = await createCategory(adminPage, parentName, categorySlug('parent'))
      expect(parentId).toBeTruthy()
      childId = await createCategory(adminPage, childName, categorySlug('child'))
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
    } finally {
      await cleanupCategories(adminPage)
    }

    expectRuntimeClean(collect)
  })
})
