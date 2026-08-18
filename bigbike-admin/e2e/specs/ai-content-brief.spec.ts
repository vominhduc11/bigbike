import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { navigateSpa, waitForScreenReady } from '../utils/quality'

const HELMET_CATEGORY_ID = 'wp-cat-289'

async function blockWrites(page) {
  await page.route('**/api/v1/**', async (route) => {
    const method = route.request().method()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
}

async function skipWhenRuntimeFixtureDiffers(page, testInfo) {
  const intro = page.locator('[data-field="introContent"]')
  await expect(intro).toBeVisible()
  const htmlTab = intro.getByRole('tab', { name: 'HTML' })
  if ((await htmlTab.count()) === 0) {
    testInfo.annotations.push({
      type: 'Not run',
      description: 'container đang chạy bản admin cũ chưa có thẻ HTML',
    })
    test.skip(true, 'Not run: container đang chạy bản admin cũ chưa có thẻ HTML')
  }
  await htmlTab.click()
  const rawHtml = await intro.locator('textarea').inputValue()
  await intro.getByRole('tab', { name: /Nhập có cấu trúc|Structured input/ }).click()
  const faqCount = await intro.locator('input[placeholder*="Câu hỏi"], input[placeholder*="Question"]').count()
  if (faqCount !== 6 || !/<table\b/i.test(rawHtml)) {
    testInfo.annotations.push({
      type: 'Not run',
      description: 'dữ liệu runtime không khớp điều kiện nghiệm thu: cần bảng và đủ 6 FAQ trong intro danh mục Mũ bảo hiểm',
    })
    test.skip(true, 'Not run: dữ liệu runtime không khớp điều kiện nghiệm thu')
  }
}

test.describe('AI content brief is read-only and HTML-first', () => {
  test('category draft edit preserves table and six FAQs without saving', async ({ adminPage, collect }, testInfo) => {
    await blockWrites(adminPage)
    await navigateSpa(adminPage, `/admin/categories/${HELMET_CATEGORY_ID}`)
    await waitForScreenReady(adminPage)
    await skipWhenRuntimeFixtureDiffers(adminPage, testInfo)

    const intro = adminPage.locator('[data-field="introContent"]')
    const beforeHtml = await intro.locator('textarea').inputValue()
    const heading = intro.getByPlaceholder(/Mũ bảo hiểm mô tô|Genuine motorcycle helmets|Heading/i).first()
    await heading.fill(`${await heading.inputValue()} — kiểm tra bản nháp`)
    const afterHtml = await intro.locator('textarea').inputValue()

    expect(afterHtml).toContain('<table')
    expect((afterHtml.match(/bb-ci-qt/g) || []).length).toBeGreaterThanOrEqual(6)
    expect((afterHtml.match(/bb-ci-at/g) || []).length).toBeGreaterThanOrEqual(6)
    expect(afterHtml).not.toBe(beforeHtml)
    expect(await adminPage.getByRole('button', { name: /Lưu danh mục|Save category/i }).count()).toBeGreaterThan(0)
    expectRuntimeClean(collect)
  })

  test('category and size-guide brief copy only reads data and never writes', async ({ adminPage, collect }, testInfo) => {
    await adminPage.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(adminPage.url()).origin })
    await blockWrites(adminPage)
    await navigateSpa(adminPage, `/admin/categories/${HELMET_CATEGORY_ID}`)
    await waitForScreenReady(adminPage)
    await skipWhenRuntimeFixtureDiffers(adminPage, testInfo)

    await adminPage.locator('[data-field="introContent"]').getByRole('tab', { name: 'HTML' }).click()
    await adminPage.getByRole('button', { name: /Chép câu lệnh|Copy prompt/i }).click()
    const categoryPrompt = await adminPage.evaluate(() => navigator.clipboard.readText())
    expect(categoryPrompt).toContain('17')
    expect(categoryPrompt).toContain('ILM')
    expect(categoryPrompt).toContain('AGV')
    expect(categoryPrompt).toMatch(/CATEGORY PROFILE|HỒ SƠ DANH MỤC/)
    console.log(`CATEGORY_AI_PROMPT_START\n${categoryPrompt}\nCATEGORY_AI_PROMPT_END`)

    // Product selection is intentionally discovered from the read-only catalog API.
    // If the owner fixture is not present, this is reported as Not run instead of
    // editing or creating a product to make the test pass.
    const products = await adminPage.evaluate(async () => {
      const response = await fetch('/api/v1/admin/products?page=1&size=50&publishStatus=PUBLISHED')
      if (!response.ok) return []
      const payload = await response.json()
      return payload?.data?.items || payload?.data || []
    })
    const helmet = products.find((product) => /mũ|helmet/i.test(product.name || '') && /helmet|mũ|bao-hiem/i.test(JSON.stringify(product.categories || product.category || '')))
    if (!helmet?.id) {
      testInfo.annotations.push({ type: 'Not run', description: 'không tìm thấy sản phẩm mũ bảo hiểm đang bán trong dữ liệu runtime' })
      test.skip(true, 'Not run: không tìm thấy sản phẩm mũ bảo hiểm đang bán trong dữ liệu runtime')
    }

    await navigateSpa(adminPage, `/admin/products/${helmet.id}`)
    await waitForScreenReady(adminPage)
    const sizeCard = adminPage.getByText(/Bảng size|Size guide/i).first().locator('..').locator('..')
    await sizeCard.getByRole('tab', { name: 'HTML' }).click()
    await sizeCard.getByRole('button', { name: /Sao chép|Copy/i }).click()
    const productPrompt = await adminPage.evaluate(() => navigator.clipboard.readText())
    expect(productPrompt).toContain(String(helmet.sku || helmet.id))
    expect(productPrompt).toMatch(/mũ|helmet/i)
    expect(productPrompt).toContain(/Bảng cỡ|size|variant/i)
    console.log(`PRODUCT_SIZE_GUIDE_AI_PROMPT_START\n${productPrompt}\nPRODUCT_SIZE_GUIDE_AI_PROMPT_END`)
    expectRuntimeClean(collect)
  })
})
