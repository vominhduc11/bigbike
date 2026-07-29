import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VideoPickerModal } from './VideoPickerModal'

const mocks = vi.hoisted(() => ({
  fetchMedia: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaTags: vi.fn(),
  uploadMedia: vi.fn(),
  hasPermission: vi.fn(),
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

const existingVideo = {
  id: 'video-1',
  filename: 'videos/existing.mp4',
  publicUrl: '/media/videos/existing.mp4',
  mimeType: 'video/mp4',
  fileSize: 1024,
}

function mediaResponse(items) {
  return {
    items,
    pagination: { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  mocks.fetchMediaFolders.mockResolvedValue([])
  mocks.fetchMediaTags.mockResolvedValue([])
  mocks.fetchMedia.mockResolvedValue(mediaResponse([existingVideo]))
})

describe('VideoPickerModal', () => {
  it('filters the media library to videos and selects an existing item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<VideoPickerModal onSelect={onSelect} onClose={vi.fn()} />)

    await user.click(await screen.findByTitle('existing.mp4'))
    await user.click(screen.getByRole('button', { name: 'homeVideos.picker.confirm' }))

    expect(mocks.fetchMedia).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'video/',
      page: 1,
      pageSize: 20,
    }))
    expect(onSelect).toHaveBeenCalledWith(
      existingVideo.publicUrl,
      expect.objectContaining({ id: existingVideo.id }),
    )
  })

  it('uploads a new MP4 and returns it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const uploadedVideo = {
      id: 'video-2',
      filename: 'videos/new.mp4',
      publicUrl: '/media/videos/new.mp4',
      mimeType: 'video/mp4',
      fileSize: 2 * 1024 * 1024,
    }
    mocks.uploadMedia.mockResolvedValue({ item: uploadedVideo })
    mocks.fetchMedia
      .mockResolvedValueOnce(mediaResponse([existingVideo]))
      .mockResolvedValue(mediaResponse([uploadedVideo, existingVideo]))

    render(<VideoPickerModal onSelect={onSelect} onClose={vi.fn()} />)
    await screen.findByTitle('existing.mp4')

    const input = document.body.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('accept', 'video/mp4')
    const file = new File(['video-data'], 'new.mp4', { type: 'video/mp4' })
    await user.upload(input, file)

    await waitFor(() => expect(mocks.uploadMedia).toHaveBeenCalledWith(file, '', expect.any(Function)))
    await waitFor(() => expect(screen.getByRole('button', { name: 'homeVideos.picker.confirm' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'homeVideos.picker.confirm' }))

    expect(onSelect).toHaveBeenCalledWith(
      uploadedVideo.publicUrl,
      expect.objectContaining({ id: uploadedVideo.id, isNewUpload: true }),
    )
  })
})
