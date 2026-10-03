import {
  testAnon as test,
  expect,
  expectRuntimeClean,
  apiLoginSession,
  resetCollectors,
} from '../fixtures/admin-test'
import { request as apiRequest, type Locator } from '@playwright/test'
import { BASE_URL } from '../utils/env'
import { expectNoHorizontalOverflow, expectWithinViewport, navigateSpa } from '../utils/quality'

type Attribute = { id: string; code: string; name: string }
type CreatedValue = { id: string; label: string }

function payloadData(payload: unknown) {
  return payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data: unknown }).data
    : payload
}

test('attribute value English fields stay scoped while safe E2E values can be saved', async ({
  page,
  collect,
}) => {
  test.setTimeout(180_000)
  const runId = Date.now()
  const created: CreatedValue[] = []

  // This focused test owns and deletes only its exact, prefixed dictionary
  // values. It avoids the suite-wide cleanup scan, which can exceed a single
  // test's setup budget on a production-sized catalog before this UI flow
  // begins.
  const authHolder = await apiLoginSession(page.request)
  await page.context().addCookies([
    {
      name: 'bb_admin_refresh',
      value: authHolder.refreshCookie,
      domain: new URL(BASE_URL).hostname,
      path: '/api/v1/auth',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ])
  const headers = { Authorization: `Bearer ${authHolder.accessToken}` }
  const cleanupApi = await apiRequest.newContext({ baseURL: BASE_URL })

  const attributesResponse = await page.request.get('/api/v1/admin/attributes', { headers })
  expect(attributesResponse.ok(), await attributesResponse.text()).toBeTruthy()
  const attributes = payloadData(await attributesResponse.json()) as Attribute[]
  const byCode = (code: string) => {
    const attribute = attributes.find((item) => item.code === code)
    expect(attribute, `missing immutable attribute ${code}`).toBeTruthy()
    return attribute!
  }
  const cleanupValue = async (value: CreatedValue) => {
    expect(value.id, `cleanup value ID for ${value.label}`).toBeTruthy()
    expect(value.label.startsWith('E2E_ATTRIBUTE_'), `cleanup marker ${value.id}`).toBe(true)
    const deleted = await cleanupApi.delete(`/api/v1/admin/attribute-values/${value.id}`, {
      headers,
    })
    expect(deleted.ok(), await deleted.text()).toBeTruthy()
  }
  const clearAbandonedTestValues = async () => {
    // The marker is exclusive to this test's disposable dictionary values.
    // Clear an interrupted prior attempt before starting a fresh one.
    for (const code of ['color', 'bo', 'co-oc']) {
      const response = await cleanupApi.get(`/api/v1/admin/attributes/${byCode(code).id}/values`, {
        headers,
      })
      expect(response.ok(), await response.text()).toBeTruthy()
      const values = payloadData(await response.json()) as CreatedValue[]
      for (const value of values.filter(({ label }) => label.startsWith('E2E_ATTRIBUTE_'))) {
        await cleanupValue(value)
      }
    }
  }
  const visibleLabel = (attribute: Attribute) =>
    attribute.code === 'color' ? 'Màu' : attribute.code === 'size' ? 'Cỡ' : attribute.name

  async function close(dialog: Locator) {
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).last().click()
    await expect(dialog).toBeHidden()
  }

  try {
    await clearAbandonedTestValues()
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 20_000 })
    resetCollectors(collect)
    await navigateSpa(page, '/admin/products/new')
    const choices = page
      .locator('.detail-section')
      .filter({ has: page.getByRole('heading', { name: 'Lựa chọn sản phẩm', exact: true }) })
    await choices.getByRole('button', { name: 'Nhiều màu / nhiều cỡ', exact: true }).click()
    const typeGroup = choices.getByRole('group', {
      name: 'Chọn điểm khác nhau giữa các lựa chọn',
      exact: true,
    })

    async function openValueManager(attribute: Attribute) {
      const label = visibleLabel(attribute)
      const checkbox = typeGroup.getByRole('checkbox', { name: label, exact: true })
      if ((await checkbox.getAttribute('data-state')) !== 'checked') await checkbox.check()
      const manage = choices.getByRole('button', {
        name: `Thêm ${attribute.name}`,
        exact: true,
      })
      await expect(manage).toBeVisible()
      await manage.click()
      const dialog = page.getByRole('dialog').last()
      await expect(dialog).toBeVisible()
      return dialog
    }

    // The managers available from this multi-choice view have no English input
    // for the non-managed dictionary codes.
    for (const code of ['color', 'gender', 'model', 'iphone', 'chieu-dai']) {
      const dialog = await openValueManager(byCode(code))
      await expect(dialog.getByPlaceholder('Tên tiếng Anh (tùy chọn)')).toHaveCount(0)
      await close(dialog)
    }

    // Size values are intentionally separate from size-filter groups. Its group
    // still requires English, and the modal remains usable at phone width.
    const size = byCode('size')
    const sizeCheckbox = typeGroup.getByRole('checkbox', { name: visibleLabel(size), exact: true })
    await sizeCheckbox.check()
    await choices.getByRole('button', { name: 'Quản lý bảng cỡ', exact: true }).click()
    const sizeDialog = page.getByRole('dialog').last()
    await expect(sizeDialog).toBeVisible()
    await sizeDialog.getByRole('tab', { name: 'Nhóm lọc', exact: true }).click()
    const groupEnglish = sizeDialog
      .locator('label')
      .filter({ hasText: 'Tên hiển thị (tiếng Anh)' })
      .locator('input')
    await expect(groupEnglish).toBeVisible()
    await sizeDialog.getByRole('button', { name: 'Tạo mới', exact: true }).click()
    await sizeDialog
      .locator('label')
      .filter({ hasText: 'Tên hiển thị (tiếng Việt)' })
      .locator('input')
      .fill(`E2E_ATTRIBUTE_group_${runId}`)
    await expect(sizeDialog.getByRole('button', { name: 'Lưu', exact: true })).toBeDisabled()
    await page.setViewportSize({ width: 375, height: 812 })
    await expectWithinViewport(page, sizeDialog, 'size-filter group modal @375')
    await expectNoHorizontalOverflow(page, 'size-filter group modal @375')
    await page.setViewportSize({ width: 1440, height: 900 })
    await close(sizeDialog)

    // A temporary color proves the normal CRUD path does not submit an English
    // field or reject an empty one. It is deleted by exact, prefixed ID below.
    const color = byCode('color')
    const colorDialog = await openValueManager(color)
    const colorLabel = `E2E_ATTRIBUTE_COLOR_${runId}`
    const colorCreated = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/api/v1/admin/attributes/${color.id}/values`,
    )
    await colorDialog.getByPlaceholder('Ví dụ: Đỏ đô, M, iPhone 15 Pro').fill(colorLabel)
    await colorDialog.getByRole('button', { name: 'Thêm', exact: true }).click()
    const colorResponse = await colorCreated
    expect(colorResponse.ok(), await colorResponse.text()).toBeTruthy()
    expect(colorResponse.request().postDataJSON()).toEqual({ label: colorLabel })
    const colorValue = payloadData(await colorResponse.json()) as CreatedValue
    created.push({ id: colorValue.id, label: colorLabel })
    await close(colorDialog)

    // Both approved dictionary codes retain a working English input and PATCH
    // only that English label on a disposable, unused value.
    for (const code of ['bo', 'co-oc']) {
      const attribute = byCode(code)
      const dialog = await openValueManager(attribute)
      const label = `E2E_ATTRIBUTE_${code}_${runId}`
      const english = `E2E English ${code} ${runId}`
      const editedEnglish = `${english} saved`
      expect(
        await dialog.getByPlaceholder('Tên tiếng Anh (tùy chọn)').count(),
      ).toBeGreaterThanOrEqual(2)
      const createdResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === `/api/v1/admin/attributes/${attribute.id}/values`,
      )
      await dialog.getByPlaceholder('Ví dụ: Đỏ đô, M, iPhone 15 Pro').fill(label)
      await dialog.getByPlaceholder('Tên tiếng Anh (tùy chọn)').first().fill(english)
      await dialog.getByRole('button', { name: 'Thêm', exact: true }).click()
      const createResponse = await createdResponse
      expect(createResponse.ok(), await createResponse.text()).toBeTruthy()
      const createdValue = payloadData(await createResponse.json()) as CreatedValue
      created.push({ id: createdValue.id, label })

      const row = dialog.locator(`input[value="${label}"]`).locator('xpath=../..')
      await expect(row).toBeVisible()
      const patched = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          new URL(response.url()).pathname === `/api/v1/admin/attribute-values/${createdValue.id}`,
      )
      await row.getByPlaceholder('Tên tiếng Anh (tùy chọn)').fill(editedEnglish)
      await row.getByRole('button', { name: 'Lưu', exact: true }).click()
      const patchResponse = await patched
      expect(patchResponse.ok(), await patchResponse.text()).toBeTruthy()
      expect(patchResponse.request().postDataJSON()).toEqual({ label, labelEn: editedEnglish })
      await close(dialog)
    }

    expectRuntimeClean(collect)
  } finally {
    try {
      for (const value of created.reverse()) await cleanupValue(value)
    } finally {
      await cleanupApi.dispose()
    }
  }
})
