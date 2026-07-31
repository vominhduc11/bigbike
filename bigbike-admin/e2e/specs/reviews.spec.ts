import { mkdir } from 'node:fs/promises'
import type { Locator, Page, Route } from '@playwright/test'
import { test, expect, expectRuntimeClean } from '../fixtures/admin-test'
import {
  expectNoHorizontalOverflow,
  navigateSpa,
  waitForScreenReady,
} from '../utils/quality'
import { VIEWPORTS } from '../utils/viewports'

type ReviewStatus = 'APPROVED' | 'PENDING' | 'SPAM' | 'TRASH'

type MockReview = {
  id: number
  productId: string
  productName: string
  productNameEn: string
  productSlug: string
  authorName: string
  authorEmail: string
  rating: number
  body: string
  photos: string[]
  status: ReviewStatus
  version: number
  createdAt: string
  updatedAt: string
}

type MockReviewState = {
  reviews: MockReview[]
  listRequests: string[]
  statusPatches: Array<{ id: number; status: ReviewStatus; expectedVersion: number }>
  deletes: Array<{ id: number; expectedVersion: number }>
  bulkStatuses: Array<{
    items: Array<{ id: number; expectedVersion: number }>
    status: ReviewStatus
  }>
  bulkDeletes: Array<{ items: Array<{ id: number; expectedVersion: number }> }>
  listError: boolean
  summaryError: boolean
  conflictNextStatus: boolean
}

const REVIEW_VIEWPORTS = ['1440x900', '768x1024', '430x932', '390x844', '375x812']
  .map((name) => VIEWPORTS.find((viewport) => viewport.name === name)!)

const BASE_REVIEWS: MockReview[] = [
  {
    id: 91001,
    productId: 'e2e-review-product-half',
    productName: 'E2E_REVIEW_PRODUCT_HALF',
    productNameEn: 'E2E_REVIEW_PRODUCT_HALF_EN',
    productSlug: 'e2e-review-product-half',
    authorName: 'E2E_REVIEW_HALF_STAR',
    authorEmail: 'e2e_review_half_star@example.invalid',
    rating: 4.5,
    body: 'E2E_REVIEW_CONTENT_HALF_STAR',
    photos: [],
    status: 'PENDING',
    version: 3,
    createdAt: '2026-07-28T01:00:00Z',
    updatedAt: '2026-07-28T01:00:00Z',
  },
  {
    id: 91002,
    productId: 'e2e-review-product-approved',
    productName: 'E2E_REVIEW_PRODUCT_APPROVED',
    productNameEn: 'E2E_REVIEW_PRODUCT_APPROVED_EN',
    productSlug: 'e2e-review-product-approved',
    authorName: 'E2E_REVIEW_APPROVED',
    authorEmail: 'e2e_review_approved@example.invalid',
    rating: 5,
    body: 'E2E_REVIEW_CONTENT_APPROVED',
    photos: [],
    status: 'APPROVED',
    version: 7,
    createdAt: '2026-07-27T01:00:00Z',
    updatedAt: '2026-07-27T01:00:00Z',
  },
  {
    id: 91003,
    productId: 'e2e-review-product-low',
    productName: 'E2E_REVIEW_PRODUCT_LOW',
    productNameEn: 'E2E_REVIEW_PRODUCT_LOW_EN',
    productSlug: 'e2e-review-product-low',
    authorName: 'E2E_REVIEW_LOW',
    authorEmail: 'e2e_review_low@example.invalid',
    rating: 1,
    body: 'E2E_REVIEW_CONTENT_LOW',
    photos: [],
    status: 'PENDING',
    version: 2,
    createdAt: '2026-07-26T01:00:00Z',
    updatedAt: '2026-07-26T01:00:00Z',
  },
  {
    id: 91004,
    productId: 'e2e-review-product-trash-candidate',
    productName: 'E2E_REVIEW_PRODUCT_TRASH_CANDIDATE',
    productNameEn: 'E2E_REVIEW_PRODUCT_TRASH_CANDIDATE_EN',
    productSlug: 'e2e-review-product-trash-candidate',
    authorName: 'E2E_REVIEW_TRASH_CANDIDATE',
    authorEmail: 'e2e_review_trash_candidate@example.invalid',
    rating: 2.5,
    body: 'E2E_REVIEW_CONTENT_TRASH_CANDIDATE',
    photos: [],
    status: 'PENDING',
    version: 5,
    createdAt: '2026-07-25T01:00:00Z',
    updatedAt: '2026-07-25T01:00:00Z',
  },
  {
    id: 91005,
    productId: 'e2e-review-product-trash',
    productName: 'E2E_REVIEW_PRODUCT_TRASH',
    productNameEn: 'E2E_REVIEW_PRODUCT_TRASH_EN',
    productSlug: 'e2e-review-product-trash',
    authorName: 'E2E_REVIEW_TRASH',
    authorEmail: 'e2e_review_trash@example.invalid',
    rating: 3,
    body: 'E2E_REVIEW_CONTENT_TRASH',
    photos: [],
    status: 'TRASH',
    version: 9,
    createdAt: '2026-07-24T01:00:00Z',
    updatedAt: '2026-07-24T01:00:00Z',
  },
]

function createMockState(): MockReviewState {
  return {
    reviews: structuredClone(BASE_REVIEWS),
    listRequests: [],
    statusPatches: [],
    deletes: [],
    bulkStatuses: [],
    bulkDeletes: [],
    listError: false,
    summaryError: false,
    conflictNextStatus: false,
  }
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

function filteredReviews(url: URL, state: MockReviewState) {
  const status = url.searchParams.get('status')
  const rating = url.searchParams.get('rating')
  const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('vi')
  return state.reviews.filter((review) => {
    if (status && review.status !== status) return false
    if (rating && review.rating !== Number(rating)) return false
    if (query) {
      const haystack = `${review.authorName} ${review.body}`.toLocaleLowerCase('vi')
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

function listReview(review: MockReview): Omit<MockReview, 'authorEmail'> {
  const { authorEmail: _detailOnlyEmail, ...item } = review
  return item
}

function canTransition(current: ReviewStatus, target: ReviewStatus) {
  if (current === target) return true
  if (current === 'PENDING') return ['APPROVED', 'SPAM', 'TRASH'].includes(target)
  return target === 'PENDING'
}

function processBulkStatus(
  state: MockReviewState,
  items: Array<{ id: number; expectedVersion: number }>,
  status: ReviewStatus,
) {
  let affected = 0
  const skipped: Array<{ id: number; reason: string }> = []
  const seen = new Set<number>()
  for (const item of items) {
    if (seen.has(item.id)) {
      skipped.push({ id: item.id, reason: 'DUPLICATE_ID' })
      continue
    }
    seen.add(item.id)
    const review = state.reviews.find((candidate) => candidate.id === item.id)
    if (!review) {
      skipped.push({ id: item.id, reason: 'NOT_FOUND' })
    } else if (review.version !== item.expectedVersion) {
      skipped.push({ id: item.id, reason: 'VERSION_CONFLICT' })
    } else if (review.status === status) {
      skipped.push({ id: item.id, reason: 'NO_CHANGE' })
    } else if (!canTransition(review.status, status)) {
      skipped.push({ id: item.id, reason: 'INVALID_TRANSITION' })
    } else {
      review.status = status
      review.version += 1
      review.updatedAt = '2026-07-28T03:00:00Z'
      affected += 1
    }
  }
  return { affected, skipped }
}

function processBulkDelete(
  state: MockReviewState,
  items: Array<{ id: number; expectedVersion: number }>,
) {
  let affected = 0
  const skipped: Array<{ id: number; reason: string }> = []
  const seen = new Set<number>()
  for (const item of items) {
    if (seen.has(item.id)) {
      skipped.push({ id: item.id, reason: 'DUPLICATE_ID' })
      continue
    }
    seen.add(item.id)
    const review = state.reviews.find((candidate) => candidate.id === item.id)
    if (!review) {
      skipped.push({ id: item.id, reason: 'NOT_FOUND' })
    } else if (review.version !== item.expectedVersion) {
      skipped.push({ id: item.id, reason: 'VERSION_CONFLICT' })
    } else if (review.status !== 'TRASH') {
      skipped.push({ id: item.id, reason: 'NOT_IN_TRASH' })
    } else {
      state.reviews = state.reviews.filter((candidate) => candidate.id !== item.id)
      affected += 1
    }
  }
  return { affected, skipped }
}

/**
 * Every Review request, including mutations, is fulfilled in the browser with
 * `.invalid` fixture identities. The shared backend and shop data are never
 * read or changed by this spec.
 */
async function installReviewApi(page: Page, state: MockReviewState) {
  await page.route('**/api/v1/admin/reviews**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const root = '/api/v1/admin/reviews'
    if (!url.pathname.startsWith(root)) {
      await route.continue()
      return
    }

    const suffix = url.pathname.slice(root.length)

    if (request.method() === 'GET' && suffix === '/summary') {
      if (state.summaryError) {
        await fulfillJson(route, { error: { message: 'E2E review summary unavailable' } }, 503)
        return
      }
      await fulfillJson(route, {
        data: {
          approved: {
            averageRating: 5,
            totalReviews: 1,
            ratingBreakdown: {
              1: 0,
              1.5: 0,
              2: 0,
              2.5: 0,
              3: 0,
              3.5: 0,
              4: 0,
              4.5: 0,
              5: 1,
            },
          },
          pending: { totalReviews: 3, oneStarReviews: 1 },
        },
      })
      return
    }

    if (request.method() === 'GET' && suffix === '') {
      state.listRequests.push(url.search)
      if (state.listError) {
        await fulfillJson(route, { error: { message: 'E2E review list unavailable' } }, 503)
        return
      }
      const filtered = filteredReviews(url, state)
      const pageNumber = Number(url.searchParams.get('page') || 1)
      const pageSize = Number(url.searchParams.get('size') || 20)
      const totalPages = filtered.length ? Math.ceil(filtered.length / pageSize) : 0
      const start = (pageNumber - 1) * pageSize
      const items = filtered.slice(start, start + pageSize).map(listReview)
      await fulfillJson(route, {
        data: {
          items,
          page: pageNumber,
          pageSize,
          totalItems: filtered.length,
          totalPages,
          hasNext: pageNumber < totalPages,
          hasPrevious: pageNumber > 1,
        },
      })
      return
    }

    if (request.method() === 'POST' && suffix === '/bulk-status') {
      const body = request.postDataJSON() as {
        items: Array<{ id: number; expectedVersion: number }>
        status: ReviewStatus
      }
      state.bulkStatuses.push({
        items: body.items.map((item) => ({ ...item })),
        status: body.status,
      })
      await fulfillJson(route, { data: processBulkStatus(state, body.items, body.status) })
      return
    }

    if (request.method() === 'POST' && suffix === '/bulk-delete') {
      const body = request.postDataJSON() as {
        items: Array<{ id: number; expectedVersion: number }>
      }
      state.bulkDeletes.push({ items: body.items.map((item) => ({ ...item })) })
      await fulfillJson(route, { data: processBulkDelete(state, body.items) })
      return
    }

    const match = suffix.match(/^\/(\d+)(?:\/status)?$/)
    const reviewId = match ? Number(match[1]) : 0
    const review = state.reviews.find((item) => item.id === reviewId)
    if (!review) {
      await fulfillJson(route, { error: { message: 'E2E review not found' } }, 404)
      return
    }

    if (request.method() === 'GET' && suffix === `/${reviewId}`) {
      await fulfillJson(route, { data: review })
      return
    }

    if (request.method() === 'PATCH' && suffix === `/${reviewId}/status`) {
      const body = request.postDataJSON() as { status: ReviewStatus; expectedVersion: number }
      state.statusPatches.push({ id: reviewId, status: body.status, expectedVersion: body.expectedVersion })
      if (state.conflictNextStatus) {
        state.conflictNextStatus = false
        review.version += 1
        review.updatedAt = '2026-07-28T02:00:00Z'
      }
      if (body.expectedVersion !== review.version) {
        await fulfillJson(route, { error: { message: 'E2E stale review conflict' } }, 409)
        return
      }
      if (body.status === review.status) {
        await fulfillJson(route, { data: review })
        return
      }
      if (!canTransition(review.status, body.status)) {
        await fulfillJson(route, { error: { message: 'E2E invalid review transition' } }, 409)
        return
      }
      review.status = body.status
      review.version += 1
      review.updatedAt = '2026-07-28T03:00:00Z'
      await fulfillJson(route, { data: listReview(review) })
      return
    }

    if (request.method() === 'DELETE' && suffix === `/${reviewId}`) {
      const expectedVersion = Number(url.searchParams.get('expectedVersion'))
      state.deletes.push({ id: reviewId, expectedVersion })
      if (expectedVersion !== review.version) {
        await fulfillJson(route, { error: { message: 'E2E stale review conflict' } }, 409)
        return
      }
      if (review.status !== 'TRASH') {
        await fulfillJson(route, { error: { message: 'E2E review is not in Trash' } }, 409)
        return
      }
      state.reviews = state.reviews.filter((item) => item.id !== reviewId)
      await route.fulfill({ status: 204 })
      return
    }

    await fulfillJson(route, { error: { message: 'Unexpected E2E Review request' } }, 405)
  })
}

async function openReviews(page: Page) {
  await navigateSpa(page, '/admin/reviews')
  await expect(page.getByRole('heading', { name: 'Đánh giá sản phẩm', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Điểm công khai', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cần xử lý', exact: true })).toBeVisible()
}

async function selectFilter(page: Page, label: string, option: string) {
  const trigger = page.getByRole('combobox', { name: label, exact: true })
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function cancelDialog(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
}

async function confirmDialog(page: Page, title: string, action: string) {
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: action, exact: true }).click()
}

function rowFor(page: Page, author: string) {
  return page.locator('tbody tr').filter({ has: page.getByText(author, { exact: true }) })
}

test.describe('Reviews admin audit', () => {
  test('uses privacy-safe fixtures and sends the exact 9-level half-star filter', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installReviewApi(adminPage, state)
    await openReviews(adminPage)

    await expect(rowFor(adminPage, 'E2E_REVIEW_HALF_STAR')).toBeVisible()
    await expect(adminPage.getByText('e2e_review_half_star@example.invalid', { exact: true })).toHaveCount(0)
    const ratingFilter = adminPage.getByRole('combobox', { name: 'Số sao', exact: true })
    await ratingFilter.click()
    await expect(adminPage.getByRole('option')).toHaveCount(10)
    await expect(adminPage.getByRole('option', { name: '4.5 sao', exact: true })).toBeVisible()
    await expect(adminPage.getByRole('option', { name: '1.5 sao', exact: true })).toBeVisible()
    await adminPage.getByRole('option', { name: '4.5 sao', exact: true }).click()

    await expect.poll(() => new URL(adminPage.url()).searchParams.get('rating')).toBe('4.5')
    await expect(rowFor(adminPage, 'E2E_REVIEW_HALF_STAR')).toBeVisible()
    await expect(rowFor(adminPage, 'E2E_REVIEW_APPROVED')).toHaveCount(0)
    expect(state.listRequests.some((query) => new URLSearchParams(query).get('rating') === '4.5')).toBe(true)

    await navigateSpa(adminPage, '/admin/reviews/91001')
    await expect(adminPage.getByText('e2e_review_half_star@example.invalid', { exact: false })).toBeVisible()
    expectRuntimeClean(collect)
  })

  test('reviews.read without reviews.write is read-only on list and detail', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installReviewApi(adminPage, state)
    await adminPage.route('**/api/v1/auth/me', async (route) => {
      await fulfillJson(route, {
        data: {
          id: 'e2e-review-read-only-admin',
          fullName: 'E2E_REVIEW_READ_ONLY_ADMIN',
          email: 'e2e_review_read_only_admin@example.invalid',
          roles: ['SHOP_MANAGER'],
          permissions: ['reviews.read'],
        },
      })
    })

    await adminPage.goto('/admin/reviews', { waitUntil: 'domcontentloaded' })
    await waitForScreenReady(adminPage)
    await expect(adminPage.getByRole('status').filter({ hasText: 'Bạn có quyền xem đánh giá' })).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('button', { name: 'Spam', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('checkbox')).toHaveCount(0)

    await navigateSpa(adminPage, '/admin/reviews/91001')
    await expect(adminPage.getByRole('heading', { name: 'Chi tiết đánh giá', exact: true })).toBeVisible()
    await expect(adminPage.getByRole('status').filter({ hasText: 'Bạn chỉ có quyền xem đánh giá' })).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('button', { name: 'Spam', exact: true })).toHaveCount(0)
    await expect(adminPage.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true })).toHaveCount(0)
    expect(state.statusPatches).toHaveLength(0)
    expect(state.deletes).toHaveLength(0)
    expectRuntimeClean(collect)
  })

  test('approve, spam, trash and permanent delete honor confirmation and rendered versions', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installReviewApi(adminPage, state)
    await openReviews(adminPage)

    const halfStarRow = rowFor(adminPage, 'E2E_REVIEW_HALF_STAR')
    await halfStarRow.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await cancelDialog(adminPage, 'Duyệt công khai')
    expect(state.statusPatches).toHaveLength(0)
    await halfStarRow.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await confirmDialog(adminPage, 'Duyệt công khai', 'Duyệt')
    await expect.poll(() => state.statusPatches.length).toBe(1)
    expect(state.statusPatches[0]).toEqual({ id: 91001, status: 'APPROVED', expectedVersion: 3 })

    const lowRow = rowFor(adminPage, 'E2E_REVIEW_LOW')
    await lowRow.getByRole('button', { name: 'Spam', exact: true }).click()
    await cancelDialog(adminPage, 'Đánh dấu spam')
    expect(state.statusPatches).toHaveLength(1)
    await lowRow.getByRole('button', { name: 'Spam', exact: true }).click()
    await confirmDialog(adminPage, 'Đánh dấu spam', 'Spam')
    await expect.poll(() => state.statusPatches.length).toBe(2)
    expect(state.statusPatches[1]).toEqual({ id: 91003, status: 'SPAM', expectedVersion: 2 })

    const trashCandidateRow = rowFor(adminPage, 'E2E_REVIEW_TRASH_CANDIDATE')
    await trashCandidateRow.getByRole('button', { name: 'Đưa vào thùng rác', exact: true }).click()
    await cancelDialog(adminPage, 'Đưa vào thùng rác')
    expect(state.statusPatches).toHaveLength(2)
    await trashCandidateRow.getByRole('button', { name: 'Đưa vào thùng rác', exact: true }).click()
    await confirmDialog(adminPage, 'Đưa vào thùng rác', 'Đưa vào thùng rác')
    await expect.poll(() => state.statusPatches.length).toBe(3)
    expect(state.statusPatches[2]).toEqual({ id: 91004, status: 'TRASH', expectedVersion: 5 })

    const trashRow = rowFor(adminPage, 'E2E_REVIEW_TRASH')
    await trashRow.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
    await cancelDialog(adminPage, 'Xoá đánh giá')
    expect(state.deletes).toHaveLength(0)
    await trashRow.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
    await confirmDialog(adminPage, 'Xoá đánh giá', 'Xóa vĩnh viễn')
    await expect.poll(() => state.deletes).toEqual([{ id: 91005, expectedVersion: 9 }])
    expectRuntimeClean(collect)
  })

  test('bulk moderation sends distinct versioned items and explains every skipped review', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installReviewApi(adminPage, state)
    await openReviews(adminPage)

    await adminPage.getByRole('checkbox', { name: 'Chọn tất cả', exact: true }).click()
    const bulk = adminPage.getByRole('region', { name: 'Hành động hàng loạt' })
    await bulk.getByRole('button', { name: 'Spam', exact: true }).click()
    await cancelDialog(adminPage, 'Đánh dấu spam')
    expect(state.bulkStatuses).toHaveLength(0)
    await bulk.getByRole('button', { name: 'Spam', exact: true }).click()
    await confirmDialog(adminPage, 'Đánh dấu spam', 'Spam')
    await expect.poll(() => state.bulkStatuses.length).toBe(1)

    const requestItems = state.bulkStatuses[0].items
    expect(requestItems).toHaveLength(5)
    expect(new Set(requestItems.map((item) => item.id)).size).toBe(5)
    expect(requestItems).toEqual([
      { id: 91001, expectedVersion: 3 },
      { id: 91002, expectedVersion: 7 },
      { id: 91003, expectedVersion: 2 },
      { id: 91004, expectedVersion: 5 },
      { id: 91005, expectedVersion: 9 },
    ])
    const main = adminPage.locator('#bb-main-content')
    await expect(main.getByText('Đã xử lý 3 đánh giá; bỏ qua 2.', { exact: true })).toBeVisible()
    await expect(main.getByText(/Đánh giá #91002: không thể chuyển/)).toBeVisible()
    await expect(main.getByText(/Đánh giá #91005: không thể chuyển/)).toBeVisible()

    await bulk.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true }).click()
    await confirmDialog(adminPage, 'Xoá đánh giá', 'Xóa vĩnh viễn')
    await expect.poll(() => state.bulkDeletes.length).toBe(1)
    expect(state.bulkDeletes[0].items).toEqual([
      { id: 91002, expectedVersion: 7 },
      { id: 91005, expectedVersion: 9 },
    ])
    await expect(main.getByText('Đã xử lý 1 đánh giá; bỏ qua 1.', { exact: true })).toBeVisible()
    await expect(main.getByText(/Đánh giá #91002: chưa nằm trong thùng rác/)).toBeVisible()
    expectRuntimeClean(collect)
  })

  test('wildcard permission without the exact SUPER_ADMIN role cannot hard-delete Trash', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installReviewApi(adminPage, state)
    await adminPage.route('**/api/v1/auth/me', async (route) => {
      await fulfillJson(route, {
        data: {
          id: 'e2e-review-regular-admin',
          fullName: 'E2E_REVIEW_REGULAR_ADMIN',
          email: 'e2e_review_regular_admin@example.invalid',
          roles: ['ADMIN'],
          permissions: ['*'],
        },
      })
    })

    await adminPage.goto('/admin/reviews', { waitUntil: 'domcontentloaded' })
    await waitForScreenReady(adminPage)
    const trashRow = rowFor(adminPage, 'E2E_REVIEW_TRASH')
    await expect(trashRow.getByRole('button', { name: 'Khôi phục', exact: true })).toBeVisible()
    await expect(trashRow.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true })).toHaveCount(0)

    await navigateSpa(adminPage, '/admin/reviews/91005')
    await expect(adminPage.getByRole('heading', { name: 'Chi tiết đánh giá', exact: true })).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Khôi phục', exact: true }).first()).toBeVisible()
    await expect(adminPage.getByRole('button', { name: 'Xóa vĩnh viễn', exact: true })).toHaveCount(0)
    await expect(adminPage.getByText('Chỉ Super Admin được xóa vĩnh viễn đánh giá trong thùng rác.').first()).toBeVisible()
    expectRuntimeClean(collect)
  })

  test('a stale status write reloads the latest version before the next action', async ({ adminPage, collect }) => {
    const state = createMockState()
    state.conflictNextStatus = true
    await installReviewApi(adminPage, state)
    await openReviews(adminPage)

    const halfStarRow = rowFor(adminPage, 'E2E_REVIEW_HALF_STAR')
    await halfStarRow.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await confirmDialog(adminPage, 'Duyệt công khai', 'Duyệt')

    await expect(adminPage.getByText(/Đánh giá đã được người khác cập nhật/)).toBeVisible()
    await expect.poll(() => state.statusPatches).toEqual([
      { id: 91001, status: 'APPROVED', expectedVersion: 3 },
    ])
    await expect(halfStarRow.getByRole('button', { name: 'Duyệt', exact: true })).toBeEnabled()

    await halfStarRow.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await confirmDialog(adminPage, 'Duyệt công khai', 'Duyệt')
    await expect.poll(() => state.statusPatches).toEqual([
      { id: 91001, status: 'APPROVED', expectedVersion: 3 },
      { id: 91001, status: 'APPROVED', expectedVersion: 4 },
    ])
    expectRuntimeClean(collect, { allowApi: true })
  })

  test('empty, summary error, list error and detail 404 stay distinct and retryable', async ({ adminPage, collect }) => {
    const state = createMockState()
    state.reviews = []
    await installReviewApi(adminPage, state)
    await openReviews(adminPage)
    await expect(adminPage.getByText('Chưa có đánh giá nào', { exact: true })).toBeVisible()

    state.summaryError = true
    await adminPage.reload({ waitUntil: 'domcontentloaded' })
    await waitForScreenReady(adminPage)
    await expect(adminPage.getByText('Không thể tải số liệu tổng quan.').last()).toBeVisible()
    await expect(adminPage.getByRole('button', { name: /đánh giá chờ duyệt/i })).toHaveCount(0)
    state.summaryError = false
    await adminPage.locator('[aria-labelledby="review-public-score"]').getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(adminPage.getByRole('button', { name: /đánh giá chờ duyệt/i })).toBeVisible()

    state.listError = true
    await adminPage.reload({ waitUntil: 'domcontentloaded' })
    await waitForScreenReady(adminPage)
    await expect(adminPage.getByText('E2E review list unavailable', { exact: true })).toBeVisible()
    state.listError = false
    await adminPage.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(adminPage.getByText('Chưa có đánh giá nào', { exact: true })).toBeVisible()

    await navigateSpa(adminPage, '/admin/reviews/999999')
    await expect(adminPage.getByText('Không tìm thấy đánh giá', { exact: true })).toBeVisible()
    expectRuntimeClean(collect, { allowApi: true })
  })

  test('list and detail do not overflow at the standard desktop, tablet and mobile viewports', async ({ adminPage, collect }) => {
    const state = createMockState()
    await installReviewApi(adminPage, state)
    const screenshotDir = 'e2e/.artifacts/review-audit'
    await mkdir(screenshotDir, { recursive: true })

    for (const viewport of REVIEW_VIEWPORTS) {
      await adminPage.setViewportSize(viewport)
      await navigateSpa(adminPage, '/admin/reviews')
      await expect(adminPage.getByRole('heading', { name: 'Đánh giá sản phẩm', exact: true })).toBeVisible()
      if (viewport.width < 640) {
        await expect(adminPage.locator('.mobile-card-list')).toBeVisible()
      } else {
        await expect(adminPage.locator('table')).toBeVisible()
      }
      await expectNoHorizontalOverflow(adminPage, `review list @ ${viewport.name}`)
      await adminPage.screenshot({
        path: `${screenshotDir}/review-list-${viewport.width}.png`,
        fullPage: true,
      })

      await navigateSpa(adminPage, '/admin/reviews/91001')
      await expect(adminPage.getByRole('heading', { name: 'Chi tiết đánh giá', exact: true })).toBeVisible()
      await expectNoHorizontalOverflow(adminPage, `review detail @ ${viewport.name}`)
      await adminPage.screenshot({
        path: `${screenshotDir}/review-detail-${viewport.width}.png`,
        fullPage: true,
      })
    }

    expectRuntimeClean(collect)
  })
})
