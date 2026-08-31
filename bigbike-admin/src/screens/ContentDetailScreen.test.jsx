import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
  contentLang: 'vi',
  toast: { success: vi.fn(), error: vi.fn() },
  // Quyền riêng cho ô "cho Google hiển thị" (V372 `seo.index`). Mặc định là có, để các
  // test nội dung không phải bận tâm; test riêng bên dưới tắt đi để kiểm nhánh khoá.
  hasPermission: vi.fn(() => true),
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
  useContentLang: () => mocks.contentLang,
  setContentLang: mocks.setContentLang,
}))
vi.mock('../lib/auth', () => ({ useHasPermission: () => mocks.hasPermission }))
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
vi.mock('../components/DeferredRichTextEditor', () => ({
  DeferredRichTextEditor: ({ value, onChange, disabled }) => (
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
  LivePreview: ({ open }) => (open ? <div data-testid="live-preview" /> : null),
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
  const renderResult = render(
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
  return { navigate, ...renderResult }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.contentLang = 'vi'
  mocks.hasPermission.mockImplementation(() => true)
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
    expect(
      screen.queryByRole('button', { name: 'content.detail.preview.open' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('live-preview')).not.toBeInTheDocument()
    expect(mocks.previewArticle).not.toHaveBeenCalled()
  })

  it('phân biệt rõ bài không tồn tại với lỗi tải thông thường', async () => {
    mocks.fetchContentDetail.mockRejectedValue(
      Object.assign(new Error('Không tìm thấy'), { status: 404 }),
    )
    renderScreen()

    expect(await screen.findByText('content.detail.notFound')).toBeInTheDocument()
    expect(screen.queryByText('content.detail.loadError')).not.toBeInTheDocument()
  })

  it('hiển thị trạng thái đã xuất bản trong ô chọn', async () => {
    mocks.fetchContentDetail.mockResolvedValue({
      item: { ...baseArticle, publishStatus: 'PUBLISHED' },
    })
    const { container } = renderScreen()

    await waitFor(() => {
      expect(within(container).getByRole('combobox')).toHaveTextContent('status.publish.PUBLISHED')
    })
  })

  // Bản trước của test này (commit 578c2961, 2026-07-29) khẳng định ô "cho Google hiển thị"
  // phải KHÔNG tồn tại, để tab SEO tin tức trông giống tab SEO sản phẩm. Mục tiêu đồng bộ
  // đó vẫn giữ — nhưng từ V371 cả 4 loại (sản phẩm/danh mục/thương hiệu/bài viết) đều có ô
  // này, nên "giống nhau" giờ nghĩa là ĐỀU CÓ. Xem BUSINESS_RULES `SEO_RULE_001`.
  it('dùng cùng hướng dẫn SEO với màn Sản phẩm, gồm cả ô cho Google hiển thị', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('tab', { name: 'content.detail.tabSeoPublish' }))

    expect(screen.getByText('0 / 60')).toBeInTheDocument()
    expect(screen.getByText('0 / 165')).toBeInTheDocument()
    expect(screen.getByText('content.detail.seoOgImageUrl')).toBeInTheDocument()
    // Khối "Tùy chọn nâng cao" gập lại vẫn không quay về — ô nằm thẳng trong tab.
    expect(screen.queryByText('content.detail.seoAdvanced')).not.toBeInTheDocument()
    expect(screen.getByText('seoIndex.labelVi')).toBeInTheDocument()
  })

  it('ô cho Google hiển thị mặc định đang bật và tắt được', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('tab', { name: 'content.detail.tabSeoPublish' }))

    // Nhãn theo chiều khẳng định: tick = cho hiển thị, dữ liệu lưu là noIndex (phủ định).
    const checkbox = screen.getByRole('checkbox', { name: 'seoIndex.labelVi' })
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('không có quyền seo.index thì ô bị khoá', async () => {
    const user = userEvent.setup()
    mocks.hasPermission.mockImplementation(() => false)
    renderScreen()

    await user.click(await screen.findByRole('tab', { name: 'content.detail.tabSeoPublish' }))

    expect(screen.getByRole('checkbox', { name: 'seoIndex.labelVi' })).toBeDisabled()
    expect(screen.getByText('seoIndex.noPermission')).toBeInTheDocument()
  })

  it('xem trước SEO tiếng Anh bằng đúng đường dẫn và nội dung tiếng Anh', async () => {
    const user = userEvent.setup()
    mocks.contentLang = 'en'
    renderScreen()

    await user.click(await screen.findByRole('tab', { name: 'content.detail.tabSeoPublish' }))

    expect(screen.getByText(/\/news\/article\/$/)).toBeInTheDocument()
    expect(screen.getByText('Article')).toBeInTheDocument()
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
    expect(
      screen.queryByRole('button', { name: 'content.detail.archiveBtn' }),
    ).not.toBeInTheDocument()
    const restoreAndSave = screen.getByRole('button', { name: 'content.detail.restoreAndSave' })
    await user.click(restoreAndSave)

    await waitFor(() => expect(mocks.restoreContent).toHaveBeenCalledWith('ARTICLE', 'article-1'))
    expect(mocks.updateContent).toHaveBeenCalledWith(
      'ARTICLE',
      'article-1',
      expect.objectContaining({
        publishStatus: 'DRAFT',
        seo: expect.objectContaining({
          canonicalUrl: expect.stringMatching(/\/tin-tuc\/bai-viet\/$/),
        }),
      }),
    )
  })

  it('xoá vĩnh viễn bài trong Thùng rác sau xác nhận', async () => {
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

  it('tự mở tab SEO và đưa focus tới lỗi ảnh OG đang hiển thị', async () => {
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
