import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaPickerModal } from './MediaPickerModal'
import { IMAGE_RECO } from '../lib/imageRecommendations'

const mocks = vi.hoisted(() => ({
  fetchMedia: vi.fn(),
  fetchMediaBlob: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaTags: vi.fn(),
  uploadMedia: vi.fn(),
  hasPermission: vi.fn(),
  showConfirm: vi.fn(),
  readImageFileDimensions: vi.fn(),
  mediaValidation: vi.fn(),
  getBrandLogoSourceDecision: vi.fn(),
  isBrandLogoBlockingIssue: vi.fn(),
  inspectBrandLogoFile: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchMedia: mocks.fetchMedia,
  fetchMediaBlob: mocks.fetchMediaBlob,
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
  readImageFileDimensions: mocks.readImageFileDimensions,
  useMediaValidation: () => mocks.mediaValidation(),
}))

vi.mock('../lib/brandLogoPolicy', () => ({
  BRAND_LOGO_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  brandLogoIssueTranslationKey: (issue) => `brands.logo.errors.${issue}`,
  getBrandLogoSourceDecision: mocks.getBrandLogoSourceDecision,
  isBrandLogoBlockingIssue: mocks.isBrandLogoBlockingIssue,
  inspectBrandLogoFile: mocks.inspectBrandLogoFile,
}))

vi.mock('../lib/contracts', () => ({
  resolveDisplayUrl: (url) => url,
  resolveThumbUrl: (media) => media.publicUrl,
}))

vi.mock('./FilterSelect', () => ({
  FilterSelect: ({ value, onValueChange, options, ariaLabel }) => (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onValueChange(e.target.value)}>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>
          {typeof o.label === 'string' ? o.label : String(o.value)}
        </option>
      ))}
    </select>
  ),
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
  mocks.fetchMediaBlob.mockResolvedValue({
    blob: new Blob(['library-image'], { type: 'image/jpeg' }),
    filename: firstMedia.filename,
  })
  mocks.uploadMedia.mockImplementation(async (_file, _altText, onProgress) => {
    onProgress?.(100)
    return { item: uploadedMedia }
  })
  mocks.readImageFileDimensions.mockResolvedValue({ width: 200, height: 200 })
  mocks.inspectBrandLogoFile.mockImplementation(async (file) => ({
    file,
    width: 800,
    height: 800,
    fileSize: file.size,
    mimeType: file.type,
    transparent: true,
  }))
  mocks.getBrandLogoSourceDecision.mockReturnValue({ needsCrop: false, issues: [] })
  mocks.isBrandLogoBlockingIssue.mockReturnValue(false)
  mocks.mediaValidation.mockReturnValue({
    blocked: false,
    status: 'idle',
    reasons: [],
    width: null,
    height: null,
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
    mocks.hasPermission.mockImplementation((permission) => permission === 'media.read')
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

    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, false),
    )
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

    expect(await screen.findByText('media.unsupportedImageType')).toBeInTheDocument()
    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(valid, '', expect.any(Function), null, false),
    )
  })

  it('upload vào đúng thư mục đang lọc và không bị reset về "Tất cả" sau khi tải xong', async () => {
    const user = userEvent.setup()
    mocks.fetchMediaFolders.mockResolvedValue([{ id: 'folder-1', name: 'Banner' }])
    renderPicker()

    await screen.findByTitle('helmet-one.jpg')
    const folderSelect = await screen.findByLabelText('media.folders')
    await user.selectOptions(folderSelect, 'folder-1')

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(
        file,
        '',
        expect.any(Function),
        'folder-1',
        false,
      ),
    )
    // Không còn nhảy về "Tất cả thư mục" sau khi upload — giữ đúng ngữ cảnh admin đang lọc.
    await waitFor(() => expect(folderSelect.value).toBe('folder-1'))
  })

  it('upload khi đang lọc "Chưa phân loại" gửi cờ clearFolder — kể cả khi ảnh trùng nội dung đã nằm ở thư mục khác vẫn phải về đúng Chưa phân loại', async () => {
    const user = userEvent.setup()
    mocks.fetchMediaFolders.mockResolvedValue([{ id: 'folder-1', name: 'Banner' }])
    renderPicker()

    await screen.findByTitle('helmet-one.jpg')
    const folderSelect = await screen.findByLabelText('media.folders')
    await user.selectOptions(folderSelect, 'NONE')

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-moi.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, true),
    )
  })

  it('chỉ tải lên ảnh danh mục vuông tuyệt đối và chấp nhận ảnh vuông nhỏ', async () => {
    const user = userEvent.setup()
    renderPicker({ recommend: IMAGE_RECO.categoryImage })

    await screen.findByTitle('helmet-one.jpg')
    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-vuong-nho.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, file)

    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, false),
    )
    expect(mocks.readImageFileDimensions).toHaveBeenCalledWith(file)
  })

  it('từ chối ảnh danh mục không vuông trước khi tải lên và báo kích thước', async () => {
    const user = userEvent.setup()
    mocks.readImageFileDimensions.mockResolvedValue({ width: 300, height: 200 })
    renderPicker({ recommend: IMAGE_RECO.categoryImage })

    await screen.findByTitle('helmet-one.jpg')
    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['jpeg-content'], 'anh-ngang.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, file)

    expect(await screen.findByText('mediaReco.categoryImageWrongRatio')).toBeInTheDocument()
    expect(mocks.uploadMedia).not.toHaveBeenCalled()
  })

  it('truyền kích thước thật của ảnh danh mục đã chọn vào form quản trị', async () => {
    const user = userEvent.setup()
    mocks.mediaValidation.mockReturnValue({
      blocked: false,
      status: 'loaded',
      reasons: [],
      width: 200,
      height: 200,
    })
    const onSelect = vi.fn()
    renderPicker({ recommend: IMAGE_RECO.categoryImage, onSelect })

    await user.click(await screen.findByTitle('helmet-one.jpg'))
    await user.click(screen.getByRole('button', { name: 'media.picker.confirmSingle' }))

    expect(onSelect).toHaveBeenCalledWith(
      firstMedia.publicUrl,
      expect.objectContaining({ width: 200, height: 200 }),
    )
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
      expect(screen.getByRole('button', { name: 'media.picker.confirmSingle' })).toBeDisabled(),
    )
  })

  it('cho phép tải file logo lớn hơn mức cũ mà vẫn qua kiểm tra logo', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPicker({ recommend: IMAGE_RECO.logo, onSelect })

    await screen.findByTitle('helmet-one.jpg')
    const fileInput = document.querySelector('input[type="file"]')
    const file = new File([new Uint8Array(1024 * 1024)], 'logo-lon.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, file)

    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, false),
    )
    const confirm = screen.getByRole('button', { name: 'media.picker.confirmSingle' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    expect(onSelect).toHaveBeenCalledWith(
      uploadedMedia.publicUrl,
      expect.objectContaining({ id: uploadedMedia.id }),
    )
  })

  it('cho phép chọn logo lớn đã có trong thư viện', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPicker({ recommend: IMAGE_RECO.logo, onSelect })

    await user.click(await screen.findByTitle('helmet-one.jpg'))
    await waitFor(() =>
      expect(mocks.fetchMediaBlob).toHaveBeenCalledWith(firstMedia.id, firstMedia.filename),
    )
    const confirm = screen.getByRole('button', { name: 'media.picker.confirmSingle' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    expect(onSelect).toHaveBeenCalledWith(
      firstMedia.publicUrl,
      expect.objectContaining({ id: firstMedia.id }),
    )
  })
})
