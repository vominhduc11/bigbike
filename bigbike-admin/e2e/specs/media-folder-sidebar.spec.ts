import { test as adminTest, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import type { Locator, TestInfo } from '@playwright/test'
import { expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'
import vi from '../../src/locales/vi.json' with { type: 'json' }
import en from '../../src/locales/en.json' with { type: 'json' }

// Chỉ dọn những thư mục do lượt kiểm này tạo; không chạy guard quét module khác.
const test = adminTest.extend({
  e2eDataGuard: [
    async ({}, use) => {
      await use({ purge: async () => {} })
    },
    { scope: 'worker', auto: true },
  ],
})

type Folder = {
  id: string
  name: string
  parentId: string | null
  systemKey: string | null
  mediaCount: number
}
type Locale = 'vi' | 'en'
const ROOT_KEYS = ['products', 'articles', 'brands', 'categories', 'illustrations'] as const
const SIZES = ['1440x900', '768x1024', '375x812'].map((name) =>
  VIEWPORTS.find((viewport) => viewport.name === name)!,
)

function selectFolder(sidebar: Locator, label: string, count: number) {
  return sidebar.getByRole('button', { name: `${label} ${count}`, exact: true })
}

async function openSmallSidebar(sidebar: Locator, locale: Locale, width: number) {
  if (width >= 1024) return
  const opener = sidebar.getByRole('button', {
    name: (locale === 'vi' ? vi : en).media.folders,
    exact: true,
  })
  if ((await opener.getAttribute('aria-expanded')) === 'false') await opener.click()
}

async function capture(page: Page, sidebar: Locator, name: string, info: TestInfo) {
  const sidebarPath = info.outputPath(`${name}-sidebar.png`)
  await sidebar.screenshot({ path: sidebarPath })
  await info.attach(`${name}-sidebar`, { path: sidebarPath, contentType: 'image/png' })
  const pagePath = info.outputPath(`${name}-page.png`)
  await page.screenshot({ path: pagePath, fullPage: true })
  await info.attach(`${name}-page`, { path: pagePath, contentType: 'image/png' })
}

test('tên thư mục, menu và nhánh rõ ràng ở ba kích thước với nhãn Việt/Anh', async ({
  adminPage,
  authHolder,
  collect,
}, testInfo) => {
  test.setTimeout(180_000)
  const headers = { Authorization: `Bearer ${authHolder.accessToken}` }
  const runPrefix = `E2E_MEDIA_FOLDER_${Date.now()}_`
  const rootName =
    `${runPrefix}Ảnh minh hoạ sản phẩm và hướng dẫn sử dụng dành cho nhân viên cửa hàng và khách hàng`
      .padEnd(120, ' ảnh')
      .slice(0, 120)
      .trim()
  const childName =
    `${runPrefix}Product photographs and installation instructions for shop staff and customer support`
      .padEnd(120, ' photos')
      .slice(0, 120)
      .trim()
  const unbrokenName = `${runPrefix}${'LongFolderName'.repeat(10)}`.slice(0, 120)
  const createdIds: string[] = []

  async function createFolder(name: string, parentId: string | null) {
    const response = await adminPage.request.post('/api/v1/admin/media-folders', {
      headers,
      data: { name, parentId },
    })
    expect(response.status(), `Tạo thư mục thử ${name}`).toBe(201)
    const folder = (await response.json()).data as Folder
    expect(folder.id).toBeTruthy()
    createdIds.push(folder.id)
    return folder
  }

  try {
    const root = await createFolder(rootName, null)
    const child = await createFolder(childName, root.id)
    await createFolder(unbrokenName, root.id)
    const response = await adminPage.request.get('/api/v1/admin/media-folders', { headers })
    expect(response.ok()).toBe(true)
    const folders = (await response.json()).data as Folder[]
    const products = folders.find((folder) => folder.systemKey === 'root:products')!
    expect(products).toBeDefined()

    await navigateSpa(adminPage, '/admin/media')
    await expect(
      selectFolder(
        adminPage.getByRole('complementary', { name: 'Thư mục', exact: true }),
        rootName,
        0,
      ),
    ).toBeAttached({ timeout: 60_000 })
    await adminPage.evaluate(() => document.fonts.ready)

    for (const locale of ['vi', 'en'] as const) {
      await adminPage.evaluate(async (language) => {
        await (
          window as unknown as {
            setMediaSidebarTestLanguage: (locale: string) => Promise<void>
          }
        ).setMediaSidebarTestLanguage(language)
      }, locale)
      const dictionary = locale === 'vi' ? vi : en
      const sidebar = adminPage.getByRole('complementary', {
        name: dictionary.media.folders,
        exact: true,
      })

      for (const viewport of SIZES) {
        await adminPage.setViewportSize({ width: viewport.width, height: viewport.height })
        await openSmallSidebar(sidebar, locale, viewport.width)
        const all = sidebar.getByRole('button', { name: dictionary.media.allFolders, exact: true })
        if ((await all.getAttribute('aria-current')) !== 'true') {
          await all.click()
          await openSmallSidebar(sidebar, locale, viewport.width)
        }

        const expanded = sidebar.getByRole('button', {
          name: new RegExp(`^${dictionary.media.collapseFolder}:`),
        })
        while ((await expanded.count()) > 0) await expanded.first().click()
        await sidebar.evaluate((element) => {
          element.scrollTop = 0
        })

        const width = (await sidebar.boundingBox())!.width
        if (viewport.width >= 1024) {
          expect(width).toBeGreaterThanOrEqual(320)
          expect(width).toBeLessThanOrEqual(384)
        }
        for (const key of ROOT_KEYS) {
          const folder = folders.find((item) => item.systemKey === `root:${key}`)!
          const label = dictionary.media.folderTree[key]
          const button = selectFolder(sidebar, label, folder.mediaCount)
          await expect(button).toBeVisible()
          const size = await button
            .locator('span')
            .first()
            .evaluate((element) => ({
              availableWidth: element.clientWidth,
              fullWidth: element.scrollWidth,
              availableHeight: element.clientHeight,
              fullHeight: element.scrollHeight,
            }))
          expect(size.fullWidth, label).toBeLessThanOrEqual(size.availableWidth + 1)
          expect(size.fullHeight, label).toBeLessThanOrEqual(size.availableHeight + 1)
        }
        const heading = sidebar.getByText(dictionary.media.myFolders, { exact: true })
        const height = await heading.evaluate((element) => ({
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
        }))
        expect(height.height).toBeLessThanOrEqual(height.lineHeight + 1)
        if (viewport.width < 1024) {
          const buttons = sidebar.getByRole('button')
          for (const button of await buttons.all()) {
            if (!(await button.isVisible())) continue
            const rect = (await button.boundingBox())!
            expect(rect.width).toBeGreaterThanOrEqual(44)
            expect(rect.height).toBeGreaterThanOrEqual(44)
          }
        }
        await expectNoHorizontalOverflow(adminPage, `Media folders ${locale} ${viewport.width}`)
        await sidebar.evaluate((element) => {
          element.scrollTop = 0
        })
        await capture(adminPage, sidebar, `${locale}-${viewport.width}-roots`, testInfo)

        const productButton = selectFolder(
          sidebar,
          dictionary.media.folderTree.products,
          products.mediaCount,
        )
        await productButton.focus()
        await adminPage.keyboard.press('Enter')
        await expect
          .poll(() => new URL(adminPage.url()).searchParams.get('folderFilter'))
          .toBe(products.id)
        if (viewport.width < 1024) {
          const opener = sidebar.getByRole('button', {
            name: dictionary.media.folders,
            exact: true,
          })
          await expect(opener).toHaveAttribute('aria-expanded', 'false')
          await expect(opener).toBeFocused()
          await opener.click()
        }
        await expect(productButton).toHaveAttribute('aria-current', 'true')

        const branch = sidebar.getByRole('button', {
          name: `${dictionary.media.expandFolder}: ${rootName}`,
          exact: true,
        })
        await branch.focus()
        await adminPage.keyboard.press('Space')
        await expect(
          sidebar.getByRole('button', {
            name: `${dictionary.media.collapseFolder}: ${rootName}`,
            exact: true,
          }),
        ).toHaveAttribute('aria-expanded', 'true')
        expect(new URL(adminPage.url()).searchParams.get('folderFilter')).toBe(products.id)
        const longButton = selectFolder(sidebar, childName, 0)
        const longLabel = longButton.locator('span').first()
        const clamped = await longLabel.evaluate((element) => ({
          height: element.clientHeight,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
          fullHeight: element.scrollHeight,
          width: element.clientWidth,
          fullWidth: element.scrollWidth,
        }))
        expect(clamped.height).toBeLessThanOrEqual(clamped.lineHeight * 2 + 1)
        const clipped = clamped.fullHeight > clamped.height || clamped.fullWidth > clamped.width
        await capture(adminPage, sidebar, `${locale}-${viewport.width}-children`, testInfo)

        await longButton.focus()
        if (clipped) await expect(adminPage.getByRole('tooltip')).toHaveText(childName)
        else await expect(adminPage.getByRole('tooltip')).toBeHidden()
        expect(new URL(adminPage.url()).searchParams.get('folderFilter')).toBe(products.id)
        await adminPage.keyboard.press('Escape')
        await expect(adminPage.getByRole('tooltip')).toBeHidden()
        await longButton.blur()
        await longButton.hover()
        if (clipped) await expect(adminPage.getByRole('tooltip')).toHaveText(childName)
        else await expect(adminPage.getByRole('tooltip')).toBeHidden()
        await adminPage.keyboard.press('Escape')
        await adminPage.mouse.move(0, 0)

        const actionName = dictionary.media.folderActions.replace('{{name}}', childName)
        const action = sidebar.getByRole('button', { name: actionName, exact: true })
        if (viewport.width < 1024) await action.tap()
        else {
          await action.focus()
          await adminPage.keyboard.press('Enter')
        }
        const menu = adminPage.getByRole('menu')
        await expect(menu).toContainText(childName)
        expect(new URL(adminPage.url()).searchParams.get('folderFilter')).toBe(products.id)
        await expectNoHorizontalOverflow(adminPage, 'Menu tên thư mục dài')
        await adminPage.keyboard.press('Escape')
        await expect(action).toBeFocused()
        const unbroken = selectFolder(sidebar, unbrokenName, 0)
        await expect(unbroken).toBeVisible()
        const size = await unbroken
          .locator('span')
          .first()
          .evaluate((element) => ({
            available: element.clientWidth,
            full: element.scrollWidth,
          }))
        expect(size.full).toBeLessThanOrEqual(size.available + 1)
      }
    }

    const filtered = await adminPage.request.get(
      `/api/v1/admin/media?folderFilter=${products.id}&size=24`,
      { headers },
    )
    expect(filtered.ok()).toBe(true)
    const allowed = new Set(
      folders
        .filter((folder) => folder.id === products.id || folder.parentId === products.id)
        .map((folder) => folder.id),
    )
    const items = (await filtered.json()).data as { folderId: string }[]
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) expect(allowed.has(item.folderId)).toBe(true)
    expect(child.parentId).toBe(root.id)
  } finally {
    for (const id of [...createdIds].reverse()) {
      const response = await adminPage.request.delete(`/api/v1/admin/media-folders/${id}`, {
        headers,
      })
      expect(response.ok(), `Dọn thư mục thử ${id}`).toBe(true)
    }
  }
  expectRuntimeClean(collect)
})
