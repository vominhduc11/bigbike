import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaFolderSidebar } from './MediaFolderSidebar'

const mocks = vi.hoisted(() => ({
  fetchMediaTags: vi.fn(),
  onSelectFolder: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, options) => options?.defaultValue || key }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchMediaTags: mocks.fetchMediaTags,
  createMediaFolder: vi.fn(),
  updateMediaFolder: vi.fn(),
  deleteMediaFolder: vi.fn(),
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn().mockResolvedValue(true) }))

const folders = [
  { id: 'products', name: 'Sản phẩm', parentId: null, depth: 0, systemKey: 'root:products', sortOrder: 10, mediaCount: 4 },
  { id: 'ls2', name: 'LS2', parentId: 'products', depth: 1, systemKey: 'products:ls2', sortOrder: 1, mediaCount: 4 },
  { id: 'custom', name: 'Kho tạm', parentId: null, depth: 0, systemKey: null, sortOrder: 99, mediaCount: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchMediaTags.mockResolvedValue([])
})

function renderSidebar() {
  return render(
    <MediaFolderSidebar
      folderFilter=""
      tag=""
      canUpdate
      folders={folders}
      onFoldersChanged={vi.fn()}
      onSelectFolder={mocks.onSelectFolder}
      onSelectTag={vi.fn()}
    />,
  )
}

describe('MediaFolderSidebar — cây thư mục', () => {
  it('hiển thị thư mục cha/con mặc định mở và số file gộp', async () => {
    renderSidebar()

    expect(screen.getByText('Sản phẩm')).toBeInTheDocument()
    expect(screen.getByText('LS2')).toBeInTheDocument()
    expect(screen.getAllByText('4')).toHaveLength(2)
    await waitFor(() => expect(mocks.fetchMediaTags).toHaveBeenCalled())
  })

  it('cho xổ/thu cây và chọn thư mục cha', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'media.collapseFolder' }))
    expect(screen.queryByText('LS2')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'media.expandFolder' }))
    await user.click(screen.getByRole('button', { name: /Sản phẩm/ }))
    expect(mocks.onSelectFolder).toHaveBeenCalledWith('products')
  })

  it('không cho đổi tên hoặc xoá thư mục hệ thống', async () => {
    const user = userEvent.setup()
    renderSidebar()
    await user.click(screen.getByRole('button', { name: 'media.folderManage' }))

    expect(screen.getAllByRole('button', { name: 'common.edit' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'common.delete' })).toHaveLength(1)
  })
})
