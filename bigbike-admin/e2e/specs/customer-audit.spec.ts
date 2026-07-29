import { mkdir } from 'node:fs/promises'
import type { Locator, Page, Route } from '@playwright/test'
import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import {
  expectNoHorizontalOverflow,
  navigateSpa,
  waitForScreenReady,
} from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'

type MockCustomer = {
  id: string
  email: string
  displayName: string
  fullName: string
  firstName?: string
  lastName?: string
  phone?: string
  status: 'ACTIVE' | 'PENDING' | 'DISABLED' | 'BLOCKED'
  isSynthetic: boolean
  emailVerifiedAt?: string
  phoneVerifiedAt?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  addresses: Array<Record<string, unknown>>
  orderSummary: {
    orderCount: number
    totalSpent: number
    avgOrderValue: number
    segment: 'VIP' | 'LOYAL' | 'REGULAR' | 'NEW' | 'INACTIVE'
    firstOrderAt?: string
    lastOrderAt?: string
    latestOrders: Array<{
      id: string
      orderNumber: string
      status: string
      totalAmount: number
      placedAt: string
    }>
  }
}

type MockCustomerState = {
  customers: MockCustomer[]
  listRequests: string[]
  profilePatches: Array<{ id: string; body: Record<string, unknown> }>
  statusPatches: Array<{ id: string; body: Record<string, unknown> }>
}

const CUSTOMER_VIEWPORTS = ['1440x900', '768x1024', '375x812', '390x844']
  .map((name) => VIEWPORTS.find((viewport) => viewport.name === name)!)

const BASE_CUSTOMERS: MockCustomer[] = [
  {
    id: 'e2e-customer-real',
    email: 'e2e_customer_real@example.invalid',
    displayName: 'E2E_CUSTOMER_REAL',
    fullName: 'E2E_CUSTOMER_REAL',
    firstName: 'E2E',
    lastName: 'REAL',
    phone: '+84901234567',
    status: 'ACTIVE',
    isSynthetic: false,
    emailVerifiedAt: '2026-07-01T02:00:00Z',
    phoneVerifiedAt: '2026-07-01T02:05:00Z',
    lastLoginAt: '2026-07-20T03:00:00Z',
    createdAt: '2026-07-01T01:00:00Z',
    updatedAt: '2026-07-20T03:00:00Z',
    addresses: [],
    orderSummary: {
      // The valid order contributes to every metric. The cancelled order below
      // remains visible in history but must not promote this customer to VIP.
      orderCount: 1,
      totalSpent: 1_000_000,
      avgOrderValue: 1_000_000,
      segment: 'NEW',
      firstOrderAt: '2026-07-10T02:00:00Z',
      // Lifecycle history still includes CANCELLED, so "last order" follows the
      // cancelled order even though monetary/customer-segment metrics exclude it.
      lastOrderAt: '2026-07-12T02:00:00Z',
      latestOrders: [
        {
          id: 'e2e-order-valid',
          orderNumber: 'E2E-ORDER-VALID',
          status: 'COMPLETED',
          totalAmount: 1_000_000,
          placedAt: '2026-07-10T02:00:00Z',
        },
        {
          id: 'e2e-order-cancelled',
          orderNumber: 'E2E-ORDER-CANCELLED',
          status: 'CANCELLED',
          totalAmount: 20_000_000,
          placedAt: '2026-07-12T02:00:00Z',
        },
      ],
    },
  },
  {
    id: 'e2e-customer-pending',
    email: 'e2e_customer_pending@example.invalid',
    displayName: 'E2E_CUSTOMER_PENDING',
    fullName: 'E2E_CUSTOMER_PENDING',
    phone: '0902222333',
    status: 'PENDING',
    isSynthetic: false,
    createdAt: '2026-07-15T01:00:00Z',
    updatedAt: '2026-07-15T01:00:00Z',
    addresses: [],
    orderSummary: {
      orderCount: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      segment: 'INACTIVE',
      latestOrders: [],
    },
  },
  {
    id: 'e2e-customer-synthetic',
    email: 'e2e_customer_synthetic@example.invalid',
    displayName: 'E2E_CUSTOMER_SYNTHETIC',
    fullName: 'E2E_CUSTOMER_SYNTHETIC',
    phone: '0903333444',
    status: 'ACTIVE',
    isSynthetic: true,
    createdAt: '2026-06-15T01:00:00Z',
    updatedAt: '2026-06-15T01:00:00Z',
    addresses: [],
    orderSummary: {
      orderCount: 1,
      totalSpent: 500_000,
      avgOrderValue: 500_000,
      segment: 'NEW',
      latestOrders: [],
    },
  },
]

function createMockState(): MockCustomerState {
  return {
    customers: structuredClone(BASE_CUSTOMERS),
    listRequests: [],
    profilePatches: [],
    statusPatches: [],
  }
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

function filteredCustomers(url: URL, state: MockCustomerState) {
  const status = url.searchParams.get('status')
  const synthetic = url.searchParams.get('synthetic')
  const emailVerified = url.searchParams.get('emailVerified')
  const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('vi')

  return state.customers.filter((customer) => {
    if (status && customer.status !== status) return false
    if (synthetic && String(customer.isSynthetic) !== synthetic) return false
    if (emailVerified && String(Boolean(customer.emailVerifiedAt)) !== emailVerified) return false
    if (query) {
      const haystack = [customer.displayName, customer.email, customer.phone]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi')
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

/**
 * All Customer mutations are fulfilled in the browser. No PATCH/DELETE request
 * from this spec can reach the shared backend or leave E2E residue.
 */
async function installCustomerApi(page: Page, state: MockCustomerState) {
  await page.route('**/api/v1/admin/customers**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const root = '/api/v1/admin/customers'
    if (!url.pathname.startsWith(root)) {
      await route.continue()
      return
    }

    const suffix = url.pathname.slice(root.length)

    if (request.method() === 'GET' && suffix === '/summary') {
      await fulfillJson(route, {
        data: { total: state.customers.length, vip: 0, newLast30Days: 1, active: 1 },
      })
      return
    }

    if (request.method() === 'GET' && suffix === '') {
      state.listRequests.push(url.search)
      const items = filteredCustomers(url, state)
      const pageNumber = Number(url.searchParams.get('page') || 1)
      const pageSize = Number(url.searchParams.get('size') || 20)
      await fulfillJson(route, {
        data: {
          items,
          page: pageNumber,
          pageSize,
          totalItems: items.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      })
      return
    }

    const match = suffix.match(/^\/([^/]+)(?:\/(status|avatar))?$/)
    const customerId = match ? decodeURIComponent(match[1]) : ''
    const action = match?.[2]
    const customer = state.customers.find((item) => item.id === customerId)

    if (!customer) {
      await fulfillJson(route, { message: 'E2E customer not found' }, 404)
      return
    }

    if (request.method() === 'GET' && !action) {
      await fulfillJson(route, { data: customer })
      return
    }

    if (request.method() === 'PATCH' && action === 'status') {
      const body = request.postDataJSON() as Record<string, unknown>
      state.statusPatches.push({ id: customerId, body })
      if (customer.isSynthetic) {
        await fulfillJson(route, { message: 'Synthetic customer status is read-only' }, 409)
        return
      }
      customer.status = body.status as MockCustomer['status']
      customer.updatedAt = '2026-07-28T04:00:00Z'
      await fulfillJson(route, { data: customer })
      return
    }

    if (request.method() === 'PATCH' && !action) {
      const body = request.postDataJSON() as Record<string, unknown>
      state.profilePatches.push({ id: customerId, body })
      if (typeof body.displayName === 'string') {
        customer.displayName = body.displayName
        customer.fullName = body.displayName
      }
      if (typeof body.phone === 'string') customer.phone = body.phone
      customer.updatedAt = '2026-07-28T04:00:00Z'
      await fulfillJson(route, { data: customer })
      return
    }

    await fulfillJson(route, { message: 'Unexpected E2E Customer request' }, 405)
  })
}

async function selectOption(page: Page, trigger: Locator, option: string) {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function selectFilter(page: Page, label: string, option: string) {
  const trigger = page.locator('.bb-filter-bar').getByRole('combobox', {
    name: label,
    exact: true,
  })
  await selectOption(page, trigger, option)
}

function summaryCard(page: Page, label: string) {
  return page.locator('.bb-kpi').filter({
    has: page.getByText(label, { exact: true }),
  })
}

test.describe('Customer admin audit', () => {
  test('list loads from privacy-safe E2E fixtures without exposing shop customer data', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installCustomerApi(adminPage, state)
    const desktop = VIEWPORTS.find((viewport) => viewport.name === '1440x900')!
    await adminPage.setViewportSize(desktop)
    await navigateSpa(adminPage, '/admin/customers')

    await expect(adminPage.getByRole('heading', { name: 'Khách hàng', exact: true })).toBeVisible()
    await expect(adminPage.locator('.bb-filter-bar').getByRole('combobox', { name: 'Trạng thái', exact: true })).toBeVisible()
    await expect(adminPage.locator('.bb-filter-bar').getByRole('combobox', { name: 'Nguồn khách hàng', exact: true })).toBeVisible()
    await expect(adminPage.locator('.bb-filter-bar').getByRole('combobox', { name: 'Xác thực email', exact: true })).toBeVisible()
    await expect(summaryCard(adminPage, 'Tổng khách hàng').locator('.bb-kpi-value')).toHaveText('3')
    await expect(summaryCard(adminPage, 'Khách VIP').locator('.bb-kpi-value')).toHaveText('0')
    await expect(summaryCard(adminPage, 'Tài khoản mới (30 ngày)').locator('.bb-kpi-value')).toHaveText('1')
    await expect(summaryCard(adminPage, 'Tài khoản đang hoạt động').locator('.bb-kpi-value')).toHaveText('1')

    const activeRegisteredCard = adminPage.getByRole('button', {
      name: 'Tài khoản đang hoạt động — lọc danh sách theo trạng thái Hoạt động',
      exact: true,
    })
    await activeRegisteredCard.click()
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('status')).toBe('ACTIVE')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('synthetic')).toBe('false')
    await expect(adminPage.locator('tbody tr')).toHaveCount(1)
    await expect(adminPage.getByText('E2E_CUSTOMER_REAL', { exact: true }).first()).toBeVisible()
    await expect(adminPage.getByText('E2E_CUSTOMER_SYNTHETIC', { exact: true })).toHaveCount(0)

    await activeRegisteredCard.click()
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('status')).toBeNull()
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('synthetic')).toBeNull()
    await expect(adminPage.locator('tbody tr')).toHaveCount(3)

    const tableOrEmpty = adminPage.locator('table').or(
      adminPage.getByText('Không có khách hàng', { exact: true }),
    )
    await expect(tableOrEmpty.first()).toBeVisible()
    await expectNoHorizontalOverflow(adminPage, 'customer fixture list @ 1440x900')
    expectRuntimeClean(collect)
  })

  test('status, synthetic and email-verification filters work; every non-ACTIVE change asks for confirmation', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installCustomerApi(adminPage, state)
    await adminPage.setViewportSize(VIEWPORTS.find((viewport) => viewport.name === '1440x900')!)
    await navigateSpa(adminPage, '/admin/customers')

    await expect(adminPage.locator('tbody tr')).toHaveCount(3)

    await selectFilter(adminPage, 'Trạng thái', 'Chờ duyệt')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('status')).toBe('PENDING')
    await expect(adminPage.locator('tbody tr')).toHaveCount(1)
    await expect(adminPage.getByText('E2E_CUSTOMER_PENDING', { exact: true }).first()).toBeVisible()

    await selectFilter(adminPage, 'Trạng thái', 'Trạng thái')
    await selectFilter(adminPage, 'Nguồn khách hàng', 'Từ đơn hàng cũ')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('synthetic')).toBe('true')
    await expect(adminPage.locator('tbody tr')).toHaveCount(1)
    await expect(adminPage.getByText('E2E_CUSTOMER_SYNTHETIC', { exact: true }).first()).toBeVisible()

    await selectFilter(adminPage, 'Nguồn khách hàng', 'Nguồn khách hàng')
    await selectFilter(adminPage, 'Xác thực email', 'Chưa xác thực')
    await expect.poll(() => new URL(adminPage.url()).searchParams.get('emailVerified')).toBe('false')
    await expect(adminPage.locator('tbody tr')).toHaveCount(2)
    await expect(adminPage.getByText('E2E_CUSTOMER_REAL', { exact: true })).toHaveCount(0)

    await selectFilter(adminPage, 'Xác thực email', 'Xác thực email')
    await expect(adminPage.locator('tbody tr')).toHaveCount(3)

    const realRow = adminPage.locator('tbody tr').filter({ hasText: 'E2E_CUSTOMER_REAL' })
    const rowStatus = realRow.getByRole('combobox', { name: 'Trạng thái', exact: true })

    for (const target of ['Chờ duyệt', 'Tạm khoá', 'Bị cấm']) {
      await selectOption(adminPage, rowStatus, target)
      const dialog = adminPage.getByRole('dialog', { name: 'Đổi trạng thái tài khoản' })
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('thu hồi ngay tất cả phiên đăng nhập')
      await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
      await expect(dialog).toBeHidden()
    }
    expect(state.statusPatches).toHaveLength(0)

    await selectOption(adminPage, rowStatus, 'Bị cấm')
    const dialog = adminPage.getByRole('dialog', { name: 'Đổi trạng thái tài khoản' })
    await dialog.getByLabel('Lý do (không bắt buộc)').fill('E2E_CUSTOMER_STATUS_AUDIT')
    await dialog.getByRole('button', { name: 'Đổi trạng thái', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect.poll(() => state.statusPatches.length).toBe(1)
    expect(state.statusPatches[0]).toEqual({
      id: 'e2e-customer-real',
      body: { status: 'BLOCKED', reason: 'E2E_CUSTOMER_STATUS_AUDIT' },
    })
    await expect(realRow.getByRole('combobox', { name: 'Trạng thái', exact: true })).toContainText('Bị cấm')

    await navigateSpa(adminPage, '/admin/customers/e2e-customer-real')
    await expect(adminPage.getByText('Bị cấm', { exact: true }).first()).toBeVisible()
    expectRuntimeClean(collect)
  })

  test('synthetic profile persists display name and phone only while status stays read-only', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installCustomerApi(adminPage, state)
    await navigateSpa(adminPage, '/admin/customers/e2e-customer-synthetic')

    await expect(adminPage.getByText('Tài khoản tạo từ đơn hàng cũ không được đổi trạng thái.', { exact: true })).toBeVisible()
    await expect(adminPage.getByRole('combobox', { name: 'Trạng thái tài khoản', exact: true })).toHaveCount(0)
    await adminPage.getByRole('button', { name: 'Sửa', exact: true }).click()

    const displayName = adminPage.getByLabel('Tên hiển thị (tùy chọn)', { exact: true })
    const phone = adminPage.getByLabel('Số điện thoại', { exact: true })
    await expect(displayName).toBeVisible()
    await expect(phone).toBeVisible()
    await expect(adminPage.getByRole('textbox', { name: 'Email', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('textbox', { name: 'Tên', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('textbox', { name: 'Họ', exact: true })).toHaveCount(0)

    await displayName.fill('E2E_CUSTOMER_SYNTHETIC_UPDATED')
    await phone.fill('0909999888')
    await adminPage.getByRole('button', { name: 'Lưu', exact: true }).click()

    await expect.poll(() => state.profilePatches.length).toBe(1)
    expect(state.profilePatches[0]).toEqual({
      id: 'e2e-customer-synthetic',
      body: {
        displayName: 'E2E_CUSTOMER_SYNTHETIC_UPDATED',
        phone: '0909999888',
      },
    })
    expect(state.statusPatches).toHaveLength(0)

    await navigateSpa(adminPage, '/admin/customers')
    await expect(adminPage.getByText('E2E_CUSTOMER_SYNTHETIC_UPDATED', { exact: true }).first()).toBeVisible()
    await navigateSpa(adminPage, '/admin/customers/e2e-customer-synthetic')
    await expect(adminPage.getByRole('heading', { name: 'E2E_CUSTOMER_SYNTHETIC_UPDATED', exact: true })).toBeVisible()
    await expect(adminPage.getByText('0909999888', { exact: true }).first()).toBeVisible()
    await expect(adminPage.getByText('Tài khoản tạo từ đơn hàng cũ không được đổi trạng thái.', { exact: true })).toBeVisible()
    expectRuntimeClean(collect)
  })

  test('detail uses valid-order metrics while cancelled orders remain in history', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installCustomerApi(adminPage, state)
    await navigateSpa(adminPage, '/admin/customers/e2e-customer-real')

    const orderCount = adminPage.locator('.bb-kpi').filter({
      has: adminPage.getByText(/^(Số đơn hàng|Tổng đơn hàng)$/, { exact: true }),
    })
    const totalSpent = adminPage.locator('.bb-kpi').filter({
      has: adminPage.getByText('Tổng chi tiêu', { exact: true }),
    })
    const segment = adminPage.locator('.bb-kpi').filter({
      has: adminPage.getByText('Phân khúc', { exact: true }),
    })
    await expect(orderCount).toContainText('1')
    await expect(totalSpent).toContainText(/1[.\s]000[.\s]000/)
    await expect(segment).toContainText('Mới')
    await expect(segment).not.toContainText('VIP')

    await expect(adminPage.getByText('#E2E-ORDER-VALID', { exact: true })).toBeVisible()
    await expect(adminPage.getByText('#E2E-ORDER-CANCELLED', { exact: true })).toBeVisible()
    await expect(adminPage.getByText('Đã huỷ', { exact: true })).toBeVisible()
    expectRuntimeClean(collect)
  })

  test('customers.read without customers.write exposes a clear read-only list and detail', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installCustomerApi(adminPage, state)
    await adminPage.route('**/api/v1/auth/me', async (route) => {
      await fulfillJson(route, {
        data: {
          id: 'e2e-read-only-admin',
          fullName: 'E2E_READ_ONLY_ADMIN',
          email: 'e2e_read_only_admin@example.invalid',
          roles: ['SHOP_MANAGER'],
          permissions: ['customers.read'],
        },
      })
    })

    await adminPage.goto('/admin/customers', { waitUntil: 'domcontentloaded' })
    await waitForScreenReady(adminPage)
    const listReadOnlyBanner = adminPage.getByRole('status').filter({
      hasText: 'Bạn chỉ có quyền xem danh sách khách hàng.',
    })
    await expect(listReadOnlyBanner).toContainText(
      'Bạn chỉ có quyền xem danh sách khách hàng. Các thao tác thay đổi trạng thái đã được khóa.',
    )
    await expect(adminPage.locator('tbody').getByRole('combobox', { name: 'Trạng thái', exact: true })).toHaveCount(0)

    await navigateSpa(adminPage, '/admin/customers/e2e-customer-real')
    const detailReadOnlyBanner = adminPage.getByRole('status').filter({
      hasText: 'Bạn chỉ có quyền xem hồ sơ khách hàng.',
    })
    await expect(detailReadOnlyBanner).toContainText(
      'Bạn chỉ có quyền xem hồ sơ khách hàng. Liên hệ quản trị để được cấp quyền chỉnh sửa.',
    )
    await expect(adminPage.getByRole('button', { name: 'Sửa', exact: true })).toBeDisabled()
    await expect(adminPage.getByRole('button', { name: 'Sửa', exact: true })).toHaveAttribute('aria-disabled', 'true')
    await expect(adminPage.getByRole('combobox', { name: 'Trạng thái tài khoản', exact: true })).toHaveCount(0)
    expect(state.profilePatches).toHaveLength(0)
    expect(state.statusPatches).toHaveLength(0)
    expectRuntimeClean(collect)
  })

  test('list and detail do not overflow at 1440, 768, 375 or the board regression width 390', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installCustomerApi(adminPage, state)
    const screenshotWidths = new Set([1440, 768, 390, 375])
    const screenshotDir = 'e2e/.artifacts/customer-audit'
    await mkdir(screenshotDir, { recursive: true })

    for (const viewport of CUSTOMER_VIEWPORTS) {
      await adminPage.setViewportSize(viewport)
      await navigateSpa(adminPage, '/admin/customers')
      await expect(adminPage.getByRole('heading', { name: 'Khách hàng', exact: true })).toBeVisible()

      if (viewport.width < 640) {
        await expect(adminPage.locator('.mobile-card-list')).toBeVisible()
      } else {
        await expect(adminPage.locator('table')).toBeVisible()
      }
      await expectNoHorizontalOverflow(adminPage, `customer list @ ${viewport.name}`)
      if (screenshotWidths.has(viewport.width)) {
        await adminPage.screenshot({
          path: `${screenshotDir}/customer-list-${viewport.width}.png`,
          fullPage: true,
        })
      }

      await navigateSpa(adminPage, '/admin/customers/e2e-customer-real')
      await expect(adminPage.getByText('Thông tin tài khoản', { exact: true })).toBeVisible()
      await expectNoHorizontalOverflow(adminPage, `customer detail @ ${viewport.name}`)
      if (screenshotWidths.has(viewport.width)) {
        await adminPage.screenshot({
          path: `${screenshotDir}/customer-detail-${viewport.width}.png`,
          fullPage: true,
        })
      }
    }

    expectRuntimeClean(collect)
  })
})
