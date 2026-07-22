import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

const REVIEW_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]

async function openReviews(page) {
  await navigateSpa(page, '/admin/reviews')
  await expect(page.getByRole('heading', { name: 'Đánh giá sản phẩm', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Điểm công khai', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cần xử lý', exact: true })).toBeVisible()
}

test.describe('Reviews admin', () => {
  for (const viewport of REVIEW_VIEWPORTS) {
    test(`list renders at ${viewport.name} ${viewport.width}px`, async ({ adminPage, collect }) => {
      await adminPage.setViewportSize({ width: viewport.width, height: viewport.height })
      await openReviews(adminPage)

      await expect(adminPage.getByText(/kết quả đang lọc/i)).toBeVisible()
      await expect(adminPage.getByRole('button', { name: 'Làm mới' })).toBeVisible()

      if (viewport.width < 640) {
        await expect(adminPage.locator('.mobile-card-list')).toBeVisible()
      } else {
        await expect(adminPage.locator('table')).toBeVisible()
      }

      await expect(adminPage).toHaveScreenshot(`reviews-list-${viewport.name}.png`, {
        fullPage: true,
        mask: [
          adminPage.locator('#review-public-score'),
          adminPage.locator('#review-queue'),
          adminPage.locator('table'),
          adminPage.locator('.mobile-card-list'),
        ],
      })
      expectRuntimeClean(collect)
    })
  }

  test('pending quick filter updates status and rating filters', async ({ adminPage, collect }) => {
    await adminPage.setViewportSize({ width: 1440, height: 900 })
    await openReviews(adminPage)

    await adminPage.getByRole('button', { name: /đánh giá chờ duyệt/i }).click()
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('status')).toBe('PENDING')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('rating')).toBe(null)

    await adminPage.getByRole('button', { name: /đánh giá 1-sao/i }).click()
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('status')).toBe('PENDING')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('rating')).toBe('1')
    expectRuntimeClean(collect)
  })

  test('detail uses the shared status and metadata structure when a review exists', async ({ adminPage, collect }) => {
    await adminPage.setViewportSize({ width: 1440, height: 900 })
    await openReviews(adminPage)
    const detailRow = adminPage.locator('tbody tr[role="button"]').first()
    if (await detailRow.count() === 0) {
      test.info().annotations.push({ type: 'skip', description: 'Backend has no review fixture available for detail smoke.' })
      return
    }

    await detailRow.click()
    await expect.poll(() => new URL(adminPage.url()).pathname).toMatch(/\/admin\/reviews\/[^/]+$/)
    await expect(adminPage.getByRole('heading', { name: 'Chi tiết đánh giá', exact: true })).toBeVisible()
    await expect(adminPage.locator('dl').first()).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Làm mới' })).toBeVisible()
    await expect(adminPage).toHaveScreenshot('reviews-detail-desktop.png', {
      fullPage: true,
      mask: [adminPage.locator('dl'), adminPage.locator('[aria-label*="ảnh"], [aria-label*="photo"]')],
    })
    expectRuntimeClean(collect)
  })
})
