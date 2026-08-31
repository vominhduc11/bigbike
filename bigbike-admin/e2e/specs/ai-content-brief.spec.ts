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
  const faqCount = await intro
    .locator('input[placeholder*="Câu hỏi"], input[placeholder*="Question"]')
    .count()
  if (faqCount !== 6 || !/<table\b/i.test(rawHtml)) {
    testInfo.annotations.push({
      type: 'Not run',
      description:
        'dữ liệu runtime không khớp điều kiện nghiệm thu: cần bảng và đủ 6 FAQ trong intro danh mục Mũ bảo hiểm',
    })
    test.skip(true, 'Not run: dữ liệu runtime không khớp điều kiện nghiệm thu')
  }
}

test.describe('AI content brief is read-only and HTML-first', () => {
  test('category draft edit preserves table and six FAQs without saving', async ({
    adminPage,
    collect,
  }, testInfo) => {
    await blockWrites(adminPage)
    await navigateSpa(adminPage, `/admin/categories/${HELMET_CATEGORY_ID}`)
    await waitForScreenReady(adminPage)
    await skipWhenRuntimeFixtureDiffers(adminPage, testInfo)

    const intro = adminPage.locator('[data-field="introContent"]')
    const beforeHtml = await intro.locator('textarea').inputValue()
    const storeMarker = 'Bigbike.vn hoạt động từ 2014'
    const beforeStoreCount = (beforeHtml.match(new RegExp(storeMarker, 'g')) || []).length
    expect(beforeStoreCount).toBeGreaterThan(0)

    for (let edit = 1; edit <= 3; edit += 1) {
      const answer = intro
        .getByRole('textbox', { name: /Câu trả lời ngắn gọn|Short answer/i })
        .first()
      await answer.fill(`${await answer.innerText()} — lần sửa ${edit}`)
      const afterHtml = await intro.locator('textarea').inputValue()
      const structure = await adminPage.evaluate(
        (rawHtml, marker) => {
          const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
          const table = doc.querySelector('table')
          const faq = doc.querySelector('.bb-ci-b')
          return {
            questions: doc.querySelectorAll('.bb-ci-qt').length,
            answers: doc.querySelectorAll('.bb-ci-at').length,
            tables: doc.querySelectorAll('table').length,
            tableBeforeFaq: Boolean(
              table && faq && table.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
            storeCount: (rawHtml.match(new RegExp(marker, 'g')) || []).length,
          }
        },
        afterHtml,
        storeMarker,
      )

      expect(structure.questions).toBe(6)
      expect(structure.answers).toBe(7)
      expect(structure.tables).toBeGreaterThan(0)
      expect(structure.tableBeforeFaq).toBe(true)
      expect(structure.storeCount).toBe(beforeStoreCount)
    }

    expect(
      await adminPage.getByRole('button', { name: /Lưu danh mục|Save category/i }).count(),
    ).toBeGreaterThan(0)
    expectRuntimeClean(collect)
  })

  test('category and size-guide brief copy only reads data and never writes', async ({
    adminPage,
    collect,
  }, testInfo) => {
    await adminPage.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(adminPage.url()).origin,
    })
    await blockWrites(adminPage)
    await navigateSpa(adminPage, `/admin/categories/${HELMET_CATEGORY_ID}`)
    await waitForScreenReady(adminPage)
    await skipWhenRuntimeFixtureDiffers(adminPage, testInfo)

    await adminPage
      .locator('[data-field="introContent"]')
      .getByRole('tab', { name: 'HTML' })
      .click()
    const categoryBrief = adminPage.locator('[data-field="introContent"]').getByRole('button', {
      name: /Hướng dẫn tạo nội dung đúng giao diện|AI brief for on-brand HTML/i,
    })
    await categoryBrief.click()
    await expect(adminPage.locator('[data-field="introContent"] pre')).toContainText(
      /HỒ SƠ DANH MỤC|CATEGORY PROFILE/i,
    )
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
    const helmet = products.find(
      (product) =>
        /mũ|helmet/i.test(product.name || '') &&
        /helmet|mũ|bao-hiem/i.test(JSON.stringify(product.categories || product.category || '')),
    )
    if (!helmet?.id) {
      testInfo.annotations.push({
        type: 'Not run',
        description: 'không tìm thấy sản phẩm mũ bảo hiểm đang bán trong dữ liệu runtime',
      })
      test.skip(true, 'Not run: không tìm thấy sản phẩm mũ bảo hiểm đang bán trong dữ liệu runtime')
    }

    await navigateSpa(adminPage, `/admin/products/${helmet.id}`)
    await waitForScreenReady(adminPage)
    const sizeCard = adminPage
      .getByText(/Bảng size|Size guide/i)
      .first()
      .locator('..')
      .locator('..')
    await sizeCard.getByRole('tab', { name: 'HTML' }).click()
    const sizeBrief = sizeCard.getByRole('button', {
      name: /Hướng dẫn tạo nội dung đúng giao diện|AI brief for on-brand HTML/i,
    })
    await sizeBrief.click()
    await expect(sizeCard.locator('pre')).toContainText(String(helmet.sku || helmet.id))
    await sizeCard.getByRole('button', { name: /Sao chép|Copy/i }).click()
    const productPrompt = await adminPage.evaluate(() => navigator.clipboard.readText())
    expect(productPrompt).toContain(String(helmet.sku || helmet.id))
    expect(productPrompt).toMatch(/mũ|helmet/i)
    expect(productPrompt).toContain(/Bảng cỡ|size|variant/i)
    console.log(
      `PRODUCT_SIZE_GUIDE_AI_PROMPT_START\n${productPrompt}\nPRODUCT_SIZE_GUIDE_AI_PROMPT_END`,
    )
    expectRuntimeClean(collect)
  })
})
