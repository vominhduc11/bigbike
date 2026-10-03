import { test as base, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { VIEWPORTS } from '../utils/viewports'
import { navigateSpa, expectNoHorizontalOverflow } from '../utils/quality'

// This suite uses real GET data only. NEVER run the inherited store cleanup.
const test = base.extend<{ businessWriteGuard: void; adminPermissions: string[] | null }>({
  adminPermissions: [null, { option: true }],
  e2eDataGuard: [
    async ({}, use) => {
      await use({
        purge: async () => {
          throw new Error('Store cleanup is disabled for banner QA')
        },
      })
    },
    { scope: 'worker', auto: true },
  ],
  businessWriteGuard: [
    async ({ page, adminPermissions }, use) => {
      const unexpectedWrites: string[] = []
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request()
        if (
          ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) ||
          /\/auth\/(login|refresh)$/.test(new URL(request.url()).pathname)
        ) {
          await route.continue()
        } else {
          unexpectedWrites.push(`${request.method()} ${new URL(request.url()).pathname}`)
          await route.abort('blockedbyclient')
        }
      })
      if (adminPermissions) {
        await page.route('**/api/v1/auth/me', async (route) => {
          const response = await route.fetch()
          const json = await response.json()
          json.data.roles = ['CUSTOM']
          json.data.permissions = adminPermissions
          await route.fulfill({ response, json })
        })
      }
      await use()
      expect(unexpectedWrites, 'All business writes must be intercepted in the test').toEqual([])
    },
    { auto: true },
  ],
})

async function selectTab(page: Page, name: string) {
  const desktopButton = page.getByRole('button', { name, exact: true })
  if (await desktopButton.isVisible()) await desktopButton.click()
  else await page.getByRole('tab', { name: new RegExp(name) }).click()
}

async function openBanners(page: Page) {
  await navigateSpa(page, '/admin/settings')
  await selectTab(page, 'Phần đầu trang')
  await expect(page.locator('[data-banner-preview]')).toHaveCount(3)
}

for (const viewport of VIEWPORTS.filter(({ name }) =>
  ['1440x900', '768x1024', '375x812'].includes(name),
)) {
  test.describe(`Banner layout ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })
    test('three banners match storefront geometry and load actual images', async ({
      adminPage: page,
      collect,
    }, testInfo) => {
      await openBanners(page)
      const previews = page.locator('[data-banner-preview]')
      const imageCount = viewport.width >= 768 ? 6 : 3
      await expect(page.locator('[data-banner-image][data-image-status="ready"]')).toHaveCount(
        imageCount,
      )
      await expect(page.locator('[data-banner-illustration]')).toHaveCount(
        viewport.width >= 768 ? 3 : 0,
      )
      for (let index = 0; index < 3; index += 1) {
        const preview = previews.nth(index)
        const metrics = await preview.evaluate((element) => {
          const image = element.querySelector<HTMLImageElement>('[data-banner-image="background"]')!
          const illustration = element.querySelector<HTMLImageElement>(
            '[data-banner-image="illustration"]',
          )
          return {
            width: element.clientWidth,
            height: element.getBoundingClientRect().height,
            fit: getComputedStyle(image).objectFit,
            position: getComputedStyle(image).objectPosition,
            naturalWidth: image.naturalWidth,
            illustrationFit: illustration && getComputedStyle(illustration).objectFit,
            src: image.src,
          }
        })
        expect(
          Math.abs(
            metrics.height - (metrics.width / viewport.width) * (viewport.width >= 768 ? 450 : 250),
          ),
        ).toBeLessThan(3)
        expect(metrics.fit).toBe('cover')
        expect(metrics.position).toBe('50% 50%')
        expect(metrics.naturalWidth).toBeGreaterThan(0)
        expect(metrics.src).toContain('/brand/page-title-bg.png')
        if (viewport.width >= 768) expect(metrics.illustrationFit).toBe('contain')
        await preview.screenshot({
          path: `e2e/.artifacts/banners-settings/${viewport.name}-${index + 1}.png`,
        })
      }
      if (viewport.width >= 1024)
        await expect(
          page.getByRole('button', { name: 'Phần đầu trang', exact: true }),
        ).toContainText('14 mục')
      await expectNoHorizontalOverflow(page, `Banners ${viewport.name}`)
      await page.evaluate(() => window.scrollTo(0, 0))
      const screenshot = `e2e/.artifacts/banners-settings/${viewport.name}-page.png`
      await page.screenshot({ path: screenshot, fullPage: true })
      await testInfo.attach(`banners-${viewport.name}`, {
        path: screenshot,
        contentType: 'image/png',
      })
      expectRuntimeClean(collect)
    })
  })
}

test('pending save locks edits, duplicate submissions and discard; success clears only banner drafts', async ({
  adminPage: page,
  collect,
}) => {
  let settings: { data: Array<Record<string, unknown>> } | undefined
  await page.route('**/api/v1/admin/settings?*', async (route) => {
    const response = await route.fetch()
    settings = await response.json()
    await route.fulfill({ response, json: settings })
  })
  await openBanners(page)
  await selectTab(page, 'Thông tin shop')
  const shop = page.locator('#setting-site_name')
  await shop.fill(`${await shop.inputValue()} bản nháp`)
  await selectTab(page, 'Phần đầu trang')
  const title = page.locator('#banner-hero_products_title-vi')
  await title.fill('Tiêu đề kiểm thử, không ghi vào cửa hàng')
  let calls = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/admin/settings', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    calls += 1
    const { updates } = route.request().postDataJSON()
    await gate
    await route.fulfill({
      json: {
        data: updates.map((update: Record<string, unknown>) => ({
          ...settings!.data.find((item) => (item.settingKey ?? item.key) === update.key),
          settingKey: update.key,
          ...(update.value !== undefined ? { settingValue: update.value } : {}),
          ...(update.valueEn !== undefined ? { settingValueEn: update.valueEn } : {}),
        })),
      },
    })
  })
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(title).toBeDisabled()
  await expect(page.getByRole('button', { name: 'EN', exact: true }).first()).toBeEnabled()
  await page.getByRole('button', { name: 'EN', exact: true }).first().click()
  await expect(page.locator('#banner-hero_products_title-en')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Huỷ', exact: true })).toBeDisabled()
  for (const button of await page
    .getByRole('button', { name: /^(Đổi ảnh|Chọn từ thư viện|Xóa ảnh)$/ })
    .all())
    await expect(button).toBeDisabled()
  release()
  await expect(page.getByText('Đã lưu thay đổi', { exact: true })).toBeVisible()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'VI', exact: true }).first().click()
  await expect(title).toHaveValue('Tiêu đề kiểm thử, không ghi vào cửa hàng')
  let dialogs = 0
  page.on('dialog', async (dialog) => {
    dialogs += 1
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: /Mở Danh mục/i }).click()
  expect(dialogs).toBe(1)
  await expect(page).toHaveURL(/\/admin\/settings$/)
  expectRuntimeClean(collect)
})

test('real guards preserve Banner → Assignment → Banner and Shop → Banner/Assignment drafts, browser history and unload', async ({
  adminPage: page,
  collect,
}) => {
  await openBanners(page)
  const title = page.locator('#banner-hero_products_title-vi')
  await title.fill('Bản nháp chưa lưu')
  await selectTab(page, 'Phân công sản phẩm')
  await selectTab(page, 'Phần đầu trang')
  await expect(title).toHaveValue('Bản nháp chưa lưu')
  let dialogs = 0
  let leave = false
  page.on('dialog', async (dialog) => {
    dialogs += 1
    await (leave ? dialog.accept() : dialog.dismiss())
  })
  const historyLength = await page.evaluate(() => history.length)
  await page.evaluate(() => history.back())
  await expect.poll(() => dialogs).toBe(1)
  await expect(page).toHaveURL(/\/admin\/settings$/)
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  await expect(title).toHaveValue('Bản nháp chưa lưu')
  const unloadPrevented = await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(unloadPrevented).toBe(true)
  leave = true
  await page.evaluate(() => history.back())
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await page.evaluate(() => history.forward())
  await expect(page).toHaveURL(/\/admin\/settings$/)
  await selectTab(page, 'Thông tin shop')
  const shop = page.locator('#setting-site_name')
  await shop.fill(`${await shop.inputValue()} bản nháp`)
  await selectTab(page, 'Phần đầu trang')
  await selectTab(page, 'Phân công sản phẩm')
  leave = false
  await page.evaluate(() => history.back())
  await expect.poll(() => dialogs).toBe(3)
  await expect(page).toHaveURL(/\/admin\/settings$/)
  expectRuntimeClean(collect)
})

test('EN preview falls back to VI drafts; indexed validation identifies EN without changing VI', async ({
  adminPage: page,
  collect,
}) => {
  await page.route('**/api/v1/admin/settings?*', async (route) => {
    const response = await route.fetch()
    const json = await response.json()
    for (const item of json.data)
      if (/^hero_.*_title$/.test(item.settingKey ?? item.key)) item.settingValueEn = ''
    await route.fulfill({ response, json })
  })
  await openBanners(page)
  const viTitle = page.locator('#banner-hero_products_title-vi')
  await viTitle.fill('Tiêu đề tiếng Việt đang soạn')
  await page.getByRole('button', { name: 'EN', exact: true }).first().click()
  const enTitle = page.locator('#banner-hero_products_title-en')
  await expect(enTitle).toHaveValue('')
  await expect(page.locator('[data-banner-title]').first()).toHaveText(
    'Tiêu đề tiếng Việt đang soạn',
  )
  await enTitle.fill('English draft')
  let submitted: Array<{ key: string; value?: string; valueEn?: string }> = []
  await page.route('**/api/v1/admin/settings', async (route) => {
    submitted = route.request().postDataJSON().updates
    const index = submitted.findIndex((update) => update.key === 'hero_products_title')
    await route.fulfill({
      status: 400,
      json: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [
            {
              field: `updates[${index}].valueEn`,
              code: 'INVALID',
              message: 'Lỗi tiếng Anh dùng cho kiểm thử',
            },
          ],
        },
        meta: { requestId: 'banner-qa' },
      },
    })
  })
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(enTitle).toHaveAttribute('aria-invalid', 'true')
  await expect(enTitle).toHaveValue('English draft')
  await page.getByRole('button', { name: 'VI', exact: true }).first().click()
  await expect(viTitle).toHaveValue('Tiêu đề tiếng Việt đang soạn')
  await expect(viTitle).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('button', { name: /EN/ }).last()).toContainText('EN')
  await page.getByRole('button', { name: /EN/ }).last().click()
  await enTitle.fill('Corrected English')
  await expect(enTitle).not.toHaveAttribute('aria-invalid', 'true')
  expect(submitted[0]).toMatchObject({
    key: 'hero_products_title',
    value: 'Tiêu đề tiếng Việt đang soạn',
    valueEn: 'English draft',
  })
  expect(collect.apiErrors).toHaveLength(1)
  expect(collect.apiErrors[0].status).toBe(400)
  expectRuntimeClean(collect, { allowApi: true })
})

test('network failure preserves an EN-only draft; retry saves EN without sending VI', async ({
  adminPage: page,
  collect,
}) => {
  let settings: { data: Array<Record<string, unknown>> } | undefined
  await page.route('**/api/v1/admin/settings?*', async (route) => {
    const response = await route.fetch()
    settings = await response.json()
    await route.fulfill({ response, json: settings })
  })
  await openBanners(page)
  const originalVi = await page.locator('#banner-hero_products_title-vi').inputValue()
  await page.getByRole('button', { name: 'EN', exact: true }).first().click()
  const enTitle = page.locator('#banner-hero_products_title-en')
  await enTitle.fill('English-only draft, intercepted save')
  let calls = 0
  await page.route('**/api/v1/admin/settings', async (route) => {
    calls += 1
    const { updates } = route.request().postDataJSON()
    expect(updates).toEqual([
      { key: 'hero_products_title', valueEn: 'English-only draft, intercepted save' },
    ])
    if (calls === 1) return route.abort('failed')
    await route.fulfill({
      json: {
        data: updates.map((update: { key: string; valueEn: string }) => ({
          ...settings!.data.find((item) => (item.settingKey ?? item.key) === update.key),
          settingValueEn: update.valueEn,
        })),
      },
    })
  })
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(
    page
      .locator('[role="alert"]')
      .filter({ hasText: /kết nối|mạng|Network|fetch/i })
      .last(),
  ).toBeVisible()
  await expect(enTitle).toHaveValue('English-only draft, intercepted save')
  await expect(enTitle).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(page.getByText('Đã lưu thay đổi', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'VI', exact: true }).first().click()
  await expect(page.locator('#banner-hero_products_title-vi')).toHaveValue(originalVi)
  expect(calls).toBe(2)
  expect(collect.apiErrors).toHaveLength(1)
  expect(collect.apiErrors[0].failure).toBeTruthy()
  expectRuntimeClean(collect, { allowApi: true })
})

test.describe('Settings permissions', () => {
  test.describe('read only', () => {
    test.use({ adminPermissions: ['settings.read', 'dashboard.read', 'media.read'] })
    test('all banner fields are read only', async ({ adminPage: page, collect }) => {
      await openBanners(page)
      await expect(page.locator('#banner-hero_products_title-vi')).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0)
      for (const button of await page
        .getByRole('button', { name: /^(Đổi ảnh|Chọn từ thư viện)$/ })
        .all())
        await expect(button).toBeDisabled()
      expectRuntimeClean(collect)
    })
  })
  test.describe('no media read', () => {
    test.use({ adminPermissions: ['settings.read', 'settings.write', 'dashboard.read'] })
    test('editing text does not grant access to the media library', async ({
      adminPage: page,
      collect,
    }) => {
      await openBanners(page)
      await expect(page.locator('#banner-hero_products_title-vi')).toBeEnabled()
      for (const button of await page
        .getByRole('button', { name: /^(Đổi ảnh|Chọn từ thư viện)$/ })
        .all())
        await expect(button).toBeDisabled()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expectRuntimeClean(collect)
    })
  })
  test.describe('media read without upload', () => {
    test.use({
      adminPermissions: ['settings.read', 'settings.write', 'dashboard.read', 'media.read'],
    })
    test('existing images can be selected without enabling upload', async ({
      adminPage: page,
      collect,
    }) => {
      await openBanners(page)
      await page.getByRole('button', { name: 'Chọn từ thư viện', exact: true }).nth(1).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: /Tải lên/ })).toHaveCount(0)
      await expect(dialog.locator('.mpicker-grid')).toBeVisible()
      await expect(dialog.locator('.mpicker-item').first()).toBeVisible()
      await dialog.locator('.mpicker-item').first().click()
      await expect(dialog.getByRole('button', { name: /Chọn ảnh/ })).toBeEnabled()
      await dialog.getByRole('button', { name: /Chọn ảnh/ }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeEnabled()
      expectRuntimeClean(collect)
    })
  })
})
