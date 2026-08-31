import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContentListScreen } from './ContentListScreen'

const mocks = vi.hoisted(() => ({
  fetchContent: vi.fn(),
  fetchContentDetail: vi.fn(),
  updateContent: vi.fn(),
  deleteContent: vi.fn(),
  restoreContent: vi.fn(),
  permanentDeleteContent: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key) => key }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchContent: mocks.fetchContent,
  fetchContentDetail: mocks.fetchContentDetail,
  updateContent: mocks.updateContent,
  deleteContent: mocks.deleteContent,
  restoreContent: mocks.restoreContent,
  permanentDeleteContent: mocks.permanentDeleteContent,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns, selectedIds = [], onSelectionChange, onSortChange }) => (
    <div data-testid="content-table" data-selected={selectedIds.join(',')}>
      <button type="button" onClick={() => onSelectionChange?.(rows.map((row) => row.id))}>
        test.selectAllRows
      </button>
      <button type="button" onClick={() => onSortChange?.('title', 'asc')}>
        test.sortTitleAsc
      </button>
      {rows.map((row) => (
        <div key={row.id} data-testid={`content-row-${row.id}`}>
          {columns.map((column) => (
            <div key={column.key}>{column.render ? column.render(row) : row[column.key]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

const draftArticle = {
  id: 'article-draft',
  type: 'ARTICLE',
  slug: 'bai-nhap',
  slugEn: 'draft-article',
  title: 'Bài nháp',
  excerpt: 'Tóm tắt',
  body: '<p>Nội dung</p>',
  publishStatus: 'DRAFT',
  translations: {
    en: {
      title: 'Draft article',
      excerpt: 'Summary',
      body: '<p>Content</p>',
    },
  },
  updatedAt: '2026-07-20T00:00:00Z',
}
const trashArticle = {
  ...draftArticle,
  id: 'article-trash',
  slug: 'bai-thung-rac',
  title: 'Bài trong Thùng rác',
  publishStatus: 'TRASH',
}

function contentResponse(items = [draftArticle, trashArticle]) {
  return {
    items,
    pagination: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
  }
}

function renderScreen(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ContentListScreen navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/content/articles')
  mocks.fetchContent.mockResolvedValue(contentResponse())
  mocks.fetchContentDetail.mockResolvedValue({ item: draftArticle })
  mocks.updateContent.mockResolvedValue({ item: { ...draftArticle, publishStatus: 'PUBLISHED' } })
  mocks.deleteContent.mockResolvedValue({})
  mocks.restoreContent.mockResolvedValue({})
  mocks.permanentDeleteContent.mockResolvedValue({})
  mocks.showConfirm.mockResolvedValue(false)
})

describe('ContentListScreen', () => {
  it('hiển thị hành động theo trạng thái từng bài, không phụ thuộc bộ lọc hiện tại', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('Bài nháp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.view' })).toBeInTheDocument()

    await user.click(
      within(screen.getByTestId('content-row-article-draft')).getByRole('button', {
        name: 'common.actions',
      }),
    )
    expect(await screen.findByRole('menuitem', { name: 'content.moveToTrash' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(
      within(screen.getByTestId('content-row-article-trash')).getByRole('button', {
        name: 'common.actions',
      }),
    )
    expect(await screen.findByRole('menuitem', { name: 'content.restore' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'common.permanentDelete' })).toBeInTheDocument()
  })

  it('chế độ chỉ đọc chỉ cho xem và không có hành động ghi', async () => {
    renderScreen(false)

    expect(await screen.findByText('content.readOnly')).toBeInTheDocument()
    expect(await screen.findByText('Bài nháp')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'common.view' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'content.moveToTrash' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'content.restore' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.permanentDelete' })).not.toBeInTheDocument()
  })

  it('không chuyển bài vào Thùng rác khi người dùng hủy xác nhận', async () => {
    const user = userEvent.setup()
    renderScreen()

    const row = await screen.findByTestId('content-row-article-draft')
    await user.click(within(row).getByRole('button', { name: 'common.actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'content.moveToTrash' }))
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1)
    expect(mocks.deleteContent).not.toHaveBeenCalled()
  })

  it('sắp xếp tiêu đề theo cả trường và chiều được chọn', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'test.sortTitleAsc' }))
    await waitFor(() => {
      expect(mocks.fetchContent).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'title:asc' }),
      )
    })
  })

  it('xuất bản hàng loạt bằng payload đầy đủ, bỏ qua bài không hợp lệ và chỉ bỏ chọn bài thành công', async () => {
    const user = userEvent.setup()
    mocks.showConfirm.mockResolvedValue(true)
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'test.selectAllRows' }))
    await user.click(screen.getByRole('button', { name: 'content.bulkPublish' }))

    await waitFor(() =>
      expect(mocks.fetchContentDetail).toHaveBeenCalledWith('ARTICLE', 'article-draft'),
    )
    expect(mocks.updateContent).toHaveBeenCalledWith(
      'ARTICLE',
      'article-draft',
      expect.objectContaining({
        title: 'Bài nháp',
        publishStatus: 'PUBLISHED',
        translations: expect.objectContaining({
          en: expect.objectContaining({ title: 'Draft article' }),
        }),
      }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('content-table')).toHaveAttribute('data-selected', 'article-trash')
    })
    expect(mocks.toast.warning).toHaveBeenCalledWith('content.bulkPartial')
  })

  it('hiển thị lỗi tải và cho phép thử lại', async () => {
    const user = userEvent.setup()
    mocks.fetchContent
      .mockRejectedValueOnce(new Error('Mất kết nối'))
      .mockResolvedValueOnce(contentResponse([draftArticle]))
    renderScreen()

    expect(await screen.findByText('Mất kết nối')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'common.retry' }))
    expect(await screen.findByText('Bài nháp')).toBeInTheDocument()
    expect(mocks.fetchContent).toHaveBeenCalledTimes(2)
  })
})
