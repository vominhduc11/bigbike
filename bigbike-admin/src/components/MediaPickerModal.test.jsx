import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaPickerModal } from './MediaPickerModal'

const mocks = vi.hoisted(() => ({
  fetchMedia: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaTags: vi.fn(),
  uploadMedia: vi.fn(),
  hasPermission: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchMedia: mocks.fetchMedia,
  fetchMediaFolders: mocks.fetchMediaFolders,
  fetchMediaTags: mocks.fetchMediaTags,
  uploadMedia: mocks.uploadMedia,
}))

vi.mock('../lib/auth', () => ({
  useHasPermission: () => mocks.hasPermission,
}))

vi.mock('../lib/confirm', () => ({
  showConfirm: mocks.showConfirm,
}))

vi.mock('@/lib/toast', () => ({
  toast: mocks.toast,
}))

vi.mock('../lib/useDebounce', () => ({
  useDebounce: (value) => value,
}))

vi.mock('../lib/useMediaDimensions', () => ({
  useMediaValidation: () => ({
    blocked: false,
    status: 'idle',
    reasons: [],
    width: null,
    height: null,
  }),
}))

vi.mock('../lib/contracts', () => ({
  resolveDisplayUrl: (url) => url,
  resolveThumbUrl: (media) => media.publicUrl,
}))

vi.mock('./FilterSelect', () => ({
  FilterSelect: () => null,
}))

vi.mock('./MediaRequirementHint', () => ({
  MediaRequirementHint: () => null,
  MediaValidationError: () => null,
}))

vi.mock('./media-picker/useModalBehavior', () => ({
  useModalFocusTrap: () => {},
  useBodyScrollLock: () => {},
}))

const firstMedia = {
  id: 'media-1',
  filename: 'catalog/helmet-one.jpg',
  publicUrl: '/media/catalog/helmet-one.jpg',
  mimeType: 'image/jpeg',
  altText: 'Mũ bảo hiểm một',
  title: 'Mũ bảo hiểm một',
  usageCount: 0,
}

const uploadedMedia = {
  id: 'media-uploaded',
  filename: 'catalog/anh-moi.jpg',
  publicUrl: '/media/catalog/anh-moi.jpg',
  mimeType: 'image/jpeg',
  altText: '',
  title: 'Ảnh mới',
  usageCount: 0,
}

function mediaResponse(items) {
  return {
    items,
    pagination: { page: 1, pageSize: 30, totalItems: items.length, totalPages: 1 },
  }
}

function renderPicker(overrides = {}) {
  const props = {
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<MediaPickerModal {...props} />)
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  mocks.fetchMediaFolders.mockResolvedValue([])
  mocks.fetchMediaTags.mockResolvedValue([])
  mocks.fetchMedia.mockResolvedValue(mediaResponse([firstMedia]))
  mocks.uploadMedia.mockImplementation(async (_file, _altText, onProgress) => {
    onProgress?.(100)
    return { item: uploadedMedia }
  })
  mocks.showConfirm.mockResolvedValue(true)
})

// Sau đợt tinh gọn, picker chỉ còn đúng một việc: tìm — tải lên — chọn. Sửa mô tả
// ảnh và xoá file đã chuyển hẳn về màn Thư viện media.
describe('MediaPickerModal', () => {
  it('không còn nút sửa thông tin hay xoá file bên trong picker', async () => {
    renderPicker()

    await screen.findByTitle('helmet-one.jpg')
    expect(screen.queryByRole('button', { name: 'media.picker.editInfo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument()
  })

  it('ẩn nút tải lên khi tài khoản không có quyền media.write', async () => {
    mocks.hasPermission.mockImplementation(permission => permission === 'media.read')
    renderPicker()

    await screen.findByTitle('helmet-one.jpg')
    expect(screen.queryByRole('button', { name: /media\.picker\.upload/ })).not.toBeInTheDocument()
    // vẫn duyệt và chọn được ảnh có sẵn
    expect(screen.getByRole('button', { name: 'media.picker.confirmSingle' })).toBeInTheDocument()
  })

  it('không gọi Media API khi thiếu media.read', async () => {
    mocks.hasPermission.mockReturnValue(false)
    renderPicker()

    expect(await screen.findByText('media.permissionDeniedTitle')).toBeInTheDocument()
    expect(mocks.fetchMedia).not.toHaveBeenCalled()
    expect(mocks.fetchMediaFolders).not.toHaveBeenCalled()
    expect(mocks.fetchMediaTags).not.toHaveBeenCalled()
  })

  it('hiện nút tải lên khi có quyền media.write', async () => {
    renderPicker()

    await screen.findByTitle('helmet-one.jpg')
    expect(screen.getByRole('button', { name: /media\.picker\.upload/ })).toBeInTheDocument()
  })

  it('tải ảnh lên ổn định, giữ modal mở và cho chọn ngay ảnh vừa tải', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    renderPicker({ onSelect, onClose })

    await screen.findByTitle('helmet-one.jpg')
    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, file)

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith(
      file,
      '',
      expect.any(Function),
    ))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'media.picker.dialogLabel' })).toBeInTheDocument()

    const confirm = screen.getByRole('button', { name: 'media.picker.confirmSingle' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    expect(onSelect).toHaveBeenCalledWith(
      uploadedMedia.publicUrl,
      expect.objectContaining({ id: uploadedMedia.id }),
    )
  })

  it('không che mất cảnh báo file sai khi một lượt tải có cả file hợp lệ', async () => {
    renderPicker()
    await screen.findByTitle('helmet-one.jpg')
    const fileInput = document.querySelector('input[type="file"]')
    const valid = new File(['jpeg-content'], 'anh-hop-le.jpg', { type: 'image/jpeg' })
    const invalid = new File(['text-content'], 'ghi-chu.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [invalid, valid] } })

    expect(await screen.findByText('media.unsupportedType')).toBeInTheDocument()
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith(valid, '', expect.any(Function)))
  })

  it('giữ nguyên chữ ký callback chọn ảnh', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPicker({ onSelect })

    await user.click(await screen.findByTitle('helmet-one.jpg'))
    await user.click(screen.getByRole('button', { name: 'media.picker.confirmSingle' }))

    expect(onSelect).toHaveBeenCalledWith(
      firstMedia.publicUrl,
      expect.objectContaining({ id: firstMedia.id }),
    )
  })

  it('bấm lại ảnh đang chọn thì bỏ chọn và khoá nút xác nhận', async () => {
    const user = userEvent.setup()
    renderPicker()

    const item = await screen.findByTitle('helmet-one.jpg')
    await user.click(item)
    expect(screen.getByRole('button', { name: 'media.picker.confirmSingle' })).toBeEnabled()

    await user.click(item)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'media.picker.confirmSingle' })).toBeDisabled())
  })
})
