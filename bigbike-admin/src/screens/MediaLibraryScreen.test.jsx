import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaLibraryScreen } from './MediaLibraryScreen'

// Khoá lại kết quả đợt tinh gọn 2026-07: màn Thư viện chỉ còn 4 điều khiển lọc,
// một kiểu xem (lưới), các nút thao tác dùng chung, và không còn đường nào xoá
// vĩnh viễn hàng loạt ngay trên mặt tiền.

const mocks = vi.hoisted(() => ({
  fetchMedia: vi.fn(),
  fetchMediaStats: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaReferences: vi.fn(),
  deleteMedia: vi.fn(),
  downloadMedia: vi.fn(),
  hardDeleteMedia: vi.fn(),
  restoreMedia: vi.fn(),
  uploadMedia: vi.fn(),
  bulkDeleteMedia: vi.fn(),
  bulkMoveMedia: vi.fn(),
  bulkRestoreMedia: vi.fn(),
  query: {},
  setQuery: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
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
  downloadMedia: mocks.downloadMedia,
  hardDeleteMedia: mocks.hardDeleteMedia,
  restoreMedia: mocks.restoreMedia,
  uploadMedia: mocks.uploadMedia,
  bulkDeleteMedia: mocks.bulkDeleteMedia,
  bulkMoveMedia: mocks.bulkMoveMedia,
  bulkRestoreMedia: mocks.bulkRestoreMedia,
}))

vi.mock('@/lib/toast', () => ({
  toast: mocks.toast,
}))

vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (v) => v }))
vi.mock('../lib/useDragDropUpload', () => ({ useDragDropUpload: () => ({ isDragging: false }) }))
vi.mock('../lib/useKeyboardNav', () => ({
  useKeyboardNav: () => ({ focusIndex: -1, setFocusIndex: vi.fn() }),
}))

// useUrlSyncedState là useState + đồng bộ URL; ở test chỉ cần state thường.
vi.mock('../lib/useUrlSyncedState', async () => {
  const { useState } = await import('react')
  return { useUrlSyncedState: (initial) => useState({ ...initial, ...mocks.query }) }
})

// Sidebar thư mục và lightbox có luồng dữ liệu riêng, không thuộc phạm vi bài test này.
vi.mock('../components/MediaFolderSidebar', () => ({ MediaFolderSidebar: () => null }))
vi.mock('../components/MediaPreviewLightbox', () => ({ MediaPreviewLightbox: () => null }))
vi.mock('../lib/contracts', () => ({
  resolveThumbUrl: (m) => m.publicUrl,
  isDownloadableMedia: (m) => m?.storageProvider === 'MINIO' && Boolean(m?.filePath),
}))

const activeMedia = {
  id: 'media_1',
  filename: 'catalog/mu-bao-hiem.jpg',
  originalFilename: 'mu-bao-hiem.jpg',
  filePath: 'uploads/media_1/mu-bao-hiem.jpg',
  storageProvider: 'MINIO',
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
  mocks.fetchMediaReferences.mockResolvedValue([])
  mocks.showConfirm.mockResolvedValue(true)
  mocks.query = {}
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
  it('hiện nút tải cùng các nút thao tác trên thẻ ảnh đang hoạt động', async () => {
    renderScreen()
    const thumb = await screen.findByTitle('catalog/mu-bao-hiem.jpg')
    const card = thumb.closest('.medialib-card')

    const actions = within(card).getAllByRole('button')
      .filter((b) => b.classList.contains('medialib-icon-btn'))
    expect(actions).toHaveLength(4)
    expect(actions.map((b) => b.getAttribute('title')))
      .toEqual(['media.copyUrl', 'media.download', 'common.edit', 'common.delete'])
  })

  it('nút thao tác luôn nằm trên vùng bấm xem lớn', async () => {
    renderScreen()
    const thumb = await screen.findByTitle('catalog/mu-bao-hiem.jpg')
    const card = thumb.closest('.medialib-card')

    expect(within(card).getByRole('button', { name: /media\.previewNamed/ }))
      .toHaveClass('z-0')
    const editButton = within(card).getByRole('button', { name: 'common.edit' })
    expect(editButton.closest('.medialib-action-overlay')).toHaveClass('z-10')
    expect(editButton.closest('.medialib-overlay-actions')).toHaveClass('pointer-events-auto')
  })

  it('không có nút xoá vĩnh viễn trên thẻ ảnh kể cả khi có quyền', async () => {
    mocks.fetchMedia.mockResolvedValue(listResponse([{ ...activeMedia, status: 'DELETED' }]))
    renderScreen({ canHardDelete: true })
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.queryByRole('button', { name: /media\.hardDelete/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'media.download' })).toBeInTheDocument()
  })

  it('người chỉ có quyền xem vẫn sao chép được link ảnh', async () => {
    renderScreen({ canUpdate: false })
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    expect(screen.getByRole('button', { name: 'media.copyUrl' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'media.download' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.upload' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'app.detail' })).toBeInTheDocument()
    expect(screen.getByText('media.readOnly')).toBeInTheDocument()
  })

  it('tệp legacy thiếu địa chỉ xem không mở lightbox rỗng', async () => {
    mocks.fetchMedia.mockResolvedValue(listResponse([{ ...activeMedia, publicUrl: null }]))
    renderScreen()

    await screen.findByTitle('catalog/mu-bao-hiem.jpg')
    expect(screen.queryByRole('button', { name: /media\.previewNamed/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'media.copyUrl' })).not.toBeInTheDocument()
  })

  it('ẩn nút tải khi media chỉ có URL ngoài hoặc không có object MinIO', async () => {
    mocks.fetchMedia.mockResolvedValue(listResponse([{ ...activeMedia, storageProvider: 'EXTERNAL', filePath: null }]))
    renderScreen()

    await screen.findByTitle('catalog/mu-bao-hiem.jpg')
    expect(screen.queryByRole('button', { name: 'media.download' })).not.toBeInTheDocument()
  })

  it('tải được file khi chỉ có quyền xem và báo lỗi nếu tải thất bại', async () => {
    const user = userEvent.setup()
    mocks.downloadMedia.mockRejectedValue(Object.assign(new Error('Mất kết nối'), { status: 0 }))
    renderScreen({ canUpdate: false })

    const card = (await screen.findByTitle('catalog/mu-bao-hiem.jpg')).closest('.medialib-card')
    await user.click(within(card).getByRole('button', { name: 'media.download' }))

    await waitFor(() => expect(mocks.downloadMedia).toHaveBeenCalledWith(activeMedia.id, activeMedia.originalFilename))
    expect(mocks.toast.error).toHaveBeenCalledWith('media.actionNetworkError')
  })

  it('xoá lỗi vẫn giữ tệp và bảng chi tiết để người dùng thử lại', async () => {
    const user = userEvent.setup()
    mocks.deleteMedia.mockRejectedValue(Object.assign(new Error('Mất kết nối'), { status: 0 }))
    renderScreen()

    const card = (await screen.findByTitle('catalog/mu-bao-hiem.jpg')).closest('.medialib-card')
    await user.click(within(card).getByRole('button', { name: 'common.edit' }))
    await user.click(screen.getByRole('complementary', { name: 'media.editTitle' })
      .querySelector('button[title="common.delete"]'))

    await waitFor(() => expect(mocks.deleteMedia).toHaveBeenCalledWith(activeMedia.id))
    expect(screen.getByRole('complementary', { name: 'media.editTitle' })).toBeInTheDocument()
    expect(await screen.findByTitle('catalog/mu-bao-hiem.jpg')).toBeInTheDocument()
    expect(mocks.toast.error).toHaveBeenCalledWith('media.actionNetworkError')
  })

  it('không xoá vĩnh viễn nếu tệp còn được dùng', async () => {
    const user = userEvent.setup()
    mocks.query = { status: 'DELETED' }
    mocks.fetchMedia.mockResolvedValue(listResponse([{ ...activeMedia, status: 'DELETED', usageCount: 1 }]))
    mocks.fetchMediaReferences.mockResolvedValue([{ type: 'PRODUCT', id: 'product-1', name: 'Sản phẩm A' }])
    renderScreen({ canHardDelete: true })

    const card = (await screen.findByTitle('catalog/mu-bao-hiem.jpg')).closest('.medialib-card')
    await user.click(within(card).getByRole('button', { name: 'app.detail' }))
    await user.click(screen.getByRole('button', { name: 'media.hardDelete' }))

    await waitFor(() => expect(mocks.fetchMediaReferences).toHaveBeenCalledWith(activeMedia.id))
    expect(mocks.hardDeleteMedia).not.toHaveBeenCalled()
    expect(mocks.showConfirm).not.toHaveBeenCalled()
    expect(mocks.toast.error).toHaveBeenCalledWith('media.hardDeleteBlockedInUse')
  })
})

describe('MediaLibraryScreen — upload', () => {
  it('upload vào đúng thư mục đang mở thay vì luôn "Chưa phân loại"', async () => {
    const user = userEvent.setup()
    mocks.query = { folderFilter: 'folder-1' }
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith(
      file,
      '',
      expect.any(Function),
      'folder-1',
      false,
    ))
  })

  it('không gán folder cụ thể khi đang xem "Tất cả"', async () => {
    const user = userEvent.setup()
    mocks.query = { folderFilter: '' }
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, false))
  })

  it('gửi cờ clearFolder khi đang xem "Chưa phân loại" — để ảnh trùng nội dung ở thư mục khác cũng phải quay về đúng Chưa phân loại', async () => {
    const user = userEvent.setup()
    mocks.query = { folderFilter: 'NONE' }
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, true))
  })

  it('đưa danh sách về trang 1 sau khi upload xong dù đang đứng ở trang khác', async () => {
    const user = userEvent.setup()
    mocks.query = { page: 3 }
    mocks.fetchMedia.mockResolvedValue({
      items: [activeMedia],
      pagination: { page: 3, pageSize: 24, totalItems: 100, totalPages: 5 },
    })
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalled())
    await waitFor(() => expect(mocks.fetchMedia).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })))
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

  it('làm mới lỗi vẫn giữ danh sách cũ thay vì làm trắng màn hình', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByTitle('catalog/mu-bao-hiem.jpg')

    mocks.fetchMedia.mockRejectedValueOnce(new Error('Mạng chập chờn'))
    await user.click(screen.getByRole('button', { name: 'common.refresh' }))

    expect(await screen.findByText('media.refreshError')).toBeInTheDocument()
    expect(screen.getByTitle('catalog/mu-bao-hiem.jpg')).toBeInTheDocument()
  })
})
