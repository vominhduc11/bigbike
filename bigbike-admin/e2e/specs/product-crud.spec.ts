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
let validationProductSku: string | null = null
const recoveryProductSkus = (process.env.E2E_PRODUCT_CLEANUP_SKUS || '')
  .split(',')
  .map((sku) => sku.trim())
  .filter(Boolean)

function sectionCard(page: Page, title: string): Locator {
  return page.locator('.bb-card').filter({ has: page.locator('.bb-card-header h3', { hasText: title }) })
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function productRowBySku(page: Page, sku: string) {
  const exactSkuCell = page.locator('td').filter({
    hasText: new RegExp(`^\\s*${escapeRegExp(sku)}\\s*$`),
  })
  return page.locator('tbody tr').filter({ has: exactSkuCell })
}

async function filterProductRows(page: Page, sku: string) {
  const searchInput = page.getByPlaceholder('Tên sản phẩm, SKU, slug')
  await searchInput.fill('')
  await expect(searchInput).toHaveValue('')

  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return response.request().method() === 'GET'
      && url.pathname.endsWith('/api/v1/admin/products')
      && url.searchParams.get('q') === sku
  })
  await searchInput.fill(sku)
  await filteredResponse
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
  await card.locator('[contenteditable="true"][role="textbox"]').fill(text)
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
  await basicCard.getByLabel('SKU', { exact: false }).fill(opts.sku)

  // The category picker is a multi-select popover; choose the first available
  // category so it becomes the primary category. The remaining comboboxes are
  // brand, then gender — see ProductDetailScreen.jsx.
  await basicCard.getByRole('button', { name: '— Chọn danh mục —' }).click()
  await page.getByRole('dialog').last().getByRole('checkbox').first().click()

  const combos = basicCard.locator('[role="combobox"]')
  await pickFirstOption(page, combos.nth(0)) // brandId — any real brand is valid
  await combos.nth(1).click() // gender
  await page.getByRole('option', { name: 'Unisex', exact: true }).click()

  await fillRichText(basicCard, SHORT_DESCRIPTION_TEXT)

  if (!opts.skipImage) {
    await uploadMainImage(page)
  }

  const pricingCard = sectionCard(page, 'Giá & trạng thái')
  await pricingCard.getByLabel('Giá niêm yết', { exact: false }).fill(RETAIL_PRICE)

  // "Mô tả chi tiết" lives in the "body" CollapsibleGroup, collapsed by default
  // (PRODUCT_GROUPS in product-detail/constants.js) — must expand it first.
  await page.getByRole('button', { name: 'Nội dung trang', exact: false }).click()
  const descCard = sectionCard(page, 'Mô tả chi tiết')
  // Sản phẩm không còn dropdown "Thêm khối" — nút tự gợi ý so le, khối đầu tiên luôn là
  // "Ảnh phải + chữ trái" (nextProductFeatureSide mặc định 'right' khi chưa có khối nào).
  await descCard.getByRole('button', { name: 'Ảnh phải + chữ trái' }).click()
  await fillRichText(descCard, DESCRIPTION_TEXT)

  await fillEnglishName(page, basicCard, opts.nameEn)
}

// PRODUCT_RULE_005: Product List and Product Detail share the same readiness
// checklist and dedicated /publish endpoint.
async function publishDraftRow(page: Page, sku: string) {
  await filterProductRows(page, sku)
  const row = productRowBySku(page, sku)
  await expect(row, `Không tìm thấy sản phẩm nháp ${sku}`).toHaveCount(1, { timeout: 10_000 })
  await row.getByRole('button', { name: 'Xuất bản', exact: true }).click()
  const checklist = page.getByRole('dialog', { name: 'Kiểm tra trước khi đăng bán' })
  await expect(checklist).toBeVisible({ timeout: 10_000 })

  const publishNowBtn = checklist.getByRole('button', { name: 'Đăng bán ngay' })
  await expect(publishNowBtn, 'Checklist báo còn mục bắt buộc chưa điền — nút "Đăng bán ngay" không hiện').toBeVisible()

  const [response] = await Promise.all([
    page.waitForResponse((r) =>
      r.request().method() === 'PATCH'
      && new URL(r.url()).pathname.endsWith('/publish')),
    publishNowBtn.click(),
  ])
  return response
}

// Caller navigates to /admin/products ONCE beforehand — re-navigating to the same
// path between the soft-delete and permanent-delete steps would remount the screen
// and reset its filter state, undoing the "Thùng rác" filter switch in between.
async function deleteRowBySku(
  page: Page,
  sku: string,
  buttonName: string,
  dialogConfirmName: string,
  allowMissing = false,
) {
  await filterProductRows(page, sku)
  const row = productRowBySku(page, sku)
  if (allowMissing && await row.count() === 0) return false
  await expect(row, `Không tìm thấy sản phẩm test với SKU ${sku} trong danh sách`).toHaveCount(1, { timeout: 10_000 })
  await row.getByRole('button', { name: 'Thao tác', exact: true }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: buttonName, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: dialogConfirmName, exact: true }).click()
  return true
}

test.describe('product-crud', () => {
  test('product-crud · create new product as DRAFT succeeds', async ({ adminPage, collect }, testInfo) => {
    test.setTimeout(150_000)

    createdProductName = productName(testInfo.retry)
    createdProductSku = productSku(testInfo.retry)
    const nameEn = productNameEn(testInfo.retry)

    await navigateSpa(adminPage, '/admin/products/new')

    await test.step('điền đủ field bắt buộc (kể cả upload ảnh thật + tên tiếng Anh)', async () => {
      await fillRequiredProductFields(adminPage, { name: createdProductName!, sku: createdProductSku!, nameEn })
    })

    await test.step('lưu nháp, kỳ vọng API tạo trả 2xx', async () => {
      const [response] = await Promise.all([
        adminPage.waitForResponse((r) =>
          r.request().method() === 'POST'
          && new URL(r.url()).pathname.endsWith('/api/v1/admin/products')),
        adminPage.getByRole('button', { name: 'Lưu nháp', exact: true }).click(),
      ])
      expect(response.status(), 'API tạo sản phẩm nháp phải trả 2xx').toBeLessThan(300)

      await expect(adminPage).toHaveURL(/\/admin\/products\/[^/]+$/, { timeout: 15_000 })
      createdProductId = adminPage.url().match(/\/admin\/products\/([^/?#]+)/)?.[1] ?? null
      expect(createdProductId, 'Không lấy được id sản phẩm vừa tạo từ URL').toBeTruthy()

      await expect(adminPage.getByText('Tạo sản phẩm thành công.')).toBeVisible()
      await expect(adminPage.getByRole('button', { name: 'Xuất bản', exact: true })).toBeVisible()
      await expect(adminPage.getByRole('button', { name: 'Đăng bán ngay', exact: true })).toHaveCount(0)
    })

    await test.step('sản phẩm xuất hiện trong danh sách /admin/products', async () => {
      await navigateSpa(adminPage, '/admin/products')
      await adminPage.getByPlaceholder('Tên sản phẩm, SKU, slug').fill(createdProductSku!)
      await expect(adminPage.getByRole('link', { name: createdProductName!, exact: false })).toBeVisible({ timeout: 10_000 })
    })

    expectRuntimeClean(collect)
  })

  test('product-crud · publish and move back to draft from Product Detail', async ({ adminPage, collect }) => {
    test.skip(!createdProductId, 'Bỏ qua: bước tạo sản phẩm ở test trước chưa thành công')
    test.setTimeout(90_000)

    await navigateSpa(adminPage, `/admin/products/${createdProductId}`)
    const detailUrl = adminPage.url()

    await adminPage.getByRole('button', { name: 'Xuất bản', exact: true }).click()
    const checklist = adminPage.getByRole('dialog', { name: 'Kiểm tra trước khi đăng bán' })
    const publishNow = checklist.getByRole('button', { name: 'Đăng bán ngay' })
    await expect(publishNow).toBeVisible()
    const [publishResponse] = await Promise.all([
      adminPage.waitForResponse((r) =>
        r.request().method() === 'PATCH'
        && new URL(r.url()).pathname.endsWith(`/api/v1/admin/products/${createdProductId}/publish`)),
      publishNow.click(),
    ])
    expect(publishResponse.status(), 'API xuất bản từ trang chi tiết phải trả 2xx').toBeLessThan(300)
    await expect(adminPage.getByText('Đã xuất bản', { exact: true })).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Chuyển về Nháp', exact: true })).toBeVisible()
    expect(adminPage.url(), 'Đổi trạng thái không được điều hướng khỏi trang chi tiết').toBe(detailUrl)

    await adminPage.getByRole('button', { name: 'Chuyển về Nháp', exact: true }).click()
    const confirmDialog = adminPage.getByRole('dialog', { name: 'Chuyển sản phẩm về Nháp?' })
    const [unpublishResponse] = await Promise.all([
      adminPage.waitForResponse((r) =>
        r.request().method() === 'PATCH'
        && new URL(r.url()).pathname.endsWith(`/api/v1/admin/products/${createdProductId}/publish`)),
      confirmDialog.getByRole('button', { name: 'Chuyển về Nháp', exact: true }).click(),
    ])
    expect(unpublishResponse.status(), 'API chuyển về Nháp từ trang chi tiết phải trả 2xx').toBeLessThan(300)
    await expect(adminPage.getByText('Nháp', { exact: true })).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Xuất bản', exact: true })).toBeVisible()
    expect(adminPage.url(), 'Chuyển về Nháp không được điều hướng khỏi trang chi tiết').toBe(detailUrl)
    expectRuntimeClean(collect)
  })

  test('product-crud · publish from Product List checklist succeeds', async ({ adminPage, collect }) => {
    test.skip(!createdProductSku, 'Bỏ qua: bước tạo sản phẩm ở test trước chưa thành công')
    test.setTimeout(90_000)

    await navigateSpa(adminPage, '/admin/products')
    const response = await publishDraftRow(adminPage, createdProductSku!)
    expect(response.status(), 'API xuất bản chuyên biệt phải trả 2xx').toBeLessThan(300)
    await expect(adminPage.getByText('Đã đổi trạng thái xuất bản.')).toBeVisible()

    const row = productRowBySku(adminPage, createdProductSku!)
    await expect(row.getByText('Đã xuất bản', { exact: true })).toBeVisible()
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

      await expect(adminPage.getByRole('button', { name: 'Chuyển về Nháp', exact: true })).toBeVisible()
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
      await expect(adminPage.getByText('Đã xuất bản', { exact: true })).toBeVisible()
    })

    createdProductName = editedName
    expectRuntimeClean(collect)
  })

  test('product-crud · Product List blocks publishing when image is missing', async ({ adminPage }, testInfo) => {
    validationProductSku = `${productSku(testInfo.retry)}-NOIMAGE`
    await navigateSpa(adminPage, '/admin/products/new')

    await fillRequiredProductFields(adminPage, {
      name: `${productName(testInfo.retry)} thiếu ảnh`,
      sku: validationProductSku,
      nameEn: `${productNameEn(testInfo.retry)} Without Image`,
      skipImage: true,
    })

    const [createResponse] = await Promise.all([
      adminPage.waitForResponse((r) =>
        r.request().method() === 'POST'
        && new URL(r.url()).pathname.endsWith('/api/v1/admin/products')),
      adminPage.getByRole('button', { name: 'Lưu nháp', exact: true }).click(),
    ])
    expect(createResponse.status(), 'Sản phẩm thiếu ảnh vẫn phải lưu Nháp được').toBeLessThan(300)

    await navigateSpa(adminPage, '/admin/products')
    await adminPage.getByPlaceholder('Tên sản phẩm, SKU, slug').fill(validationProductSku)
    const row = productRowBySku(adminPage, validationProductSku)
    await expect(row).toHaveCount(1, { timeout: 10_000 })
    await row.getByRole('button', { name: 'Xuất bản', exact: true }).click()

    const checklist = adminPage.getByRole('dialog', { name: 'Kiểm tra trước khi đăng bán' })
    await expect(checklist).toBeVisible()
    await expect(checklist.getByText('Ảnh đại diện', { exact: true })).toBeVisible()
    await expect(checklist.getByRole('button', { name: 'Đăng bán ngay' })).toHaveCount(0)
    await checklist.getByRole('button', { name: 'Quay lại sửa' }).click()
    await expect(row.getByText('Nháp', { exact: true })).toBeVisible()
  })

  test('product-crud · cleanup test products', async ({ adminPage }) => {
    const testSkus = [...new Set(
      [createdProductSku, validationProductSku, ...recoveryProductSkus].filter(
        (sku): sku is string => Boolean(sku),
      ),
    )]
    test.skip(testSkus.length === 0, 'Không có sản phẩm test nào cần xoá')
    test.setTimeout(90_000)

    await navigateSpa(adminPage, '/admin/products')

    await test.step('xoá (chuyển vào thùng rác)', async () => {
      for (const sku of testSkus) {
        const deleted = await deleteRowBySku(adminPage, sku, 'Xoá', 'Chuyển vào thùng rác', true)
        if (deleted) await expect(adminPage.getByText('Đã xoá sản phẩm').last()).toBeVisible()
      }
    })

    await test.step('xoá vĩnh viễn khỏi thùng rác', async () => {
      const statusFilter = adminPage.getByRole('combobox', { name: 'Trạng thái xuất bản' })
      await statusFilter.click()
      await adminPage.getByRole('option', { name: 'Thùng rác', exact: true }).click()

      for (const sku of testSkus) {
        const deleted = await deleteRowBySku(adminPage, sku, 'Xóa vĩnh viễn', 'Xóa vĩnh viễn', true)
        if (deleted) await expect(adminPage.getByText(/Xóa vĩnh viễn sản phẩm thành công/).last()).toBeVisible()
      }
    })

    createdProductId = null
    createdProductSku = null
    createdProductName = null
    validationProductSku = null
  })
})
