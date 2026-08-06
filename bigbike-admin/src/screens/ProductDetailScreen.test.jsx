import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductDetailScreen } from './ProductDetailScreen'
import { normalizeProduct } from '../lib/contracts'

const mocks = vi.hoisted(() => ({
  fetchProductDetail: vi.fn(),
  fetchBrands: vi.fn(),
  fetchCategoryTree: vi.fn(),
  fetchProductAssignment: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  publishProduct: vi.fn(),
  previewProduct: vi.fn(),
  mapValidationErrors: vi.fn(() => ({})),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  // Ngôn ngữ nội dung đang xem (VI/EN). Đổi được để test nhánh tiếng Anh — trước đây
  // bị khoá cứng 'vi' nên toàn bộ nhánh EN của màn hình chưa từng được kiểm.
  contentLang: 'vi',
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
  publishProduct: mocks.publishProduct,
  previewProduct: mocks.previewProduct,
  mapValidationErrors: mocks.mapValidationErrors,
}))

vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/navigationGuard', () => ({ clearNavGuard: vi.fn() }))
vi.mock('../lib/useRecentItems', () => ({ recordRecentItem: vi.fn() }))
vi.mock('../lib/contentLang', () => ({
  useContentLang: () => mocks.contentLang,
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
  mocks.contentLang = 'vi'
  mocks.fetchProductDetail.mockResolvedValue({ item: product })
  mocks.fetchBrands.mockResolvedValue({ items: [product.brand] })
  mocks.fetchCategoryTree.mockResolvedValue({ items: product.categories })
  mocks.fetchProductAssignment.mockResolvedValue({})
  mocks.publishProduct.mockImplementation(async (_id, publishStatus) => ({
    item: { ...product, publishStatus },
  }))
  mocks.showConfirm.mockResolvedValue(true)
  mocks.updateProduct.mockImplementation(async (_id, payload) => ({
    item: { ...product, name: payload.name },
  }))
})

describe('ProductDetailScreen', () => {
  it('ẩn Xem trước và khóa form khi tài khoản chỉ có quyền đọc', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('products.detail.permissionDesc')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'products.detail.preview.open' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'products.publishAction' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Mũ AGV K1S')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'products.detail.saveDraft' })).toBeDisabled()
  })

  it('xuất bản DRAFT bằng checklist và cập nhật badge ngay trên trang', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'products.publishAction' }))
    await user.click(screen.getByRole('button', { name: 'products.detail.checklist.publishNow' }))

    await waitFor(() => {
      expect(mocks.publishProduct).toHaveBeenCalledWith(product.id, 'PUBLISHED')
    })
    expect(await screen.findByText('status.publish.PUBLISHED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'products.unpublishAction' })).toBeInTheDocument()
    expect(mocks.toast.success).toHaveBeenCalledWith('products.publishToggleSuccess')
  })

  it('chặn xuất bản khi checklist còn blocker', async () => {
    const user = userEvent.setup()
    mocks.fetchProductDetail.mockResolvedValue({
      item: { ...product, image: null },
    })
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'products.publishAction' }))

    expect(screen.getByText('products.detail.checklist.image')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'products.detail.checklist.publishNow' })).not.toBeInTheDocument()
    expect(mocks.publishProduct).not.toHaveBeenCalled()
  })

  it('xác nhận trước khi chuyển PUBLISHED về DRAFT và cập nhật badge tại chỗ', async () => {
    const user = userEvent.setup()
    const publishedProduct = { ...product, publishStatus: 'PUBLISHED' }
    mocks.fetchProductDetail.mockResolvedValue({ item: publishedProduct })
    mocks.publishProduct.mockResolvedValue({
      item: { ...publishedProduct, publishStatus: 'DRAFT' },
    })
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'products.unpublishAction' }))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'products.detail.unpublishConfirm',
      'products.detail.unpublishConfirmTitle',
      expect.objectContaining({ confirmLabel: 'products.unpublishAction' }),
    )
    await waitFor(() => {
      expect(mocks.publishProduct).toHaveBeenCalledWith(product.id, 'DRAFT')
    })
    expect(await screen.findByText('status.publish.DRAFT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'products.publishAction' })).toBeInTheDocument()
  })

  it('khóa đổi trạng thái khi form dirty và giữ nguyên nội dung đang sửa', async () => {
    const user = userEvent.setup()
    renderScreen()

    const nameInput = await screen.findByDisplayValue('Mũ AGV K1S')
    await user.clear(nameInput)
    await user.type(nameInput, 'Tên đang sửa chưa lưu')

    const publishButton = screen.getByRole('button', { name: 'products.publishAction' })
    expect(publishButton).toBeDisabled()
    expect(publishButton).toHaveAttribute('title', 'products.detail.publishRequiresSavedForm')
    expect(nameInput).toHaveValue('Tên đang sửa chưa lưu')
    expect(mocks.publishProduct).not.toHaveBeenCalled()
  })

  it('không hiện toggle cho TRASH và giữ nguyên flow khôi phục hiện có', async () => {
    const user = userEvent.setup()
    mocks.fetchProductDetail.mockResolvedValue({
      item: { ...product, publishStatus: 'TRASH' },
    })
    renderScreen()

    const nameInput = await screen.findByDisplayValue('Mũ AGV K1S')
    expect(screen.queryByRole('button', { name: 'products.publishAction' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'products.unpublishAction' })).not.toBeInTheDocument()

    await user.type(nameInput, ' cập nhật')
    await user.click(screen.getByRole('button', { name: 'products.detail.restoreAndSave' }))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'products.detail.restoreAndSaveConfirm',
      'products.detail.restoreAndSaveConfirmTitle',
      expect.objectContaining({ confirmLabel: 'products.detail.restoreAndSave' }),
    )
    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledTimes(1))
    expect(mocks.updateProduct.mock.calls[0][1]).toEqual(
      expect.objectContaining({ publishStatus: 'DRAFT' }),
    )
    expect(mocks.publishProduct).not.toHaveBeenCalled()
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

/**
 * Regression 2026-08-06 — đường dẫn tiếng Anh biến mất khỏi màn hình sửa sản phẩm.
 *
 * Dữ liệu giả ở đây đi qua `normalizeProduct` THẬT (giống adminApi.fetchProductDetail/
 * updateProduct chạy `parseDetailPayload(payload, normalizeProduct)`), nên bộ test này
 * canh đúng chuỗi thật: API → normalize → form → payload → form sau khi lưu.
 */
describe('ProductDetailScreen — đường dẫn tiếng Anh (tab EN)', () => {
  const VI_SLUG = 'mu-agv-k1s'
  const EN_SLUG = 'agv-k1s-fullface-helmet'

  // Backend giả: nhận translations.en.slug khi ghi, trả lại ở top-level slugEn khi đọc —
  // đúng bất đối xứng của hợp đồng API (ProductTranslationRequest vs Product record).
  function serve(rawItem) {
    mocks.fetchProductDetail.mockResolvedValue({ item: normalizeProduct(rawItem) })
    mocks.updateProduct.mockImplementation(async (_id, payload) => ({
      item: normalizeProduct({
        ...rawItem,
        name: payload.name,
        slug: payload.slug,
        slugEn: payload.translations?.en?.slug ?? null,
      }),
    }))
  }

  const withEnSlug = { ...product, slugEn: EN_SLUG }

  async function renderEn(rawItem) {
    serve(rawItem)
    mocks.contentLang = 'en'
    const user = userEvent.setup()
    renderScreen()
    const slugInput = await screen.findByLabelText('products.detail.slug')
    return { user, slugInput }
  }

  it('chuyển sang tab tiếng Anh: ô Đường dẫn hiện slug EN đã lưu, không để trống', async () => {
    const { slugInput } = await renderEn(withEnSlug)
    expect(slugInput).toHaveValue(EN_SLUG)
  })

  it('sản phẩm chưa có slug EN thì ô để trống, không mượn slug tiếng Việt', async () => {
    const { slugInput } = await renderEn(product)
    expect(slugInput).toHaveValue('')
  })

  it('nhập slug EN thì payload gửi qua translations.en.slug, slug tiếng Việt giữ nguyên', async () => {
    const { user, slugInput } = await renderEn(product)

    await user.clear(slugInput)
    await user.type(slugInput, EN_SLUG)
    await user.click(screen.getByRole('button', { name: 'products.detail.saveDraft' }))

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledTimes(1))
    const payload = mocks.updateProduct.mock.calls[0][1]
    expect(payload.translations.en.slug).toBe(EN_SLUG)
    expect(payload.slug).toBe(VI_SLUG)
  })

  it('lưu xong ô vẫn giữ slug EN mới, KHÔNG bị reset về trống', async () => {
    const { user, slugInput } = await renderEn(product)

    await user.clear(slugInput)
    await user.type(slugInput, EN_SLUG)
    await user.click(screen.getByRole('button', { name: 'products.detail.saveDraft' }))

    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('products.detail.successUpdate'))
    expect(await screen.findByLabelText('products.detail.slug')).toHaveValue(EN_SLUG)
  })

  it('sửa ô khác ở tab tiếng Việt rồi lưu thì KHÔNG xoá mất slug EN đã lưu', async () => {
    // Đây là đường mất dữ liệu âm thầm: admin chỉ sửa tên tiếng Việt, không đụng tab EN.
    // Trước khi sửa lỗi, form nạp slug EN rỗng nên payload xoá trắng slug_en trong DB.
    serve(withEnSlug)
    const user = userEvent.setup()
    renderScreen()

    const nameInput = await screen.findByDisplayValue('Mũ AGV K1S')
    await user.clear(nameInput)
    await user.type(nameInput, 'Mũ AGV K1S 2026')
    await user.click(screen.getByRole('button', { name: 'products.detail.saveDraft' }))

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledTimes(1))
    expect(mocks.updateProduct.mock.calls[0][1].translations.en.slug).toBe(EN_SLUG)
  })

  it('ô trống: gõ tên tiếng Anh thì tự gợi ý slug EN', async () => {
    const { user, slugInput } = await renderEn(product)

    const nameInput = screen.getByLabelText(/^products\.detail\.name/)
    await user.clear(nameInput)
    await user.type(nameInput, 'AGV K1S Helmet')

    expect(slugInput).toHaveValue('agv-k1s-helmet')
  })

  it('ô đã có giá trị: gõ tên tiếng Anh KHÔNG đè lên slug người dùng đã lưu', async () => {
    const { user, slugInput } = await renderEn(withEnSlug)

    const nameInput = screen.getByLabelText(/^products\.detail\.name/)
    await user.clear(nameInput)
    await user.type(nameInput, 'AGV K1S Helmet Renamed')

    expect(slugInput).toHaveValue(EN_SLUG)
  })

  it('sửa slug EN không làm đổi slug tiếng Việt', async () => {
    const { user, slugInput } = await renderEn(withEnSlug)

    await user.clear(slugInput)
    await user.type(slugInput, 'agv-k1s-intercom')
    await user.click(screen.getByRole('button', { name: 'products.detail.saveDraft' }))

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledTimes(1))
    const payload = mocks.updateProduct.mock.calls[0][1]
    expect(payload.translations.en.slug).toBe('agv-k1s-intercom')
    expect(payload.slug).toBe(VI_SLUG)
  })

  it('cảnh báo khi slug EN trùng slug tiếng Việt, nhưng vẫn cho lưu', async () => {
    const { user, slugInput } = await renderEn(product)

    await user.clear(slugInput)
    await user.type(slugInput, VI_SLUG)

    expect(await screen.findByText('products.detail.slugDuplicateEnVi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'products.detail.saveDraft' })).toBeEnabled()
  })
})
