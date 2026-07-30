import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaLibraryScreen } from './MediaLibraryScreen'

// Khoá lại kết quả đợt tinh gọn 2026-07: màn Thư viện chỉ còn 4 điều khiển lọc,
// một kiểu xem (lưới), tối đa 3 nút trên mỗi thẻ ảnh, và không còn đường nào xoá
// vĩnh viễn hàng loạt ngay trên mặt tiền.

const mocks = vi.hoisted(() => ({
  fetchMedia: vi.fn(),
  fetchMediaStats: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaReferences: vi.fn(),
  deleteMedia: vi.fn(),
  hardDeleteMedia: vi.fn(),
  restoreMedia: vi.fn(),
  uploadMedia: vi.fn(),
  bulkDeleteMedia: vi.fn(),
  bulkMoveMedia: vi.fn(),
  bulkRestoreMedia: vi.fn(),
  query: {},
  setQuery: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
  // lib/formatters.js kéo theo lib/i18n.js — cần export này để module đó nạp được.
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

vi.mock('../lib/adminApi', () => ({
  fetchMedia: mocks.fetchMedia,
  fetchMediaStats: mocks.fetchMediaStats,
  fetchMediaFolders: mocks.fetchMediaFolders,
  fetchMediaReferences: mocks.fetchMediaReferences,
  deleteMedia: mocks.deleteMedia,
  hardDeleteMedia: mocks.hardDeleteMedia,
  restoreMedia: mocks.restoreMedia,
  uploadMedia: mocks.uploadMedia,
  bulkDeleteMedia: mocks.bulkDeleteMedia,
  bulkMoveMedia: mocks.bulkMoveMedia,
  bulkRestoreMedia: mocks.bulkRestoreMedia,
}))

vi.mock('@/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn().mockResolvedValue(true) }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (v) => v }))
vi.mock('../lib/useDragDropUpload', () => ({ useDragDropUpload: () => ({ isDragging: false }) }))
vi.mock('../lib/useKeyboardNav', () => ({
  useKeyboardNav: () => ({ focusIndex: -1, setFocusIndex: vi.fn() }),
}))

// useUrlSyncedState là useState + đồng bộ URL; ở test chỉ cần state thường.
vi.mock('../lib/useUrlSyncedState', async () => {
  const { useState } = await import('react')
  return { useUrlSyncedState: (initial) => useState(initial) }
})

// Sidebar thư mục và lightbox có luồng dữ liệu riêng, không thuộc phạm vi bài test này.
vi.mock('../components/MediaFolderSidebar', () => ({ MediaFolderSidebar: () => null }))
vi.mock('../components/MediaPreviewLightbox', () => ({ MediaPreviewLightbox: () => null }))
vi.mock('../lib/contracts', () => ({ resolveThumbUrl: (m) => m.publicUrl }))

const activeMedia = {
  id: 'media_1',
  filename: 'catalog/mu-bao-hiem.jpg',
  publicUrl: '/media/catalog/mu-bao-hiem.jpg',
  mimeType: 'image/jpeg',
  title: 'Mũ bảo hiểm',
  fileSize: 120_000,
  width: 800,
  height: 800,
  status: 'ACTIVE',
  usageCount: 0,
}

function listResponse(items) {
  return { items, pagination: { page: 1, pageSize: 24, totalItems: items.length, totalPages: 1 } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchMedia.mockResolvedValue(listResponse([activeMedia]))
  mocks.fetchMediaStats.mockResolvedValue({ total: 1, used: 0, unused: 1, byMimeGroup: { image: 1 } })
  mocks.fetchMediaFolders.mockResolvedValue([])
})

function renderScreen(props = {}) {
  render(<MediaLibraryScreen canUpdate canHardDelete={false} {...props} />)
}

describe('MediaLibraryScreen — thanh lọc đã tinh gọn', () => {
  it('chỉ còn 4 điều khiển lọc: tìm kiếm, loại file, tình trạng dùng, sắp xếp', async () => {
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(4) // 3 bộ lọc + số mỗi trang
  })

  it('không còn nút bộ lọc nâng cao', async () => {
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.queryByRole('button', { name: /media\.showAdvanced/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /media\.hideAdvanced/ })).not.toBeInTheDocument()
  })

  it('không còn nút chuyển kiểu xem lưới/bảng', async () => {
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /media\.viewList/ })).not.toBeInTheDocument()
  })
})

describe('MediaLibraryScreen — thao tác trên thẻ ảnh', () => {
  it('tối đa 3 nút thao tác trên thẻ ảnh đang hoạt động', async () => {
    renderScreen()
    const thumb = await screen.findByTitle('catalog/mu-bao-hiem.jpg')
    const card = thumb.closest('.medialib-card')

    const actions = within(card).getAllByRole('button')
      .filter((b) => b.classList.contains('medialib-icon-btn'))
    expect(actions).toHaveLength(3)
    expect(actions.map((b) => b.getAttribute('title')))
      .toEqual(['media.copyUrl', 'common.edit', 'common.delete'])
  })

  it('không có nút xoá vĩnh viễn trên thẻ ảnh kể cả khi có quyền', async () => {
    mocks.fetchMedia.mockResolvedValue(listResponse([{ ...activeMedia, status: 'DELETED' }]))
    renderScreen({ canHardDelete: true })
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.queryByRole('button', { name: /media\.hardDelete/ })).not.toBeInTheDocument()
  })

  it('người chỉ có quyền xem vẫn sao chép được link ảnh', async () => {
    renderScreen({ canUpdate: false })
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.getByRole('button', { name: 'media.copyUrl' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.upload' })).not.toBeInTheDocument()
  })
})

describe('MediaLibraryScreen — trạng thái', () => {
  it('hiện lỗi kèm nút thử lại khi không tải được danh sách', async () => {
    mocks.fetchMedia.mockRejectedValue(new Error('Mất kết nối'))
    renderScreen()

    expect(await screen.findByText('media.loadError')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.retry' })).toBeInTheDocument()
  })

  it('kho trống thì mời tải lên thay vì gợi ý xoá bộ lọc', async () => {
    mocks.fetchMedia.mockResolvedValue(listResponse([]))
    renderScreen()

    expect(await screen.findByText('media.empty')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.resetFilters' })).not.toBeInTheDocument()
  })
})
