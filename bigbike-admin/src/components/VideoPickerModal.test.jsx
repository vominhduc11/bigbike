import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoPickerModal } from './VideoPickerModal'

const mocks = vi.hoisted(() => ({
  fetchMedia: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaTags: vi.fn(),
  uploadMedia: vi.fn(),
  hasPermission: vi.fn(),
  showConfirm: vi.fn(),
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

vi.mock('../lib/auth', () => ({ useHasPermission: () => mocks.hasPermission }))
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('../lib/useDebounce', () => ({ useDebounce: (value) => value }))
vi.mock('../lib/useMediaDimensions', () => ({
  useMediaValidation: () => ({
    blocked: false,
    status: 'idle',
    reasons: [],
    width: null,
    height: null,
  }),
}))
vi.mock('./MediaRequirementHint', () => ({
  MediaRequirementHint: () => null,
  MediaValidationError: () => null,
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
vi.mock('./media-picker/useModalBehavior', () => ({
  useModalFocusTrap: () => {},
  useBodyScrollLock: () => {},
}))

const video = {
  id: 'video-1',
  filename: 'catalog/gioi-thieu.mp4',
  publicUrl: '/media/catalog/gioi-thieu.mp4',
  mimeType: 'video/mp4',
  fileSize: 1_000_000,
}

function response(items) {
  return { items, pagination: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 } }
}

function renderPicker(overrides = {}) {
  const props = { onSelect: vi.fn(), onClose: vi.fn(), ...overrides }
  render(<VideoPickerModal {...props} />)
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  mocks.fetchMedia.mockResolvedValue(response([video]))
  mocks.fetchMediaFolders.mockResolvedValue([])
  mocks.fetchMediaTags.mockResolvedValue([])
  mocks.showConfirm.mockResolvedValue(true)
  mocks.uploadMedia.mockImplementation(async (_file, _altText, onProgress) => {
    onProgress?.(100)
    return { item: { ...video, id: 'video-uploaded', publicUrl: '/media/catalog/video-moi.mp4' } }
  })
})

describe('VideoPickerModal', () => {
  it.each(['resolve', 'reject'])(
    'giữ bộ lọc mới nhất khi yêu cầu cũ %s muộn và vẫn chuyển trang được',
    async (lateResult) => {
      const user = userEvent.setup()
      const pending = []
      const pageResponse = (media) => ({
        ...response([media]),
        pagination: { page: 1, pageSize: 20, totalItems: 90, totalPages: 3 },
      })
      mocks.fetchMediaTags.mockResolvedValue(['Mũ'])
      mocks.fetchMedia.mockResolvedValueOnce(pageResponse(video))
      mocks.fetchMedia.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            pending.push({ resolve, reject })
          }),
      )
      renderPicker()
      await screen.findByTitle('gioi-thieu.mp4')
      await user.click(screen.getByRole('button', { name: 'homeVideos.picker.next' }))
      await waitFor(() => expect(pending).toHaveLength(1))

      await user.selectOptions(screen.getByRole('combobox', { name: 'media.folders' }), 'NONE')
      await waitFor(() => expect(pending).toHaveLength(2))
      await user.selectOptions(screen.getByRole('combobox', { name: 'media.popularTags' }), 'Mũ')
      await waitFor(() => expect(pending).toHaveLength(3))
      const latest = {
        ...video,
        id: 'latest',
        filename: 'latest.mp4',
        publicUrl: '/media/latest.mp4',
      }
      await act(async () => pending[2].resolve(pageResponse(latest)))
      expect(await screen.findByTitle('latest.mp4')).toBeInTheDocument()

      await act(async () => {
        for (const request of pending.slice(0, 2)) {
          if (lateResult === 'reject') request.reject(new Error('Yêu cầu cũ thất bại'))
          else request.resolve(pageResponse(video))
        }
      })
      expect(screen.getByTitle('latest.mp4')).toBeInTheDocument()
      expect(screen.queryByTitle('gioi-thieu.mp4')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'homeVideos.picker.next' }))
      await waitFor(() =>
        expect(mocks.fetchMedia).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 2, folderFilter: 'NONE', tag: 'Mũ' }),
        ),
      )
      expect(mocks.fetchMedia.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 1, 1, 2])
      await act(async () => pending[3].resolve(pageResponse(latest)))
    },
  )

  it.each(['search', 'folder', 'tag'])(
    'đổi %s từ trang sau chỉ yêu cầu trang đầu của bộ lọc mới',
    async (filter) => {
      const user = userEvent.setup()
      mocks.fetchMediaTags.mockResolvedValue(['Mũ'])
      mocks.fetchMedia.mockResolvedValue({
        ...response([video]),
        pagination: { page: 1, pageSize: 30, totalItems: 90, totalPages: 3 },
      })
      renderPicker()
      await screen.findByTitle('gioi-thieu.mp4')
      await user.click(screen.getByRole('button', { name: 'homeVideos.picker.next' }))
      await waitFor(() =>
        expect(mocks.fetchMedia).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
      )
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'homeVideos.picker.next' })).toBeEnabled(),
      )
      mocks.fetchMedia.mockClear()

      if (filter === 'search') {
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'helmet' } })
      } else {
        await user.selectOptions(
          screen.getByRole('combobox', {
            name: filter === 'folder' ? 'media.folders' : 'media.popularTags',
          }),
          filter === 'folder' ? 'NONE' : 'Mũ',
        )
      }

      await waitFor(() =>
        expect(mocks.fetchMedia).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })),
      )
      expect(mocks.fetchMedia.mock.calls.map(([query]) => query.page)).toEqual([1])
    },
  )

  it('không gọi API và giải thích rõ khi thiếu quyền xem media', async () => {
    mocks.hasPermission.mockReturnValue(false)
    renderPicker()

    expect(await screen.findByText('media.videoPermissionDeniedTitle')).toBeInTheDocument()
    expect(mocks.fetchMedia).not.toHaveBeenCalled()
    expect(mocks.fetchMediaFolders).not.toHaveBeenCalled()
    expect(mocks.fetchMediaTags).not.toHaveBeenCalled()
  })

  it('chỉ tải danh sách video và không cho chọn tệp legacy thiếu URL', async () => {
    mocks.fetchMedia.mockResolvedValue(response([{ ...video, publicUrl: null }]))
    renderPicker()

    const item = await screen.findByTitle('gioi-thieu.mp4')
    expect(item).toBeDisabled()
    expect(screen.getByRole('img', { name: 'media.missingPublicUrl' })).toBeInTheDocument()
    expect(mocks.fetchMedia).toHaveBeenCalledWith(
      expect.objectContaining({ mimeTypes: ['video/mp4'] }),
    )
  })

  it('vẫn cho chọn video có sẵn nhưng ẩn tải lên khi thiếu media.write', async () => {
    mocks.hasPermission.mockImplementation((permission) => permission === 'media.read')
    renderPicker()

    await screen.findByTitle('gioi-thieu.mp4')
    expect(
      screen.queryByRole('button', { name: 'homeVideos.picker.uploadButton' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'homeVideos.picker.confirm' })).toBeInTheDocument()
  })

  it('tải video ngay trong form, tự chọn và trả đủ media cho màn gọi', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderPicker({ onSelect })
    await screen.findByTitle('gioi-thieu.mp4')

    const input = document.querySelector('input[type="file"]')
    await user.upload(input, new File(['video'], 'video-moi.mp4', { type: 'video/mp4' }))
    const confirm = screen.getByRole('button', { name: 'homeVideos.picker.confirm' })
    await waitFor(() => expect(confirm).toBeEnabled())
    await user.click(confirm)

    expect(onSelect).toHaveBeenCalledWith(
      '/media/catalog/video-moi.mp4',
      expect.objectContaining({ id: 'video-uploaded' }),
    )
  })

  it('tải video vào đúng thư mục đang lọc và không bị reset về "Tất cả" sau khi tải xong', async () => {
    const user = userEvent.setup()
    mocks.fetchMediaFolders.mockResolvedValue([{ id: 'folder-1', name: 'Video trang chủ' }])
    renderPicker()
    await screen.findByTitle('gioi-thieu.mp4')

    const folderSelect = await screen.findByLabelText('media.folders')
    await user.selectOptions(folderSelect, 'folder-1')

    const input = document.querySelector('input[type="file"]')
    const file = new File(['video'], 'video-moi.mp4', { type: 'video/mp4' })
    await user.upload(input, file)

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

  it('tải video khi đang lọc "Chưa phân loại" gửi cờ clearFolder', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByTitle('gioi-thieu.mp4')

    const folderSelect = await screen.findByLabelText('media.folders')
    await user.selectOptions(folderSelect, 'NONE')

    const input = document.querySelector('input[type="file"]')
    const file = new File(['video'], 'video-moi.mp4', { type: 'video/mp4' })
    await user.upload(input, file)

    await waitFor(() =>
      expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function), null, true),
    )
  })

  it('chặn đúng tệp không phải MP4 và tệp vượt 200MB trước khi gọi máy chủ', async () => {
    renderPicker()
    await screen.findByTitle('gioi-thieu.mp4')
    const input = document.querySelector('input[type="file"]')

    fireEvent.change(input, {
      target: { files: [new File(['image'], 'anh.jpg', { type: 'image/jpeg' })] },
    })
    expect(await screen.findByText('homeVideos.picker.unsupportedType')).toBeInTheDocument()

    const oversized = new File(['video'], 'qua-lon.mp4', { type: 'video/mp4' })
    Object.defineProperty(oversized, 'size', { configurable: true, value: 200 * 1024 * 1024 + 1 })
    fireEvent.change(input, { target: { files: [oversized] } })
    expect(await screen.findByText('homeVideos.picker.maxSizeError')).toBeInTheDocument()
    expect(mocks.uploadMedia).not.toHaveBeenCalled()
  })

  it('giữ cửa sổ mở trong lúc video đang tải lên', async () => {
    const user = userEvent.setup()
    let resolveUpload
    mocks.uploadMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve
        }),
    )
    const { onClose } = renderPicker()
    await screen.findByTitle('gioi-thieu.mp4')

    const input = document.querySelector('input[type="file"]')
    await user.upload(input, new File(['video'], 'video-moi.mp4', { type: 'video/mp4' }))
    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'homeVideos.picker.close' }))

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('media.closeWhileUploading')).toBeInTheDocument()
    resolveUpload({ item: { ...video, id: 'video-2', publicUrl: '/media/video-moi.mp4' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'homeVideos.picker.uploadButton' })).toBeEnabled(),
    )
  })
})
