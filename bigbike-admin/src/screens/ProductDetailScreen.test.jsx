import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductDetailScreen } from './ProductDetailScreen'

const mocks = vi.hoisted(() => ({
  fetchProductDetail: vi.fn(),
  fetchBrands: vi.fn(),
  fetchCategoryTree: vi.fn(),
  fetchProductAssignment: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  previewProduct: vi.fn(),
  mapValidationErrors: vi.fn(() => ({})),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name)),
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchProductDetail: mocks.fetchProductDetail,
  fetchBrands: mocks.fetchBrands,
  fetchCategoryTree: mocks.fetchCategoryTree,
  fetchProductAssignment: mocks.fetchProductAssignment,
  createProduct: mocks.createProduct,
  updateProduct: mocks.updateProduct,
  previewProduct: mocks.previewProduct,
  mapValidationErrors: mocks.mapValidationErrors,
}))

vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn() }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/navigationGuard', () => ({ clearNavGuard: vi.fn() }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../lib/contentLang', () => ({
  useContentLang: () => 'vi',
  setContentLang: vi.fn(),
  overlayEnNames: (items) => items ?? [],
}))
vi.mock('../lib/useProductPicker', () => ({
  useProductPicker: () => ({
    search: '',
    setSearch: vi.fn(),
    debouncedSearch: '',
    items: [],
    isFetching: false,
    reset: vi.fn(),
  }),
}))
vi.mock('../lib/useAdminPresence', () => ({
  useAdminPresence: () => ({ hasOtherAdmin: false }),
}))
vi.mock('../components/AdminShell', () => ({ useAutoHideSidebar: () => {} }))

vi.mock('../components/ImageUrlInput', () => ({ ImageUrlInput: () => null }))
vi.mock('../components/ProductPickerCombobox', () => ({ ProductPickerCombobox: () => null }))
vi.mock('./product-detail/BrandCombobox', () => ({
  BrandCombobox: ({ displayLabel }) => <span>{displayLabel}</span>,
}))
vi.mock('../components/RichTextEditor', () => ({ RichTextEditor: () => null }))
vi.mock('../components/BlockEditor', () => ({ BlockEditor: () => null }))
vi.mock('../components/block-editor/blocks', () => ({
  SuitabilityBlockEditor: () => null,
  SizeGuideBlockEditor: () => null,
}))
vi.mock('../components/Sortable', () => ({ SortableList: () => null }))
vi.mock('../components/LivePreview', () => ({ LivePreview: () => null }))
vi.mock('./product-detail/ContentEditors', () => ({
  GalleryEditor: () => null,
  VideoEditor: () => null,
  SpecificationsEditor: () => null,
  HighlightsEditor: () => null,
  HighlightsHtmlEditor: () => null,
  FaqEditor: () => null,
}))
vi.mock('./product-detail/RowEditors', () => ({
  CommitmentEditor: () => null,
  SpecStatEditor: () => null,
  TrustBadgesEditor: () => null,
}))
vi.mock('./product-detail/VariantEditors', () => ({
  VariantsEditor: () => null,
  VariantMatrixWizard: () => null,
}))
vi.mock('./product-detail/Layout', () => ({
  RelatedProductRow: () => null,
  RoleBadge: () => null,
  AssignmentBanner: () => null,
}))
vi.mock('../components/SectionCard', () => ({
  SectionCard: ({ title, children }) => <section><h2>{title}</h2>{children}</section>,
}))
vi.mock('@/components/CollapsibleSection', () => ({
  CollapsibleSection: ({ title, children }) => <section><h2>{title}</h2>{children}</section>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }) => <div>{children}</div>,
  PopoverTrigger: ({ children }) => <>{children}</>,
  PopoverContent: ({ children }) => <div>{children}</div>,
}))
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ children }) => <span>{children}</span>,
}))
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, disabled }) => <input type="checkbox" checked={Boolean(checked)} disabled={disabled} readOnly />,
}))
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, disabled }) => <input type="checkbox" checked={Boolean(checked)} disabled={disabled} readOnly />,
}))
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }) => <div>{children}</div>,
  TabsList: ({ children }) => <div>{children}</div>,
  TabsTrigger: ({ children }) => <button type="button">{children}</button>,
}))

const product = {
  id: 'product-1',
  sku: 'AGV-K1S',
  slug: 'mu-agv-k1s',
  name: 'Mũ AGV K1S',
  shortDescription: 'Mũ fullface đạt chuẩn ECE 22.06.',
  description: '',
  brandId: 'brand-agv',
  brand: { id: 'brand-agv', name: 'AGV', slug: 'agv' },
  categories: [{ id: 'helmet', name: 'Mũ bảo hiểm', slug: 'helmet', visible: true, deleted: false }],
  price: { retailPrice: 5900000, salePrice: 5500000 },
  available: true,
  publishStatus: 'DRAFT',
  gender: 'Unisex',
  image: {
    rawUrl: '/media/product-main.jpg',
    alt: 'Mũ AGV K1S màu đen',
    width: 1200,
    height: 1200,
    mimeType: 'image/jpeg',
  },
  seo: {
    title: 'Mũ AGV K1S',
    description: 'Mô tả SEO cho mũ AGV K1S',
    ogImage: {
      rawUrl: '/media/product-og.png',
      alt: 'Ảnh chia sẻ AGV K1S',
      width: 1200,
      height: 630,
      mimeType: 'image/png',
    },
  },
  gallery: [{
    mediaType: 'image',
    rawUrl: '/media/gallery-1.webp',
    alt: 'Mặt trước mũ',
    width: 1600,
    height: 1200,
    mimeType: 'image/webp',
  }],
  variants: [],
  translations: { en: { name: 'AGV K1S Helmet' } },
  updatedAt: '2026-07-28T00:00:00Z',
}

function renderScreen({ canUpdate = true } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const navigate = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ProductDetailScreen
        productId={product.id}
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
  mocks.fetchProductDetail.mockResolvedValue({ item: product })
  mocks.fetchBrands.mockResolvedValue({ items: [product.brand] })
  mocks.fetchCategoryTree.mockResolvedValue({ items: product.categories })
  mocks.fetchProductAssignment.mockResolvedValue({})
  mocks.updateProduct.mockImplementation(async (_id, payload) => ({
    item: { ...product, name: payload.name },
  }))
})

describe('ProductDetailScreen', () => {
  it('ẩn Xem trước và khóa form khi tài khoản chỉ có quyền đọc', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('products.detail.permissionDesc')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'products.detail.preview.open' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Mũ AGV K1S')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.detail.saveDraft' })).toBeDisabled()
  })

  it('giữ metadata ảnh trong PATCH khi chỉ sửa tên sản phẩm', async () => {
    const user = userEvent.setup()
    renderScreen()

    const nameInput = await screen.findByDisplayValue('Mũ AGV K1S')
    await user.clear(nameInput)
    await user.type(nameInput, 'Mũ AGV K1S mới')
    await user.click(screen.getByRole('button', { name: 'products.detail.saveDraft' }))

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledTimes(1))
    const payload = mocks.updateProduct.mock.calls[0][1]
    expect(payload.image).toEqual({
      url: '/media/product-main.jpg',
      alt: 'Mũ AGV K1S màu đen',
      width: 1200,
      height: 1200,
      mimeType: 'image/jpeg',
    })
    expect(payload.seo.ogImage).toEqual({
      url: '/media/product-og.png',
      alt: 'Ảnh chia sẻ AGV K1S',
      width: 1200,
      height: 630,
      mimeType: 'image/png',
    })
    expect(payload.gallery[0]).toEqual(expect.objectContaining({
      url: '/media/gallery-1.webp',
      alt: 'Mặt trước mũ',
      width: 1600,
      height: 1200,
      mimeType: 'image/webp',
    }))
  })

  it('hiển thị trạng thái không tìm thấy riêng cho lỗi 404', async () => {
    const error = Object.assign(new Error('Not found'), { status: 404 })
    mocks.fetchProductDetail.mockRejectedValue(error)

    renderScreen()

    expect(await screen.findByText('products.detail.notFound')).toBeInTheDocument()
    expect(screen.getByText('products.detail.notFoundDesc')).toBeInTheDocument()
  })
})
