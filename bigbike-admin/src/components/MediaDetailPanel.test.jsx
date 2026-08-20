import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaDetailPanel } from './MediaDetailPanel'

const mocks = vi.hoisted(() => ({
  refs: [],
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

vi.mock('../lib/useMediaReferences', () => ({
  useMediaReferences: () => ({ refs: mocks.refs, refsLoading: false }),
}))

vi.mock('../lib/useSaveShortcut', () => ({
  useSaveShortcut: () => {},
}))

vi.mock('../lib/useUnsavedChanges', () => ({
  useUnsavedChanges: () => {},
}))

const media = {
  id: 'media_1',
  filename: 'catalog/mu-bao-hiem.jpg',
  publicUrl: '/media/catalog/mu-bao-hiem.jpg',
  mimeType: 'image/jpeg',
  usageCount: 1,
}

function renderPanel(overrides = {}) {
  const { media: mediaOverride, ...props } = overrides
  return render(
    <MediaDetailPanel
      media={{ ...media, ...mediaOverride }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onPreview={vi.fn()}
      canUpdate={false}
      canHardDelete={false}
      folders={[]}
      {...props}
    />,
  )
}

beforeEach(() => {
  mocks.refs = []
})

describe('MediaDetailPanel reference links', () => {
  it('mở sản phẩm bằng route quản trị hợp lệ', () => {
    mocks.refs = [{
      type: 'PRODUCT',
      id: 'prod_123',
      name: 'Mũ bảo hiểm',
      adminPath: '/products/prod_123',
    }]

    renderPanel()

    expect(screen.getByRole('link', { name: 'Mũ bảo hiểm' }))
      .toHaveAttribute('href', '/admin/products/prod_123')
  })

  it('hiển thị tham chiếu dạng chỉ đọc khi không xác định được route an toàn', () => {
    mocks.refs = [{
      type: 'PRODUCT',
      id: '',
      name: 'Sản phẩm đã xoá',
      adminPath: '/products/prod_deleted',
    }]

    renderPanel()

    expect(screen.getByText('Sản phẩm đã xoá')).not.toHaveAttribute('href')
    expect(screen.queryByRole('link', { name: 'Sản phẩm đã xoá' })).not.toBeInTheDocument()
  })
})

describe('MediaDetailPanel — mục Nâng cao', () => {
  it('không hiện mục Nâng cao khi không có biến thể', () => {
    renderPanel({ canUpdate: false })
    expect(screen.queryByRole('button', { name: /media\.advancedSection/ })).not.toBeInTheDocument()
  })

  it('chỉ hiển thị biến thể trong mục Nâng cao', async () => {
    const user = userEvent.setup()
    renderPanel({ media: { sizes: { thumb: '/media/thumb.jpg' } } })

    await user.click(screen.getByRole('button', { name: /media\.advancedSection/ }))
    expect(screen.getByText('media.variants')).toBeInTheDocument()
    expect(screen.queryByText(/replace/i)).not.toBeInTheDocument()
  })
})

describe('MediaDetailPanel — tải file', () => {
  it('hiện nút tải ở bảng chi tiết khi được cung cấp callback', async () => {
    const onDownload = vi.fn()
    renderPanel({ onDownload })

    const button = screen.getByRole('button', { name: 'media.download' })
    expect(button).toHaveAttribute('title', 'media.download')
    await userEvent.setup().click(button)
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 'media_1' }))
  })
})

describe('MediaDetailPanel — xoá vĩnh viễn', () => {
  it('chỉ hiện khi ở thùng rác và có quyền xoá vĩnh viễn', () => {
    renderPanel({ canUpdate: true, canHardDelete: true, media: { status: 'DELETED' }, onHardDelete: vi.fn() })
    expect(screen.getByRole('button', { name: /media\.hardDelete/ })).toBeInTheDocument()
  })

  it('không hiện với file đang hoạt động dù có quyền', () => {
    renderPanel({ canUpdate: true, canHardDelete: true, onHardDelete: vi.fn(), onDelete: vi.fn() })
    expect(screen.queryByRole('button', { name: /media\.hardDelete/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /common\.delete/ })).toBeInTheDocument()
  })

  it('không hiện khi ở thùng rác nhưng không có quyền xoá vĩnh viễn', () => {
    renderPanel({ canUpdate: true, canHardDelete: false, media: { status: 'DELETED' }, onRestore: vi.fn() })
    expect(screen.queryByRole('button', { name: /media\.hardDelete/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /media\.restore/ })).toBeInTheDocument()
  })
})
