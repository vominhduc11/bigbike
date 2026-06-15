/* eslint-disable */
// TEMP verification spec — visual check that the media-dimension warning shows
// at EVERY image/video attach point, incl. the newly-wired BlockEditor blocks
// and RichTextEditor inline images. Delete after the verify session.
import { testAnon as test, expect, type Page } from '../fixtures/admin-test'
import fs from 'fs'
import path from 'path'

const OUT = path.resolve('e2e/.artifacts/dimwarn')
fs.mkdirSync(OUT, { recursive: true })
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, name) }).catch(() => {})

const SMALL = 'z7800808372730'                 // 330x283 jpg  -> "tooSmall"
const VID = 'ao-bao-ho-komine-jk173-man'       // 1080x1920 mp4 -> "wrongRatio"
const PRODUCT = 'wp-prod-36255'

const results: Array<{ step: string; ok: boolean; detail: string }> = []
async function check(step: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ step, ok: true, detail: 'warning shown' }) }
  catch (e: any) { results.push({ step, ok: false, detail: String(e?.message || e).split('\n')[0] }) }
}

async function pickImage(page: Page, search: string) {
  const m = page.locator('.mpicker-modal')
  await m.waitFor({ state: 'visible' })
  await m.locator('input[type="search"]').fill(search)
  await page.waitForTimeout(900)
  await m.locator('.mpicker-item').first().click()
  await m.getByRole('button', { name: 'Chọn ảnh này', exact: true }).click()
  await m.waitFor({ state: 'detached' })
}
async function pickVideo(page: Page, search: string) {
  const m = page.locator('.mpicker-modal')
  await m.waitFor({ state: 'visible' })
  await m.locator('input[type="search"]').fill(search)
  await page.waitForTimeout(1100)
  await m.locator('.mpicker-item').first().click()
  await expect(m.getByRole('status')).toContainText(/tỉ lệ|nhỏ/, { timeout: 9000 })
  await m.getByRole('button', { name: 'Chọn video này', exact: true }).click()
  await m.waitFor({ state: 'detached' })
}

test('media dimension warning — all attach points', async ({ page, collect }) => {
  test.setTimeout(240000)

  // ---- UI login (single) ----
  await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
  if (await page.locator('.bb-login-shell, form').count()) {
    await page.locator('input').first().fill('admin@bigbike.vn')
    await page.locator('input[type="password"]').fill('admin123')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  }
  await page.locator('.bb-app').waitFor({ state: 'attached', timeout: 25000 })

  // ============ PRODUCT screen ============
  await page.goto(`/admin/products/${PRODUCT}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Thêm khối/ }).first().waitFor({ timeout: 25000 })

  await check('Product main image (ImageUrlInput)', async () => {
    const main = page.locator('.image-url-input').first()
    await main.getByRole('button', { name: /Đổi ảnh|Chọn từ thư viện/ }).click()
    await pickImage(page, SMALL)
    await expect(main.getByRole('status')).toContainText(/nhỏ/, { timeout: 8000 })
    await shot(page, '01-product-main-image.png')
  })

  await check('BlockEditor IMAGE block (new)', async () => {
    await page.getByRole('button', { name: /Thêm khối/ }).first().click()
    await page.getByRole('menuitem', { name: 'Hình ảnh', exact: true }).click()
    const blk = page.locator('div.border').filter({ hasText: 'Chọn ảnh' }).last()
    await blk.getByRole('button', { name: 'Chọn ảnh', exact: true }).click()
    await pickImage(page, SMALL)
    await expect(blk.getByRole('status')).toContainText(/nhỏ/, { timeout: 8000 })
    await blk.scrollIntoViewIfNeeded()
    await shot(page, '02-block-image.png')
  })

  await check('BlockEditor VIDEO block (new)', async () => {
    await page.getByRole('button', { name: /Thêm khối/ }).first().click()
    await page.getByRole('menuitem', { name: 'Video', exact: true }).click()
    const blk = page.locator('div.border').filter({ hasText: 'Video tải lên' }).last()
    await blk.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Video tải lên', exact: true }).click()
    await blk.getByRole('button', { name: 'Chọn video từ thư viện', exact: true }).click()
    await pickVideo(page, VID)
    await expect(blk.getByRole('status')).toContainText(/tỉ lệ/, { timeout: 10000 })
    await blk.scrollIntoViewIfNeeded()
    await shot(page, '03-block-video.png')
  })

  await check('RichTextEditor inline image (new)', async () => {
    await page.getByRole('button', { name: /Thêm khối/ }).first().click()
    await page.getByRole('menuitem', { name: 'Đoạn văn', exact: true }).click()
    const blk = page.locator('div.border').filter({ has: page.locator('.rich-editor-content') }).last()
    await blk.getByRole('button', { name: 'Chèn ảnh từ thư viện' }).click()
    await pickImage(page, SMALL)
    await expect(blk.getByRole('status')).toContainText(/nhỏ/, { timeout: 8000 })
    await blk.scrollIntoViewIfNeeded()
    await shot(page, '04-rte-image.png')
  })

  await check('Product SEO OG image (ImageUrlInput)', async () => {
    await page.getByText('Nội dung & SEO', { exact: false }).first().click()
    const og = page.locator('.image-url-input').last()
    await og.scrollIntoViewIfNeeded()
    await og.getByRole('button', { name: /Đổi ảnh|Chọn từ thư viện/ }).click()
    await pickImage(page, SMALL)
    await expect(og.getByRole('status')).toContainText(/nhỏ|tỉ lệ/, { timeout: 8000 })
    await shot(page, '05-product-seo-og.png')
  })

  // ============ Other ImageUrlInput screens: attach small img -> warning ============
  const IMG_SCREENS: Array<{ step: string; url: string; idx: number }> = [
    { step: 'Category banner', url: '/admin/categories/new', idx: 0 },
    { step: 'Brand logo', url: '/admin/brands/new', idx: 0 },
    { step: 'Slider desktop', url: '/admin/sliders', idx: 0 },
  ]
  // Settings: many image fields — verify the first one
  IMG_SCREENS.push({ step: 'Settings image', url: '/admin/settings', idx: 0 })

  for (const s of IMG_SCREENS) {
    await check(s.step, async () => {
      await page.goto(s.url, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
      // Sliders need the create/edit form opened
      if (s.url.includes('sliders')) {
        await page.getByRole('button', { name: /Thêm|Tạo|slider/i }).first().click().catch(() => {})
        await page.waitForTimeout(500)
      }
      const inp = page.locator('.image-url-input').nth(s.idx)
      await inp.scrollIntoViewIfNeeded()
      await inp.getByRole('button', { name: /Đổi ảnh|Chọn từ thư viện/ }).first().click()
      await pickImage(page, SMALL)
      await expect(inp.getByRole('status')).toContainText(/nhỏ|tỉ lệ/, { timeout: 8000 })
      await shot(page, `scr-${s.step.replace(/\s+/g, '-')}.png`)
    })
  }

  // ============ Home Videos: thumbnail (img) + video file (VideoPickerModal) ============
  await check('HomeVideo thumbnail + video file', async () => {
    await page.goto('/admin/home-videos', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
    await page.getByRole('button', { name: /Thêm|Tạo/i }).first().click().catch(() => {})
    await page.waitForTimeout(600)
    // thumbnail
    const thumb = page.locator('.image-url-input').first()
    await thumb.getByRole('button', { name: /Đổi ảnh|Chọn từ thư viện/ }).first().click()
    await pickImage(page, SMALL)
    await expect(thumb.getByRole('status')).toContainText(/nhỏ|tỉ lệ/, { timeout: 8000 })
    await shot(page, 'scr-homevideo-thumb.png')
  })

  // ---- report ----
  console.log('\n================ DIMENSION-WARNING VERIFICATION ================')
  for (const r of results) console.log(`${r.ok ? '✅ PASS' : '❌ FAIL'}  ${r.step}  — ${r.detail}`)
  console.log('================================================================\n')
  const failed = results.filter((r) => !r.ok)
  expect(failed, `Failed steps:\n${failed.map((f) => `${f.step}: ${f.detail}`).join('\n')}`).toEqual([])
})
