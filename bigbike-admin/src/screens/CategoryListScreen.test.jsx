import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategoryListScreen } from './CategoryListScreen'

const mocks = vi.hoisted(() => ({
  fetchCategories: vi.fn(),
  fetchCategoryTree: vi.fn(),
  fetchCategoryDetail: vi.fn(),
  updateCategory: vi.fn(),
  softDeleteCategory: vi.fn(),
  restoreCategory: vi.fn(),
  hardDeleteCategory: vi.fn(),
  previewCategoryPermanentDelete: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      if (values && typeof values === 'object' && 'defaultValue' in values) {
        return String(values.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
      }
      return key
    },
  }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchCategories: mocks.fetchCategories,
  fetchCategoryTree: mocks.fetchCategoryTree,
  fetchCategoryDetail: mocks.fetchCategoryDetail,
  updateCategory: mocks.updateCategory,
  softDeleteCategory: mocks.softDeleteCategory,
  restoreCategory: mocks.restoreCategory,
  hardDeleteCategory: mocks.hardDeleteCategory,
  previewCategoryPermanentDelete: mocks.previewCategoryPermanentDelete,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
// Kéo-thả cần API con trỏ của trình duyệt thật; kiểm thử này chỉ soi vòng đời + quyền.
vi.mock('../components/Sortable', () => ({
  useDragSensors: () => [],
  SortableRow: ({ children }) => children({
    setNodeRef: () => {},
    attributes: {},
    listeners: {},
    isDragging: false,
    style: {},
  }),
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
// jsdom không có Pointer Capture API — Radix Select (ô lọc trạng thái) cần các hàm này
// để mở được danh sách lựa chọn.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const helmet = {
  id: 'cat_helmet',
  slug: 'mu-bao-hiem',
  name: 'Mũ bảo hiểm',
  isVisible: true,
  deleted: false,
  showOnHomepage: true,
  parentId: null,
  sortOrder: 0,
  updatedAt: '2026-07-25T00:00:00Z',
}
const systemCategory = {
  id: 'uncategorized',
  slug: 'uncategorized',
  name: 'Chưa phân loại',
  isVisible: false,
  deleted: false,
  showOnHomepage: false,
  parentId: null,
  sortOrder: 99,
  updatedAt: '2026-07-25T00:00:00Z',
}

function renderScreen({ canUpdate = true, items = [helmet, systemCategory] } = {}) {
  mocks.fetchCategories.mockResolvedValue({
    items,
    pagination: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
  })
  mocks.fetchCategoryTree.mockResolvedValue({ items })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <CategoryListScreen navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

// Màn hình render đồng thời bảng desktop và danh sách thẻ mobile, nên tên danh mục
// xuất hiện nhiều lần — luôn khoanh vùng về đúng dòng trong bảng.
async function findRow(name) {
  return waitFor(() => {
    const row = screen.getAllByText(name).map((node) => node.closest('tr')).find(Boolean)
    expect(row).toBeTruthy()
    return row
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/categories')
  mocks.showConfirm.mockResolvedValue(false)
  mocks.softDeleteCategory.mockResolvedValue({})
  mocks.restoreCategory.mockResolvedValue({})
  mocks.hardDeleteCategory.mockResolvedValue({})
  mocks.previewCategoryPermanentDelete.mockResolvedValue({
    descendantCategoryCount: 2,
    affectedProductCount: 7,
    reassignedProductCount: 3,
  })
})

describe('CategoryListScreen — vòng đời 2 cờ độc lập', () => {
  it('chỉ hiển thị các cột cốt lõi và tách riêng trạng thái trang chủ', async () => {
    renderScreen({
      items: [{
        ...helmet,
        description: 'Mô tả không cần xuất hiện trong bảng',
      }],
    })

    const row = await findRow('Mũ bảo hiểm')
    const table = row.closest('table')

    expect(within(table).getByRole('columnheader', { name: 'categories.colCategory' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'categories.colVisibility' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'categories.colHomepage' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'categories.colUpdated' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'categories.colActions' })).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'categories.colDescription' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'categories.colSortOrder' })).not.toBeInTheDocument()
    expect(within(row).getByText('/mu-bao-hiem')).toBeInTheDocument()
    expect(within(row).queryByText('Mô tả không cần xuất hiện trong bảng')).not.toBeInTheDocument()
    expect(within(row).getByText('common.yes')).toBeInTheDocument()
  })

  it('đưa liên kết xem website vào menu phụ thay vì nút riêng trên hàng', async () => {
    const user = userEvent.setup()
    renderScreen({ items: [helmet] })

    const row = await findRow('Mũ bảo hiểm')
    expect(within(row).queryByRole('link', { name: 'categories.viewOnSite' })).not.toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Thao tác' }))

    const storefrontLink = await screen.findByRole('menuitem', { name: 'categories.viewOnSite' })
    expect(storefrontLink).toHaveAttribute('href', expect.stringContaining('/mu-bao-hiem'))
    expect(storefrontLink).toHaveAttribute('target', '_blank')
  })

  it('mặc định loại danh mục trong Thùng rác và không lọc sẵn theo ẩn/hiện', async () => {
    renderScreen()

    await findRow('Mũ bảo hiểm')
    expect(mocks.fetchCategories).toHaveBeenLastCalledWith(
      expect.objectContaining({ deleted: false, visibility: 'ALL' }),
    )
  })

  it('hộp xác nhận xóa mềm nói rõ là Thùng rác và ảnh hưởng danh mục con', async () => {
    const user = userEvent.setup()
    renderScreen()

    const row = await findRow('Mũ bảo hiểm')
    await user.click(within(row).getByRole('button', { name: 'Thao tác' }))
    await user.click(await screen.findByRole('menuitem', { name: /common.delete/ }))

    await waitFor(() => expect(mocks.showConfirm).toHaveBeenCalled())
    const [message] = mocks.showConfirm.mock.calls.at(-1)
    expect(message).toContain('Mũ bảo hiểm')
    expect(message).toContain('danh mục con')
    // Hủy xác nhận thì không gọi API.
    expect(mocks.softDeleteCategory).not.toHaveBeenCalled()
  })

  it('gọi xóa mềm sau khi xác nhận', async () => {
    const user = userEvent.setup()
    mocks.showConfirm.mockResolvedValue(true)
    renderScreen()

    const row = await findRow('Mũ bảo hiểm')
    await user.click(within(row).getByRole('button', { name: 'Thao tác' }))
    await user.click(await screen.findByRole('menuitem', { name: /common.delete/ }))

    await waitFor(() => expect(mocks.softDeleteCategory).toHaveBeenCalledWith('cat_helmet'))
  })

  it('khóa mọi thao tác ghi trên danh mục hệ thống "Chưa phân loại"', async () => {
    renderScreen()

    const row = await findRow('Chưa phân loại')
    // Ô chọn để gộp thao tác hàng loạt bị khóa, và không có menu thao tác dòng nào.
    expect(within(row).getByRole('checkbox')).toBeDisabled()
    expect(within(row).queryByRole('button', { name: 'Thao tác' })).not.toBeInTheDocument()

    // Dòng danh mục bình thường thì cả 2 thứ đó đều dùng được.
    const normalRow = await findRow('Mũ bảo hiểm')
    expect(within(normalRow).getByRole('checkbox')).toBeEnabled()
    expect(within(normalRow).getByRole('button', { name: 'Thao tác' })).toBeInTheDocument()
  })

  it('hiện dải chỉ-xem và bỏ nút tạo mới khi chỉ có quyền đọc', async () => {
    renderScreen({ canUpdate: false })

    await findRow('Mũ bảo hiểm')
    expect(screen.getByText(/chỉ có quyền xem danh mục/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'categories.create' })).not.toBeInTheDocument()
  })
})

describe('CategoryListScreen — xóa vĩnh viễn có xem trước ảnh hưởng', () => {
  // Chuyển sang view Thùng rác qua đúng ô lọc trên giao diện (không đặt URL thủ công,
  // vì bộ đọc query trên URL chưa hiểu giá trị đúng/sai — xem ghi chú việc xuyên module).
  async function switchToTrashView(user) {
    await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
    await user.click(await screen.findByRole('option', { name: 'Thùng rác' }))
  }

  async function openTrashRowMenu(user) {
    await switchToTrashView(user)
    // Đổi ô lọc phải gửi đúng yêu cầu "chỉ lấy danh mục trong Thùng rác" xuống máy chủ.
    await waitFor(() => expect(mocks.fetchCategories)
      .toHaveBeenLastCalledWith(expect.objectContaining({ deleted: true })))
    const row = await findRow('Mũ bảo hiểm')
    await user.click(within(row).getByRole('button', { name: 'Thao tác' }))
  }

  it('lấy số liệu ảnh hưởng TRƯỚC hộp xác nhận và chỉ xóa sau khi đồng ý', async () => {
    const user = userEvent.setup()
    mocks.showConfirm.mockResolvedValue(true)
    renderScreen({ items: [{ ...helmet, deleted: true, isVisible: false }] })

    await openTrashRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: /Xóa vĩnh viễn/ }))

    await waitFor(() => expect(mocks.previewCategoryPermanentDelete).toHaveBeenCalledWith(['cat_helmet']))
    // Xem trước phải chạy trước khi hỏi xác nhận.
    expect(mocks.previewCategoryPermanentDelete.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.showConfirm.mock.invocationCallOrder[0])
    await waitFor(() => expect(mocks.hardDeleteCategory).toHaveBeenCalledWith('cat_helmet'))
  })

  it('không xóa gì khi hủy hộp xác nhận dù đã lấy được số liệu', async () => {
    const user = userEvent.setup()
    renderScreen({ items: [{ ...helmet, deleted: true, isVisible: false }] })

    await openTrashRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: /Xóa vĩnh viễn/ }))

    await waitFor(() => expect(mocks.showConfirm).toHaveBeenCalled())
    expect(mocks.hardDeleteCategory).not.toHaveBeenCalled()
  })

  it('báo lỗi và không hỏi xác nhận khi không lấy được số liệu ảnh hưởng', async () => {
    const user = userEvent.setup()
    mocks.previewCategoryPermanentDelete.mockRejectedValue(new Error('Không tải được số liệu.'))
    renderScreen({ items: [{ ...helmet, deleted: true, isVisible: false }] })

    await openTrashRowMenu(user)
    await user.click(await screen.findByRole('menuitem', { name: /Xóa vĩnh viễn/ }))

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('Không tải được số liệu.'))
    expect(mocks.showConfirm).not.toHaveBeenCalled()
    expect(mocks.hardDeleteCategory).not.toHaveBeenCalled()
  })
})
