import { test as base, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { navigateSpa, expectNoHorizontalOverflow } from '../utils/quality'

// Existing VPS records are only edited in unsaved browser forms. The save test
// creates and removes its own exact draft ID, without the suite's global purge.
const test = base.extend({
  e2eDataGuard: [
    async ({}, use) => {
      await use({ purge: async () => {} })
    },
    { scope: 'worker', auto: true },
  ],
})
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]

test('real catalog choices and recovered article tables remain editable without saving', async ({
  adminPage: page,
  collect,
}, testInfo) => {
  test.setTimeout(180000)
  const mutations: string[] = []
  page.on('request', (request) => {
    if (
      !['GET', 'HEAD'].includes(request.method()) &&
      /\/api\/v1\/admin\/(products|content|size-scales|attributes)/.test(request.url())
    )
      mutations.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  expect(process.env.E2E_PRODUCT_ID, 'Supply a real product ID with many options').toBeTruthy()
  expect(process.env.E2E_ARTICLE_ID, 'Supply a real legacy article containing a table').toBeTruthy()

  await navigateSpa(page, `/admin/products/${process.env.E2E_PRODUCT_ID}`)
  const choices = page
    .locator('.detail-section')
    .filter({ has: page.getByRole('heading', { name: 'Lựa chọn sản phẩm', exact: true }) })
  await expect(choices).toBeVisible()
  await expect(
    choices.getByText('Chọn điểm khác nhau giữa các lựa chọn', { exact: true }),
  ).toBeVisible()
  await expect(
    choices.getByRole('button', { name: /Nhân bản|Tạo nhanh|Điền giá cho/ }),
  ).toHaveCount(0)
  await expect(choices.getByText('Thuộc tính khác', { exact: true })).toHaveCount(0)
  await expect(choices.getByText('Tạo loại thuộc tính mới', { exact: true })).toHaveCount(0)
  const attributesResponse = await page.request.get('/api/v1/admin/attributes')
  expect(attributesResponse.ok(), await attributesResponse.text()).toBeTruthy()
  const attributesPayload = await attributesResponse.json()
  const attributes = Array.isArray(attributesPayload)
    ? attributesPayload
    : attributesPayload.data || []
  const typeGroup = choices.getByRole('group', {
    name: 'Chọn điểm khác nhau giữa các lựa chọn',
    exact: true,
  })
  await expect(typeGroup.getByRole('checkbox')).toHaveCount(attributes.length)
  await expect(typeGroup.getByRole('checkbox', { name: 'Màu', exact: true })).toBeVisible()
  await expect(typeGroup.getByRole('checkbox', { name: 'Cỡ', exact: true })).toBeVisible()
  await expect(choices.locator('tbody [role="checkbox"]')).toHaveCount(0)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await choices
      .getByRole('heading', { name: 'Lựa chọn sản phẩm', exact: true })
      .scrollIntoViewIfNeeded()
    await expectNoHorizontalOverflow(page, `existing choices ${viewport.width}`)
    await page.screenshot({ path: testInfo.outputPath(`choices-${viewport.width}.png`) })
  }

  await page.setViewportSize(viewports[0])
  await navigateSpa(page, '/admin/products/new')
  const newChoices = page
    .locator('.detail-section')
    .filter({ has: page.getByRole('heading', { name: 'Lựa chọn sản phẩm', exact: true }) })
  await expect(newChoices.getByRole('table')).toHaveCount(0)
  await newChoices.getByRole('button', { name: 'Một kiểu duy nhất', exact: true }).click()
  await expect(newChoices.getByRole('table')).toHaveCount(0)
  await newChoices.getByRole('button', { name: /Nhiều màu/ }).click()
  await newChoices.getByRole('checkbox', { name: 'Màu', exact: true }).check()
  await expect(newChoices.getByLabel('Bảng cỡ áp dụng', { exact: true })).toHaveCount(0)
  // Values come from the running backend; choose the first actual color.
  const color = newChoices.locator('div.max-h-64').first().getByRole('checkbox').first()
  await color.check()
  await expect(newChoices.locator('tbody tr').first()).toBeVisible()
  await expect(newChoices.getByText(/Thiếu ảnh màu/).first()).toBeVisible()
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await expectNoHorizontalOverflow(page, `new choices ${viewport.width}`)
  }

  await page.setViewportSize(viewports[0])
  await navigateSpa(page, `/admin/content/article/${process.env.E2E_ARTICLE_ID}`)
  const body = page
    .locator('.detail-section')
    .filter({ has: page.getByRole('heading', { name: /^Nội dung chính/ }) })
  await expect(body).toBeVisible()
  await expect(body.getByText('Mô tả cũ', { exact: true })).toHaveCount(0)
  expect(
    await body.locator('.ProseMirror').count(),
    'Long articles only mount expanded editors',
  ).toBeLessThanOrEqual(1)
  const tableToggle = body
    .getByText('Bảng biểu', { exact: true })
    .first()
    .locator('..')
    .getByRole('button', { name: 'Mở khối', exact: true })
  await tableToggle.click()
  const table = body.locator('.ProseMirror table').first()
  await expect(table).toBeVisible()
  const cell = table.locator('td,th').first()
  await cell.click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(' E2E_UNSAVED')
  await expect(cell).toContainText('E2E_UNSAVED')
  await expect(body.getByRole('button', { name: /Sao chép/ })).toHaveCount(0)
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await table.scrollIntoViewIfNeeded()
    await expectNoHorizontalOverflow(page, `article table ${viewport.width}`)
    await page.screenshot({ path: testInfo.outputPath(`article-table-${viewport.width}.png`) })
  }
  expect(mutations, 'Opening/editing unsaved forms must not write stored catalog/content').toEqual(
    [],
  )
  expectRuntimeClean(collect)
})

test('generated options save as a draft with inherited prices and keep existing rows when adding a color', async ({
  adminPage: page,
  authHolder,
  collect,
}) => {
  test.setTimeout(120000)
  const rootSku = `E2E_PRODUCT_CHOICES_${Date.now()}`
  let createdId = ''
  const headers = { Authorization: `Bearer ${authHolder.accessToken}` }
  try {
    await navigateSpa(page, '/admin/products/new')
    const basic = page
      .locator('.detail-section')
      .filter({ has: page.getByRole('heading', { name: /^Thông tin cơ bản/ }) })
    await basic.getByLabel('Tên', { exact: false }).fill(rootSku)
    await basic.getByLabel(/SKU|Mã sản phẩm/).fill(rootSku)
    await basic.getByRole('button', { name: '— Chọn danh mục —' }).click()
    await page.getByRole('dialog').last().getByRole('checkbox').first().check()
    await page.keyboard.press('Escape')
    await basic.getByRole('combobox').first().click()
    await page.getByRole('option').first().click()
    await page.locator('.lang-switcher').getByRole('button', { name: 'EN', exact: true }).click()
    await basic.getByLabel('Tên', { exact: false }).fill(`${rootSku} English`)
    await page.locator('.lang-switcher').getByRole('button', { name: 'VI', exact: true }).click()
    const price = page
      .locator('.detail-section')
      .filter({ has: page.getByRole('heading', { name: /^Giá & trạng thái/ }) })
    await price.getByLabel('Giá niêm yết', { exact: false }).fill('590000')
    const choices = page
      .locator('.detail-section')
      .filter({ has: page.getByRole('heading', { name: 'Lựa chọn sản phẩm', exact: true }) })
    await choices.getByRole('button', { name: /Nhiều màu/ }).click()
    await choices.getByRole('checkbox', { name: 'Màu', exact: true }).check()
    const colorValues = choices.locator('div.max-h-64').first().getByRole('checkbox')
    await colorValues.first().check()
    const created = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/v1/admin/products',
    )
    await page
      .getByRole('button', { name: /Tạo sản phẩm|Lưu nháp/, exact: true })
      .last()
      .click()
    const response = await created
    expect(response.ok(), await response.text()).toBeTruthy()
    const item = (await response.json()).data
    createdId = item.id
    expect(item.publishStatus).toBe('DRAFT')
    expect(item.variants).toHaveLength(1)
    const request = response.request().postDataJSON()
    expect(request.variants[0].retailPrice ?? null).toBeNull()
    expect(request.variants[0].sku).toMatch(new RegExp(`^${rootSku}-`))
    const firstId = item.variants[0].id
    const row = choices.locator('tbody tr').first()
    await row.getByRole('textbox', { name: /^Mã sản phẩm/ }).fill(`${rootSku}-CUSTOM`)
    await row.getByRole('textbox', { name: /^Giá niêm yết/ }).fill('650000')
    await row.getByRole('switch').uncheck()
    await colorValues.nth(1).check()
    const updated = page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'PATCH' &&
        new URL(candidate.url()).pathname === `/api/v1/admin/products/${createdId}`,
    )
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click()
    const saved = await updated
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const persisted = (await saved.json()).data
    expect(persisted.variants).toHaveLength(2)
    expect(persisted.variants[0]).toMatchObject({ id: firstId, sku: `${rootSku}-CUSTOM` })
    const changed = saved.request().postDataJSON().variants
    expect(changed[0]).toMatchObject({ retailPrice: 650000, isAvailable: false })
    expect(changed[1].retailPrice ?? null).toBeNull()
    expectRuntimeClean(collect)
  } finally {
    if (createdId) {
      // Cleanup is restricted to the exact E2E record created in this test.
      const check = await page.request.get(`/api/v1/admin/products/${createdId}`, { headers })
      expect(check.ok()).toBeTruthy()
      expect((await check.json()).data.sku).toBe(rootSku)
      const trashed = await page.request.delete(`/api/v1/admin/products/${createdId}`, { headers })
      expect(trashed.ok()).toBeTruthy()
      const removed = await page.request.delete(`/api/v1/admin/products/${createdId}/permanent`, {
        headers,
      })
      expect(removed.ok()).toBeTruthy()
    }
  }
})
