import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaPickerModal } from './MediaPickerModal'

const mocks = vi.hoisted(() => ({
  deleteMedia: vi.fn(),
  fetchMedia: vi.fn(),
  fetchMediaFolders: vi.fn(),
  fetchMediaTags: vi.fn(),
  updateMedia: vi.fn(),
  uploadMedia: vi.fn(),
  hasPermission: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('../lib/adminApi', () => ({
  deleteMedia: mocks.deleteMedia,
  fetchMedia: mocks.fetchMedia,
  fetchMediaFolders: mocks.fetchMediaFolders,
  fetchMediaTags: mocks.fetchMediaTags,
  updateMedia: mocks.updateMedia,
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

vi.mock('../lib/useMediaReferences', () => ({
  useMediaReferences: () => ({ refs: [], refsLoading: false }),
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

const secondMedia = {
  id: 'media-2',
  filename: 'catalog/helmet-two.jpg',
  publicUrl: '/media/catalog/helmet-two.jpg',
  mimeType: 'image/jpeg',
  altText: 'Mũ bảo hiểm hai',
  title: 'Mũ bảo hiểm hai',
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
  mocks.deleteMedia.mockResolvedValue(undefined)
  mocks.showConfirm.mockResolvedValue(true)
})

describe('MediaPickerModal soft delete', () => {
  it('does not expose write or delete actions without media.write', async () => {
    mocks.hasPermission.mockReturnValue(false)
    renderPicker()

    await screen.findByTitle('helmet-one.jpg')
    expect(screen.queryByRole('button', { name: 'media.picker.editInfo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument()
  })

  it('soft-deletes, refreshes and clears a selected item without closing the picker', async () => {
    const user = userEvent.setup()
    mocks.fetchMedia
      .mockResolvedValueOnce(mediaResponse([firstMedia]))
      .mockResolvedValue(mediaResponse([]))
    renderPicker()

    await user.click(await screen.findByTitle('helmet-one.jpg'))
    await user.click(screen.getByRole('button', { name: 'media.picker.editInfo' }))
    await user.click(await screen.findByRole('button', { name: 'common.delete' }))

    await waitFor(() => expect(mocks.deleteMedia).toHaveBeenCalledWith('media-1'))
    await waitFor(() => expect(mocks.fetchMedia).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog', { name: 'media.editTitle' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'media.picker.dialogLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'media.picker.confirmSingle' })).toBeDisabled()
    expect(mocks.toast.success).toHaveBeenCalledWith('media.deleteSuccess')
  })

  it('keeps the detail, grid and selection unchanged when the API rejects deletion', async () => {
    const user = userEvent.setup()
    mocks.deleteMedia.mockRejectedValue(new Error('Không thể xoá file'))
    renderPicker()

    const item = await screen.findByTitle('helmet-one.jpg')
    await user.click(item)
    await user.click(screen.getByRole('button', { name: 'media.picker.editInfo' }))
    await user.click(await screen.findByRole('button', { name: 'common.delete' }))

    expect(await screen.findByText('Không thể xoá file')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'media.editTitle' })).toBeInTheDocument()
    expect(screen.getByTitle('helmet-one.jpg')).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.fetchMedia).toHaveBeenCalledTimes(1)
    expect(mocks.toast.success).not.toHaveBeenCalled()
  })

  it('removes only the deleted item from a multi-selection and preserves callback shape', async () => {
    const user = userEvent.setup()
    const onSelectMultiple = vi.fn()
    mocks.fetchMedia
      .mockResolvedValueOnce(mediaResponse([firstMedia, secondMedia]))
      .mockResolvedValue(mediaResponse([secondMedia]))
    renderPicker({ multiSelect: true, onSelectMultiple })

    await user.click(await screen.findByTitle('helmet-one.jpg'))
    await user.click(screen.getByTitle('helmet-two.jpg'))
    const editButtons = screen.getAllByRole('button', { name: 'media.picker.editInfo' })
    await user.click(editButtons[0])
    await user.click(await screen.findByRole('button', { name: 'common.delete' }))

    await waitFor(() => expect(mocks.fetchMedia).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: 'media.picker.confirmMulti' }))
    expect(onSelectMultiple).toHaveBeenCalledWith(
      [secondMedia.publicUrl],
      [expect.objectContaining({ id: secondMedia.id })],
    )
  })

  it('keeps the existing single-select callback signature', async () => {
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
})
