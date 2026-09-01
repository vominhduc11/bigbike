import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaFolderSidebar } from './MediaFolderSidebar'

const mocks = vi.hoisted(() => ({
  createMediaFolder: vi.fn(),
  deleteMediaFolder: vi.fn(),
  fetchMediaTags: vi.fn(),
  onSelectFolder: vi.fn(),
  updateMediaFolder: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, options) => options?.defaultValue || key }),
}))

vi.mock('../lib/adminApi', () => ({
  createMediaFolder: mocks.createMediaFolder,
  deleteMediaFolder: mocks.deleteMediaFolder,
  fetchMediaTags: mocks.fetchMediaTags,
  updateMediaFolder: mocks.updateMediaFolder,
}))

vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../lib/confirm', () => ({ showConfirm: vi.fn().mockResolvedValue(true) }))

const folders = [
  {
    id: 'products',
    name: 'Sản phẩm',
    parentId: null,
    depth: 0,
    systemKey: 'root:products',
    sortOrder: 10,
    mediaCount: 4,
  },
  {
    id: 'ls2',
    name: 'LS2',
    parentId: 'products',
    depth: 1,
    systemKey: 'products:ls2',
    sortOrder: 1,
    mediaCount: 4,
  },
  {
    id: 'custom',
    name: 'Kho tạm',
    parentId: null,
    depth: 0,
    systemKey: null,
    sortOrder: 99,
    mediaCount: 1,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetchMediaTags.mockResolvedValue([])
  mocks.createMediaFolder.mockResolvedValue({})
  mocks.updateMediaFolder.mockResolvedValue({})
  mocks.deleteMediaFolder.mockResolvedValue()
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

  it('hiển thị thao tác đổi tên, thêm con, di chuyển và xoá cho thư mục hệ thống', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getAllByRole('button', { name: 'media.folderActions' })[0])

    expect(screen.getByText('common.edit')).toBeInTheDocument()
    expect(screen.getByText('media.folderAddChild')).toBeInTheDocument()
    expect(screen.getByText('media.folderMove')).toBeInTheDocument()
    expect(screen.getByText('common.delete')).toBeInTheDocument()
  })

  it('đổi tên thư mục hệ thống mà không gửi mã nội bộ', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getAllByRole('button', { name: 'media.folderActions' })[0])
    await user.click(screen.getByText('common.edit'))
    await user.clear(screen.getByLabelText('media.folderName'))
    await user.type(screen.getByLabelText('media.folderName'), 'Kho sản phẩm')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() =>
      expect(mocks.updateMediaFolder).toHaveBeenCalledWith(
        'products',
        expect.objectContaining({ name: 'Kho sản phẩm', parentId: null }),
      ),
    )
    expect(mocks.updateMediaFolder.mock.calls[0][1]).not.toHaveProperty('systemKey')
  })

  it('chặn di chuyển thư mục còn con ngay trong giao diện', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getAllByRole('button', { name: 'media.folderActions' })[0])
    await user.click(screen.getByText('media.folderMove'))

    expect(screen.getByRole('alert')).toHaveTextContent('media.folderMoveHasChildren')
    expect(screen.getByRole('button', { name: 'media.folderMoveConfirm' })).toBeDisabled()
  })

  it('dùng cảnh báo riêng trước khi xoá thư mục hệ thống', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getAllByRole('button', { name: 'media.folderActions' })[1])
    await user.click(screen.getByText('common.delete'))

    expect(screen.getByText('media.systemFolderDeleteTitle')).toBeInTheDocument()
    expect(screen.getByText('media.systemFolderDeleteImpact.productBrand')).toBeInTheDocument()
  })
})
