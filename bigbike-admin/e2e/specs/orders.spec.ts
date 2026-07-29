import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import { navigateSpa, waitForScreenReady, expectNoHorizontalOverflow } from '../utils/quality'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '../utils/viewports'

test.describe('Orders admin (read-only smoke)', () => {
  test('mobile list keeps filters and order cards within the viewport', async ({ adminPage, collect }) => {
    await adminPage.setViewportSize(MOBILE_VIEWPORT)
    await navigateSpa(adminPage, '/admin/orders')

    await expect(adminPage.getByRole('heading', { name: 'Đơn hàng', exact: true })).toBeVisible()
    const fromDate = adminPage.locator('#orders-filter-from')
    const toDate = adminPage.locator('#orders-filter-to')
    await expect(fromDate).toBeVisible()
    await expect(toDate).toBeVisible()
    await expect(adminPage.locator('.mobile-card-list')).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Cột hiển thị' })).toBeHidden()
    await fromDate.fill('2026-07-01')
    await toDate.fill('2026-07-28')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('from')).toBe('2026-07-01')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('to')).toBe('2026-07-28')
    await expectNoHorizontalOverflow(adminPage, `orders list @ ${MOBILE_VIEWPORT.name}`)
    expectRuntimeClean(collect)
  })

  test('an existing order detail stays readable on mobile without changing data', async ({ adminPage, collect }) => {
    await adminPage.setViewportSize(DESKTOP_VIEWPORT)
    await navigateSpa(adminPage, '/admin/orders')

    const firstOrderLink = adminPage.locator('tbody .bb-row-link').first()
    if (await firstOrderLink.count() === 0) {
      test.info().annotations.push({
        type: 'skip',
        description: 'Backend has no order fixture available for detail smoke.',
      })
      return
    }

    await firstOrderLink.click()
    await expect.poll(() => new URL(adminPage.url()).pathname).toMatch(/\/admin\/orders\/[^/]+$/)
    await waitForScreenReady(adminPage)
    await expect(adminPage.getByRole('heading', { name: /Đơn hàng/ })).toBeVisible()

    await adminPage.setViewportSize(MOBILE_VIEWPORT)
    await expectNoHorizontalOverflow(adminPage, `order detail @ ${MOBILE_VIEWPORT.name}`)
    await expect(adminPage.getByText('Thông tin khách hàng', { exact: true })).toBeVisible()
    const mobileActions = adminPage.getByRole('toolbar', { name: 'Thao tác đơn hàng' })
    if (await mobileActions.count()) {
      await expect(mobileActions).toBeVisible()
      const box = await mobileActions.boundingBox()
      expect(box && box.y + box.height).toBeLessThanOrEqual(846)
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'The selected order is terminal and has no mobile status action.',
      })
    }
    expectRuntimeClean(collect)
  })
})
