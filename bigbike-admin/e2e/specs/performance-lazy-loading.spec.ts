import {
  testAnon as anonTest,
  expect as anonExpect,
  expectRuntimeClean as expectAnonRuntimeClean,
} from '../fixtures/admin-test'
import { test, expect, expectRuntimeClean, type Page } from '../fixtures/admin-test'
import { navigateSpa } from '../utils/quality'

const DASHBOARD_WITH_CHARTS = {
  data: {
    kpi: {
      todayRevenue: 1_000_000,
      todayPaidRevenue: 800_000,
      todayRevenuePct: 12,
      todayOrders: 3,
      todayOrdersDelta: 1,
      pendingOrders: 2,
      activeProducts: 10,
    },
    revenueData: [
      { date: '2026-08-19', revenue: 750_000, orders: 2 },
      { date: '2026-08-20', revenue: 1_000_000, orders: 3 },
    ],
    orderStatusBreakdown: [
      { status: 'PENDING', count: 2 },
      { status: 'PROCESSING', count: 1 },
    ],
    recentOrders: [],
    topProducts: [],
  },
}

const HTML_SETTING = {
  data: [
    {
      key: 'home_content_bottom_html',
      value: '<p>Nội dung kiểm thử chỉ đọc</p>',
      valueEn: '<p>Read-only test content</p>',
      valueType: 'HTML',
      settingGroup: 'SEO',
      updatedAt: '2026-08-20T00:00:00Z',
    },
  ],
}

function loadedResourceNames(page: Page) {
  return page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name))
}

anonTest(
  'hiển thị đăng nhập không lấy chunk trình soạn thảo',
  async ({ adminPage: page, collect }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await anonExpect(page.locator('.bb-login-shell')).toBeVisible()

    const resources = await loadedResourceNames(page)
    anonExpect(resources.filter((url) => /RichTextEditor|tiptap|prosemirror/i.test(url))).toEqual(
      [],
    )
    expectAnonRuntimeClean(collect, { allowApi: true })
  },
)

anonTest('màn đăng nhập giữ bố cục ở khổ điện thoại', async ({ adminPage: page, collect }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await anonExpect(page.locator('.bb-login-shell')).toBeVisible()

  const horizontalOverflow = await page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
  )
  anonExpect(
    horizontalOverflow,
    'Màn đăng nhập không được tràn ngang trên điện thoại',
  ).toBeLessThanOrEqual(1)
  expectAnonRuntimeClean(collect, { allowApi: true })
})

test('chỉ nạp biểu đồ khi cuộn tới, và rê menu chỉ nạp màn được trỏ', async ({
  adminPage,
  collect,
}) => {
  await adminPage.setViewportSize({ width: 1440, height: 480 })
  await adminPage.route('**/api/v1/admin/dashboard?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(DASHBOARD_WITH_CHARTS),
    })
  })
  await adminPage.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })

  const revenueSlot = adminPage.getByTestId('dashboard-revenue-chart-slot')
  const statusSlot = adminPage.getByTestId('dashboard-status-chart-slot')
  await expect(revenueSlot).toBeVisible()
  await expect(statusSlot).toBeVisible()
  await expect(adminPage.locator('.recharts-wrapper')).toHaveCount(0)

  const heightBefore = (await revenueSlot.boundingBox())?.height ?? 0
  await revenueSlot.scrollIntoViewIfNeeded()
  await expect(adminPage.locator('.recharts-wrapper').first()).toBeVisible()
  const heightAfter = (await revenueSlot.boundingBox())?.height ?? 0
  expect(
    Math.abs(heightAfter - heightBefore),
    'Vùng chờ biểu đồ doanh thu phải giữ chiều cao ổn định',
  ).toBeLessThanOrEqual(2)

  await statusSlot.scrollIntoViewIfNeeded()
  await expect(adminPage.locator('.recharts-wrapper')).toHaveCount(2)

  const beforeHover = await loadedResourceNames(adminPage)
  expect(beforeHover.some((url) => /OrderListScreen-[\w-]+\.js/.test(url))).toBe(false)
  expect(beforeHover.some((url) => /ProductListScreen-[\w-]+\.js/.test(url))).toBe(false)

  await adminPage.locator('.bb-nav-link[href="/admin/orders"]').hover()
  await expect
    .poll(
      async () => {
        const resources = await loadedResourceNames(adminPage)
        return resources.some((url) => /OrderListScreen-[\w-]+\.js/.test(url))
      },
      { message: 'Rê đúng menu Đơn hàng phải nạp trước riêng màn Đơn hàng' },
    )
    .toBe(true)
  const afterHover = await loadedResourceNames(adminPage)
  expect(
    afterHover.some((url) => /ProductListScreen-[\w-]+\.js/.test(url)),
    'Không được nạp trước màn khác',
  ).toBe(false)
  expectRuntimeClean(collect)
})

test('mở màn biên tập và cấu hình sẽ nạp trình soạn thảo mà không ghi dữ liệu', async ({
  adminPage,
  collect,
}) => {
  await navigateSpa(adminPage, '/admin/content/article/new')
  await expect(adminPage.locator('.ProseMirror').first()).toBeVisible()

  await adminPage.route('**/api/v1/admin/settings?*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(HTML_SETTING) })
  })
  await navigateSpa(adminPage, '/admin/settings')
  await expect(adminPage.locator('.ProseMirror').first()).toBeVisible()
  expectRuntimeClean(collect)
})
