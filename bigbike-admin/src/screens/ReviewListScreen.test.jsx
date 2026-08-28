import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReviewListScreen } from './ReviewListScreen'

const mocks = vi.hoisted(() => ({
  fetchReviews: vi.fn(),
  fetchReviewSummary: vi.fn(),
  updateReviewStatus: vi.fn(),
  deleteReview: vi.fn(),
  bulkDeleteReviews: vi.fn(),
  bulkUpdateReviewStatus: vi.fn(),
  showConfirm: vi.fn(),
  subscribeAdminWs: vi.fn(),
  unsubscribeAdminWs: vi.fn(),
  wsHandler: null,
}))
const {
  fetchReviews,
  fetchReviewSummary,
  updateReviewStatus,
  deleteReview,
  showConfirm,
  bulkDeleteReviews,
  bulkUpdateReviewStatus,
} = mocks

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchReviews: mocks.fetchReviews,
  fetchReviewSummary: mocks.fetchReviewSummary,
  updateReviewStatus: mocks.updateReviewStatus,
  deleteReview: mocks.deleteReview,
  bulkDeleteReviews: mocks.bulkDeleteReviews,
  bulkUpdateReviewStatus: mocks.bulkUpdateReviewStatus,
}))

vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/useRecentItems', () => ({ useRecentItems: () => [] }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('../lib/adminWebSocket', () => ({
  subscribeAdminWs: mocks.subscribeAdminWs,
}))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ columns, rows, loading, selectable, onSelectionChange, onRowClick }) => (
    <div data-testid="review-table">
      {loading ? <span>review-table-loading</span> : null}
      {rows.map((row) => (
        <div key={row.id}>
          <button type="button" onClick={() => onRowClick(row)}>{row.authorName}</button>
          {columns.find((column) => column.key === 'author')?.render(row)}
          {columns.find((column) => column.key === 'rating')?.render(row)}
          {columns.find((column) => column.key === 'actions')?.render(row)}
        </div>
      ))}
      {selectable ? <button type="button" onClick={() => onSelectionChange([rows[0]?.id])}>select review</button> : null}
    </div>
  ),
}))

vi.mock('../components/FilterSelect', () => ({
  FilterSelect: ({ value, onValueChange, ariaLabel, options }) => (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onValueChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

function renderScreen(canUpdate = false, isSuperAdmin = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ReviewListScreen navigate={vi.fn()} canUpdate={canUpdate} isSuperAdmin={isSuperAdmin} /></QueryClientProvider>)
}

const review = {
  id: 12,
  productId: 'prod-1',
  productName: 'Mũ BigBike',
  productNameEn: 'BigBike Helmet',
  authorName: 'Nguyễn Minh',
  authorEmail: 'minh@example.com',
  rating: 1,
  body: 'Không hài lòng',
  photos: [],
  status: 'PENDING',
  version: 3,
  createdAt: '2026-07-22T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/reviews')
  mocks.wsHandler = null
  fetchReviews.mockResolvedValue({ items: [review], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } })
  fetchReviewSummary.mockResolvedValue({
    approved: { averageRating: 4.2, totalReviews: 8, ratingBreakdown: { 1: 1, 1.5: 0, 2: 0, 2.5: 0, 3: 1, 3.5: 0, 4: 2, 4.5: 0, 5: 4 } },
    pending: { totalReviews: 3, oneStarReviews: 1 },
  })
  showConfirm.mockResolvedValue(false)
  mocks.subscribeAdminWs.mockImplementation((_destination, handler) => {
    mocks.wsHandler = handler
    return mocks.unsubscribeAdminWs
  })
})

describe('ReviewListScreen', () => {
  it('uses global summary values and shows the read-only state separately from filtered results', async () => {
    renderScreen(false)

    expect(await screen.findByText('reviews.publicScoreTitle')).toBeInTheDocument()
    expect(screen.getByText('reviews.readOnlyListHint')).toBeInTheDocument()
    expect(await screen.findByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('reviews.filteredResults')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'select review' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.deletePermanent' })).not.toBeInTheDocument()
    expect(screen.queryByText('minh@example.com')).not.toBeInTheDocument()
    expect(fetchReviewSummary).toHaveBeenCalledTimes(1)
  })

  it('shows a designed fallback instead of a fake zero score for malformed partial data', async () => {
    fetchReviews.mockResolvedValue({
      items: [{ ...review, id: '', rating: null }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })
    renderScreen(false)

    const table = await screen.findByTestId('review-table')
    expect(await within(table).findByText('—')).toBeInTheDocument()
    expect(within(table).queryByText('0/5')).not.toBeInTheDocument()
    expect(within(table).queryByRole('img')).not.toBeInTheDocument()
  })

  it('links the pending queue action to the matching status and star filters', async () => {
    const user = userEvent.setup()
    renderScreen(true)

    const pendingButton = await screen.findByRole('button', { name: /reviews\.pendingCount/ })
    await user.click(pendingButton)

    await waitFor(() => expect(fetchReviews).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PENDING', rating: '' })))
  })

  it('sends an exact half-star filter and resets to page one', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/admin/reviews?page=3')
    renderScreen(true)

    await user.selectOptions(await screen.findByRole('combobox', { name: 'reviews.filterRating' }), '4.5')

    await waitFor(() => expect(fetchReviews).toHaveBeenLastCalledWith(expect.objectContaining({ rating: '4.5', page: 1 })))
  })

  it('requires confirmation before bulk permanent deletion and respects cancel', async () => {
    const user = userEvent.setup()
    fetchReviews.mockResolvedValue({
      items: [{ ...review, status: 'TRASH' }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })
    renderScreen(true, true)

    await user.click(await screen.findByRole('button', { name: 'select review' }))
    const deleteButton = (await screen.findAllByRole('button', { name: 'reviews.deletePermanent' }))[0]
    await user.click(deleteButton)
    expect(showConfirm).toHaveBeenCalledWith(expect.stringContaining('reviews.deleteConfirmPermanent'), expect.any(String), expect.any(Object))
    expect(bulkDeleteReviews).not.toHaveBeenCalled()

    showConfirm.mockResolvedValue(true)
    await user.click(deleteButton)
    await waitFor(() => expect(bulkDeleteReviews).toHaveBeenCalledWith([{ id: 12, expectedVersion: 3 }]))
  })

  it('sends versioned bulk items and explains skipped conflicts', async () => {
    const user = userEvent.setup()
    showConfirm.mockResolvedValue(true)
    bulkUpdateReviewStatus.mockResolvedValue({
      affected: 0,
      skipped: [{ id: 12, reason: 'VERSION_CONFLICT' }],
    })
    renderScreen(true)

    await user.click(await screen.findByRole('button', { name: 'select review' }))
    const bulk = screen.getByRole('region', { name: 'common.bulkActions' })
    await user.click(within(bulk).getByRole('button', { name: 'reviews.spam' }))

    await waitFor(() => expect(bulkUpdateReviewStatus).toHaveBeenCalledWith(
      [{ id: 12, expectedVersion: 3 }],
      'SPAM',
    ))
    expect(await screen.findByText('reviews.bulkResultSummary')).toBeInTheDocument()
    expect(screen.getByText('reviews.bulkSkippedItem')).toBeInTheDocument()
  })

  it('does not render zero queue counts as real data when the summary request fails', async () => {
    fetchReviewSummary.mockRejectedValue(new Error('summary unavailable'))
    renderScreen(false)

    expect((await screen.findAllByText('reviews.summaryError')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /reviews\.pendingCount/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reviews\.lowRatingPending/ })).not.toBeInTheDocument()
  })

  it('distinguishes filtered empty state and can reset it', async () => {
    window.history.replaceState({}, '', '/admin/reviews?status=PENDING')
    fetchReviews.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } })
    renderScreen(false)

    expect(await screen.findByText('reviews.empty')).toBeInTheDocument()
    expect(screen.getByText('reviews.emptyDesc')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'common.resetFilters' }).length).toBeGreaterThan(0)
  })

  it('shows a retryable list error instead of an empty state', async () => {
    fetchReviews.mockRejectedValueOnce(new Error('list unavailable'))
    renderScreen(false)

    expect(await screen.findByText('reviews.error')).toBeInTheDocument()
    expect(screen.getByText('list unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument()
    expect(screen.queryByText('reviews.emptyAll')).not.toBeInTheDocument()
  })

  it('không còn nút "Làm mới" thủ công — websocket là nguồn cập nhật chính', async () => {
    renderScreen(false)

    await screen.findByText('reviews.publicScoreTitle')
    expect(screen.queryByRole('button', { name: 'reviews.refresh' })).not.toBeInTheDocument()
  })

  it('làm mới danh sách và số liệu khi có thông báo đánh giá thời gian thực', async () => {
    renderScreen(false)
    await screen.findByText('reviews.publicScoreTitle')

    expect(mocks.subscribeAdminWs).toHaveBeenCalledWith(
      '/topic/admin/reviews',
      expect.any(Function),
    )
    const reviewsCallsBefore = fetchReviews.mock.calls.length
    const summaryCallsBefore = fetchReviewSummary.mock.calls.length

    await act(async () => {
      mocks.wsHandler()
    })

    await waitFor(() => {
      expect(fetchReviews.mock.calls.length).toBeGreaterThan(reviewsCallsBefore)
      expect(fetchReviewSummary.mock.calls.length).toBeGreaterThan(summaryCallsBefore)
    })
  })

  it('clamps an empty out-of-range page back to page one', async () => {
    window.history.replaceState({}, '', '/admin/reviews?page=3')
    fetchReviews.mockResolvedValue({ items: [], pagination: { page: 3, pageSize: 20, totalItems: 0, totalPages: 0 } })
    renderScreen(false)

    await waitFor(() => expect(fetchReviews).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
  })

  it('sends the rendered version and reloads before unlocking a stale review', async () => {
    const user = userEvent.setup()
    const staleError = Object.assign(new Error('stale review'), { status: 409 })
    updateReviewStatus.mockRejectedValue(staleError)
    fetchReviews
      .mockResolvedValueOnce({ items: [review], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } })
      .mockResolvedValue({ items: [{ ...review, version: 4 }], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } })
    showConfirm.mockResolvedValue(true)
    renderScreen(true)

    await user.click(await screen.findByRole('button', { name: 'reviews.approve' }))

    await waitFor(() => expect(updateReviewStatus).toHaveBeenCalledWith(12, 'APPROVED', 3))
    expect(await screen.findByText('reviews.staleConflict')).toBeInTheDocument()
    await waitFor(() => expect(fetchReviews.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'reviews.approve' })).toBeEnabled())
  })

  it('sends the rendered version with a confirmed permanent delete', async () => {
    const user = userEvent.setup()
    showConfirm.mockResolvedValue(true)
    fetchReviews.mockResolvedValue({
      items: [{ ...review, status: 'TRASH' }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })
    renderScreen(true, true)

    await user.click(await screen.findByRole('button', { name: 'common.actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'reviews.deletePermanent' }))

    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith(12, 3))
  })

  it('shows only owner-approved transitions and gates hard delete to a super admin in Trash', async () => {
    const user = userEvent.setup()
    const { unmount } = renderScreen(true, false)

    expect(await screen.findByRole('button', { name: 'reviews.approve' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.actions' }))
    expect(await screen.findByRole('menuitem', { name: 'reviews.spam' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'reviews.moveToTrash' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'reviews.returnPending' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'reviews.deletePermanent' })).not.toBeInTheDocument()
    unmount()

    fetchReviews.mockResolvedValue({
      items: [{ ...review, status: 'TRASH' }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })
    renderScreen(true, true)

    await user.click(await screen.findByRole('button', { name: 'common.actions' }))
    expect(await screen.findByRole('menuitem', { name: 'reviews.restore' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'reviews.deletePermanent' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'reviews.spam' })).not.toBeInTheDocument()
  })

  it('requires confirmation before approving a pending review', async () => {
    const user = userEvent.setup()
    renderScreen(true)

    await user.click(await screen.findByRole('button', { name: 'reviews.approve' }))

    expect(showConfirm).toHaveBeenCalledWith(
      'reviews.approveConfirmMany',
      'reviews.approveConfirmTitle',
      expect.objectContaining({ confirmLabel: 'reviews.approve' }),
    )
    expect(updateReviewStatus).not.toHaveBeenCalled()
  })
})
