import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../utils/viewports'

const RUN_ID = Date.now()
const ISOLATED_MEDIA_FOLDER_DB = process.env.E2E_MEDIA_FOLDER_ISOLATED === '1'
const ALLOW_SYSTEM_DELETE = process.env.E2E_MEDIA_FOLDER_ALLOW_SYSTEM_DELETE === '1'

function folderName(suffix: string, retry: number) {
  return `E2E_MEDIA_FOLDER_${RUN_ID}${retry ? `_R${retry}` : ''}_${suffix}`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function folderAction(page: Page, name: string) {
  return page.getByRole('button', {
    name: new RegExp(`Thao tác với thư mục.*${escapeRegex(name)}`),
  })
}

async function openFolderAction(page: Page, name: string) {
  const action = folderAction(page, name)
  await expect(action).toBeVisible()
  await action.click()
}

async function createFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Thêm thư mục', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tên thư mục', { exact: true }).fill(name)
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/v1/admin/media-folders'),
    ),
    dialog.getByRole('button', { name: 'Thêm', exact: true }).click(),
  ])
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

async function deleteE2EFolders(page: Page, apiOrigin: string, authorization: string) {
  const response = await page.request.get(`${apiOrigin}/api/v1/admin/media-folders`, {
    headers: { Authorization: authorization },
  })
  if (!response.ok()) return
  const folders = (await response.json())?.data ?? []
  const generated = folders
    .filter((folder: { name?: string }) => folder.name?.startsWith('E2E_MEDIA_FOLDER_'))
    .sort(
      (left: { depth?: number }, right: { depth?: number }) =>
        (right.depth ?? 0) - (left.depth ?? 0),
    )
  for (const folder of generated) {
    await page.request.delete(`${apiOrigin}/api/v1/admin/media-folders/${folder.id}`, {
      headers: { Authorization: authorization },
    })
  }
}

test.describe('media-folder-management', () => {
  test.skip(
    !ISOLATED_MEDIA_FOLDER_DB,
    'Requires a disposable database seeded with the 34 system media folders.',
  )

  test('quản lý được thư mục tự tạo và vẫn chặn cây ba tầng', async ({
    adminPage,
    collect,
  }, testInfo) => {
    test.setTimeout(90_000)
    await adminPage.setViewportSize({
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    })

    const rootName = folderName('ROOT', testInfo.retry)
    const childName = folderName('CHILD', testInfo.retry)
    const renamedProducts = folderName('PRODUCTS', testInfo.retry)
    let apiOrigin = ''
    let authorization = ''

    const foldersResponse = adminPage.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/api/v1/admin/media-folders'),
    )
    await navigateSpa(adminPage, '/admin/media')
    const initialResponse = await foldersResponse
    apiOrigin = new URL(initialResponse.url()).origin
    authorization = initialResponse.request().headers().authorization || ''

    try {
      await test.step('tạo thư mục gốc và thư mục con bằng giao diện', async () => {
        await createFolder(adminPage, rootName)
        await openFolderAction(adminPage, rootName)
        await adminPage.getByRole('menuitem', { name: 'Thêm thư mục con', exact: true }).click()
        const dialog = adminPage.getByRole('dialog')
        await dialog.getByLabel('Tên thư mục', { exact: true }).fill(childName)
        await Promise.all([
          adminPage.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname.endsWith('/api/v1/admin/media-folders'),
          ),
          dialog.getByRole('button', { name: 'Thêm', exact: true }).click(),
        ])
        await expect(adminPage.getByText(childName, { exact: true })).toBeVisible()
      })

      await test.step('chuyển thư mục con ra cấp ngoài cùng', async () => {
        await openFolderAction(adminPage, childName)
        await adminPage.getByRole('menuitem', { name: 'Di chuyển thư mục', exact: true }).click()
        const dialog = adminPage.getByRole('dialog')
        await dialog.getByLabel('Thư mục cha mới', { exact: true }).click()
        await adminPage.getByRole('option', { name: 'Cấp ngoài cùng', exact: true }).click()
        const [response] = await Promise.all([
          adminPage.waitForResponse(
            (item) =>
              item.request().method() === 'PATCH' &&
              new URL(item.url()).pathname.startsWith('/api/v1/admin/media-folders/'),
          ),
          dialog.getByRole('button', { name: 'Di chuyển', exact: true }).click(),
        ])
        expect(response.status()).toBe(200)
      })

      await test.step('chặn chuyển thư mục cha còn con và giữ danh sách hoạt động', async () => {
        await openFolderAction(adminPage, 'Sản phẩm')
        await adminPage.getByRole('menuitem', { name: 'Di chuyển thư mục', exact: true }).click()
        const dialog = adminPage.getByRole('dialog')
        await expect(dialog).toContainText(/còn \d+ thư mục con/)
        await expect(dialog.getByRole('button', { name: 'Di chuyển', exact: true })).toBeDisabled()
        await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
        await expect(adminPage.getByText('Sản phẩm', { exact: true })).toBeVisible()
      })

      await test.step('đổi tên system folder, tải lại và khôi phục tên gốc', async () => {
        await openFolderAction(adminPage, 'Sản phẩm')
        await adminPage.getByRole('menuitem', { name: 'Chỉnh sửa', exact: true }).click()
        let dialog = adminPage.getByRole('dialog')
        await dialog.getByLabel('Tên thư mục', { exact: true }).fill(renamedProducts)
        await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
        await expect(adminPage.getByText(renamedProducts, { exact: true })).toBeVisible()
        await adminPage.reload()
        await expect(adminPage.getByText(renamedProducts, { exact: true })).toBeVisible()

        await openFolderAction(adminPage, renamedProducts)
        await adminPage.getByRole('menuitem', { name: 'Chỉnh sửa', exact: true }).click()
        dialog = adminPage.getByRole('dialog')
        await dialog.getByLabel('Tên thư mục', { exact: true }).fill('Sản phẩm')
        await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
      })

      await test.step('báo trùng tên bằng tiếng Việt', async () => {
        await createFolder(adminPage, rootName)
        const dialog = adminPage.getByRole('dialog')
        await expect(dialog.getByRole('alert')).toHaveText(
          'Tên thư mục đã tồn tại. Hãy dùng tên khác.',
        )
        await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
      })

      await test.step('mở cột thư mục và thao tác được trên điện thoại', async () => {
        await adminPage.setViewportSize({
          width: MOBILE_VIEWPORT.width,
          height: MOBILE_VIEWPORT.height,
        })
        await adminPage.getByRole('button', { name: 'Thư mục', exact: true }).click()
        await expect(folderAction(adminPage, rootName)).toBeVisible()
        await expectNoHorizontalOverflow(adminPage, 'Media folder management mobile')
      })
    } finally {
      if (apiOrigin && authorization) await deleteE2EFolders(adminPage, apiOrigin, authorization)
    }

    expectRuntimeClean(collect, { allowApi: true })
  })

  test('hiển thị cảnh báo riêng trước khi xoá thư mục hệ thống', async ({ adminPage, collect }) => {
    await navigateSpa(adminPage, '/admin/media')
    await openFolderAction(adminPage, 'AGV')
    await adminPage.getByRole('menuitem', { name: 'Xoá', exact: true }).click()
    const dialog = adminPage.getByRole('dialog')
    await expect(dialog).toContainText('Từ nay ảnh sản phẩm hãng AGV')
    await expect(dialog).toContainText('Các tệp hiện có trong thư mục sẽ chuyển về Chưa phân loại')
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
    expectRuntimeClean(collect)
  })

  test('chỉ xoá system folder trên cơ sở dữ liệu dùng riêng cho kiểm thử phá huỷ', async ({
    adminPage,
    collect,
  }) => {
    test.skip(
      !ALLOW_SYSTEM_DELETE,
      'Set E2E_MEDIA_FOLDER_ALLOW_SYSTEM_DELETE=1 only for a disposable seeded database.',
    )
    await navigateSpa(adminPage, '/admin/media')
    await openFolderAction(adminPage, 'AGV')
    await adminPage.getByRole('menuitem', { name: 'Xoá', exact: true }).click()
    const dialog = adminPage.getByRole('dialog')
    const [response] = await Promise.all([
      adminPage.waitForResponse(
        (item) =>
          item.request().method() === 'DELETE' &&
          /\/api\/v1\/admin\/media-folders\//.test(new URL(item.url()).pathname),
      ),
      dialog.getByRole('button', { name: 'Xoá thư mục hệ thống', exact: true }).click(),
    ])
    expect(response.status()).toBe(204)
    await expect(adminPage.getByText('AGV', { exact: true })).toHaveCount(0)
    expectRuntimeClean(collect)
  })
})
