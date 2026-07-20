import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Locator } from '@playwright/test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { navigateSpa, gotoAdmin } from '../utils/quality'

/**
 * Real create/edit product flow against the live backend (no mocking) — verifies the
 * mutation actually succeeds (2xx + toast + data persisted), not just that the form
 * renders (smoke-routes.spec.ts already covers render-only). Required fields sourced
 * from `createProductSchema(t, isCreate)` in src/lib/schemas.js, cross-checked against
 * `getPublishReadiness` in screens/product-detail/constants.js (same required set).
 *
 * Test data is prefixed E2E_TEST_<runId> and removed in the last test (soft delete +
 * permanent delete) so nothing lingers in the real DB.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_IMAGE_PATH = path.join(__dirname, '../fixtures/product-image-2000.jpg')

const RUN_ID = Date.now()
const SHORT_DESCRIPTION_TEXT =
  'Mô tả ngắn cho sản phẩm kiểm thử tự động E2E, không phải hàng thật, sẽ bị xoá sau khi chạy test.'
const DESCRIPTION_TEXT =
  'Mô tả chi tiết cho sản phẩm kiểm thử tự động E2E. Nội dung này chỉ dùng để kiểm tra luồng tạo sản phẩm trong bigbike-admin, không phải thông tin sản phẩm thật.'
const RETAIL_PRICE = '590000'
const RETAIL_PRICE_EDITED = '699000'

// Per-retry suffix so a Playwright retry (playwright.config.ts retries:1 locally)
// never collides with the SKU/slug the first attempt may have already saved.
function productName(retry: number) {
  return `E2E_TEST_${RUN_ID}${retry ? `_r${retry}` : ''} Mũ bảo hiểm kiểm thử tự động`
}
function productSku(retry: number) {
  return `E2E-TEST-${RUN_ID}${retry ? `-R${retry}` : ''}`
}
function productNameEn(retry: number) {
  return `E2E_TEST_${RUN_ID}${retry ? `_r${retry}` : ''} Automated Test Helmet`
}

// Shared across tests in this file (each test gets a fresh page/context via the
// `adminPage` fixture, but they run in file order — plain `test()`, not `.serial()` —
// so an earlier failure never skips the cleanup test at the bottom).
let createdProductId: string | null = null
let createdProductSku: string | null = null
let createdProductName: string | null = null

function sectionCard(page: Page, title: string): Locator {
  return page.locator('.bb-card').filter({ has: page.locator('.bb-card-header h3', { hasText: title }) })
}

// Field↔control linkage (htmlFor/id from product-detail/Layout.jsx's <Field>) is a
// no-op for Select/Tabs-based controls: Radix's Select.Root/Tabs.Root render no DOM
// node of their own, so the cloned id/aria-* never reach the actual trigger. Only
// plain <Input>/<Textarea> fields (name, sku, retailPrice) support getByLabel; every
// Select must be targeted positionally within its SectionCard instead.
async function pickFirstOption(page: Page, combobox: Locator) {
  await combobox.click()
  await page.getByRole('option').first().click()
}

// shortDescription and the description block's feature block (`html` field) both render
// a plain RichTextEditor (TipTap) — no raw-HTML tab (V-notion-html-removed, matches the
// Content/article editor). Playwright's .fill() supports [contenteditable] directly,
// so type plain text straight into the editor's contenteditable region (identified by
// its role="textbox" from RichTextEditor.jsx's editorProps.attributes) — TipTap wraps
// it in a <p> like any normal keystroke would.
async function fillRichText(card: Locator, text: string) {
  await card.getByRole('textbox').fill(text)
}

// Product main image must be a REAL upload to MinIO — DATA_CONTRACT media rule — and
// the picker measures the uploaded file's natural dimensions client-side before
// enabling "Chọn ảnh này": productImage recommend requires a 1:1 ratio
// (imageRecommendations.js) — size is advisory only since 2026-07-04, not a blocker;
// e2e/fixtures/product-image-2000.jpg is square so it satisfies the ratio either way.
async function uploadMainImage(page: Page) {
  const card = sectionCard(page, 'Ảnh đại diện')
  await card.getByRole('button', { name: 'Chọn từ thư viện' }).click()
  const dialog = page.getByRole('dialog', { name: 'Chọn ảnh từ thư viện' })
  await dialog.locator('input[type="file"]').setInputFiles(TEST_IMAGE_PATH)
  const confirmBtn = dialog.getByRole('button', { name: 'Chọn ảnh này' })
  await expect(confirmBtn, 'Upload chưa xong hoặc ảnh sai tỉ lệ 1:1').toBeEnabled({ timeout: 30_000 })
  await confirmBtn.click()
  await expect(card.getByRole('button', { name: 'Đổi ảnh' })).toBeVisible()
}

// Content language (VI/EN) is a GLOBAL admin toggle (src/lib/contentLang.js, header
// button), not a per-page tab — it swaps which language the shared name/slug/etc.
// fields are bound to. `translations.en.name` is required on every save (VI and EN
// alike, see TRANSLATION_RULE_002 in schemas.js), so every product needs this step.
async function fillEnglishName(page: Page, basicCard: Locator, nameEn: string) {
  const langSwitcher = page.locator('.lang-switcher')
  await langSwitcher.getByRole('button', { name: 'EN', exact: true }).click()
  await basicCard.getByLabel('Tên', { exact: false }).fill(nameEn)
  await langSwitcher.getByRole('button', { name: 'VI', exact: true }).click()
}

interface FillOptions {
  name: string
  sku: string
  nameEn: string
  skipImage?: boolean
}

async function fillRequiredProductFields(page: Page, opts: FillOptions) {
  const basicCard = sectionCard(page, 'Thông tin cơ bản')
  await basicCard.getByLabel('Tên', { exact: false }).fill(opts.name) // also auto-derives slug
  await basicCard.getByLabel('Mã model', { exact: false }).fill(opts.sku)

  // Order in DOM within "Thông tin cơ bản": categoryId, brandId, then (after the
  // "Thương hiệu (nước)" text input) gender — see ProductDetailScreen.jsx:1135-1196.
  const combos = basicCard.locator('[role="combobox"]')
  await pickFirstOption(page, combos.nth(0)) // categoryId — any real category is valid
  await pickFirstOption(page, combos.nth(1)) // brandId — any real brand is valid
  await combos.nth(2).click() // gender
  await page.getByRole('option', { name: 'Unisex', exact: true }).click()

  await fillRichText(basicCard, SHORT_DESCRIPTION_TEXT)

  if (!opts.skipImage) {
    await uploadMainImage(page)
  }

  const pricingCard = sectionCard(page, 'Giá & trạng thái')
  await pricingCard.getByLabel('Giá niêm yết', { exact: false }).fill(RETAIL_PRICE)

  // "Mô tả chi tiết" lives in the "body" CollapsibleGroup, collapsed by default
  // (PRODUCT_GROUPS in product-detail/constants.js) — must expand it first.
  await page.getByRole('button', { name: 'Mô tả & nội dung trang' }).click()
  const descCard = sectionCard(page, 'Mô tả chi tiết')
  await descCard.getByRole('button', { name: 'Thêm khối' }).click()
  await page.getByRole('menuitem', { name: 'Ảnh phải + chữ trái' }).click()
  await fillRichText(descCard, DESCRIPTION_TEXT)

  await fillEnglishName(page, basicCard, opts.nameEn)
}

// Going from a non-PUBLISHED product to PUBLISHED always shows the publish-quality
// checklist modal first (ProductDetailScreen.jsx handleSave) — confirm inside it
// performs the actual save. Surfaces inline field errors in the thrown message
// instead of just timing out if the checklist never opens.
async function publishViaChecklist(page: Page) {
  await page.getByRole('button', { name: 'Tạo & Đăng bán' }).click()

  const checklist = page.getByRole('dialog', { name: 'Kiểm tra trước khi đăng bán' })
  try {
    await expect(checklist).toBeVisible({ timeout: 8_000 })
  } catch {
    const errors = await page.locator('.field-error').allInnerTexts()
    throw new Error(
      errors.length
        ? `Không mở được hộp thoại xác nhận xuất bản — form đang báo lỗi: ${errors.join(' | ')}`
        : 'Không mở được hộp thoại xác nhận xuất bản, cũng không thấy lỗi field nào.',
    )
  }

  const publishNowBtn = checklist.getByRole('button', { name: 'Đăng bán ngay' })
  await expect(publishNowBtn, 'Checklist báo còn mục bắt buộc chưa điền — nút "Đăng bán ngay" không hiện').toBeVisible()

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/admin/products')),
    publishNowBtn.click(),
  ])
  return response
}

// Caller navigates to /admin/products ONCE beforehand — re-navigating to the same
// path between the soft-delete and permanent-delete steps would remount the screen
// and reset its filter state, undoing the "Thùng rác" filter switch in between.
async function deleteRowBySku(page: Page, sku: string, buttonName: string, dialogConfirmName: string) {
  await page.getByPlaceholder('Tên sản phẩm, SKU, slug').fill(sku)
  const row = page.locator('tbody tr').filter({ hasText: sku })
  await expect(row, `Không tìm thấy sản phẩm test với SKU ${sku} trong danh sách`).toHaveCount(1, { timeout: 10_000 })
  await row.locator('[data-row-menu-trigger]').click()
  await page.locator('.bb-row-menu').getByRole('button', { name: buttonName, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: dialogConfirmName, exact: true }).click()
}

test.describe('product-crud', () => {
  test('product-crud · create new product (PUBLISHED) succeeds', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(150_000)

    createdProductName = productName(testInfo.retry)
    createdProductSku = productSku(testInfo.retry)
    const nameEn = productNameEn(testInfo.retry)

    await navigateSpa(adminPage, '/admin/products/new')

    await test.step('điền đủ field bắt buộc (kể cả upload ảnh thật + tên tiếng Anh)', async () => {
      await fillRequiredProductFields(adminPage, { name: createdProductName!, sku: createdProductSku!, nameEn })
    })

    await test.step('bấm Tạo & Đăng bán, xác nhận checklist, kỳ vọng API 2xx', async () => {
      const response = await publishViaChecklist(adminPage)
      expect(response.status(), 'API tạo sản phẩm phải trả 2xx').toBeLessThan(300)

      await expect(adminPage).toHaveURL(/\/admin\/products\/[^/]+$/, { timeout: 15_000 })
      createdProductId = adminPage.url().match(/\/admin\/products\/([^/?#]+)/)?.[1] ?? null
      expect(createdProductId, 'Không lấy được id sản phẩm vừa tạo từ URL').toBeTruthy()

      await expect(adminPage.getByText('Tạo sản phẩm thành công.')).toBeVisible()
    })

    await test.step('sản phẩm xuất hiện trong danh sách /admin/products', async () => {
      await navigateSpa(adminPage, '/admin/products')
      await adminPage.getByPlaceholder('Tên sản phẩm, SKU, slug').fill(createdProductSku!)
      await expect(adminPage.getByRole('link', { name: createdProductName!, exact: false })).toBeVisible({ timeout: 10_000 })
    })

    expectRuntimeClean(collect)
  })

  test('product-crud · edit existing product persists after reload', async ({ adminPage, collect }) => {
    test.skip(!createdProductId, 'Bỏ qua: bước tạo sản phẩm ở test trước chưa thành công nên không có sản phẩm để sửa')
    test.setTimeout(90_000)

    const editedName = `${createdProductName} (đã sửa)`

    await test.step('mở lại sản phẩm vừa tạo, đổi tên + giá bán, lưu', async () => {
      await navigateSpa(adminPage, `/admin/products/${createdProductId}`)
      const basicCard = sectionCard(adminPage, 'Thông tin cơ bản')
      const pricingCard = sectionCard(adminPage, 'Giá & trạng thái')

      await basicCard.getByLabel('Tên', { exact: false }).fill(editedName)
      await pricingCard.getByLabel('Giá niêm yết', { exact: false }).fill(RETAIL_PRICE_EDITED)

      const [response] = await Promise.all([
        adminPage.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/admin/products/${createdProductId}`)),
        adminPage.getByRole('button', { name: 'Lưu thay đổi' }).click(),
      ])
      expect(response.status(), 'API cập nhật sản phẩm phải trả 2xx').toBeLessThan(300)
      await expect(adminPage.getByText('Cập nhật sản phẩm thành công.')).toBeVisible()
    })

    await test.step('reload trang, xác nhận giá trị mới đã lưu (không revert)', async () => {
      await gotoAdmin(adminPage, `/admin/products/${createdProductId}`)
      const basicCard = sectionCard(adminPage, 'Thông tin cơ bản')
      const pricingCard = sectionCard(adminPage, 'Giá & trạng thái')

      await expect(basicCard.getByLabel('Tên', { exact: false })).toHaveValue(editedName)
      const priceValue = await pricingCard.getByLabel('Giá niêm yết', { exact: false }).inputValue()
      expect(priceValue.replace(/\D/g, '')).toBe(RETAIL_PRICE_EDITED)
    })

    createdProductName = editedName
    expectRuntimeClean(collect)
  })

  test('product-crud · publish blocked when a required field (image) is missing', async ({ adminPage }, testInfo) => {
    await navigateSpa(adminPage, '/admin/products/new')

    await fillRequiredProductFields(adminPage, {
      name: `${productName(testInfo.retry)}_novalidate`,
      sku: `${productSku(testInfo.retry)}-NOVALIDATE`,
      nameEn: `${productNameEn(testInfo.retry)} NoValidate`,
      skipImage: true,
    })

    await adminPage.getByRole('button', { name: 'Tạo & Đăng bán' }).click()

    await expect(adminPage.getByText('Vui lòng chọn ảnh đại diện.')).toBeVisible()
    await expect(adminPage.getByRole('dialog', { name: 'Kiểm tra trước khi đăng bán' })).toHaveCount(0)
    expect(new URL(adminPage.url()).pathname).toBe('/admin/products/new')
  })

  test('product-crud · cleanup test product', async ({ adminPage }) => {
    test.skip(!createdProductSku, 'Không có sản phẩm test nào cần xoá')
    test.setTimeout(90_000)

    await navigateSpa(adminPage, '/admin/products')

    await test.step('xoá (chuyển vào thùng rác)', async () => {
      await deleteRowBySku(adminPage, createdProductSku!, 'Xoá', 'Chuyển vào thùng rác')
      await expect(adminPage.getByText('Đã xoá sản phẩm')).toBeVisible()
    })

    await test.step('xoá vĩnh viễn khỏi thùng rác', async () => {
      const statusFilter = adminPage.getByRole('combobox', { name: 'Trạng thái xuất bản' })
      await statusFilter.click()
      await adminPage.getByRole('option', { name: 'Thùng rác', exact: true }).click()

      await deleteRowBySku(adminPage, createdProductSku!, 'Xóa vĩnh viễn', 'Xóa vĩnh viễn')
      await expect(adminPage.getByText(/Xóa vĩnh viễn sản phẩm thành công/)).toBeVisible()
    })

    createdProductId = null
    createdProductSku = null
  })
})
