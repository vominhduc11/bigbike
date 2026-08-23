import { test, expect, expectRuntimeClean, resetCollectors } from '../fixtures/admin-test'
import {
  navigateSpa, expectNoHorizontalOverflow, expectHeaderNotOverlappingContent,
  expectSidebarDrawerClosed, openSidebarDrawer,
} from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'
import { KEY_ROUTES } from '../utils/routes'

/**
 * Responsive sweep — the full 8-viewport matrix. Each viewport is one test that
 * resizes (no reload) and walks KEY_ROUTES via in-app navigation, asserting:
 *  - no page-level horizontal overflow
 *  - header not covering content
 *  - on <=900px: sidebar is an off-canvas drawer by default
 *  - runtime/network stay clean at that size
 */
for (const vp of VIEWPORTS) {
  test(`responsive · ${vp.name} (${vp.kind})`, async ({ adminPage, collect }) => {
    await adminPage.setViewportSize({ width: vp.width, height: vp.height })
    const issues: string[] = []

    for (const route of KEY_ROUTES) {
      await test
        .step(`${route.id} @ ${vp.name}`, async () => {
          resetCollectors(collect)
          await navigateSpa(adminPage, route.path)
          await expectNoHorizontalOverflow(adminPage, `${route.id} @ ${vp.name}`)
          await expectHeaderNotOverlappingContent(adminPage, `${route.id} @ ${vp.name}`)
          if (vp.sidebarIsDrawer) await expectSidebarDrawerClosed(adminPage)
          expectRuntimeClean(collect)
        })
        .catch((e: Error) => issues.push(`✗ ${route.id}: ${e.message.split('\n')[0]}`))
    }

    expect(issues, `Responsive problems @ ${vp.name}:\n${issues.join('\n')}`).toEqual([])
  })
}

test('responsive · mobile sidebar drawer opens and navigates', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 390, height: 844 })
  await navigateSpa(adminPage, '/admin/orders')

  // Drawer hidden by default, hamburger visible.
  await expectSidebarDrawerClosed(adminPage)
  await openSidebarDrawer(adminPage)

  // Tapping a nav item navigates and closes the drawer.
  await adminPage.locator('.bb-sidebar .bb-nav-link', { hasText: /Sản phẩm|Products/ }).first().click()
  await expect.poll(async () => {
    const box = await adminPage.locator('.bb-sidebar').boundingBox()
    return box ? Math.round(box.x + box.width) : 0
  }, { message: 'Drawer should close after selecting a nav item' }).toBeLessThanOrEqual(4)
  await expect(adminPage).toHaveURL(/\/admin\/products/)
  await expectNoHorizontalOverflow(adminPage, 'orders→products mobile drawer nav')
})

test('responsive · product and order screens share the same 1920px content width', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 1920, height: 1080 })
  await navigateSpa(adminPage, '/admin/products')
  const productWidth = await adminPage.locator('.screen').first().evaluate((element) => element.getBoundingClientRect().width)
  await navigateSpa(adminPage, '/admin/orders')
  const orderWidth = await adminPage.locator('.screen').first().evaluate((element) => element.getBoundingClientRect().width)
  expect(Math.abs(productWidth - orderWidth)).toBeLessThanOrEqual(1)
})
