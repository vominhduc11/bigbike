import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchSliders: vi.fn(),
  createSlider: vi.fn(),
  updateSlider: vi.fn(),
  deleteSlider: vi.fn(),
  reorderSliders: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, values = {}) => ({
      'common.edit': 'Sửa',
      'common.update': 'Cập nhật',
      'common.delete': 'Xoá',
      'common.cancel': 'Hủy',
      'sliders.formMobileUrl': 'Ảnh mobile',
      'sliders.formMobileUrlHint': 'Ảnh mobile tùy chọn',
      'sliders.sectionMobileImage': 'Ảnh mobile',
    }[key] || values.defaultValue || key),
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchSliders: mocks.fetchSliders,
  createSlider: mocks.createSlider,
  updateSlider: mocks.updateSlider,
  deleteSlider: mocks.deleteSlider,
  reorderSliders: mocks.reorderSliders,
}))
vi.mock('../lib/contentLang', () => ({ useContentLang: () => 'vi' }))
vi.mock('../lib/useProductPicker', () => ({
  useProductPicker: () => ({
    search: '',
    setSearch: vi.fn(),
    items: [],
    isFetching: false,
  }),
}))
vi.mock('@/lib/useUnsavedChanges', () => ({ useUnsavedChanges: () => {} }))
vi.mock('@/lib/useSaveShortcut', () => ({ useSaveShortcut: () => {} }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn().mockResolvedValue(true) }))
vi.mock('../components/ProductPickerCombobox', () => ({
  ProductPickerCombobox: ({ onPick }) => (
    <button type="button" onClick={() => onPick({ id: 'prod_1', name: 'Sản phẩm thử' })}>
      Chọn sản phẩm thử
    </button>
  ),
}))
vi.mock('../components/ReadOnlyBanner', () => ({ ReadOnlyBanner: () => null }))
vi.mock('../components/StatePanel', () => ({ StatePanel: () => null }))
vi.mock('../components/Sortable', () => ({
  SortableList: ({ items, renderItem }) => (
    <>{items.map((item) => (
      <div key={item.id}>
        {renderItem(item, {
          setNodeRef: () => {},
          style: {},
          isDragging: false,
          handleProps: {},
        })}
      </div>
    ))}</>
  ),
}))
vi.mock('../components/ImageUrlInput', () => ({
  ImageUrlInput: ({ value, onChange, alt, onAltChange, recommend }) => {
    const kind = recommend?.ratio?.[0] === 3 && recommend?.ratio?.[1] === 4 ? 'mobile' : 'desktop'
    return (
      <div data-testid={`${kind}-image-input`}>
        <input aria-label={`${kind}-url`} value={value || ''} readOnly />
        <input aria-label={`${kind}-alt`} value={alt || ''} readOnly />
        <button
          type="button"
          onClick={() => {
            onChange(`/media/sliders/${kind}-new.jpg`, {
              width: kind === 'mobile' ? 780 : 3840,
              height: kind === 'mobile' ? 1040 : 1536,
              mimeType: 'image/jpeg',
            })
            onAltChange?.(`Alt ${kind} mới`)
          }}
        >
          Chọn {kind}
        </button>
        <button
          type="button"
          onClick={() => {
            onChange('')
            onAltChange?.('')
          }}
        >
          Xoá {kind}
        </button>
      </div>
    )
  },
}))

import { SliderListScreen } from './SliderListScreen'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

const legacySlider = {
  id: 'slider-home-legacy-mobile',
  location: 'home',
  sortOrder: 0,
  desktopImage: {
    url: '/media/sliders/desktop-old.jpg',
    alt: 'Ảnh desktop cũ',
    width: 3840,
    height: 1536,
    mimeType: 'image/webp',
  },
  mobileImage: {
    url: '/media/sliders/mobile-old.jpg',
    alt: 'Ảnh mobile cũ',
    width: 780,
    height: 1040,
    mimeType: 'image/webp',
  },
  externalLink: '/sp/',
  productId: 'prod_1',
  productName: 'Sản phẩm thử',
  isActive: true,
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SliderListScreen canUpdate />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchSliders.mockResolvedValue({ items: [legacySlider] })
  mocks.createSlider.mockResolvedValue({ item: { ...legacySlider, productId: 'prod_1' } })
  mocks.updateSlider.mockResolvedValue({ item: legacySlider })
})

describe('SliderListScreen mobile image', () => {
  it('hiển thị thumbnail mobile và nạp lại đúng URL/alt khi sửa banner cũ', async () => {
    const user = userEvent.setup()
    renderScreen()

    const mobileThumbnail = await screen.findByTitle('Điện thoại')
    expect(mobileThumbnail).toHaveAttribute('src', '/media/sliders/mobile-old.jpg')

    await user.click(screen.getByRole('button', { name: 'Sửa' }))

    expect(screen.getByLabelText('mobile-url')).toHaveValue('/media/sliders/mobile-old.jpg')
    expect(screen.getByLabelText('mobile-alt')).toHaveValue('Ảnh mobile cũ')
  })

  it('đổi ảnh mobile và lưu URL/alt mới trong payload', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Sửa' }))
    await user.click(screen.getByRole('button', { name: 'Chọn mobile' }))
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => expect(mocks.updateSlider).toHaveBeenCalledWith(
      legacySlider.id,
      expect.objectContaining({
        mobileImage: {
          url: '/media/sliders/mobile-new.jpg',
          alt: 'Alt mobile mới',
          width: 780,
          height: 1040,
          mimeType: 'image/jpeg',
        },
      }),
    ))
  })

  it('giữ nguyên metadata ảnh desktop/mobile khi mở sửa rồi lưu không đổi ảnh', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Sửa' }))
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => expect(mocks.updateSlider).toHaveBeenCalledWith(
      legacySlider.id,
      expect.objectContaining({
        desktopImage: legacySlider.desktopImage,
        mobileImage: legacySlider.mobileImage,
      }),
    ))
  })

  it('gửi mobileImage null khi admin xoá ảnh mobile', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Sửa' }))
    await user.click(screen.getByRole('button', { name: 'Xoá mobile' }))
    await user.click(screen.getByRole('button', { name: 'Cập nhật' }))

    await waitFor(() => expect(mocks.updateSlider).toHaveBeenCalledWith(
      legacySlider.id,
      expect.objectContaining({ mobileImage: null }),
    ))
  })

  it('không hiển thị link ngoài của banner cũ', async () => {
    const user = userEvent.setup()
    renderScreen()

    expect(screen.queryByText('/sp/')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Sửa' }))

    expect(screen.queryByPlaceholderText('https://...')).not.toBeInTheDocument()
    expect(screen.queryByText('Link ngoài')).not.toBeInTheDocument()
  })

  it('không cho lưu khi chưa chọn sản phẩm liên kết', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'sliders.addBtn' }))
    await user.click(screen.getByRole('button', { name: 'sliders.saveBtn' }))

    expect(await screen.findByText('sliders.formProductRequired')).toBeInTheDocument()
    expect(mocks.createSlider).not.toHaveBeenCalled()
  })

  it('lưu banner mới bằng productId và không gửi externalLink', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'sliders.addBtn' }))
    await user.click(screen.getByRole('button', { name: 'Chọn sản phẩm thử' }))
    await user.click(screen.getByRole('button', { name: 'sliders.saveBtn' }))

    await waitFor(() => expect(mocks.createSlider).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod_1' }),
    ))
    expect(mocks.createSlider.mock.calls[0][0]).not.toHaveProperty('externalLink')
  })
})
