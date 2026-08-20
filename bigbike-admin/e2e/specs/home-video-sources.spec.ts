import type { TestInfo } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa, waitForScreenReady } from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'

const RUN_ID = Date.now()
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const CAPTURE_VIEWPORTS = VIEWPORTS.filter((viewport) =>
  ['1440x900', '768x1024', '375x812'].includes(viewport.name),
)

function videoTitle(retry: number) {
  return `E2E_HOME_VIDEO_${RUN_ID}${retry ? `_r${retry}` : ''}`
}

function findVideoCard(page: Page, title: string) {
  return page.locator('.bb-slider-card').filter({ hasText: title })
}

async function deleteVideoCard(page: Page, card: ReturnType<typeof findVideoCard>) {
  await card.getByRole('button', { name: /Xoá|Xóa/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(/Xoá video này\?|Xóa video này\?/)
  const [deleteResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.includes('/admin/home-videos/'),
    ),
    dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click(),
  ])
  expect(deleteResponse.status(), 'API dọn video E2E phải trả 2xx').toBeLessThan(300)
}

async function cleanupTaggedVideos(page: Page) {
  const taggedCards = findVideoCard(page, 'E2E_HOME_VIDEO_')
  while (await taggedCards.count()) {
    const previousCount = await taggedCards.count()
    await deleteVideoCard(page, taggedCards.first())
    await expect(taggedCards).toHaveCount(previousCount - 1)
  }
}

async function captureResponsiveList(page: Page, testInfo: TestInfo) {
  for (const viewport of CAPTURE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Home video list ${viewport.name}`)
    const path = testInfo.outputPath(`home-video-sources-${viewport.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach(`Home video sources ${viewport.name}`, { path, contentType: 'image/png' })
  }
}

test.describe('home-video-sources', () => {
  test('chỉ tạo video YouTube/Upload và dọn sạch dữ liệu thử', async ({
    adminPage,
    collect,
  }, testInfo) => {
    test.setTimeout(120_000)
    const title = videoTitle(testInfo.retry)
    let created = false

    try {
      await navigateSpa(adminPage, '/admin/home-videos')
      await waitForScreenReady(adminPage)
      await cleanupTaggedVideos(adminPage)
      await adminPage.getByRole('button', { name: 'Thêm video', exact: true }).click()

      const form = adminPage.locator('form')
      const sourceRadios = form.getByRole('radio')
      await expect(sourceRadios).toHaveCount(2)
      await expect(form.getByRole('radio', { name: 'YouTube', exact: true })).toBeVisible()
      await expect(
        form.getByRole('radio', { name: 'Upload / thư viện media', exact: true }),
      ).toBeVisible()
      await expect(form).not.toContainText(/TikTok|Facebook/i)

      await form.locator('input').nth(0).fill(title)
      await form.locator('input[placeholder*="youtube.com"]').fill(YOUTUBE_URL)

      const [createResponse] = await Promise.all([
        adminPage.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname.endsWith('/admin/home-videos'),
        ),
        form.getByRole('button', { name: 'Thêm', exact: true }).click(),
      ])
      expect(createResponse.status(), 'API tạo video trang chủ phải trả 2xx').toBeLessThan(300)
      created = true

      await expect(findVideoCard(adminPage, title)).toHaveCount(1)
      await captureResponsiveList(adminPage, testInfo)
    } finally {
      if (created) {
        await adminPage.setViewportSize({ width: 1440, height: 900 })
        await navigateSpa(adminPage, '/admin/home-videos')
        const card = findVideoCard(adminPage, title)
        await expect(card, `Không tìm thấy bản ghi E2E cần dọn: ${title}`).toHaveCount(1)
        await deleteVideoCard(adminPage, card)
        await expect(findVideoCard(adminPage, title)).toHaveCount(0)
      }
    }

    expectRuntimeClean(collect)
  })
})
