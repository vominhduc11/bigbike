import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Locator } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import {
  getPageLevelErrorPanel,
  gotoAdmin,
  navigateSpa,
  expectNoHorizontalOverflow,
  waitForScreenReady,
} from '../utils/quality'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_IMAGE_PATH = path.join(__dirname, '../fixtures/product-image-2000.jpg')
const RUN_ID = Date.now()

function productSku(retry: number) {
  return `E2E_PRODUCT_EDITOR_${RUN_ID}${retry ? `_R${retry}` : ''}`
}

function productName(retry: number) {
  return `E2E_PRODUCT_EDITOR_${RUN_ID}${retry ? `_R${retry}` : ''} Mũ thử nghiệm`
}

function productNameEn(retry: number) {
  return `E2E_PRODUCT_EDITOR_${RUN_ID}${retry ? `_R${retry}` : ''} Automated Test Helmet`
}

function imageFilename(retry: number) {
  return `E2E_MEDIA_PRODUCT_EDITOR_${RUN_ID}${retry ? `_R${retry}` : ''}.jpg`
}

function sectionCard(page: Page, title: string): Locator {
  return page
    .locator('.detail-section')
    .filter({ has: page.locator('.detail-section-header :is(h2,h3,h4)', { hasText: title }) })
}

async function fillRichText(card: Locator, value: string) {
  await card.locator('[contenteditable="true"][role="textbox"]').first().fill(value)
}

async function pickFirstOption(page: Page, combobox: Locator) {
  await combobox.click()
  await page.getByRole('option').first().click()
}

async function dragFirstRowBelowSecond(page: Page, card: Locator) {
  const handles = card.getByRole('button', { name: 'Kéo để sắp xếp' })
  const source = handles.first()
  const target = handles.nth(1)
  await source.scrollIntoViewIfNeeded()
  await target.scrollIntoViewIfNeeded()
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox, 'Không tìm thấy tay nắm dòng đầu').not.toBeNull()
  expect(targetBox, 'Không tìm thấy tay nắm dòng thứ hai').not.toBeNull()
  if (!sourceBox || !targetBox) return

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2,
    { steps: 4 },
  )
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 16,
  })
  await page.mouse.up()
}

async function uploadMainImage(page: Page, filename: string) {
  const card = sectionCard(page, 'Ảnh đại diện')
  await card.getByRole('button', { name: 'Chọn từ thư viện' }).click()
  const dialog = page.getByRole('dialog', { name: 'Chọn ảnh từ thư viện' })
  await dialog.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'image/jpeg',
    buffer: await readFile(TEST_IMAGE_PATH),
  })
  const confirmButton = dialog.getByRole('button', { name: 'Chọn ảnh này' })
  await expect(confirmButton).toBeEnabled({ timeout: 30_000 })
  await confirmButton.click()
  await expect(card.getByRole('button', { name: 'Đổi ảnh' })).toBeVisible()
}

async function createProduct(page: Page, retry: number) {
  const sku = productSku(retry)
  await navigateSpa(page, '/admin/products/new')
  const basicCard = sectionCard(page, 'Thông tin cơ bản')
  await basicCard.getByLabel('Tên', { exact: false }).fill(productName(retry))
  await basicCard.getByLabel(/SKU|Mã sản phẩm/, { exact: false }).fill(sku)

  await basicCard.getByRole('button', { name: '— Chọn danh mục —' }).click()
  await page.getByRole('dialog').last().getByRole('checkbox').first().click()

  await pickFirstOption(page, basicCard.locator('[role="combobox"]').first())

  await fillRichText(
    basicCard,
    'Mô tả ngắn cho sản phẩm kiểm thử khả năng chịu tải của trình soạn thảo.',
  )
  await uploadMainImage(page, imageFilename(retry))

  const pricingCard = sectionCard(page, 'Giá & trạng thái')
  await pricingCard.getByLabel('Giá niêm yết', { exact: false }).fill('590000')

  const contentGroup = page.getByRole('button', { name: /^Nội dung trang/ })
  await contentGroup.click()
  const descriptionCard = sectionCard(page, 'Mô tả chi tiết')
  await descriptionCard.getByRole('button', { name: 'Ảnh phải + chữ trái' }).click()
  await fillRichText(descriptionCard, 'Mô tả chi tiết dùng cho sản phẩm thử nghiệm E2E.')

  const languageSwitcher = page.locator('.lang-switcher')
  await languageSwitcher.getByRole('button', { name: 'EN', exact: true }).click()
  await basicCard.getByLabel('Tên', { exact: false }).fill(productNameEn(retry))
  await languageSwitcher.getByRole('button', { name: 'VI', exact: true }).click()

  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname.endsWith('/api/v1/admin/products'),
    ),
    page.getByRole('button', { name: 'Lưu nháp', exact: true }).click(),
  ])
  expect(response.status(), 'Tạo sản phẩm test phải trả 2xx').toBeLessThan(300)
  await expect(page).toHaveURL(/\/admin\/products\/[^/]+$/, { timeout: 15_000 })
  return page.url().match(/\/admin\/products\/([^/?#]+)/)?.[1] ?? null
}

function heavySpecificationsHtml() {
  const rows = Array.from(
    { length: 50 },
    (_, index) =>
      `<tr><th scope="row">Thông số ${index + 1}</th><td>Giá trị ${index + 1}</td></tr>`,
  ).join('')
  return `<table class="shop_attributes"><tbody>${rows}</tbody></table>`
}

async function seedHeavyContent(page: Page) {
  const contentGroup = page.getByRole('button', { name: /^Nội dung trang/ })
  if ((await contentGroup.getAttribute('aria-expanded')) !== 'true') await contentGroup.click()

  const specsCard = sectionCard(page, 'Thông số kỹ thuật')
  await specsCard.getByRole('tab', { name: 'HTML', exact: true }).click()
  await specsCard.locator('textarea').fill(heavySpecificationsHtml())
  await specsCard.getByRole('button', { name: 'Nhận nội dung mới', exact: true }).click()
  const importDialog = page.getByRole('dialog', { name: 'Nhận nội dung HTML mới?' })
  await expect(importDialog).toBeVisible()
  await importDialog.getByRole('button', { name: 'Nhận và lưu', exact: true }).click()

  await expect(specsCard.locator('input[aria-label="Tên thông số (bắt buộc)"]')).toHaveCount(50, {
    timeout: 120_000,
  })
  await expect(specsCard.locator('[contenteditable="true"][role="textbox"]')).toHaveCount(50, {
    timeout: 120_000,
  })

  const faqCard = sectionCard(page, 'Câu hỏi thường gặp')
  const addFaq = faqCard.getByRole('button', { name: 'Thêm câu hỏi', exact: false })
  for (let index = 0; index < 6; index += 1) await addFaq.click()
  await expect(faqCard.getByPlaceholder('Câu hỏi *')).toHaveCount(6)
  await expect(faqCard.locator('[contenteditable="true"][role="textbox"]')).toHaveCount(6, {
    timeout: 60_000,
  })

  const questions = faqCard.getByPlaceholder('Câu hỏi *')
  const answers = faqCard.locator('[contenteditable="true"][role="textbox"]')
  for (let index = 0; index < 6; index += 1) {
    await questions.nth(index).fill(`Câu hỏi ${index + 1}?`)
    await answers.nth(index).fill(`Câu trả lời ${index + 1}.`)
  }
}

async function exerciseMutableLists(page: Page) {
  const specsCard = sectionCard(page, 'Thông số kỹ thuật')
  const specNames = specsCard.locator('input[aria-label="Tên thông số (bắt buộc)"]')
  const addSpec = specsCard.getByRole('button', { name: 'Thêm thông số', exact: false })
  await addSpec.click()
  await expect(specNames).toHaveCount(51)
  await specsCard.getByRole('button', { name: 'Xoá thông số', exact: true }).last().click()
  await expect(specNames).toHaveCount(50)

  await dragFirstRowBelowSecond(page, specsCard)
  await expect(specNames.first()).toHaveValue('Thông số 2')

  const faqCard = sectionCard(page, 'Câu hỏi thường gặp')
  const addFaq = faqCard.getByRole('button', { name: 'Thêm câu hỏi', exact: false })
  await addFaq.click()
  await expect(faqCard.getByPlaceholder('Câu hỏi *')).toHaveCount(7)
  await faqCard.getByPlaceholder('Câu hỏi *').last().fill('Câu hỏi tạm thời?')
  await faqCard.getByRole('button', { name: 'Xoá câu hỏi', exact: true }).last().click()
  const removeDialog = page.getByRole('dialog', { name: 'Xoá dòng' })
  await expect(removeDialog).toBeVisible()
  await removeDialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(faqCard.getByPlaceholder('Câu hỏi *')).toHaveCount(6)

  await dragFirstRowBelowSecond(page, faqCard)
  await expect(faqCard.getByPlaceholder('Câu hỏi *').first()).toHaveValue('Câu hỏi 2?')

  const languageSwitcher = page.locator('.lang-switcher')
  await languageSwitcher.getByRole('button', { name: 'EN', exact: true }).click()
  await waitForScreenReady(page)
  expect(await getPageLevelErrorPanel(page)).toBeNull()
  await languageSwitcher.getByRole('button', { name: 'VI', exact: true }).click()
  await waitForScreenReady(page)
  await expect(specNames).toHaveCount(50, { timeout: 120_000 })

  const contentGroup = page.getByRole('button', { name: /^Nội dung trang/ })
  await contentGroup.click()
  await expect(contentGroup).toHaveAttribute('aria-expanded', 'false')
  await contentGroup.click()
  await expect(contentGroup).toHaveAttribute('aria-expanded', 'true')

  const descriptionCard = sectionCard(page, 'Mô tả chi tiết')
  const collapseBlock = descriptionCard.getByRole('button', { name: 'Thu gọn khối' }).first()
  if (await collapseBlock.count()) {
    await collapseBlock.click()
    await expect(descriptionCard.getByRole('button', { name: 'Mở khối' }).first()).toBeVisible()
    await descriptionCard.getByRole('button', { name: 'Mở khối' }).first().click()
  }
}

test('product detail không sập khi có 50 thông số + 6 FAQ trên máy chậm', async ({
  adminPage,
  collect,
}, testInfo) => {
  test.setTimeout(420_000)
  let productId: string | null = null
  const slowSession = await adminPage.context().newCDPSession(adminPage)

  try {
    productId = await createProduct(adminPage, testInfo.retry)
    expect(productId, 'Không lấy được id sản phẩm test').toBeTruthy()

    // This scenario is intentionally allowed to time out on a slow emulator.
    // The worker-scoped E2E data guard runs outside this test timeout and removes
    // the just-created product by ID before the retry/next worker phase starts.
    if (process.env.E2E_FORCE_EDITOR_TIMEOUT === '1' && testInfo.retry === 0) {
      test.setTimeout(5_000)
      await new Promise(() => {})
    }

    await seedHeavyContent(adminPage)
    const [seedResponse] = await Promise.all([
      adminPage.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/admin/products/${productId}`),
        { timeout: 120_000 },
      ),
      adminPage.getByRole('button', { name: 'Lưu nháp', exact: true }).click(),
    ])
    expect(seedResponse.status(), 'Lưu nội dung nặng phải trả 2xx').toBeLessThan(300)
    await expect(adminPage.getByText('Cập nhật sản phẩm thành công.')).toBeVisible()

    await exerciseMutableLists(adminPage)
    const [editResponse] = await Promise.all([
      adminPage.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/admin/products/${productId}`),
        { timeout: 120_000 },
      ),
      adminPage.getByRole('button', { name: 'Lưu nháp', exact: true }).click(),
    ])
    expect(editResponse.status(), 'Lưu sau thao tác danh sách phải trả 2xx').toBeLessThan(300)
    await expect(adminPage.getByText('Cập nhật sản phẩm thành công.')).toBeVisible()

    await slowSession.send('Emulation.setCPUThrottlingRate', { rate: 6 })
    const viewports = [
      { name: '1440x900', width: 1440, height: 900 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '375x812', width: 375, height: 812 },
    ]

    for (const viewport of viewports) {
      await adminPage.setViewportSize({ width: viewport.width, height: viewport.height })
      await gotoAdmin(adminPage, `/admin/products/${productId}`)

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await adminPage.reload({ waitUntil: 'domcontentloaded' })
          await waitForScreenReady(adminPage)
        }

        const pageError = await getPageLevelErrorPanel(adminPage)
        expect(
          pageError,
          `${viewport.name} lần ${attempt + 1}: không được hiện panel lỗi`,
        ).toBeNull()
        await expect(
          adminPage.getByText('Đã xảy ra lỗi không mong đợi', { exact: false }),
        ).toHaveCount(0)

        const contentGroup = adminPage.getByRole('button', { name: /^Nội dung trang/ })
        if ((await contentGroup.getAttribute('aria-expanded')) !== 'true')
          await contentGroup.click()
        const specsCard = sectionCard(adminPage, 'Thông số kỹ thuật')
        await expect(specsCard.locator('input[aria-label="Tên thông số (bắt buộc)"]')).toHaveCount(
          50,
          { timeout: 120_000 },
        )
        await expect(specsCard.locator('[contenteditable="true"][role="textbox"]')).toHaveCount(
          50,
          { timeout: 120_000 },
        )
        await expect(
          sectionCard(adminPage, 'Câu hỏi thường gặp').getByPlaceholder('Câu hỏi *'),
        ).toHaveCount(6, { timeout: 60_000 })
        await expectNoHorizontalOverflow(
          adminPage,
          `Product Detail ${viewport.name} lần ${attempt + 1}`,
        )
      }

      await testInfo.attach(`product-editor-${viewport.name}.png`, {
        body: await adminPage.screenshot({ fullPage: false }),
        contentType: 'image/png',
      })
    }

    // Môi trường backend đang dùng để kiểm thử hiện trả 500 cho polling thông báo
    // toàn cục; chỉ bỏ qua đúng endpoint nền này, vẫn chặn mọi lỗi khác của trang.
    const productRuntime = {
      ...collect,
      apiErrors: collect.apiErrors.filter(
        (entry) => new URL(entry.url).pathname !== '/api/v1/admin/notifications',
      ),
    }
    expectRuntimeClean(productRuntime)
  } finally {
    await slowSession.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
})
