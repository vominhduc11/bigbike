import type { TestInfo } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'

const RUN_ID = Date.now()
const CAPTURE_VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '375', width: 375, height: 812 },
]

async function captureResponsiveList(page: Page, testInfo: TestInfo) {
  for (const viewport of CAPTURE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Redirect list ${viewport.name}px`)
    const path = testInfo.outputPath(`redirect-list-after-${viewport.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach(`Redirect list after ${viewport.name}px`, { path, contentType: 'image/png' })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}

test.describe('redirect-lifecycle', () => {
  test('tạo, sửa, tắt và xóa vĩnh viễn một chuyển hướng thử nghiệm', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(120_000)

    const suffix = `${RUN_ID}${testInfo.retry ? `-r${testInfo.retry}` : ''}`
    const source = `/E2E_REDIRECT_${suffix}`
    const firstTarget = `/sp/?q=e2e-${suffix}`
    const updatedTarget = `/tim-kiem/?q=e2e-${suffix}`
    let redirectId: string | null = null
    let authorization = ''
    let deleted = false

    await testInfo.attach('Redirect list before desktop', {
      path: '.claude/skills/run-bigbike-admin/shots/admin-redirects.png',
      contentType: 'image/png',
    })

    try {
      await test.step('mở danh sách và tạo quy tắc HTTP 301', async () => {
        await navigateSpa(adminPage, '/admin/redirects')
        await expect(adminPage.getByRole('heading', { name: 'Chuyển hướng', exact: true }).first()).toBeVisible()
        await adminPage.getByRole('button', { name: 'Tạo chuyển hướng', exact: true }).click()
        await adminPage.getByPlaceholder('/dia-chi-cu').fill(source)
        await adminPage.getByPlaceholder('/dia-chi-moi').fill(firstTarget)

        const [response] = await Promise.all([
          adminPage.waitForResponse((r) => r.request().method() === 'POST'
            && new URL(r.url()).pathname.endsWith('/api/v1/admin/redirects')),
          adminPage.getByRole('button', { name: 'Lưu', exact: true }).click(),
        ])
        expect(response.status(), 'API tạo chuyển hướng phải trả 2xx').toBeLessThan(300)
        authorization = response.request().headers().authorization || ''
        redirectId = (await response.json()).data?.id ?? null
        expect(redirectId, 'Không lấy được id chuyển hướng vừa tạo').toBeTruthy()
        await expect(adminPage.getByText('Đã tạo chuyển hướng.')).toBeVisible()
      })

      await test.step('tìm đúng quy tắc và kiểm tra giao diện responsive', async () => {
        const search = adminPage.getByRole('searchbox')
        const responsePromise = adminPage.waitForResponse((r) => r.request().method() === 'GET'
          && new URL(r.url()).pathname.endsWith('/api/v1/admin/redirects')
          && new URL(r.url()).searchParams.get('q') === source)
        await search.fill(source)
        await responsePromise
        const row = adminPage.locator('tbody tr').filter({ hasText: source })
        await expect(row).toHaveCount(1)
        await expect(row).toContainText(firstTarget)
        await adminPage.getByText('Đã tạo chuyển hướng.').waitFor({ state: 'hidden', timeout: 7_000 }).catch(() => {})
        await captureResponsiveList(adminPage, testInfo)
      })

      await test.step('sửa địa chỉ mới và tắt quy tắc', async () => {
        await adminPage.getByRole('button', { name: `Sửa chuyển hướng ${source}` }).click()
        await adminPage.getByPlaceholder('/dia-chi-moi').fill(updatedTarget)
        const [updateResponse] = await Promise.all([
          adminPage.waitForResponse((r) => r.request().method() === 'PATCH'
            && new URL(r.url()).pathname.endsWith(`/api/v1/admin/redirects/${redirectId}`)),
          adminPage.getByRole('button', { name: 'Lưu', exact: true }).click(),
        ])
        expect(updateResponse.status(), 'API sửa chuyển hướng phải trả 2xx').toBeLessThan(300)

        const row = adminPage.locator('tbody tr').filter({ hasText: source })
        await expect(row).toContainText(updatedTarget)
        const [toggleResponse] = await Promise.all([
          adminPage.waitForResponse((r) => r.request().method() === 'PATCH'
            && new URL(r.url()).pathname.endsWith(`/api/v1/admin/redirects/${redirectId}`)),
          row.getByRole('button', { name: `Tắt chuyển hướng ${source}` }).click(),
        ])
        expect(toggleResponse.status(), 'API tắt chuyển hướng phải trả 2xx').toBeLessThan(300)
        await expect(row).toContainText('Tắt')
      })

      await test.step('xác nhận cảnh báo rồi xóa vĩnh viễn', async () => {
        const row = adminPage.locator('tbody tr').filter({ hasText: source })
        await row.getByRole('button', { name: `Xóa chuyển hướng ${source}` }).click()
        const dialog = adminPage.getByRole('dialog')
        await expect(dialog).toContainText('không thể hoàn tác')
        await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
        await expect(row).toHaveCount(1)

        await row.getByRole('button', { name: `Xóa chuyển hướng ${source}` }).click()
        const [deleteResponse] = await Promise.all([
          adminPage.waitForResponse((r) => r.request().method() === 'DELETE'
            && new URL(r.url()).pathname.endsWith(`/api/v1/admin/redirects/${redirectId}`)),
          adminPage.getByRole('dialog').getByRole('button', { name: 'Xoá', exact: true }).click(),
        ])
        expect(deleteResponse.status(), 'API xóa chuyển hướng phải trả 204').toBe(204)
        deleted = true
        await expect(row).toHaveCount(0)
      })

      expectRuntimeClean(collect)
    } finally {
      if (redirectId && !deleted && authorization) {
        await adminPage.request.delete(`/api/v1/admin/redirects/${redirectId}`, {
          headers: { Authorization: authorization },
        })
      }
    }
  })
})
