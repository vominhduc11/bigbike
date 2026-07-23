import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getBrandRequiredProgress, toBrandPayload } from './brandPayload'
import { BrandDetailScreen } from './BrandDetailScreen'

function formWithSeo(overrides = {}) {
  return {
    slug: 'ls2',
    name: 'LS2',
    description: '',
    showOnHomepage: true,
    logoUrl: '',
    bannerUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoCanonicalUrl: '',
    seoOgImageUrl: '',
    seoOgImageAlt: '',
    translations: { en: { description: '', seoTitle: '', seoDescription: '' } },
    ...overrides,
  }
}

describe('BrandDetailScreen toPayload', () => {
  it('gửi khối SEO rỗng rõ ràng để xóa dữ liệu cũ', () => {
    expect(toBrandPayload(formWithSeo()).seo).toEqual({
      title: null,
      description: null,
      canonicalUrl: null,
      ogImage: null,
    })
  })

  it('giữ nội dung mô tả ảnh chia sẻ khi có ảnh', () => {
    expect(toBrandPayload(formWithSeo({
      seoOgImageUrl: '/media/brands/ls2.jpg',
      seoOgImageAlt: 'Logo thương hiệu LS2',
    })).seo.ogImage).toEqual({
      url: '/media/brands/ls2.jpg',
      alt: 'Logo thương hiệu LS2',
    })
  })

  it('không gửi tên hoặc slug tiếng Anh riêng cho thương hiệu', () => {
    const payload = toBrandPayload(formWithSeo({
      name: 'Hevik',
      translations: { en: { description: 'English description' } },
    }))
    expect(payload.translations.en).not.toHaveProperty('name')
    expect(payload.translations.en).not.toHaveProperty('slug')
    expect(payload.translations.en.description).toBe('English description')
  })

  it('gửi cờ hiện ở trang chủ và không gửi cờ thùng rác', () => {
    const payload = toBrandPayload(formWithSeo({ showOnHomepage: false }))
    expect(payload.showOnHomepage).toBe(false)
    expect(payload).not.toHaveProperty('visible')
  })
})

describe('BrandDetailScreen required progress', () => {
  it('chỉ tính tên dùng chung và slug vì thương hiệu không có tên tiếng Anh riêng', () => {
    expect(getBrandRequiredProgress(formWithSeo({ translations: { en: {} } }))).toEqual({
      filled: 2,
      total: 2,
    })
  })

  it('đủ tiến độ khi có tên dùng chung và slug', () => {
    expect(getBrandRequiredProgress(formWithSeo())).toEqual({
      filled: 2,
      total: 2,
    })
  })
})

const mocks = vi.hoisted(() => ({
  fetchBrandDetail: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  deleteBrand: vi.fn(),
  restoreBrand: vi.fn(),
  mapValidationErrors: vi.fn(() => ({})),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchBrandDetail: mocks.fetchBrandDetail,
  createBrand: mocks.createBrand,
  updateBrand: mocks.updateBrand,
  deleteBrand: mocks.deleteBrand,
  restoreBrand: mocks.restoreBrand,
  mapValidationErrors: mocks.mapValidationErrors,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange, placeholder, disabled }) => (
    <textarea
      data-testid="rich-text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

// jsdom không có ResizeObserver — Radix Checkbox (showOnHomepage) cần nó cho bubble input ẩn.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

const baseBrand = {
  id: 'brand_ls2',
  slug: 'ls2',
  name: 'LS2',
  isVisible: true,
  showOnHomepage: false,
  updatedAt: '2026-07-22T00:00:00Z',
}

function renderScreen({ item = baseBrand, canUpdate = true } = {}) {
  mocks.fetchBrandDetail.mockResolvedValue({ item })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <BrandDetailScreen brandId={item.id} navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

describe('BrandDetailScreen restore/hide action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.showConfirm.mockResolvedValue(true)
    mocks.deleteBrand.mockResolvedValue({ item: { ...baseBrand, isVisible: false } })
    mocks.restoreBrand.mockResolvedValue({ item: { ...baseBrand, isVisible: true } })
  })

  it('hiện nút "Chuyển vào Thùng rác" và gọi deleteBrand khi thương hiệu đang hiển thị', async () => {
    const user = userEvent.setup()
    renderScreen({ item: { ...baseBrand, isVisible: true } })

    const hideButton = await screen.findByRole('button', { name: 'brands.detail.hideBtn' })
    expect(screen.queryByRole('button', { name: 'brands.detail.restoreBtn' })).not.toBeInTheDocument()

    await user.click(hideButton)
    await waitFor(() => expect(mocks.deleteBrand).toHaveBeenCalledWith('brand_ls2'))
    expect(mocks.restoreBrand).not.toHaveBeenCalled()
  })

  it('hiện nút "Khôi phục" và gọi restoreBrand khi thương hiệu đang ở Thùng rác', async () => {
    const user = userEvent.setup()
    renderScreen({ item: { ...baseBrand, isVisible: false } })

    const restoreButton = await screen.findByRole('button', { name: 'brands.detail.restoreBtn' })
    expect(screen.queryByRole('button', { name: 'brands.detail.hideBtn' })).not.toBeInTheDocument()

    await user.click(restoreButton)
    await waitFor(() => expect(mocks.restoreBrand).toHaveBeenCalledWith('brand_ls2'))
    expect(mocks.deleteBrand).not.toHaveBeenCalled()
  })
})
