import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReviewDetailScreen } from './ReviewDetailScreen'

const mocks = vi.hoisted(() => ({
  fetchReviewDetail: vi.fn(),
  updateReviewStatus: vi.fn(),
  deleteReview: vi.fn(),
  showConfirm: vi.fn(),
}))
const { fetchReviewDetail, updateReviewStatus, deleteReview, showConfirm } = mocks

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))
vi.mock('../lib/adminApi', () => ({ fetchReviewDetail: mocks.fetchReviewDetail, updateReviewStatus: mocks.updateReviewStatus, deleteReview: mocks.deleteReview }))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderScreen(canUpdate = false, isSuperAdmin = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ReviewDetailScreen reviewId="12" navigate={vi.fn()} canUpdate={canUpdate} isSuperAdmin={isSuperAdmin} /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  showConfirm.mockResolvedValue(false)
  fetchReviewDetail.mockResolvedValue({ item: {
    id: 12,
    productId: 'prod-1',
    productName: 'Mũ BigBike',
    authorName: 'Nguyễn Minh',
    authorEmail: 'minh@example.com',
    rating: 5,
    body: 'Rất tốt',
    photos: [],
    status: 'APPROVED',
    version: 3,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
  } })
})

describe('ReviewDetailScreen', () => {
  it('renders scan-friendly review metadata with a shared status badge and read-only banner', async () => {
    renderScreen(false)

    expect(await screen.findByText('reviews.detail.sectionReview')).toBeInTheDocument()
    expect(screen.getAllByText('reviews.statusApproved').length).toBeGreaterThan(0)
    expect(screen.getByText('reviews.detail.readOnlyHint')).toBeInTheDocument()
    expect(screen.getByText('reviews.detail.noPhotos')).toBeInTheDocument()
    expect(screen.getByText('minh@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.spam' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.deletePermanent' })).not.toBeInTheDocument()
  })

  it.each([1, 10])('renders the supported gallery size: %s photo(s)', async (photoCount) => {
    fetchReviewDetail.mockResolvedValue({ item: {
      id: 12,
      productId: 'prod-1',
      productName: 'Mũ BigBike',
      authorName: 'Nguyễn Minh',
      authorEmail: 'minh@example.com',
      rating: 5,
      body: 'Rất tốt',
      photos: Array.from({ length: photoCount }, (_, index) => `/media/reviews/${index + 1}.jpg`),
      status: 'APPROVED',
      version: 3,
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    } })

    renderScreen(true)

    expect((await screen.findAllByRole('button', { name: /reviews\.detail\.openPhoto/ })).length).toBe(photoCount)
  })

  it('renders a dedicated not-found state for a 404 response', async () => {
    const navigate = vi.fn()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const notFound = Object.assign(new Error('Review not found.'), { status: 404 })
    fetchReviewDetail.mockRejectedValue(notFound)
    render(<QueryClientProvider client={client}><ReviewDetailScreen reviewId="missing" navigate={navigate} canUpdate={false} /></QueryClientProvider>)

    expect(await screen.findByText('reviews.detail.notFound')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'common.back' }))
    expect(navigate).toHaveBeenCalledWith('/admin/reviews')
  })

  it('keeps a generic fetch error retryable and separate from not-found', async () => {
    fetchReviewDetail.mockRejectedValue(new Error('network unavailable'))
    renderScreen(false)

    expect(await screen.findByText('reviews.detail.error')).toBeInTheDocument()
    expect(screen.getByText('network unavailable')).toBeInTheDocument()
    expect(screen.queryByText('reviews.detail.notFound')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument()
  })

  it('does not delete when the permanent-delete confirmation is cancelled', async () => {
    const user = userEvent.setup()
    fetchReviewDetail.mockResolvedValue({ item: {
      id: 12,
      productId: 'prod-1',
      productName: 'Mũ BigBike',
      authorName: 'Nguyễn Minh',
      authorEmail: 'minh@example.com',
      rating: 5,
      body: 'Rất tốt',
      photos: [],
      status: 'TRASH',
      version: 3,
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    } })
    renderScreen(true, true)
    await screen.findByText('reviews.detail.sectionReview')

    await user.click(screen.getAllByRole('button', { name: 'reviews.deletePermanent' })[0])

    expect(showConfirm).toHaveBeenCalled()
    expect(deleteReview).not.toHaveBeenCalled()
  })

  it('reloads the latest version after a conflict before enabling actions again', async () => {
    const user = userEvent.setup()
    const pendingReview = {
      id: 12,
      productId: 'prod-1',
      productName: 'Mũ BigBike',
      authorName: 'Nguyễn Minh',
      authorEmail: 'minh@example.com',
      rating: 5,
      body: 'Rất tốt',
      photos: [],
      status: 'PENDING',
      version: 3,
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    }
    fetchReviewDetail
      .mockResolvedValueOnce({ item: pendingReview })
      .mockResolvedValue({ item: { ...pendingReview, version: 4 } })
    updateReviewStatus.mockRejectedValue(Object.assign(new Error('stale review'), { status: 409 }))
    showConfirm.mockResolvedValue(true)
    renderScreen(true)

    await user.click((await screen.findAllByRole('button', { name: 'reviews.approve' }))[0])

    await waitFor(() => expect(updateReviewStatus).toHaveBeenCalledWith('12', 'APPROVED', 3))
    expect(await screen.findByText('reviews.staleConflict')).toBeInTheDocument()
    await waitFor(() => expect(fetchReviewDetail).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'reviews.approve' })[0]).toBeEnabled())
  })

  it('sends the displayed version with a confirmed permanent delete', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    showConfirm.mockResolvedValue(true)
    deleteReview.mockResolvedValue(undefined)
    fetchReviewDetail.mockResolvedValue({ item: {
      id: 12,
      productId: 'prod-1',
      productName: 'Mũ BigBike',
      authorName: 'Nguyễn Minh',
      authorEmail: 'minh@example.com',
      rating: 5,
      body: 'Rất tốt',
      photos: [],
      status: 'TRASH',
      version: 3,
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    } })
    render(<QueryClientProvider client={client}><ReviewDetailScreen reviewId="12" navigate={navigate} canUpdate isSuperAdmin /></QueryClientProvider>)

    await user.click((await screen.findAllByRole('button', { name: 'reviews.deletePermanent' }))[0])

    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith('12', 3))
    expect(navigate).toHaveBeenCalledWith('/admin/reviews')
  })

  it('shows only the owner-approved action for a processed review', async () => {
    renderScreen(true, false)

    expect((await screen.findAllByRole('button', { name: 'reviews.returnPending' })).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'reviews.approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.spam' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.moveToTrash' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'reviews.deletePermanent' })).not.toBeInTheDocument()
  })

  it('keeps the detail-only author email after a privacy-safe status response', async () => {
    const user = userEvent.setup()
    updateReviewStatus.mockResolvedValue({
      item: { id: 12, status: 'PENDING', version: 4 },
    })
    renderScreen(true, false)

    await user.click((await screen.findAllByRole('button', { name: 'reviews.returnPending' }))[0])

    await waitFor(() => expect(updateReviewStatus).toHaveBeenCalledWith('12', 'PENDING', 3))
    expect(screen.getByText('minh@example.com')).toBeInTheDocument()
  })

  it('requires confirmation before approving a pending review', async () => {
    const user = userEvent.setup()
    fetchReviewDetail.mockResolvedValue({ item: {
      id: 12,
      productId: 'prod-1',
      productName: 'Mũ BigBike',
      authorName: 'Nguyễn Minh',
      authorEmail: 'minh@example.com',
      rating: 5,
      body: 'Rất tốt',
      photos: [],
      status: 'PENDING',
      version: 3,
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    } })
    renderScreen(true)

    await user.click((await screen.findAllByRole('button', { name: 'reviews.approve' }))[0])

    expect(showConfirm).toHaveBeenCalledWith(
      'reviews.approveConfirmMany',
      'reviews.approveConfirmTitle',
      expect.objectContaining({ confirmLabel: 'reviews.approve' }),
    )
    expect(updateReviewStatus).not.toHaveBeenCalled()
  })
})
