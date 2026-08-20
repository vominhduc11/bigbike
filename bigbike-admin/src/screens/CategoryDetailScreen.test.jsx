import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategoryDetailScreen } from './CategoryDetailScreen'
import { buildEmptyForm } from './category-detail/constants'
import { createCategorySchema, zodErrors } from '../lib/schemas'

const t = (key, values = {}) => {
  if (values && typeof values === 'object' && 'defaultValue' in values) {
    return String(values.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(values[name] ?? name),
    )
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

function renderScreen({ item = helmet, canUpdate = true } = {}) {
  mocks.fetchCategoryDetail.mockResolvedValue({ item })
  mocks.fetchCategoryTree.mockResolvedValue({ items: [item] })
  mocks.fetchProducts.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 },
  })
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
