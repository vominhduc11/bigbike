import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import type { Locator } from '@playwright/test'
import { navigateSpa, waitForScreenReady } from '../utils/quality'

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]
const FALLBACK_VARIANT_PRODUCT_ID = 'wp-prod-41359'

async function findPublicProductWithVariants(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/v1/products?page=1&size=100')
    if (!response.ok) return null
    const body = await response.json()
    const items = Array.isArray(body) ? body : (body.items ?? body.content ?? [])
    const item = items.find((candidate: { id?: string; variants?: unknown[] }) =>
      candidate.id && Array.isArray(candidate.variants) && candidate.variants.length > 0)
    return item?.id ?? null
  })
}

async function replaceWithoutSaving(input: Locator, value: string, formatted: string) {
  await input.click()
  await input.press('Control+A')
  await input.type(value)
  await input.blur()
  await expect(input).toHaveValue(formatted)
}

test('product money inputs stay local and clean at desktop/tablet/mobile viewports', async ({ adminPage, collect }) => {
  // The list response intentionally omits full variants; keep the verified
  // fixture id as a read-only fallback so this test reaches the real detail screen.
  const productId = (await findPublicProductWithVariants(adminPage)) || FALLBACK_VARIANT_PRODUCT_ID

  const mutationRequests: string[] = []
  adminPage.on('request', (request) => {
    const method = request.method()
    if (method !== 'GET' && request.url().includes('/api/v1/admin/products')) {
      mutationRequests.push(`${method} ${request.url()}`)
    }
  })

  // The shared runtime currently serves this unrelated catalogue endpoint as
  // 404, while the product editor only needs an empty list for this audit.
  // Keep the money-input check focused and do not mutate product data.
  await adminPage.route('**/api/v1/admin/size-scales', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }))

  await navigateSpa(adminPage, `/admin/products/${productId}`)
  await waitForScreenReady(adminPage)

  const pricingCard = adminPage.locator('.detail-section').filter({ hasText: 'Giá & trạng thái' }).first()
  await expect(pricingCard.getByLabel(/Giá niêm yết/).first()).toBeVisible()

  for (const viewport of VIEWPORTS) {
    await adminPage.setViewportSize(viewport)

    const productRetail = pricingCard.getByLabel(/Giá niêm yết/).first()
    await replaceWithoutSaving(productRetail, '2000000', '2.000.000')

    const productSale = pricingCard.getByLabel(/Giá khuyến mãi/).first()
    if (await productSale.count() && await productSale.isVisible()) {
      await replaceWithoutSaving(productSale, '0', '')
    }

    const variantRetail = adminPage.locator('input[aria-label*="Giá niêm yết"]:visible').first()
    if (await variantRetail.count()) {
      await replaceWithoutSaving(variantRetail, '2300000', '2.300.000')
    }
  }

  // Select one real variant and verify bulk edit only changes the in-memory form.
  await adminPage.setViewportSize({ width: 1440, height: 900 })
  const rowCheckbox = adminPage.locator('tbody tr:visible [role="checkbox"]').first()
  if (await rowCheckbox.count()) {
    await rowCheckbox.scrollIntoViewIfNeeded()
    await rowCheckbox.click()
    await adminPage.getByRole('button', { name: 'Điền giá cho các dòng đã chọn', exact: true }).click()
    const dialog = adminPage.getByRole('dialog').last()
    await dialog.locator('input').first().fill('2400000')
    await dialog.getByRole('button', { name: 'Áp dụng giá', exact: true }).click()
  }

  expect(mutationRequests, 'Gõ/chọn giá không được gọi API mutation trước Lưu/Áp dụng nghiệp vụ').toEqual([])
  expectRuntimeClean(collect)
})
