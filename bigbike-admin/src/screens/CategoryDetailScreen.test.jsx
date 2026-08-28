import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategoryDetailScreen } from './CategoryDetailScreen'
import { buildEmptyForm } from './category-detail/constants'
import { createCategorySchema, zodErrors } from '../lib/schemas'

const t = (key, values = {}) => {
  if (values && typeof values === 'object' && 'defaultValue' in values) {
    return String(values.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
  }
  return key
}

// CATEGORY_RULE_001 + TRANSLATION_RULE_002: danh mục có bản dịch tiếng Anh THẬT, và
// riêng TÊN là bắt buộc cả 2 ngôn ngữ — khác Thương hiệu (tên/slug dùng chung 1 giá trị).
describe('createCategorySchema — song ngữ thật của Danh mục', () => {
  const base = () => ({ ...buildEmptyForm(), slug: 'mu-bao-hiem', name: 'Mũ bảo hiểm' })

  it('chặn lưu khi thiếu tên tiếng Anh lúc tạo mới', () => {
    const result = createCategorySchema(t, true).safeParse(base())
    expect(result.success).toBe(false)
    expect(zodErrors(result)).toHaveProperty('translations.en.name')
  })

  it('cho lưu khi có đủ tên tiếng Việt và tiếng Anh', () => {
    const form = base()
    form.translations.en.name = 'Helmets'
    expect(createCategorySchema(t, true).safeParse(form).success).toBe(true)
  })

  it('không đòi đường dẫn tiếng Anh — slugEn là tùy chọn', () => {
    const form = base()
    form.translations.en.name = 'Helmets'
    form.translations.en.slug = ''
    expect(createCategorySchema(t, true).safeParse(form).success).toBe(true)
  })

  it('chặn đường dẫn tiếng Anh sai định dạng nếu admin có nhập', () => {
    const form = base()
    form.translations.en.name = 'Helmets'
    form.translations.en.slug = 'Sai Dinh Dang!!!'
    const result = createCategorySchema(t, true).safeParse(form)
    expect(result.success).toBe(false)
    expect(zodErrors(result)).toHaveProperty('translations.en.slug')
  })
})

const mocks = vi.hoisted(() => ({
  fetchCategoryDetail: vi.fn(),
  fetchCategoryTree: vi.fn(),
  fetchProducts: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  restoreCategory: vi.fn(),
  hardDeleteCategory: vi.fn(),
  previewCategoryPermanentDelete: vi.fn(),
  mapValidationErrors: vi.fn(() => ({})),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchCategoryDetail: mocks.fetchCategoryDetail,
  fetchCategoryTree: mocks.fetchCategoryTree,
  fetchProducts: mocks.fetchProducts,
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  restoreCategory: mocks.restoreCategory,
  hardDeleteCategory: mocks.hardDeleteCategory,
  previewCategoryPermanentDelete: mocks.previewCategoryPermanentDelete,
  mapValidationErrors: mocks.mapValidationErrors,
}))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/navigationGuard', () => ({ clearNavGuard: vi.fn() }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('./category-detail/IntroContentField', () => ({
  IntroContentField: ({ value, onChange, disabled }) => (
    <textarea
      data-testid="intro-content"
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
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
  showOnHomepage: false,
  parentId: null,
  updatedAt: '2026-07-25T00:00:00Z',
  translations: { en: { name: 'Helmets' } },
}

function renderScreen({ item = helmet, canUpdate = true, treeItems = [item] } = {}) {
  mocks.fetchCategoryDetail.mockResolvedValue({ item })
  mocks.fetchCategoryTree.mockResolvedValue({ items: treeItems })
  mocks.fetchProducts.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <CategoryDetailScreen categoryId={item.id} navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

/** Ô nhập tên danh mục — ô chữ đầu tiên trong form. */
async function nameInput() {
  return waitFor(() => {
    const input = document.querySelector('#category-form input:not([type="checkbox"])')
    expect(input).toBeTruthy()
    return input
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.showConfirm.mockResolvedValue(true)
})

describe('CategoryDetailScreen — khóa ghi theo trạng thái', () => {
  it('khóa toàn bộ form với danh mục hệ thống "Chưa phân loại"', async () => {
    renderScreen({
      item: { ...helmet, id: 'uncategorized', slug: 'uncategorized', name: 'Chưa phân loại' },
    })

    expect(await nameInput()).toBeDisabled()
  })

  it('vẫn lưu được danh mục cũ có ảnh không vuông khi chỉ sửa tên', async () => {
    const user = userEvent.setup()
    const item = {
      ...helmet,
      image: { url: '/media/old-category.jpg', width: 39, height: 60, mimeType: 'image/jpeg' },
    }
    mocks.updateCategory.mockResolvedValue({ item: { ...item, name: 'Tên mới' } })
    renderScreen({ item })

    const input = await nameInput()
    await user.clear(input)
    await user.type(input, 'Tên mới')
    await user.click(screen.getByRole('button', { name: 'categories.detail.saveBtn' }))

    await waitFor(() => expect(mocks.updateCategory).toHaveBeenCalled())
    expect(mocks.updateCategory.mock.calls[0][1].image).toMatchObject({
      url: '/media/old-category.jpg',
      width: 39,
      height: 60,
    })
  })

  it('khóa toàn bộ form khi danh mục đang ở Thùng rác', async () => {
    renderScreen({ item: { ...helmet, deleted: true, isVisible: false } })

    expect(await nameInput()).toBeDisabled()
  })

  it('khóa toàn bộ form khi chỉ có quyền xem', async () => {
    renderScreen({ canUpdate: false })

    expect(await nameInput()).toBeDisabled()
  })

  it('cho sửa bình thường với danh mục đang hoạt động và có quyền cập nhật', async () => {
    renderScreen()

    expect(await nameInput()).toBeEnabled()
  })

  it('ẩn biểu tượng menu và loại biểu tượng khỏi chỉ số ảnh của danh mục con', async () => {
    const parent = { id: 'cat_parent', name: 'Danh mục cha', parentId: null }
    const item = { ...helmet, parentId: parent.id, menuIconUrl: '/media/stale-menu.svg' }
    renderScreen({ item, treeItems: [parent, item] })

    await nameInput()
    expect(document.querySelector('[data-field="menuIconUrl"]')).toBeNull()
    expect(screen.getByText('0/4')).toBeInTheDocument()
  })

  it('ẩn và hiện lại ô biểu tượng ngay khi đổi danh mục cha', async () => {
    const user = userEvent.setup()
    const parent = { id: 'cat_parent', name: 'Danh mục cha', parentId: null }
    const item = { ...helmet, menuIconUrl: '/media/menu.svg' }
    renderScreen({ item, treeItems: [item, parent] })

    await nameInput()
    expect(document.querySelector('[data-field="menuIconUrl"]')).toBeInTheDocument()
    expect(screen.getByText('1/5')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'Danh mục cha' }))

    expect(document.querySelector('[data-field="menuIconUrl"]')).toBeNull()
    expect(screen.getByText('0/4')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'categories.detail.parentIdNone' }))

    expect(document.querySelector('[data-field="menuIconUrl"]')).toBeInTheDocument()
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('báo lỗi có nút thử lại khi không tải được danh mục', async () => {
    mocks.fetchCategoryDetail.mockRejectedValue(new Error('Mất kết nối.'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <CategoryDetailScreen categoryId="cat_helmet" navigate={vi.fn()} canUpdate />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Mất kết nối.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})
