import type { Locator, TestInfo } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import {
  expectNoHorizontalOverflow,
  gotoAdmin,
  navigateSpa,
  waitForScreenReady,
} from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'

const RUN_ID = Date.now()
const BODY =
  'Nội dung kiểm thử tự động cho module Tin tức. Bản ghi này chỉ phục vụ E2E và sẽ được xóa vĩnh viễn.'
const BODY_EDITED =
  'Nội dung kiểm thử tự động đã được chỉnh sửa để xác nhận dữ liệu được lưu và đọc lại chính xác.'
const CAPTURE_VIEWPORTS = ['1440x900', '768x1024', '375x812']
  .map((name) => VIEWPORTS.find((viewport) => viewport.name === name)!)

function articleTitle(retry: number) {
  return `E2E_CONTENT_${RUN_ID}${retry ? `_R${retry}` : ''}`
}

function articleTitleEdited(retry: number) {
  return `${articleTitle(retry)}_EDITED`
}

function articleTitleEn(retry: number) {
  return `E2E Content ${RUN_ID}${retry ? ` R${retry}` : ''}`
}

function coverFilename(retry: number) {
  return `E2E_MEDIA_CONTENT_${RUN_ID}${retry ? `_R${retry}` : ''}.svg`
}

function sectionCard(page: Page, title: string): Locator {
  return page.locator('.detail-section').filter({
    has: page.locator('.detail-section-header :is(h2,h3,h4)', { hasText: title }),
  })
}

async function dismissDraftBannerIfAny(page: Page) {
  const discard = page.getByRole('button', { name: 'Bỏ qua', exact: true })
  if ((await discard.count()) > 0 && await discard.isVisible()) await discard.click()
}

async function addParagraphBlock(page: Page, text: string) {
  const bodyCard = sectionCard(page, 'Nội dung chính')
  await bodyCard.getByRole('button', { name: 'Thêm khối' }).click()
  await page.getByRole('menuitem', { name: 'Đoạn văn', exact: true }).click()
  const editor = bodyCard.locator('.ProseMirror')
  await editor.click()
  await editor.pressSequentially(text)
}

async function replaceParagraphBlock(page: Page, text: string) {
  const editor = sectionCard(page, 'Nội dung chính').locator('.ProseMirror')
  await editor.click()
  await editor.press('Control+A')
  await editor.press('Backspace')
  await editor.pressSequentially(text)
}

async function fillEnglishTitle(page: Page, title: string) {
  const language = page.locator('.lang-switcher')
  await language.getByRole('button', { name: 'EN', exact: true }).click()
  await sectionCard(page, 'Thông tin chính').getByLabel('Tiêu đề', { exact: false }).fill(title)
  await language.getByRole('button', { name: 'VI', exact: true }).click()
}

async function uploadCoverFromPicker(page: Page, filename: string) {
  const mediaCard = sectionCard(page, 'Hình ảnh')
  await mediaCard.getByRole('button', { name: 'Chọn từ thư viện', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Chọn ảnh từ thư viện' })
  await expect(dialog).toBeVisible()

  for (const viewport of CAPTURE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Picker ảnh bài viết ${viewport.name}`)
    await expect(dialog).toBeVisible()
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><title>${filename}</title><rect width="1200" height="630" fill="#ff0c09"/></svg>`
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((candidate) => candidate.request().method() === 'POST'
      && new URL(candidate.url()).pathname.endsWith('/api/v1/admin/media')),
    dialog.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(svg),
    }),
  ])
  expect(uploadResponse.status(), 'API tải ảnh ngay trong picker bài viết phải trả 201').toBe(201)
  const uploaded = await uploadResponse.json()
  const confirm = dialog.getByRole('button', { name: 'Chọn ảnh này', exact: true })
  await expect(confirm, 'Ảnh bìa 1200×630 hợp lệ phải chọn được').toBeEnabled({ timeout: 30_000 })
  await confirm.click()
  await expect(mediaCard.getByRole('button', { name: 'Đổi ảnh', exact: true }).first()).toBeVisible()

  return {
    id: uploaded?.data?.id as string | undefined,
  }
}

async function savePublishStatus(page: Page, articleId: string, status: 'Nháp' | 'Đã xuất bản') {
  const publishCard = sectionCard(page, 'Hiển thị')
  await publishCard.getByRole('combobox').click()
  await page.getByRole('option', { name: status, exact: true }).click()
  const [response] = await Promise.all([
    page.waitForResponse((candidate) =>
      candidate.request().method() === 'PATCH'
      && new URL(candidate.url()).pathname.endsWith(`/admin/content/articles/${articleId}`)),
    page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(),
  ])
  expect(response.status(), `API lưu trạng thái ${status} phải trả 2xx`).toBeLessThan(300)
  await expect(page.getByText('Cập nhật bài viết thành công.').last()).toBeVisible()
}

async function filterStatus(page: Page, status: 'Nháp' | 'Đã xuất bản' | 'Thùng rác') {
  await page.getByRole('combobox', { name: 'Trạng thái xuất bản' }).click()
  await page.getByRole('option', { name: status, exact: true }).click()
}

async function findArticleRow(page: Page, title: string) {
  await page.getByPlaceholder(/Tên hoặc (slug|đường dẫn)/).fill(title)
  const row = page.locator('tbody tr').filter({ hasText: title })
  await expect(row, `Không tìm thấy bài thử nghiệm ${title}`).toHaveCount(1, { timeout: 15_000 })
  await expect(page.locator('tbody tr'), `Bộ lọc phải chỉ còn bài thử nghiệm ${title}`)
    .toHaveCount(1, { timeout: 15_000 })
  return row
}

async function confirmDialog(page: Page, label: string | RegExp) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
}

async function captureResponsive(
  page: Page,
  testInfo: TestInfo,
  label: 'list' | 'detail',
  articleId?: string,
) {
  for (const viewport of CAPTURE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    if (label === 'detail') {
      await navigateSpa(page, `/admin/content/article/${articleId}`)
      await expect(sectionCard(page, 'Thông tin chính')).toBeVisible()
      const editorBounds = await sectionCard(page, 'Nội dung chính')
        .locator('.ProseMirror')
        .first()
        .boundingBox()
      expect(editorBounds?.width, `Trình soạn thảo phải đủ rộng tại ${viewport.name}`)
        .toBeGreaterThan(viewport.width === 375 ? 200 : 320)
    }
    await expectNoHorizontalOverflow(page, `Tin tức ${label} ${viewport.name}`)
    const path = testInfo.outputPath(`content-${label}-${viewport.name}.png`)
    await page.screenshot({ path, fullPage: true })
    await testInfo.attach(`Tin tức ${label} ${viewport.name}`, { path, contentType: 'image/png' })
  }
  const desktop = CAPTURE_VIEWPORTS[0]
  await page.setViewportSize({ width: desktop.width, height: desktop.height })
}

async function installReadOnlyIdentity(page: Page) {
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'e2e-content-read-only',
          fullName: 'E2E_CONTENT_READ_ONLY',
          email: 'e2e_content_read_only@example.invalid',
          roles: ['SHOP_MANAGER'],
          permissions: ['content.read'],
        },
      }),
    })
  })
}

test.describe('content-article lifecycle', () => {
  test('tạo, sửa, xuất bản, về Nháp, Thùng rác, khôi phục và xóa vĩnh viễn đúng bài E2E_CONTENT_', async ({
    adminPage,
    collect,
  }, testInfo) => {
    test.setTimeout(240_000)
    let articleId: string | null = null
    const title = articleTitle(testInfo.retry)
    const titleEdited = articleTitleEdited(testInfo.retry)
    const titleEn = articleTitleEn(testInfo.retry)
    const coverFile = coverFilename(testInfo.retry)

    await test.step('tạo bài Nháp với tiêu đề VI/EN, nội dung VI và tải ảnh trực tiếp từ picker', async () => {
        await navigateSpa(adminPage, '/admin/content/articles/new')
        await dismissDraftBannerIfAny(adminPage)
        await sectionCard(adminPage, 'Thông tin chính')
          .getByLabel('Tiêu đề', { exact: false })
          .fill(title)
        await addParagraphBlock(adminPage, BODY)
        await fillEnglishTitle(adminPage, titleEn)
        const uploadedCover = await uploadCoverFromPicker(adminPage, coverFile)
        expect(uploadedCover.id, 'Không lấy được id ảnh bìa tải từ picker').toBeTruthy()

        const [response] = await Promise.all([
          adminPage.waitForResponse((candidate) =>
            candidate.request().method() === 'POST'
            && new URL(candidate.url()).pathname.endsWith('/admin/content/articles')),
          adminPage.getByRole('button', { name: 'Tạo bài viết', exact: true }).click(),
        ])
        expect(response.status(), 'API tạo bài phải trả 2xx').toBeLessThan(300)
        const requestPayload = response.request().postDataJSON()
        expect(requestPayload.coverImage).toMatchObject({ mimeType: 'image/svg+xml' })
        expect(requestPayload.coverImage.url).toContain('/media/')
        expect(requestPayload.coverImage.alt).toContain('E2E_MEDIA_CONTENT_')
        await expect(adminPage).toHaveURL(/\/admin\/content\/articles\/[^/]+$/, { timeout: 15_000 })
        articleId = adminPage.url().match(/\/admin\/content\/articles\/([^/?#]+)/)?.[1] ?? null
        expect(articleId, 'Không lấy được id bài E2E_CONTENT_ vừa tạo').toBeTruthy()
      })

    await test.step('kiểm tra form chi tiết ở 1440×900, 768×1024 và 375×812', async () => {
        await captureResponsive(adminPage, testInfo, 'detail', articleId!)
      })

    await test.step('sửa tiêu đề và nội dung, tải lại vẫn giữ đúng dữ liệu', async () => {
        await navigateSpa(adminPage, `/admin/content/article/${articleId}`)
        await dismissDraftBannerIfAny(adminPage)
        await sectionCard(adminPage, 'Thông tin chính')
          .getByLabel('Tiêu đề', { exact: false })
          .fill(titleEdited)
        await replaceParagraphBlock(adminPage, BODY_EDITED)

        const [response] = await Promise.all([
          adminPage.waitForResponse((candidate) =>
            candidate.request().method() === 'PATCH'
            && new URL(candidate.url()).pathname.endsWith(`/admin/content/articles/${articleId}`)),
          adminPage.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(),
        ])
        expect(response.status(), 'API cập nhật bài phải trả 2xx').toBeLessThan(300)

        await gotoAdmin(adminPage, `/admin/content/article/${articleId}`)
        await expect(sectionCard(adminPage, 'Thông tin chính')
          .getByLabel('Tiêu đề', { exact: false })).toHaveValue(titleEdited)
        await expect(sectionCard(adminPage, 'Nội dung chính').locator('.ProseMirror')).toContainText(BODY_EDITED)
      })

    await test.step('lọc danh sách theo Nháp, tìm kiếm và sắp xếp tiêu đề', async () => {
        await navigateSpa(adminPage, '/admin/content')
        await filterStatus(adminPage, 'Nháp')
        const sort = adminPage.getByRole('combobox', { name: 'Sắp xếp' })
        await sort.click()
        await adminPage.getByRole('option', { name: 'Tiêu đề A–Z', exact: true }).click()
        await findArticleRow(adminPage, titleEdited)
        await captureResponsive(adminPage, testInfo, 'list')
      })

    await test.step('xuất bản rồi chuyển lại về Nháp qua đúng state machine', async () => {
        await navigateSpa(adminPage, `/admin/content/article/${articleId}`)
        await savePublishStatus(adminPage, articleId!, 'Đã xuất bản')
        await expect(adminPage.locator('.bb-badge', { hasText: 'Đã xuất bản' }).first()).toBeVisible()
        await savePublishStatus(adminPage, articleId!, 'Nháp')
        await expect(adminPage.locator('.bb-badge', { hasText: 'Nháp' }).first()).toBeVisible()
      })

    await test.step('chuyển vào Thùng rác và thấy đúng hành động tại bộ lọc Thùng rác', async () => {
        const [response] = await Promise.all([
          adminPage.waitForResponse((candidate) =>
            candidate.request().method() === 'DELETE'
            && new URL(candidate.url()).pathname.endsWith(`/admin/content/article/${articleId}`)),
          (async () => {
            await adminPage.getByRole('button', { name: 'Đưa vào thùng rác', exact: true }).click()
            await confirmDialog(adminPage, 'Xác nhận')
          })(),
        ])
        expect(response.status(), 'API chuyển Thùng rác phải trả 2xx').toBeLessThan(300)

        await navigateSpa(adminPage, '/admin/content')
        await filterStatus(adminPage, 'Thùng rác')
        const row = await findArticleRow(adminPage, titleEdited)
        await expect(row.getByRole('button', { name: 'Xem', exact: true })).toBeVisible()
        await expect(row.getByRole('button', { name: 'Khôi phục', exact: true })).toBeVisible()
        await expect(row.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true })).toBeVisible()
      })

    await test.step('khôi phục có xác nhận và lưu bài về Nháp', async () => {
        await navigateSpa(adminPage, `/admin/content/article/${articleId}`)
        await expect(adminPage.getByText('Bài viết đang ở Thùng rác.')).toBeVisible()
        const [restoreResponse, updateResponse] = await Promise.all([
          adminPage.waitForResponse((candidate) =>
            candidate.request().method() === 'POST'
            && new URL(candidate.url()).pathname.endsWith(`/admin/content/articles/${articleId}/restore`)),
          adminPage.waitForResponse((candidate) =>
            candidate.request().method() === 'PATCH'
            && new URL(candidate.url()).pathname.endsWith(`/admin/content/articles/${articleId}`)),
          (async () => {
            await adminPage.getByRole('button', { name: 'Khôi phục và lưu', exact: true }).click()
            await confirmDialog(adminPage, 'Khôi phục và lưu')
          })(),
        ])
        expect(restoreResponse.status()).toBeLessThan(300)
        expect(updateResponse.status()).toBeLessThan(300)
        await expect(adminPage.locator('.bb-badge', { hasText: 'Nháp' }).first()).toBeVisible()
      })

    await test.step('giao diện content.read là chỉ đọc và tuyệt đối không gọi preview', async () => {
        const previewRequests: string[] = []
        adminPage.on('request', (request) => {
          if (new URL(request.url()).pathname.endsWith('/admin/content/articles/preview')) {
            previewRequests.push(request.url())
          }
        })
        await installReadOnlyIdentity(adminPage)
        await gotoAdmin(adminPage, '/admin/content')
        await adminPage.getByPlaceholder(/Tên hoặc (slug|đường dẫn)/).fill(titleEdited)
        await expect(adminPage.getByRole('status')
          .filter({ hasText: 'Bạn chỉ có quyền xem Tin tức.' })).toBeVisible()
        await expect(adminPage.getByRole('button', { name: 'Chuyển vào Thùng rác' })).toHaveCount(0)
        await expect(adminPage.getByRole('checkbox')).toHaveCount(0)

        await navigateSpa(adminPage, `/admin/content/article/${articleId}`)
        await expect(adminPage.getByRole('status')
          .filter({ hasText: 'Bạn chỉ có thể xem' })).toBeVisible()
        await expect(sectionCard(adminPage, 'Thông tin chính')
          .getByLabel('Tiêu đề', { exact: false })).toBeDisabled()
        await expect(adminPage.getByRole('button', { name: 'Xem trước', exact: true })).toHaveCount(0)
        await adminPage.waitForTimeout(600)
        expect(previewRequests).toHaveLength(0)

        await adminPage.unroute('**/api/v1/auth/me')
        await gotoAdmin(adminPage, '/admin/dashboard')
      })

    await test.step('đưa lại vào Thùng rác và xóa vĩnh viễn đúng bản ghi test', async () => {
        await navigateSpa(adminPage, `/admin/content/article/${articleId}`)
        await adminPage.getByRole('button', { name: 'Đưa vào thùng rác', exact: true }).click()
        await confirmDialog(adminPage, 'Xác nhận')

        await navigateSpa(adminPage, '/admin/content')
        await filterStatus(adminPage, 'Thùng rác')
        const row = await findArticleRow(adminPage, titleEdited)
        const [response] = await Promise.all([
          adminPage.waitForResponse((candidate) =>
            candidate.request().method() === 'DELETE'
            && new URL(candidate.url()).pathname.endsWith(`/admin/content/articles/${articleId}/permanent`)),
          (async () => {
            await row.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
            await confirmDialog(adminPage, 'Xóa vĩnh viễn')
          })(),
        ])
        expect(response.status(), 'API xóa vĩnh viễn phải trả 2xx').toBeLessThan(300)
        await expect(adminPage.locator('tbody tr').filter({ hasText: titleEdited })).toHaveCount(0)
      })

    expectRuntimeClean(collect)
  })
})
