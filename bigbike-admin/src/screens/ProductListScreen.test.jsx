import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductListScreen } from './ProductListScreen'

const mocks = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  fetchBrands: vi.fn(),
  fetchCategoryTree: vi.fn(),
  fetchProductDetail: vi.fn(),
  publishProduct: vi.fn(),
  exportProductJson: vi.fn(),
  exportFullProductCatalogCsv: vi.fn(),
  restoreProduct: vi.fn(),
  softDeleteProduct: vi.fn(),
  permanentDeleteProduct: vi.fn(),
  canExport: true,
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))

vi.mock('@/lib/auth', () => ({
  useHasPermission: () => () => mocks.canExport,
}))

vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))

vi.mock('../lib/adminApi', () => ({
  ApiClientError: class ApiClientError extends Error {},
  fetchProducts: mocks.fetchProducts,
  fetchBrands: mocks.fetchBrands,
  fetchCategoryTree: mocks.fetchCategoryTree,
  fetchProductDetail: mocks.fetchProductDetail,
  publishProduct: mocks.publishProduct,
  exportProductJson: mocks.exportProductJson,
  exportFullProductCatalogCsv: mocks.exportFullProductCatalogCsv,
  restoreProduct: mocks.restoreProduct,
  softDeleteProduct: mocks.softDeleteProduct,
  permanentDeleteProduct: mocks.permanentDeleteProduct,
}))

vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/useRecentItems', () => ({ useRecentItems: () => [] }))
vi.mock('@/components/ImportProductsDialog', () => ({ ImportProductsDialog: () => null }))
vi.mock('./product-detail/Modals', () => ({ PublishChecklistModal: () => null }))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }) => <>{children}</>,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled }) => (
    <button type="button" disabled={disabled} onClick={onSelect}>{children}</button>
  ),
  DropdownMenuCheckboxItem: ({ children, disabled }) => (
    <button type="button" disabled={disabled}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns, mobileCard }) => {
    const row = rows[0]
    if (!row) return <div data-testid="product-table" />
    const actionColumn = columns.find((column) => column.key === 'actions')
    const dataColumns = columns.filter((column) => column.key !== 'actions')
    const card = mobileCard(row)
    return (
      <div data-testid="product-table">
        <div data-testid="desktop-cells">
          {dataColumns.map((column) => (
            <div key={column.key}>{column.render ? column.render(row) : row[column.key]}</div>
          ))}
        </div>
        <div data-testid="desktop-actions">{actionColumn.render(row)}</div>
        <div data-testid="mobile-meta">
          {card.meta.map((entry) => <div key={entry.label}>{entry.value}</div>)}
        </div>
        <div data-testid="mobile-actions">{card.actions}</div>
      </div>
    )
  },
}))

const product = {
  id: 'product-1',
  name: 'Mũ AGV K1S',
  sku: '',
  publishStatus: 'DRAFT',
  stockState: 'IN_STOCK',
  price: { retailPrice: 5900000, salePrice: null },
  category: null,
  brand: { id: 'brand-agv', name: 'AGV' },
  homepageBlock: 'NONE',
  updatedAt: '2026-07-28T00:00:00Z',
}

function productResponse(page = 1, overrides = {}) {
  return {
    items: [product],
    pagination: { page, pageSize: 20, totalItems: 1, totalPages: 1 },
    ...overrides,
  }
}

function renderScreen(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ProductListScreen navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return { navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.canExport = true
  window.history.replaceState({}, '', '/admin/products')
  localStorage.clear()
  mocks.fetchProducts.mockResolvedValue(productResponse())
  mocks.fetchBrands.mockResolvedValue({ items: [] })
  mocks.fetchCategoryTree.mockResolvedValue({ items: [] })
  mocks.fetchProductDetail.mockResolvedValue({ item: product })
  mocks.publishProduct.mockResolvedValue({ item: product })
  mocks.exportProductJson.mockResolvedValue(undefined)
})

describe('ProductListScreen', () => {
  it('dùng hành động Xem ở chế độ chỉ đọc và hiển thị rõ dữ liệu chưa phân loại', async () => {
    renderScreen(false)

    expect(await screen.findByText('products.readOnly')).toBeInTheDocument()
    await screen.findByTestId('desktop-actions')
    expect(screen.getAllByText('products.uncategorized').length).toBeGreaterThan(0)
    expect(screen.getAllByText('products.skuFallback').length).toBeGreaterThan(0)

    for (const testId of ['desktop-actions', 'mobile-actions']) {
      const actions = within(screen.getByTestId(testId))
      const viewButton = actions.getByRole('button', { name: 'common.view' })
      expect(viewButton).toHaveClass('min-h-11', 'min-w-11')
      expect(actions.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument()
      expect(actions.queryByRole('button', { name: 'products.publishAction' })).not.toBeInTheDocument()
      expect(actions.queryByRole('button', { name: 'products.exportJson' })).not.toBeInTheDocument()
    }
  })

  it('giữ publish toggle và xuất JSON đồng nhất trên desktop lẫn mobile với vùng chạm 44px', async () => {
    renderScreen(true)
    await screen.findByTestId('desktop-actions')

    for (const testId of ['desktop-actions', 'mobile-actions']) {
      const actions = within(screen.getByTestId(testId))
      expect(actions.getByRole('button', { name: 'products.publishAction' }))
        .toHaveClass('min-h-11', 'min-w-11')
      expect(actions.getByRole('button', { name: 'products.exportJson' })).toBeInTheDocument()
    }
  })

  it('tự đưa trang vượt quá tổng số trang về trang cuối hợp lệ', async () => {
    window.history.replaceState({}, '', '/admin/products?page=3')
    mocks.fetchProducts.mockImplementation(async (query) => (
      query.page === 3
        ? productResponse(3, { items: [], pagination: { page: 3, pageSize: 20, totalItems: 1, totalPages: 1 } })
        : productResponse(1)
    ))

    renderScreen()

    await waitFor(() => {
      expect(mocks.fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
    })
    expect(window.location.search).not.toContain('page=')
  })
})
