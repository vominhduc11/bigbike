import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageUrlInput } from './ImageUrlInput'

const mocks = vi.hoisted(() => ({
  fetchMediaBlob: vi.fn(),
  importBrandLogoUrl: vi.fn(),
  uploadMedia: vi.fn(),
  hasPermission: vi.fn(),
  media: {
    id: 'media-picked',
    publicUrl: '/media/picked.jpg',
    altText: 'Mũ bảo hiểm đã chọn',
    width: 1200,
    height: 630,
    mimeType: 'image/jpeg',
  },
  inspectBrandLogoFile: vi.fn(),
  getBrandLogoSourceDecision: vi.fn(),
  isBrandLogoBlockingIssue: vi.fn(),
}))

vi.mock('react-i18next', () => {
  const t = (key) => key
  return { useTranslation: () => ({ t }) }
})

vi.mock('@/lib/adminApi', () => ({
  fetchMediaBlob: mocks.fetchMediaBlob,
  importBrandLogoUrl: mocks.importBrandLogoUrl,
  uploadMedia: mocks.uploadMedia,
}))

vi.mock('@/lib/auth', () => ({
  useHasPermission: () => mocks.hasPermission,
}))

vi.mock('@/lib/useMediaAltSync', () => ({
  useMediaAltSync: () => ({ pickAlt: (_current, media) => media?.altText || '' }),
}))

vi.mock('@/lib/contracts', () => ({
  resolveDisplayUrl: (url) => url,
}))

vi.mock('@/lib/brandLogoPolicy', () => ({
  brandLogoCheckerboardStyle: () => ({}),
  brandLogoIssueTranslationKey: (issue) => `brands.logo.errors.${issue}`,
  getBrandLogoSourceDecision: mocks.getBrandLogoSourceDecision,
  isBrandLogoBlockingIssue: mocks.isBrandLogoBlockingIssue,
  inspectBrandLogoFile: mocks.inspectBrandLogoFile,
}))

vi.mock('./MediaPickerModal', () => ({
  MediaPickerModal: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect(mocks.media.publicUrl, mocks.media)}>
      Chọn media kiểm thử
    </button>
  ),
}))

vi.mock('./BrandLogoCropDialog', () => ({
  BrandLogoCropDialog: () => null,
}))

vi.mock('./MediaRequirementHint', () => ({
  MediaRequirementHint: () => null,
}))

const logoRecommendation = { brandLogo: true }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(true)
  mocks.importBrandLogoUrl.mockResolvedValue({
    item: {
      id: 'media-from-url',
      filename: 'imported-logo.jpg',
      publicUrl: '/media/imported-logo.jpg',
      mimeType: 'image/jpeg',
      altText: '',
    },
  })
  mocks.fetchMediaBlob.mockResolvedValue({
    blob: new Blob(['imported-image'], { type: 'image/jpeg' }),
    filename: 'imported-logo.jpg',
  })
  mocks.inspectBrandLogoFile.mockResolvedValue({
    width: 800,
    height: 800,
    fileSize: 3 * 1024 * 1024,
    mimeType: 'image/jpeg',
    transparent: true,
  })
  mocks.getBrandLogoSourceDecision.mockReturnValue({ needsCrop: false, issues: [] })
  mocks.isBrandLogoBlockingIssue.mockReturnValue(false)
})

describe('ImageUrlInput brand logo URL import', () => {
  it('accepts a large imported logo and keeps the saved URL internal', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ImageUrlInput
        value=""
        onChange={onChange}
        alt=""
        recommend={logoRecommendation}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'brands.logo.importUrlLabel' }), 'https://example.com/logo.jpg')
    await user.click(screen.getByRole('button', { name: 'brands.logo.importUrl' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(
      '/media/imported-logo.jpg',
      expect.objectContaining({
        id: 'media-from-url',
        publicUrl: '/media/imported-logo.jpg',
        fileSize: 3 * 1024 * 1024,
      }),
    ))
    expect(mocks.importBrandLogoUrl).toHaveBeenCalledWith({
      url: 'https://example.com/logo.jpg',
      altText: null,
    })
    expect(mocks.fetchMediaBlob).toHaveBeenCalledWith('media-from-url', 'imported-logo.jpg')
  })
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
