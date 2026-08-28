import type { TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { expectHeaderNotOverlappingContent, expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'

const RUN_ID = Date.now()
const CAPTURE_LABEL = process.env.MEDIA_CAPTURE_LABEL || 'after'
const CAPTURE_VIEWPORTS = [
  { name: '1440', width: 1440, height: 1000 },
  { name: '768', width: 768, height: 1024 },
  { name: '375', width: 375, height: 812 },
]

function mediaMarker(retry: number) {
  return `E2E_MEDIA_${RUN_ID}${retry ? `_R${retry}` : ''}`
}

function videoMarker(retry: number) {
  return `E2E_VIDEO_${RUN_ID}${retry ? `_R${retry}` : ''}`
}
// MP4 H.264 16x16, 0,12 giây. Fixture nhúng giúp CI kiểm tra đúng luồng video
// mà không phụ thuộc ffmpeg hay một tệp nhị phân bên ngoài repository.
const VIDEO_FIXTURE_BASE64 = [
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAANdbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAHgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAod0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAHgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAB4AAAEAAABAAAAAAH/bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAACABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABqm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAWpzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAMg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAMAwAAAAAAAAABhzdHRzAAAAAAAAAAEAAAADAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAKGN0dHMAAAAAAAAAAwAAAAEAAAQAAAAAAQAABgAAAAABAAACAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAwAAAAEAAAAgc3RzegAAAAAAAAAAAAAAAwAAAsoAAAAMAAAADAAAABRzdGNvAAAAAAAAAAEAAAONAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2Mi4xMi4xMDIAAAAIZnJlZQAAAuptZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMyAwNDgwY2IwIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAFGWIhAAz//7fMvgUzcWJzsyAXJ6XAAAACEGaImxCv/7AAAAACAGeQXkK/8SB',
].join('')

function mediaCard(page: Page, marker: string) {
  return page.locator('.medialib-card').filter({ hasText: marker }).first()
}

async function downloadFromButton(page: Page, button: ReturnType<Page['getByRole']>, expectedFilename: string) {
  const pageCount = page.context().pages().length
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button.click(),
  ])
  expect(download.suggestedFilename()).toBe(expectedFilename)
  expect(page.context().pages()).toHaveLength(pageCount)
  const path = await download.path()
  expect(path).toBeTruthy()
  return readFile(path!)
}

async function captureLibrary(page: Page, testInfo: TestInfo) {
  for (const viewport of CAPTURE_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await expectNoHorizontalOverflow(page, `Media Library ${viewport.name}px`)
    await expectHeaderNotOverlappingContent(page, `Media Library ${viewport.name}px`)
    const screenshotPath = testInfo.outputPath(`media-library-${CAPTURE_LABEL}-${viewport.name}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    await testInfo.attach(`Media Library ${CAPTURE_LABEL} ${viewport.name}px`, {
      path: screenshotPath,
      contentType: 'image/png',
    })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
}

test.describe('media-library', () => {
  test('bố cục thư viện sạch ở desktop, tablet và mobile', async ({ adminPage, collect }, testInfo) => {
    await navigateSpa(adminPage, '/admin/media')
    await expect(adminPage.getByRole('heading', { name: 'Thư viện ảnh', exact: true })).toBeVisible()
    await expect(adminPage.locator('.medialib-card').first()).toBeVisible()

    await captureLibrary(adminPage, testInfo)
    expectRuntimeClean(collect)
  })

  test('tải ảnh/video, tải bản gốc, sửa, xoá mềm, khôi phục và xoá vĩnh viễn tệp thử nghiệm', async ({ adminPage, collect }, testInfo) => {
    test.skip(Boolean(process.env.MEDIA_CAPTURE_ONLY), 'Chỉ chụp ảnh trước/sau, không thay đổi dữ liệu.')
    test.setTimeout(120_000)

    const marker = mediaMarker(testInfo.retry)
    const videoMarkerValue = videoMarker(testInfo.retry)
    const filename = `${marker}.svg`
    const updatedTitle = `${marker}_ĐÃ_SỬA`
    let mediaId: string | null = null
    let videoId: string | null = null
    let imageFileSize = 0
    let apiOrigin = ''
    let authorization = ''

      const listResponsePromise = adminPage.waitForResponse((response) =>
        response.request().method() === 'GET'
          && new URL(response.url()).pathname.endsWith('/api/v1/admin/media'))
      await navigateSpa(adminPage, '/admin/media')
      const listResponse = await listResponsePromise
      apiOrigin = new URL(listResponse.url()).origin
      authorization = listResponse.request().headers().authorization || ''
      await expect(adminPage.getByRole('heading', { name: 'Thư viện ảnh', exact: true })).toBeVisible()

    await test.step('tải, hiển thị và xoá sạch MP4 hợp lệ', async () => {
        const fileInput = adminPage.locator('input[type="file"][multiple]')
        const videoBytes = Buffer.from(VIDEO_FIXTURE_BASE64, 'base64')
        const [response] = await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'POST'
            && new URL(item.url()).pathname.endsWith('/api/v1/admin/media')),
          fileInput.setInputFiles({
            name: `${videoMarkerValue}.mp4`,
            mimeType: 'video/mp4',
            buffer: videoBytes,
          }),
        ])
        expect(response.status(), 'API tải video phải trả 201').toBe(201)
        const payload = await response.json()
        videoId = payload?.data?.id ?? null
        expect(videoId, 'Không lấy được id video vừa tải').toBeTruthy()
        expect(payload?.data?.mimeType).toBe('video/mp4')

        const search = adminPage.getByRole('searchbox')
        await search.fill(videoMarkerValue)
        const card = mediaCard(adminPage, videoMarkerValue)
        await expect(card).toBeVisible({ timeout: 15_000 })
        await expect(card.locator('video')).toHaveCount(1)
        const cardDownload = card.getByRole('button', { name: 'Tải về máy', exact: true })
        await expect(cardDownload).toBeVisible()
        const downloadedVideo = await downloadFromButton(adminPage, cardDownload, `${videoMarkerValue}.mp4`)
        expect(downloadedVideo.equals(videoBytes), 'Video tải về phải đúng bản gốc').toBeTruthy()

        const headers = { Authorization: authorization }
        const softDeleted = await adminPage.request.delete(`${apiOrigin}/api/v1/admin/media/${videoId}`, { headers })
        expect(softDeleted.status(), 'API xoá mềm video phải trả 204').toBe(204)
        await adminPage.getByRole('button', { name: 'Thùng rác', exact: true }).click()
        const trashCard = mediaCard(adminPage, videoMarkerValue)
        await expect(trashCard).toBeVisible()
        const downloadedTrashVideo = await downloadFromButton(
          adminPage,
          trashCard.getByRole('button', { name: 'Tải về máy', exact: true }),
          `${videoMarkerValue}.mp4`,
        )
        expect(downloadedTrashVideo.equals(videoBytes), 'Video trong thùng rác vẫn phải tải đúng bản gốc').toBeTruthy()
        const hardDeleted = await adminPage.request.delete(
          `${apiOrigin}/api/v1/admin/media/${videoId}?permanent=true`, { headers },
        )
        expect(hardDeleted.status(), 'API xoá vĩnh viễn video phải trả 204').toBe(204)
        videoId = null
        await adminPage.getByRole('button', { name: 'Thùng rác', exact: true }).click()
      })

    await test.step('tải SVG hợp lệ lên thư viện', async () => {
        const fileInput = adminPage.locator('input[type="file"][multiple]')
        const uniqueSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><title>${marker}</title><rect width="20" height="20" fill="#ff0c09"/></svg>`
        const [response] = await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'POST'
            && new URL(item.url()).pathname.endsWith('/api/v1/admin/media')),
          fileInput.setInputFiles({ name: filename, mimeType: 'image/svg+xml', buffer: Buffer.from(uniqueSvg) }),
        ])
        expect(response.status(), 'API tải media phải trả 201').toBe(201)
        const payload = await response.json()
        mediaId = payload?.data?.id ?? null
        expect(mediaId, 'Không lấy được id media vừa tải').toBeTruthy()
        imageFileSize = Number(payload?.data?.fileSize) || 0

        const search = adminPage.getByRole('searchbox')
        await search.fill(marker)
        const card = mediaCard(adminPage, marker)
        await expect(card).toBeVisible({ timeout: 15_000 })
        await expect(card.getByRole('button', { name: /thay file|replace file/i })).toHaveCount(0)
        const replaceResponse = await adminPage.request.post(
          `${apiOrigin}/api/v1/admin/media/${mediaId}/replace`, { headers: { Authorization: authorization } })
        expect(replaceResponse.status(), 'Đường thay file đã bị gỡ phải trả 404').toBe(404)
        const downloadedImage = await downloadFromButton(
          adminPage,
          card.getByRole('button', { name: 'Tải về máy', exact: true }),
          filename,
        )
        expect(downloadedImage.length, 'Ảnh tải về phải là object gốc, không phải biến thể').toBe(imageFileSize)
      })

    await test.step('mở chi tiết và cập nhật metadata', async () => {
        const card = mediaCard(adminPage, marker)
        await card.getByRole('button', { name: 'Sửa', exact: true }).click()
        const panel = adminPage.getByRole('complementary', { name: 'Chỉnh sửa thông tin ảnh/video' })
        await expect(panel).toBeVisible()
        await panel.getByLabel('Tiêu đề', { exact: true }).fill(updatedTitle)
        await panel.getByLabel('Mô tả ảnh', { exact: true }).fill('Ảnh kiểm thử thư viện media')
        const [response] = await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'PATCH'
            && new URL(item.url()).pathname.endsWith(`/api/v1/admin/media/${mediaId}`)),
          panel.getByRole('button', { name: 'Lưu', exact: true }).click(),
        ])
        expect(response.status(), 'API sửa media phải trả 200').toBe(200)
        await expect(panel).toBeHidden()

        await card.getByRole('button', { name: 'Sửa', exact: true }).click()
        const detailPanel = adminPage.getByRole('complementary', { name: 'Chỉnh sửa thông tin ảnh/video' })
        await expect(detailPanel).toBeVisible()
        const detailDownload = detailPanel.getByRole('button', { name: 'Tải về máy', exact: true })
        await expect(detailDownload).toBeVisible()
        const downloadedFromDetail = await downloadFromButton(adminPage, detailDownload, filename)
        expect(downloadedFromDetail.length).toBe(imageFileSize)

        await detailPanel.getByRole('button', { name: 'Xem to', exact: true }).click()
        const lightbox = adminPage.getByRole('dialog', { name: filename })
        await expect(lightbox).toBeVisible()
        const lightboxDownload = lightbox.getByRole('button', { name: 'Tải về máy', exact: true })
        await expect(lightboxDownload).toBeVisible()
        const downloadedFromLightbox = await downloadFromButton(adminPage, lightboxDownload, filename)
        expect(downloadedFromLightbox.length).toBe(imageFileSize)
        await lightbox.getByRole('button', { name: 'Đóng', exact: true }).click()
        await expect(lightbox).toBeHidden()
        await detailPanel.getByRole('button', { name: 'Đóng', exact: true }).click()
        await expect(detailPanel).toBeHidden()
      })

    await test.step('xoá mềm rồi khôi phục từ Thùng rác', async () => {
        let card = mediaCard(adminPage, marker)
        await card.getByRole('button', { name: 'Xoá', exact: true }).click()
        const [deleted] = await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'DELETE'
            && new URL(item.url()).pathname.endsWith(`/api/v1/admin/media/${mediaId}`)
            && !new URL(item.url()).searchParams.has('permanent')),
          adminPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click(),
        ])
        expect(deleted.status(), 'API xoá mềm media phải trả 204').toBe(204)

        await adminPage.getByRole('button', { name: 'Thùng rác', exact: true }).click()
        card = mediaCard(adminPage, marker)
        await expect(card).toBeVisible()
        await expect(card.getByRole('button', { name: 'Tải về máy', exact: true })).toBeVisible()
        const downloadedTrashImage = await downloadFromButton(
          adminPage,
          card.getByRole('button', { name: 'Tải về máy', exact: true }),
          filename,
        )
        expect(downloadedTrashImage.length).toBe(imageFileSize)
        const [restored] = await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'POST'
            && new URL(item.url()).pathname.endsWith(`/api/v1/admin/media/${mediaId}/restore`)),
          card.getByRole('button', { name: 'Khôi phục', exact: true }).click(),
        ])
        expect(restored.status(), 'API khôi phục media phải trả 200').toBe(200)
      })

    await test.step('xoá lại và xoá vĩnh viễn từ bảng chi tiết trong Thùng rác', async () => {
        await adminPage.getByRole('button', { name: 'Thùng rác', exact: true }).click()
        let card = mediaCard(adminPage, marker)
        await expect(card).toBeVisible()
        await card.getByRole('button', { name: 'Xoá', exact: true }).click()
        await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'DELETE'
            && new URL(item.url()).pathname.endsWith(`/api/v1/admin/media/${mediaId}`)),
          adminPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click(),
        ])

        await adminPage.getByRole('button', { name: 'Thùng rác', exact: true }).click()
        card = mediaCard(adminPage, marker)
        await expect(card).toBeVisible()
        await card.getByRole('button', { name: 'Chi tiết', exact: true }).click()
        const panel = adminPage.getByRole('complementary', { name: 'Chỉnh sửa thông tin ảnh/video' })
        await expect(panel).toBeVisible()
        await panel.getByRole('button', { name: 'Xoá vĩnh viễn', exact: true }).click()
        await expect(adminPage.getByRole('dialog')).toContainText('không thể khôi phục')
        const [hardDeleted] = await Promise.all([
          adminPage.waitForResponse((item) => item.request().method() === 'DELETE'
            && new URL(item.url()).pathname.endsWith(`/api/v1/admin/media/${mediaId}`)
            && new URL(item.url()).searchParams.get('permanent') === 'true'),
          adminPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click(),
        ])
        expect(hardDeleted.status(), 'API xoá vĩnh viễn media phải trả 204').toBe(204)
        mediaId = null
        await expect(mediaCard(adminPage, marker)).toHaveCount(0)
      })

    expectRuntimeClean(collect)
  })
})
