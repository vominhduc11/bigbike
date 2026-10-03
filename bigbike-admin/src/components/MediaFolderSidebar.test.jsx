import { act, render, screen, waitFor } from '@testing-library/react'
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

function renderSidebar(props = {}) {
  return render(
    <MediaFolderSidebar
      folderFilter=""
      tag=""
      canUpdate
      folders={folders}
      onFoldersChanged={vi.fn()}
      onSelectFolder={mocks.onSelectFolder}
      onSelectTag={vi.fn()}
      {...props}
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

    await user.click(screen.getByRole('button', { name: 'media.collapseFolder: Sản phẩm' }))
    expect(screen.queryByText('LS2')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'media.expandFolder: Sản phẩm' }))
    await user.click(screen.getByRole('button', { name: /^Sản phẩm/ }))
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

  it('mở nhánh và menu bằng bàn phím không chọn nhầm thư mục', async () => {
    const user = userEvent.setup()
    renderSidebar()

    act(() => screen.getByRole('button', { name: 'media.collapseFolder: Sản phẩm' }).focus())
    await user.keyboard('{Enter}')
    expect(screen.queryByText('LS2')).not.toBeInTheDocument()
    expect(mocks.onSelectFolder).not.toHaveBeenCalled()

    const menuButton = screen.getAllByRole('button', { name: 'media.folderActions' })[0]
    act(() => menuButton.focus())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toHaveTextContent('Sản phẩm')
    expect(mocks.onSelectFolder).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(menuButton).toHaveFocus())

    const selectButton = screen.getByRole('button', { name: /^Sản phẩm/ })
    act(() => selectButton.focus())
    await user.keyboard('{Enter}')
    expect(mocks.onSelectFolder).toHaveBeenCalledExactlyOnceWith('products')
  })

  it('người chỉ đọc vẫn chọn và mở nhánh được, không có thao tác quản lý', async () => {
    const user = userEvent.setup()
    renderSidebar({ canUpdate: false })

    expect(screen.queryByRole('button', { name: 'media.folderAdd' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'media.folderActions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'media.folderNoChildren' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'media.collapseFolder: Sản phẩm' }))
    await user.click(screen.getByRole('button', { name: /^Sản phẩm/ }))
    expect(mocks.onSelectFolder).toHaveBeenCalledWith('products')
  })

  it('chỉ mở tooltip cho tên bị cắt và đọc được tên đầy đủ khi focus hoặc hover', async () => {
    const user = userEvent.setup()
    const longName = 'Ảnh minh hoạ sản phẩm và hướng dẫn sử dụng cho khách hàng tại cửa hàng'
    renderSidebar({ folders: [{ ...folders[2], name: longName }] })
    const label = screen.getByText(longName)
    const button = screen.getByRole('button', { name: new RegExp(`^${longName}`) })

    act(() => button.focus())
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    act(() => button.blur())
    Object.defineProperties(label, {
      clientHeight: { configurable: true, value: 40 },
      scrollHeight: { configurable: true, value: 60 },
    })
    act(() => button.focus())
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longName)
    expect(mocks.onSelectFolder).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    act(() => button.blur())
    await user.hover(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(longName)
  })
})
