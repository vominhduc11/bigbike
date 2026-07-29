import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaDetailModal } from './MediaDetailModal'

const mocks = vi.hoisted(() => ({
  showConfirm: vi.fn(),
  updateMedia: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('../lib/adminApi', () => ({
  updateMedia: mocks.updateMedia,
}))

vi.mock('../lib/confirm', () => ({
  showConfirm: mocks.showConfirm,
}))

vi.mock('../lib/useMediaReferences', () => ({
  useMediaReferences: () => ({ refs: [], refsLoading: false }),
}))

vi.mock('./media-picker/useModalBehavior', () => ({
  useModalFocusTrap: () => {},
  useBodyScrollLock: () => {},
}))

const media = {
  id: 'media-1',
  filename: 'catalog/helmet.jpg',
  publicUrl: '/media/catalog/helmet.jpg',
  mimeType: 'image/jpeg',
  altText: 'Mũ bảo hiểm',
  title: 'Mũ bảo hiểm',
  usageCount: 1,
}

function renderModal(overrides = {}) {
  const props = {
    media,
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<MediaDetailModal {...props} />)
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.showConfirm.mockResolvedValue(false)
})

describe('MediaDetailModal soft delete', () => {
  it('only renders the delete action when the parent supplies a callback', () => {
    const { unmount } = render(<MediaDetailModal media={media} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument()

    unmount()
    renderModal({ onDelete: vi.fn() })
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument()
  })

  it('does not call the delete callback when the normal confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderModal({ onDelete })

    await user.click(screen.getByRole('button', { name: 'common.delete' }))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'media.deleteConfirm',
      'media.deleteConfirmTitle',
      { variant: 'danger', confirmLabel: 'common.delete' },
    )
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('warns about discarded edits before deleting a dirty form', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    mocks.showConfirm.mockResolvedValue(true)
    renderModal({ onDelete })

    const altInput = screen.getByLabelText('media.fieldAltText')
    await user.clear(altInput)
    await user.type(altInput, 'Ảnh mũ bảo hiểm mới')
    await user.click(screen.getByRole('button', { name: 'common.delete' }))

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'media.deleteDirtyConfirm',
      'media.deleteConfirmTitle',
      { variant: 'danger', confirmLabel: 'common.delete' },
    )
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(media))
  })

  it('keeps the modal open and shows the API error when deletion fails', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockRejectedValue(new Error('Không thể xoá file'))
    mocks.showConfirm.mockResolvedValue(true)
    renderModal({ onDelete })

    await user.click(screen.getByRole('button', { name: 'common.delete' }))

    expect(await screen.findByText('Không thể xoá file')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'media.editTitle' })).toBeInTheDocument()
  })
})
