import { mkdir } from 'node:fs/promises'
import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { expectNoHorizontalOverflow, navigateSpa } from '../utils/quality'

const SETTINGS_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]

test.describe('Settings UI', () => {
  test('uses real settings data, stays responsive, and discards a local draft without PATCH', async ({
    adminPage,
    collect,
  }) => {
    const patchRequests: string[] = []
    adminPage.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/api/v1/admin/settings')) {
        patchRequests.push(request.url())
      }
    })

    const screenshotDir = 'e2e/.artifacts/settings-ui'
    await mkdir(screenshotDir, { recursive: true })

    for (const viewport of SETTINGS_VIEWPORTS) {
      await adminPage.setViewportSize(viewport)
      await navigateSpa(adminPage, '/admin/settings')
      await expect(
        adminPage.getByRole('heading', { name: 'Cài đặt cửa hàng', exact: true }),
      ).toBeVisible()
      await expectNoHorizontalOverflow(adminPage, `settings @ ${viewport.width}x${viewport.height}`)

      const desktopNavigator = adminPage.locator('nav[aria-label="Nhóm cài đặt"]')
      const mobileTabs = adminPage.getByRole('tablist', { name: 'Nhóm cài đặt' })
      const policyTab = /Chính sách cửa hàng|Store policies/i
      const orderOperationsTab = /Vận hành đơn hàng|Order operations/i
      const reviewInvitationTab = /Mời khách đánh giá|Review invitations/i
      await expect(
        adminPage
          .getByRole('button', { name: policyTab })
          .or(adminPage.getByRole('tab', { name: policyTab })),
      ).toHaveCount(0)
      await expect(
        adminPage
          .getByRole('button', { name: orderOperationsTab })
          .or(adminPage.getByRole('tab', { name: orderOperationsTab })),
      ).toHaveCount(0)
      await expect(
        adminPage
          .getByRole('button', { name: reviewInvitationTab })
          .or(adminPage.getByRole('tab', { name: reviewInvitationTab })),
      ).toHaveCount(0)
      await expect(adminPage.getByText('Bật email mời đánh giá', { exact: true })).toHaveCount(0)
      await expect(
        adminPage.getByText('Enable review invitation emails', { exact: true }),
      ).toHaveCount(0)
      await expect(
        adminPage.getByText('Nhắc khi đơn chờ quá số ngày', { exact: true }),
      ).toHaveCount(0)
      await expect(
        adminPage.getByText('Remind after this many waiting days', { exact: true }),
      ).toHaveCount(0)
      if (viewport.width >= 1024) {
        await expect(desktopNavigator).toBeVisible()
        await expect(mobileTabs).toBeHidden()
        await expect(
          desktopNavigator.getByRole('button', { name: 'Thông tin shop', exact: true }),
        ).toHaveAttribute('aria-current', 'page')
      } else {
        await expect(desktopNavigator).toBeHidden()
        await expect(mobileTabs).toBeVisible()
        await expect(mobileTabs.getByRole('tab', { name: /Thông tin shop/ })).toHaveAttribute(
          'aria-selected',
          'true',
        )
      }

      await adminPage.screenshot({
        path: `${screenshotDir}/settings-after-${viewport.width}.png`,
        fullPage: true,
      })
    }

    await adminPage.setViewportSize({ width: 1440, height: 900 })
    await navigateSpa(adminPage, '/admin/settings')
    const siteName = adminPage.locator('#setting-site_name')
    await expect(siteName).toBeVisible()
    const originalValue = await siteName.inputValue()
    await siteName.fill(`${originalValue} — kiểm tra giao diện`)

    const actionBar = adminPage.getByRole('toolbar', { name: 'Thanh thao tác' })
    await expect(actionBar).toBeVisible()
    await expect(actionBar).toContainText('1 thay đổi chưa lưu')
    await actionBar.getByRole('button', { name: 'Huỷ', exact: true }).click()
    await expect(siteName).toHaveValue(originalValue)
    await expect(actionBar).toBeHidden()

    expect(patchRequests).toEqual([])
    expectRuntimeClean(collect)
  })
})
