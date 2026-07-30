import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

function renderPanel() {
  return render(
    <MediaDetailPanel
      media={media}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onPreview={vi.fn()}
      canUpdate={false}
      canHardDelete={false}
      folders={[]}
    />,
  )
}

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
