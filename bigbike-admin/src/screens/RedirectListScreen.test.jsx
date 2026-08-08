import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RedirectListScreen } from './RedirectListScreen'
import { ApiClientError } from '../lib/adminApi'

const mocks = vi.hoisted(() => ({
  fetchRedirects: vi.fn(),
  createRedirect: vi.fn(),
  updateRedirect: vi.fn(),
  deleteRedirect: vi.fn(),
  resolveRedirectTarget: vi.fn(),
  showConfirm: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, options = {}) => options.defaultValue || key,
  }),
}))

// mapValidationErrors và ApiClientError giữ nguyên bản thật (importActual) để test đúng
// wiring end-to-end — chỉ mock các lời gọi API tạo/sửa/xoá/tải danh sách.
vi.mock('../lib/adminApi', async () => {
  const actual = await vi.importActual('../lib/adminApi')
  return {
    ...actual,
    fetchRedirects: mocks.fetchRedirects,
    createRedirect: mocks.createRedirect,
    updateRedirect: mocks.updateRedirect,
    deleteRedirect: mocks.deleteRedirect,
    resolveRedirectTarget: mocks.resolveRedirectTarget,
  }
})
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns, loading, selectable }) => (
    <div data-testid="redirect-table" data-loading={String(Boolean(loading))} data-selectable={String(Boolean(selectable))}>
      {rows.map((row) => (
        <div key={row.id}>
          {columns.map((column) => <div key={column.key}>{column.render ? column.render(row) : row[column.key]}</div>)}
        </div>
      ))}
    </div>
  ),
}))

// jsdom không có ResizeObserver — Radix Select (Loại chuyển hướng) cần nó.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

function renderScreen(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RedirectListScreen canUpdate={canUpdate} />
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/redirects')
  mocks.fetchRedirects.mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
  })
  // Mặc định đích đi thẳng — test nào cần cảnh báo đi vòng thì tự ghi đè.
  mocks.resolveRedirectTarget.mockResolvedValue({ hops: 1, finalTarget: '/new-page' })
})

async function openCreateFormAndFill(user) {
  await user.click(await screen.findByRole('button', { name: 'Tạo chuyển hướng' }))
  await user.type(screen.getByPlaceholderText('/dia-chi-cu'), '/old-page')
  await user.type(screen.getByPlaceholderText('/dia-chi-moi'), '/new-page')
  await user.click(screen.getByRole('button', { name: 'common.save' }))
}

describe('RedirectListScreen — lỗi submit hiện đúng field bằng tiếng Việt', () => {
  it('lỗi CONFLICT (trùng mẫu nguồn) hiện dưới ô Mẫu nguồn, không hiện banner chung', async () => {
    const user = userEvent.setup()
    mocks.createRedirect.mockRejectedValue(
      new ApiClientError('Redirect source already exists: /old-page', 409, 'CONFLICT', []),
    )
    renderScreen()

    await openCreateFormAndFill(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Nguồn này đã có chuyển hướng khác trỏ tới. Hãy dùng mẫu nguồn khác hoặc sửa bản ghi đang có.',
    )
    expect(screen.queryByText(/Redirect source already exists/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('lỗi SELF_LOOP (targetUrl) hiện dưới ô URL đích, không hiện banner chung', async () => {
    const user = userEvent.setup()
    mocks.createRedirect.mockRejectedValue(
      new ApiClientError('Validation failed.', 400, 'VALIDATION_ERROR', [
        { field: 'targetUrl', code: 'SELF_LOOP', message: 'Redirect target must differ from the source pattern.' },
      ]),
    )
    renderScreen()

    await openCreateFormAndFill(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Địa chỉ mới không được trùng với địa chỉ cũ.')
    expect(screen.queryByText(/Redirect target must differ/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('không gọi createRedirect khi tải danh sách và không submit', async () => {
    renderScreen()
    expect(await screen.findByTestId('redirect-table')).toBeInTheDocument()
    expect(mocks.createRedirect).not.toHaveBeenCalled()
  })

  it('gửi đúng nguồn/đích đã cắt khoảng trắng khi tạo thành công', async () => {
    const user = userEvent.setup()
    mocks.createRedirect.mockResolvedValue({ id: 'rd_1', sourcePattern: '/old-page', targetUrl: '/new-page' })
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Tạo chuyển hướng' }))
    await user.type(screen.getByPlaceholderText('/dia-chi-cu'), '  /old-page  ')
    await user.type(screen.getByPlaceholderText('/dia-chi-moi'), '  /new-page  ')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.createRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePattern: '/old-page', targetUrl: '/new-page' }),
    ))
    const [payload] = mocks.createRedirect.mock.calls.at(-1)
    expect(payload).not.toHaveProperty('statusCode')
    expect(payload).not.toHaveProperty('redirectType')
  })

  it('chỉ có quyền đọc thì ẩn nút tạo chuyển hướng', async () => {
    renderScreen(false)
    expect(await screen.findByTestId('redirect-table')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo chuyển hướng' })).not.toBeInTheDocument()
    expect(screen.getByText('Bạn chỉ có quyền xem chuyển hướng; mọi thao tác thay đổi đều bị khóa.')).toBeInTheDocument()
    expect(screen.getByTestId('redirect-table')).toHaveAttribute('data-selectable', 'false')
  })

  it('chặn địa chỉ cũ có tên miền, query hoặc dấu # ngay trên form', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByRole('button', { name: 'Tạo chuyển hướng' }))
    await user.type(screen.getByPlaceholderText('/dia-chi-cu'), 'https://bigbike.vn/old?q=1#x')
    await user.type(screen.getByPlaceholderText('/dia-chi-moi'), '/new-page')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Địa chỉ cũ phải là đường dẫn trong website, không gồm tên miền, query hoặc dấu #.',
    )
    expect(mocks.createRedirect).not.toHaveBeenCalled()
  })

  it('làm sạch tham số URL sai trước khi tải danh sách', async () => {
    const longSearch = 'a'.repeat(250)
    window.history.replaceState({}, '', `/admin/redirects?page=-3&pageSize=999&enabled=unknown&search=${longSearch}`)

    renderScreen()

    await waitFor(() => expect(mocks.fetchRedirects).toHaveBeenCalledWith({
      search: 'a'.repeat(200),
      enabled: 'ALL',
      page: 1,
      pageSize: 20,
    }))
    expect(window.location.search).toBe(`?search=${'a'.repeat(200)}`)
  })

  it('phân biệt danh sách trống với kết quả lọc không có dữ liệu', async () => {
    window.history.replaceState({}, '', '/admin/redirects?search=khong-co')
    renderScreen()

    expect(await screen.findByText('Không có chuyển hướng phù hợp')).toBeInTheDocument()
    expect(screen.getByText('Hãy đổi từ khóa hoặc bộ lọc để xem kết quả khác.')).toBeInTheDocument()
  })

  it('chỉ xóa sau khi người dùng xác nhận thao tác không thể hoàn tác', async () => {
    const user = userEvent.setup()
    mocks.fetchRedirects.mockResolvedValue({
      items: [{
        id: 'rd_delete', sourcePattern: '/old-delete', targetUrl: '/new-delete',
        enabled: true, hitCount: 0, updatedAt: '2026-08-07T00:00:00Z',
      }],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    })
    mocks.showConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    mocks.deleteRedirect.mockResolvedValue(undefined)
    renderScreen()

    const deleteButton = await screen.findByRole('button', { name: 'Xóa chuyển hướng /old-delete' })
    await user.click(deleteButton)
    expect(mocks.deleteRedirect).not.toHaveBeenCalled()

    await user.click(deleteButton)
    await waitFor(() => expect(mocks.deleteRedirect).toHaveBeenCalledWith('rd_delete'))
    expect(mocks.showConfirm).toHaveBeenLastCalledWith(
      'Xóa vĩnh viễn chuyển hướng "/old-delete"? Thao tác này không thể hoàn tác.',
      'Xóa chuyển hướng',
      { confirmLabel: 'common.delete', variant: 'danger' },
    )
  })
})

describe('RedirectListScreen — cảnh báo đi vòng', () => {
  async function fillTargetAndBlur(user, target = '/trung-gian') {
    await user.click(await screen.findByRole('button', { name: 'Tạo chuyển hướng' }))
    await user.type(screen.getByPlaceholderText('/dia-chi-cu'), '/old-page')
    await user.type(screen.getByPlaceholderText('/dia-chi-moi'), target)
    // Rời ô đích để kích hoạt tra chuỗi.
    await user.tab()
  }

  it('đích còn chuyển tiếp thì hiện cảnh báo kèm đích cuối', async () => {
    const user = userEvent.setup()
    mocks.resolveRedirectTarget.mockResolvedValue({ hops: 2, finalTarget: '/dich-cuoi' })
    renderScreen()

    await fillTargetAndBlur(user)

    // t() trong test không nội suy biến, nên chỉ khớp phần tĩnh của câu cảnh báo.
    // Việc đích cuối được truyền ra đúng đã có test "Trỏ thẳng tới đích cuối" bên dưới bảo chứng.
    expect(await screen.findByText(/còn chuyển hướng tiếp tới/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Trỏ thẳng tới đích cuối' })).toBeInTheDocument()
    expect(mocks.resolveRedirectTarget).toHaveBeenCalledWith('/trung-gian')
  })

  it('cảnh báo KHÔNG chặn lưu — vẫn tạo được với đích đang đi vòng', async () => {
    const user = userEvent.setup()
    mocks.resolveRedirectTarget.mockResolvedValue({ hops: 2, finalTarget: '/dich-cuoi' })
    mocks.createRedirect.mockResolvedValue({ id: 'rd_1' })
    renderScreen()

    await fillTargetAndBlur(user)
    await screen.findByText(/còn chuyển hướng tiếp tới/)
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.createRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePattern: '/old-page', targetUrl: '/trung-gian' }),
    ))
  })

  it('bấm "Trỏ thẳng tới đích cuối" thay ô đích và ẩn cảnh báo', async () => {
    const user = userEvent.setup()
    mocks.resolveRedirectTarget.mockResolvedValue({ hops: 3, finalTarget: '/dich-cuoi' })
    renderScreen()

    await fillTargetAndBlur(user)
    await user.click(await screen.findByRole('button', { name: 'Trỏ thẳng tới đích cuối' }))

    expect(screen.getByPlaceholderText('/dia-chi-moi')).toHaveValue('/dich-cuoi')
    await waitFor(() => expect(screen.queryByText(/còn chuyển hướng tiếp tới/)).not.toBeInTheDocument())
  })

  it('đích đi thẳng thì không cảnh báo gì', async () => {
    const user = userEvent.setup()
    mocks.resolveRedirectTarget.mockResolvedValue({ hops: 1, finalTarget: '/trung-gian' })
    renderScreen()

    await fillTargetAndBlur(user)

    await waitFor(() => expect(mocks.resolveRedirectTarget).toHaveBeenCalled())
    expect(screen.queryByText(/còn chuyển hướng tiếp tới/)).not.toBeInTheDocument()
  })

  it('tra chuỗi lỗi mạng thì im lặng, không cản người dùng lưu', async () => {
    const user = userEvent.setup()
    mocks.resolveRedirectTarget.mockRejectedValue(new Error('network down'))
    mocks.createRedirect.mockResolvedValue({ id: 'rd_1' })
    renderScreen()

    await fillTargetAndBlur(user)
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.createRedirect).toHaveBeenCalled())
    expect(screen.queryByText(/còn chuyển hướng tiếp tới/)).not.toBeInTheDocument()
  })
})
