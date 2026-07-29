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
  }
})
vi.mock('../lib/confirm', () => ({ showConfirm: mocks.showConfirm }))
vi.mock('@/lib/toast', () => ({ toast: mocks.toast }))
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns }) => (
    <div data-testid="redirect-table">
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
})

async function openCreateFormAndFill(user) {
  await user.click(await screen.findByRole('button', { name: 'Tạo chuyển hướng' }))
  await user.type(screen.getByPlaceholderText('/old-url'), '/old-page')
  await user.type(screen.getByPlaceholderText('/new-url'), '/new-page')
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
    expect(alert).toHaveTextContent('URL đích không được trùng với mẫu nguồn.')
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
    await user.type(screen.getByPlaceholderText('/old-url'), '  /old-page  ')
    await user.type(screen.getByPlaceholderText('/new-url'), '  /new-page  ')
    await user.click(screen.getByRole('button', { name: 'common.save' }))

    await waitFor(() => expect(mocks.createRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePattern: '/old-page', targetUrl: '/new-page', redirectType: 'PERMANENT' }),
    ))
  })

  it('chỉ có quyền đọc thì ẩn nút tạo chuyển hướng', async () => {
    renderScreen(false)
    expect(await screen.findByTestId('redirect-table')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo chuyển hướng' })).not.toBeInTheDocument()
  })
})
