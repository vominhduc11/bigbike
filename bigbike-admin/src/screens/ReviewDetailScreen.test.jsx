import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReviewDetailScreen } from './ReviewDetailScreen'

const mocks = vi.hoisted(() => ({
  fetchReviewDetail: vi.fn(),
  updateReviewStatus: vi.fn(),
  deleteReview: vi.fn(),
}))
const { fetchReviewDetail } = mocks

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))
vi.mock('../lib/adminApi', () => ({ fetchReviewDetail: mocks.fetchReviewDetail, updateReviewStatus: mocks.updateReviewStatus, deleteReview: mocks.deleteReview }))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn(async () => false) }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderScreen(canUpdate = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><ReviewDetailScreen reviewId="12" navigate={vi.fn()} canUpdate={canUpdate} /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
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
      createdAt: '2026-07-22T00:00:00Z',
      updatedAt: '2026-07-22T00:00:00Z',
    } })

    renderScreen(true)

    expect((await screen.findAllByRole('button', { name: /reviews\.detail\.openPhoto/ })).length).toBe(photoCount)
  })
})
