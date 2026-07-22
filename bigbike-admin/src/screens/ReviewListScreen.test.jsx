import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
}))
const { fetchReviews, fetchReviewSummary, showConfirm, bulkDeleteReviews } = mocks

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
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, selectable, onSelectionChange, onRowClick }) => (
    <div data-testid="review-table">
      {rows.map((row) => <button key={row.id} type="button" onClick={() => onRowClick(row)}>{row.authorName}</button>)}
      {selectable ? <button type="button" onClick={() => onSelectionChange([rows[0]?.id])}>select review</button> : null}
    </div>
  ),
}))

function renderScreen(canUpdate = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ReviewListScreen navigate={vi.fn()} canUpdate={canUpdate} /></QueryClientProvider>)
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
  createdAt: '2026-07-22T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchReviews.mockResolvedValue({ items: [review], pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } })
  fetchReviewSummary.mockResolvedValue({
    approved: { averageRating: 4.2, totalReviews: 8, ratingBreakdown: { 1: 1, 2: 0, 3: 1, 4: 2, 5: 4 } },
    pending: { totalReviews: 3, oneStarReviews: 1 },
  })
  showConfirm.mockResolvedValue(false)
})

describe('ReviewListScreen', () => {
  it('uses global summary values and shows the read-only state separately from filtered results', async () => {
    renderScreen(false)

    expect(await screen.findByText('reviews.publicScoreTitle')).toBeInTheDocument()
    expect(screen.getByText('reviews.readOnlyListHint')).toBeInTheDocument()
    expect(await screen.findByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('reviews.filteredResults')).toBeInTheDocument()
    expect(fetchReviewSummary).toHaveBeenCalledTimes(1)
  })

  it('links the pending queue action to the matching status and star filters', async () => {
    const user = userEvent.setup()
    renderScreen(true)

    const pendingButton = await screen.findByRole('button', { name: /reviews\.pendingCount/ })
    await user.click(pendingButton)

    await waitFor(() => expect(fetchReviews).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PENDING', rating: '' })))
  })

  it('requires confirmation before bulk permanent deletion and respects cancel', async () => {
    const user = userEvent.setup()
    renderScreen(true)

    await user.click(await screen.findByRole('button', { name: 'select review' }))
    const deleteButton = await screen.findByRole('button', { name: 'reviews.deletePermanent' })
    await user.click(deleteButton)
    expect(showConfirm).toHaveBeenCalledWith(expect.stringContaining('reviews.deleteConfirmPermanent'), expect.any(String), expect.any(Object))
    expect(bulkDeleteReviews).not.toHaveBeenCalled()

    showConfirm.mockResolvedValue(true)
    await user.click(deleteButton)
    await waitFor(() => expect(bulkDeleteReviews).toHaveBeenCalledWith([12]))
  })
})
