import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContentDetailScreen } from './ContentDetailScreen'

const mocks = vi.hoisted(() => ({
  fetchContentDetail: vi.fn(),
  createContent: vi.fn(),
  updateContent: vi.fn(),
  deleteContent: vi.fn(),
  restoreContent: vi.fn(),
  permanentDeleteContent: vi.fn(),
  previewArticle: vi.fn(),
  mapValidationErrors: vi.fn(() => ({})),
  showConfirm: vi.fn(),
  setContentLang: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key) => key }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchContentDetail: mocks.fetchContentDetail,
  createContent: mocks.createContent,
  updateContent: mocks.updateContent,
  deleteContent: mocks.deleteContent,
  restoreContent: mocks.restoreContent,
  permanentDeleteContent: mocks.permanentDeleteContent,
  previewArticle: mocks.previewArticle,
  mapValidationErrors: mocks.mapValidationErrors,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../lib/contentLang', () => ({
  useContentLang: () => 'vi',
  setContentLang: mocks.setContentLang,
}))
vi.mock('../lib/useUnsavedChanges', () => ({ useUnsavedChanges: vi.fn() }))
vi.mock('../lib/navigationGuard', () => ({ clearNavGuard: vi.fn() }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../components/AdminShell', () => ({ useAutoHideSidebar: vi.fn() }))
vi.mock('./content-detail/ContentAssignmentBanner', () => ({
  ContentAssignmentBanner: () => <div data-testid="assignment-banner" />,
}))
vi.mock('../components/BlockEditor', () => ({
  BlockEditor: ({ disabled, hasError }) => (
    <textarea
      data-testid="block-editor"
      disabled={disabled}
      aria-invalid={hasError || undefined}
      defaultValue=""
    />
  ),
}))
vi.mock('../components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange, disabled }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))
vi.mock('../components/ImageUrlInput', () => ({
  ImageUrlInput: ({
    id,
    value,
    onChange,
    disabled,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    'aria-describedby': ariaDescribedBy,
  }) => (
    <input
      id={id}
      data-testid={id}
      value={value}
      disabled={disabled}
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      aria-describedby={ariaDescribedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))
vi.mock('../components/LivePreview', () => ({
  LivePreview: ({ open }) => open ? <div data-testid="live-preview" /> : null,
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

const baseArticle = {
  id: 'article-1',
  type: 'ARTICLE',
  slug: 'bai-viet',
  slugEn: 'article',
  title: 'Bài viết',
  excerpt: 'Tóm tắt',
  body: '<p>Nội dung tiếng Việt</p>',
  bodyBlocks: null,
  publishStatus: 'DRAFT',
  featured: false,
  homeExperience: false,
  translations: {
    en: {
      title: 'Article',
      excerpt: 'Summary',
      body: '',
      seoTitle: '',
      seoDescription: '',
    },
  },
  seo: {},
  updatedAt: '2026-07-22T00:00:00Z',
}

function renderScreen({
  item = baseArticle,
  canUpdate = true,
  isCreate = false,
  contentId = item?.id || 'article-1',
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ContentDetailScreen
        contentType="ARTICLE"
        contentId={contentId}
        isCreate={isCreate}
        navigate={navigate}
        canUpdate={canUpdate}
      />
    </QueryClientProvider>,
  )
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.fetchContentDetail.mockResolvedValue({ item: baseArticle })
  mocks.createContent.mockResolvedValue({ item: baseArticle })
  mocks.updateContent.mockResolvedValue({ item: baseArticle })
  mocks.deleteContent.mockResolvedValue({})
  mocks.restoreContent.mockResolvedValue({ item: { ...baseArticle, publishStatus: 'DRAFT' } })
  mocks.permanentDeleteContent.mockResolvedValue({})
  mocks.previewArticle.mockResolvedValue(baseArticle)
  mocks.mapValidationErrors.mockReturnValue({})
  mocks.showConfirm.mockResolvedValue(true)
})

describe('ContentDetailScreen', () => {
  it('khóa biểu mẫu, hiện banner và không tạo yêu cầu xem trước trong chế độ chỉ đọc', async () => {
    renderScreen({ canUpdate: false })

    const title = await screen.findByLabelText(/content\.detail\.title/)
    expect(screen.getByText('content.detail.permissionDesc')).toBeInTheDocument()
    expect(title).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'content.detail.preview.open' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('live-preview')).not.toBeInTheDocument()
    expect(mocks.previewArticle).not.toHaveBeenCalled()
  })

  it('phân biệt rõ bài không tồn tại với lỗi tải thông thường', async () => {
    mocks.fetchContentDetail.mockRejectedValue(Object.assign(new Error('Không tìm thấy'), { status: 404 }))
    renderScreen()

    expect(await screen.findByText('content.detail.notFound')).toBeInTheDocument()
    expect(screen.queryByText('content.detail.loadError')).not.toBeInTheDocument()
  })

  it('bài trong Thùng rác chỉ cho khôi phục và lưu về Nháp sau xác nhận', async () => {
    const user = userEvent.setup()
    const trash = {
      ...baseArticle,
      publishStatus: 'TRASH',
      slug: 'bai-viet-deleted-article_1',
      slugEn: 'article-deleted-article_1',
    }
    mocks.fetchContentDetail.mockResolvedValue({ item: trash })
    mocks.restoreContent.mockResolvedValue({
      item: { ...baseArticle, publishStatus: 'DRAFT' },
    })
    mocks.updateContent.mockResolvedValue({ item: { ...baseArticle, publishStatus: 'DRAFT' } })
    renderScreen({ item: trash })

    expect(await screen.findByText('content.detail.trashWarningTitle')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'content.detail.archiveBtn' })).not.toBeInTheDocument()
    const restoreAndSave = screen.getByRole('button', { name: 'content.detail.restoreAndSave' })
    await user.click(restoreAndSave)

    await waitFor(() => expect(mocks.restoreContent).toHaveBeenCalledWith('ARTICLE', 'article-1'))
    expect(mocks.updateContent).toHaveBeenCalledWith(
      'ARTICLE',
      'article-1',
      expect.objectContaining({
        publishStatus: 'DRAFT',
        categoryId: '',
        seo: expect.objectContaining({
          canonicalUrl: expect.stringMatching(/\/tin-tuc\/bai-viet\/$/),
        }),
      }),
    )
  })

  it('xóa vĩnh viễn bài trong Thùng rác sau xác nhận', async () => {
    const user = userEvent.setup()
    const trash = { ...baseArticle, publishStatus: 'TRASH' }
    mocks.fetchContentDetail.mockResolvedValue({ item: trash })
    renderScreen({ item: trash })

    await user.click(await screen.findByRole('button', { name: 'common.permanentDelete' }))
    await waitFor(() => {
      expect(mocks.permanentDeleteContent).toHaveBeenCalledWith('ARTICLE', 'article-1')
    })
  })

  it('tự chuyển sang ngôn ngữ có lỗi và đưa focus tới trường lỗi đầu tiên', async () => {
    const user = userEvent.setup()
    renderScreen({ isCreate: true, item: null, contentId: 'new' })

    await user.click(screen.getByRole('button', { name: 'content.detail.createArticleBtn' }))

    await waitFor(() => expect(mocks.setContentLang).toHaveBeenCalledWith('en'))
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-invalid', 'true'))
    expect(mocks.createContent).not.toHaveBeenCalled()
  })

  it('tự mở tab SEO và phần nâng cao khi máy chủ báo lỗi ảnh OG', async () => {
    const user = userEvent.setup()
    mocks.updateContent.mockRejectedValue(new Error('Ảnh OG không hợp lệ'))
    mocks.mapValidationErrors.mockReturnValue({ seoOgImageUrl: 'content.detail.errSeoOgImageUrl' })
    renderScreen()

    const title = await screen.findByLabelText(/content\.detail\.title/)
    await user.clear(title)
    await user.type(title, 'Bài viết đã sửa')
    await user.click(screen.getByRole('button', { name: 'content.detail.saveBtn' }))

    expect(await screen.findByText('content.detail.errSeoOgImageUrl')).toBeInTheDocument()
    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute('aria-invalid', 'true')
    })
  })
})
