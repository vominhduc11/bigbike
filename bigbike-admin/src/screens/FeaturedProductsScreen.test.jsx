import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeaturedProductsScreen } from './FeaturedProductsScreen'
import { featuredSaveErrorMessage } from './featured-products/constants'

const t = (key, values = {}) => {
  if (values && typeof values === 'object' && 'defaultValue' in values) {
    return String(values.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(values[name] ?? name),
    )
  }
  return key
}

describe('featuredSaveErrorMessage', () => {
  const items = [
    { id: 'prod_a', name: 'Mũ LS2 FF390', sku: 'LS2-FF390' },
    { id: 'prod_b', name: 'Găng tay Hevik', sku: 'HV-GT01' },
  ]

  it('gọi tên sản phẩm bằng tiếng Việt khi sản phẩm không còn đang bán', () => {
    const message = featuredSaveErrorMessage(
      t,
      {
        details: [
          {
            field: 'featuredGrid[1]',
            code: 'NOT_PUBLISHED',
            message: "Product 'prod_b' must be PUBLISHED to appear on the homepage.",
          },
        ],
      },
      items,
    )

    expect(message).toContain('Găng tay Hevik')
    expect(message).not.toContain('prod_b')
    expect(message).not.toMatch(/PUBLISHED/)
  })

  it('gộp nhiều sản phẩm cùng lỗi thành một câu, không lặp tên', () => {
    const message = featuredSaveErrorMessage(
      t,
      {
        details: [
          { field: 'featuredGrid[0]', code: 'NOT_PUBLISHED' },
          { field: 'featuredGrid[1]', code: 'NOT_PUBLISHED' },
          { field: 'featuredGrid[1]', code: 'NOT_PUBLISHED' },
        ],
      },
      items,
    )

    expect(message).toContain('Mũ LS2 FF390, Găng tay Hevik')
  })

  it('phân biệt sản phẩm đã bị xoá với sản phẩm ngừng bán', () => {
    const message = featuredSaveErrorMessage(
      t,
      {
        details: [{ field: 'featuredGrid[0]', code: 'NOT_FOUND' }],
      },
      items,
    )

    expect(message).toContain('không còn tồn tại')
    expect(message).toContain('Mũ LS2 FF390')
  })

  it('lùi về thông báo gốc khi lỗi không thuộc 2 nguyên nhân trên', () => {
    expect(featuredSaveErrorMessage(t, { message: 'Mất kết nối mạng.' }, items)).toBe(
      'Mất kết nối mạng.',
    )
  })

  it('không vỡ khi vị trí lỗi nằm ngoài danh sách hiện tại', () => {
    const message = featuredSaveErrorMessage(
      t,
      {
        details: [{ field: 'featuredGrid[9]', code: 'NOT_PUBLISHED' }],
        message: 'Lỗi máy chủ.',
      },
      items,
    )

    expect(message).toBe('Lỗi máy chủ.')
  })
})

const mocks = vi.hoisted(() => ({
  fetchHomepageBlocks: vi.fn(),
  saveHomepageBlocks: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  showConfirm: vi.fn(),
  pickerItems: [],
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t }),
}))
vi.mock('../lib/adminApi', () => ({
  fetchHomepageBlocks: mocks.fetchHomepageBlocks,
  saveHomepageBlocks: mocks.saveHomepageBlocks,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/navigationGuard', () => ({ clearNavGuard: vi.fn() }))
vi.mock('../lib/useProductPicker', () => ({
  useProductPicker: () => ({
    search: '',
    setSearch: vi.fn(),
    items: mocks.pickerItems,
    isFetching: false,
    reset: vi.fn(),
  }),
}))
// dnd-kit cần API con trỏ/ResizeObserver của trình duyệt thật — thay bằng danh sách phẳng
// để kiểm thử tập trung vào dữ liệu gửi lên, không kiểm thử thư viện kéo-thả.
vi.mock('../components/Sortable', () => ({
  SortableList: ({ items, renderItem }) => (
    <div data-testid="featured-list">
      {items.map((item) => (
        <div key={item.id}>{renderItem(item, null)}</div>
      ))}
    </div>
  ),
}))

const published = (index) => ({
  id: `prod_${index}`,
  name: `Sản phẩm ${index}`,
  sku: `SKU-${index}`,
  image: { url: `/media/products/${index}.jpg`, alt: `Ảnh ${index}` },
})

function renderScreen({ canUpdate = true, grid = [published(1), published(2)] } = {}) {
  mocks.fetchHomepageBlocks.mockResolvedValue({ featuredGrid: grid })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <FeaturedProductsScreen canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pickerItems = []
  mocks.saveHomepageBlocks.mockResolvedValue({})
})

describe('FeaturedProductsScreen', () => {
  it('hiện danh sách đã lưu và số lượng trên tổng tối đa', async () => {
    renderScreen()

    expect(await screen.findByText('Sản phẩm 1')).toBeInTheDocument()
    expect(screen.getByText('2 / 12')).toBeInTheDocument()
  })

  it('khóa nút Lưu khi chưa có thay đổi nào', async () => {
    renderScreen()

    await screen.findByText('Sản phẩm 1')
    expect(screen.getByRole('button', { name: 'featuredProducts.saveButton' })).toBeDisabled()
  })

  it('gửi đúng danh sách mã sản phẩm theo thứ tự sau khi bỏ một sản phẩm', async () => {
    const user = userEvent.setup()
    renderScreen({ grid: [published(1), published(2), published(3)] })

    await screen.findByText('Sản phẩm 2')
    await user.click(screen.getAllByRole('button', { name: 'Xoá khỏi danh sách' })[1])

    const saveButton = screen.getByRole('button', { name: 'featuredProducts.saveButton' })
    await waitFor(() => expect(saveButton).toBeEnabled())
    await user.click(saveButton)

    await waitFor(() => expect(mocks.saveHomepageBlocks).toHaveBeenCalledWith(['prod_1', 'prod_3']))
  })

  it('hiện trạng thái trống khi chưa chọn sản phẩm nào', async () => {
    renderScreen({ grid: [] })

    expect(await screen.findByText('Chưa có sản phẩm nổi bật')).toBeInTheDocument()
    expect(screen.getByText('0 / 12')).toBeInTheDocument()
  })

  it('báo lỗi có nút thử lại khi không tải được danh sách', async () => {
    mocks.fetchHomepageBlocks.mockRejectedValue(new Error('Mất kết nối.'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <FeaturedProductsScreen canUpdate />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Mất kết nối.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument()
  })

  it('chặn thêm quá 12 sản phẩm và không hiện ô tìm sản phẩm khi đã đầy', async () => {
    const full = Array.from({ length: 12 }, (_, index) => published(index + 1))
    renderScreen({ grid: full })

    await screen.findByText('Sản phẩm 12')
    expect(screen.getByText('12 / 12')).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('featuredProducts.searchPlaceholder'),
    ).not.toBeInTheDocument()
  })

  it('cảnh báo ngay sản phẩm đã ngừng bán còn nằm trong danh sách nổi bật', async () => {
    renderScreen({
      grid: [
        { ...published(1), publishStatus: 'PUBLISHED' },
        { ...published(2), publishStatus: 'DRAFT' },
      ],
    })

    await screen.findByText('Sản phẩm 2')
    const warning = await screen.findByText(/không còn đang bán nên không hiện trên trang chủ/)
    expect(warning).toHaveTextContent('Sản phẩm 2')
    expect(warning).not.toHaveTextContent('Sản phẩm 1')
    expect(screen.getByText('status.publish.DRAFT')).toBeInTheDocument()
  })

  it('không cảnh báo khi mọi sản phẩm trong danh sách đều đang bán', async () => {
    renderScreen({
      grid: [
        { ...published(1), publishStatus: 'PUBLISHED' },
        { ...published(2), publishStatus: 'PUBLISHED' },
      ],
    })

    await screen.findByText('Sản phẩm 2')
    expect(screen.queryByText('status.publish.DRAFT')).not.toBeInTheDocument()
    expect(screen.queryByText(/không còn đang bán/)).not.toBeInTheDocument()
  })

  it('đổi thông báo lỗi của máy chủ thành câu tiếng Việt gọi tên sản phẩm khi lưu thất bại', async () => {
    const user = userEvent.setup()
    const apiError = new Error("Product 'prod_2' must be PUBLISHED to appear on the homepage.")
    apiError.details = [{ field: 'featuredGrid[1]', code: 'NOT_PUBLISHED' }]
    mocks.saveHomepageBlocks.mockRejectedValue(apiError)
    renderScreen({ grid: [published(1), published(2), published(3)] })

    await screen.findByText('Sản phẩm 3')
    await user.click(screen.getAllByRole('button', { name: 'Xoá khỏi danh sách' })[2])
    const saveButton = screen.getByRole('button', { name: 'featuredProducts.saveButton' })
    await waitFor(() => expect(saveButton).toBeEnabled())
    await user.click(saveButton)

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled())
    const message = mocks.toast.error.mock.calls.at(-1)[0]
    expect(message).toContain('Sản phẩm 2')
    expect(message).not.toMatch(/PUBLISHED/)
  })
})
