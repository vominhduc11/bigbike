import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageUrlInput } from './ImageUrlInput'

const mocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  media: {
    id: 'media-picked',
    publicUrl: '/media/picked.jpg',
    altText: 'Mũ bảo hiểm đã chọn',
    width: 1200,
    height: 630,
    mimeType: 'image/jpeg',
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('@/lib/auth', () => ({
  useHasPermission: () => mocks.hasPermission,
}))

vi.mock('./MediaPickerModal', () => ({
  MediaPickerModal: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect(mocks.media.publicUrl, mocks.media)}>
      Chọn media kiểm thử
    </button>
  ),
}))

vi.mock('./MediaRequirementHint', () => ({ MediaRequirementHint: () => null }))
vi.mock('@/lib/contracts', () => ({ resolveDisplayUrl: (url) => url }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
})

describe('ImageUrlInput media picker integration', () => {
  it('khóa picker và không mở modal khi thiếu media.read', async () => {
    mocks.hasPermission.mockReturnValue(false)
    render(<ImageUrlInput value="" onChange={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'imageInput.pickFromLibrary' })
    expect(trigger).toBeDisabled()
    expect(screen.getByText('media.permissionDeniedDesc')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chọn media kiểm thử' })).not.toBeInTheDocument()
  })

  it('trả URL, metadata và prefill alt từ media đã chọn', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onAltChange = vi.fn()
    render(<ImageUrlInput value="" alt="" onChange={onChange} onAltChange={onAltChange} />)

    await user.click(screen.getByRole('button', { name: 'imageInput.pickFromLibrary' }))
    await user.click(screen.getByRole('button', { name: 'Chọn media kiểm thử' }))

    expect(onChange).toHaveBeenCalledWith(mocks.media.publicUrl, mocks.media)
    expect(onAltChange).toHaveBeenCalledWith(mocks.media.altText)
  })

  it('vẫn chọn được ảnh khi màn hình không có ô alt riêng', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ImageUrlInput value="" onChange={onChange} onAltChange={null} />)

    await user.click(screen.getByRole('button', { name: 'imageInput.pickFromLibrary' }))
    await user.click(screen.getByRole('button', { name: 'Chọn media kiểm thử' }))

    expect(onChange).toHaveBeenCalledWith(mocks.media.publicUrl, mocks.media)
  })
})
