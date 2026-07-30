import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OrderListScreen } from './OrderListScreen'

const mocks = vi.hoisted(() => ({
  fetchOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  exportOrdersCsv: vi.fn(),
  subscribeAdminWs: vi.fn(),
  unsubscribeAdminWs: vi.fn(),
  wsHandler: null,
  showConfirm: vi.fn(),
  canExport: false,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'vi' },
  }),
}))

vi.mock('../lib/adminApi', () => ({
  fetchOrders: mocks.fetchOrders,
  updateOrderStatus: mocks.updateOrderStatus,
  exportOrdersCsv: mocks.exportOrdersCsv,
}))
vi.mock('../lib/adminWebSocket', () => ({
  subscribeAdminWs: mocks.subscribeAdminWs,
}))
vi.mock('../lib/useDebounce', () => ({
  useDebounce: (value) => value,
}))
vi.mock('../lib/auth', () => ({
  useHasPermission: () => (permission) => permission === 'reports.export' && mocks.canExport,
}))
vi.mock('../lib/confirm', () => ({
  showConfirm: mocks.showConfirm,
}))
vi.mock('@/lib/toast', () => ({
  toast: mocks.toast,
}))

vi.mock('../components/FilterSearchInput', () => ({
  FilterSearchInput: ({ value, onChange, placeholder, disabled }) => (
    <input
      type="search"
      aria-label={placeholder}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

vi.mock('../components/FilterSelect', () => ({
  FilterSelect: ({ value, onValueChange, ariaLabel, options = [], disabled }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}))

vi.mock('../components/PageSizeSelect', () => ({
  PageSizeSelect: ({ value, onChange, disabled }) => (
    <select
      aria-label="common.rowsPerPage"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {[20, 50, 100].map((pageSize) => (
        <option key={pageSize} value={pageSize}>{pageSize}</option>
      ))}
    </select>
  ),
}))

vi.mock('../components/ColumnVisibilityToggle', () => ({
  ColumnVisibilityToggle: () => <button type="button">common.columns</button>,
}))

vi.mock('../components/AdminTable', () => ({
  AdminTable: ({
    caption,
    columns,
    rows,
    loading,
    selectable,
    selectedIds,
    onSelectionChange,
  }) => (
    <section
      data-testid="order-table"
      data-loading={loading ? 'true' : 'false'}
      aria-label={caption}
    >
      {!loading && rows.map((row) => (
        <article key={row.id} data-testid={`order-row-${row.id}`}>
          {selectable ? (
            <input
              type="checkbox"
              aria-label={`select-${row.id}`}
              checked={selectedIds.includes(row.id)}
              onChange={() => onSelectionChange(
                selectedIds.includes(row.id)
                  ? selectedIds.filter((id) => id !== row.id)
                  : [...selectedIds, row.id],
              )}
            />
          ) : null}
          {columns.map((column) => (
            <div key={column.key}>
              {column.render ? column.render(row) : row[column.key]}
            </div>
          ))}
        </article>
      ))}
    </section>
  ),
}))

vi.mock('../components/PaginationControls', () => ({
  PaginationControls: ({ pagination, onPageChange }) => {
    if (!pagination?.totalItems) return null
    return (
      <nav aria-label="order-pagination">
        <span data-testid="current-page">{pagination.page}</span>
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          pagination.previous
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          pagination.next
        </button>
      </nav>
    )
  },
}))

const pendingOrder = {
  id: 'order-pending',
  orderNumber: 'BB-2026-0001',
  customerName: 'Nguyễn Văn A',
  customerEmail: 'a@bigbike.test',
  createdAt: '2026-07-24T03:00:00Z',
  total: 2_500_000,
  orderStatus: 'PENDING',
}

const completedOrder = {
  id: 'order-completed',
  orderNumber: 'BB-2026-0002',
  customerName: 'Trần Thị B',
  customerEmail: 'b@bigbike.test',
  createdAt: '2026-07-23T03:00:00Z',
  total: 1_200_000,
  orderStatus: 'COMPLETED',
}

function orderResponse({
  items = [pendingOrder, completedOrder],
  page = 1,
  pageSize = 20,
  totalItems = items.length,
  totalPages = totalItems > 0 ? 1 : 0,
} = {}) {
  return {
    items,
    pagination: { page, pageSize, totalItems, totalPages },
  }
}

function renderScreen({ canUpdate = true, search = '' } = {}) {
  window.history.replaceState({}, '', `/admin/orders${search}`)
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const navigate = vi.fn()

  render(
    <QueryClientProvider client={client}>
      <OrderListScreen navigate={navigate} canUpdate={canUpdate} />
    </QueryClientProvider>,
  )

  return { client, navigate }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mocks.canExport = false
  mocks.wsHandler = null
  mocks.fetchOrders.mockResolvedValue(orderResponse())
  mocks.updateOrderStatus.mockResolvedValue({
    item: { ...pendingOrder, orderStatus: 'PROCESSING' },
  })
  mocks.exportOrdersCsv.mockResolvedValue({ truncated: false, maxRows: null })
  mocks.showConfirm.mockResolvedValue(false)
  mocks.subscribeAdminWs.mockImplementation((_destination, handler) => {
    mocks.wsHandler = handler
    return mocks.unsubscribeAdminWs
  })
})

describe('OrderListScreen', () => {
  it('hiển thị trạng thái tải ban đầu trong bảng đơn hàng', () => {
    mocks.fetchOrders.mockReturnValue(new Promise(() => {}))

    renderScreen()

    expect(screen.getByTestId('order-table')).toHaveAttribute('data-loading', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('orders.loading')
  })

  it('hiển thị lỗi tải và thử lại thành công', async () => {
    const user = userEvent.setup()
    mocks.fetchOrders.mockRejectedValueOnce(new Error('Không thể kết nối máy chủ'))

    renderScreen()

    expect(await screen.findByText('orders.loadError')).toBeInTheDocument()
    expect(screen.getByText('orders.loadErrorDesc')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common.retry' }))

    expect(await screen.findByText('BB-2026-0001')).toBeInTheDocument()
    expect(mocks.fetchOrders).toHaveBeenCalledTimes(2)
  })

  it('giữ danh sách cũ, khoá thao tác và cho thử lại khi làm mới nền thất bại', async () => {
    mocks.fetchOrders
      .mockResolvedValueOnce(orderResponse())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(orderResponse())
    const user = userEvent.setup()
    renderScreen()

    expect(await screen.findByText('BB-2026-0001')).toBeInTheDocument()
    await act(async () => {
      mocks.wsHandler()
    })

    expect(await screen.findByText('orders.refreshError')).toBeInTheDocument()
    expect(screen.getByText('BB-2026-0001')).toBeInTheDocument()
    expect(screen.getByLabelText('orders.processingOrderLabel')).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'common.retry' }))
    await waitFor(() => expect(screen.queryByText('orders.refreshError')).not.toBeInTheDocument())
    expect(mocks.fetchOrders).toHaveBeenCalledTimes(3)
  })

  it('phân biệt danh sách chưa từng có đơn với kết quả lọc rỗng', async () => {
    mocks.fetchOrders.mockResolvedValue(orderResponse({
      items: [],
      totalItems: 0,
      totalPages: 0,
    }))

    const first = renderScreen()
    expect(await screen.findByText('orders.emptyAll')).toBeInTheDocument()
    expect(screen.queryByText('orders.empty')).not.toBeInTheDocument()

    first.client.clear()
  })

  it('gửi đúng bộ lọc trạng thái và tìm kiếm, đồng thời cho phép xoá bộ lọc', async () => {
    const user = userEvent.setup()
    mocks.fetchOrders.mockImplementation(async (query) => (
      query.orderStatus === 'PROCESSING' || query.search
        ? orderResponse({ items: [], totalItems: 0, totalPages: 0 })
        : orderResponse()
    ))

    renderScreen()
    await screen.findByText('BB-2026-0001')

    await user.click(screen.getByRole('button', { name: 'status.order.PROCESSING' }))
    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderStatus: 'PROCESSING', page: 1 }),
    ))

    await user.type(screen.getByRole('searchbox', { name: 'orders.searchPlaceholder' }), 'BB-0009')
    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'BB-0009',
        orderStatus: 'PROCESSING',
        page: 1,
      }),
    ))
    expect(await screen.findByText('orders.empty')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common.clearAllFilters' }))
    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', orderStatus: 'ALL', page: 1 }),
    ))
  })

  it('đổi trang và giữ nguyên bộ lọc hiện tại', async () => {
    const user = userEvent.setup()
    mocks.fetchOrders.mockImplementation(async (query) => orderResponse({
      items: [pendingOrder],
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 21,
      totalPages: 2,
    }))

    renderScreen({ search: '?orderStatus=PENDING' })
    await screen.findByText('BB-2026-0001')

    await user.click(screen.getByRole('button', { name: 'pagination.next' }))

    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, orderStatus: 'PENDING' }),
    ))
  })

  it.each([
    ['trang bằng 0', '?page=0'],
    ['trang vượt quá tổng số trang', '?page=999'],
  ])('đưa %s về một trang hợp lệ', async (_label, search) => {
    mocks.fetchOrders.mockImplementation(async (query) => {
      const validPage = query.page >= 1 && query.page <= 2
      return orderResponse({
        items: validPage ? [pendingOrder] : [],
        page: query.page,
        pageSize: query.pageSize,
        totalItems: 21,
        totalPages: 2,
      })
    })

    renderScreen({ search })

    await waitFor(() => {
      const lastQuery = mocks.fetchOrders.mock.calls.at(-1)?.[0]
      expect(lastQuery?.page).toBeGreaterThanOrEqual(1)
      expect(lastQuery?.page).toBeLessThanOrEqual(2)
    })
    expect(window.location.search).not.toContain('page=0')
    expect(window.location.search).not.toContain('page=999')
  })

  it('ở chế độ chỉ đọc thì có cảnh báo và không có thao tác đổi trạng thái hoặc chọn hàng', async () => {
    renderScreen({ canUpdate: false })

    expect(await screen.findByText('orders.readOnlyWarning')).toBeInTheDocument()
    expect(screen.queryByLabelText('orders.processingOrderLabel')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('select-order-pending')).not.toBeInTheDocument()
  })

  it('chuyển nhanh đơn đang chờ sang đang xử lý và báo kết quả', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(await screen.findByLabelText('orders.processingOrderLabel'))

    await waitFor(() => expect(mocks.updateOrderStatus).toHaveBeenCalledWith(
      'order-pending',
      'PROCESSING',
    ))
    expect(mocks.toast.success).toHaveBeenCalledWith('orders.detail.statusUpdated')
  })

  it.each([
    [403, 'orders.detail.errorForbidden'],
    [404, 'orders.detail.errorNotFound'],
    [409, 'orders.detail.errorConflict'],
  ])('báo lỗi rõ ràng khi đổi trạng thái nhanh nhận HTTP %s', async (status, expectedMessage) => {
    const user = userEvent.setup()
    mocks.updateOrderStatus.mockRejectedValueOnce(Object.assign(new Error('Backend message'), { status }))

    renderScreen()
    await user.click(await screen.findByLabelText('orders.processingOrderLabel'))

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(expectedMessage))
    if (status === 404 || status === 409) {
      await waitFor(() => expect(mocks.fetchOrders.mock.calls.length).toBeGreaterThanOrEqual(2))
    }
    expect(mocks.toast.success).not.toHaveBeenCalled()
  })

  it('báo lỗi kết nối thân thiện khi đổi trạng thái nhanh mất mạng', async () => {
    const user = userEvent.setup()
    mocks.updateOrderStatus.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    renderScreen()
    await user.click(await screen.findByLabelText('orders.processingOrderLabel'))

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith('orders.detail.errorNetwork'))
  })

  it('hành động hàng loạt chỉ chuyển các đơn đang chờ sau khi xác nhận', async () => {
    const user = userEvent.setup()
    mocks.showConfirm.mockResolvedValue(true)
    renderScreen()
    await screen.findByText('BB-2026-0001')

    await user.click(screen.getByLabelText('select-order-pending'))
    await user.click(screen.getByLabelText('select-order-completed'))
    await user.click(screen.getByRole('button', { name: 'orders.bulkProcessingAction' }))

    await waitFor(() => expect(mocks.showConfirm).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.updateOrderStatus).toHaveBeenCalledTimes(1))
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith('order-pending', 'PROCESSING')
    expect(mocks.toast.success).toHaveBeenCalledWith('orders.bulkProcessingResult')
  })

  it('không mở lặp xác nhận hàng loạt khi lần xác nhận đầu còn chờ', async () => {
    const user = userEvent.setup()
    let resolveConfirm
    mocks.showConfirm.mockReturnValue(new Promise((resolve) => { resolveConfirm = resolve }))
    renderScreen()
    await screen.findByText('BB-2026-0001')

    await user.click(screen.getByLabelText('select-order-pending'))
    const action = screen.getByRole('button', { name: 'orders.bulkProcessingAction' })
    await user.click(action)
    await waitFor(() => expect(action).toBeDisabled())
    await user.click(action)

    expect(mocks.showConfirm).toHaveBeenCalledTimes(1)
    await act(async () => resolveConfirm(false))
  })

  it('lọc ngày Việt Nam và xuất toàn bộ đơn theo đúng bộ lọc hiện tại', async () => {
    const user = userEvent.setup()
    mocks.canExport = true
    renderScreen({
      search: '?search=0909&orderStatus=PROCESSING&from=2026-07-20&to=2026-07-24',
    })

    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: '0909',
        orderStatus: 'PROCESSING',
        from: '2026-07-20',
        to: '2026-07-24',
      }),
    ))

    await user.click(await screen.findByRole('button', { name: 'common.exportCsv' }))

    await waitFor(() => expect(mocks.exportOrdersCsv).toHaveBeenCalledWith({
      q: '0909',
      status: 'PROCESSING',
      from: '2026-07-20',
      to: '2026-07-24',
    }))
    expect(mocks.toast.success).toHaveBeenCalledWith('common.exportCsvDone')
    expect(mocks.toast.warning).not.toHaveBeenCalled()
  })

  it('đổi và xoá khoảng ngày trong URL cùng bộ lọc', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByText('BB-2026-0001')

    fireEvent.change(screen.getByLabelText('orders.filterFrom'), {
      target: { value: '2026-07-21' },
    })
    fireEvent.change(screen.getByLabelText('orders.filterTo'), {
      target: { value: '2026-07-25' },
    })

    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-07-21', to: '2026-07-25', page: 1 }),
    ))
    expect(window.location.search).toContain('from=2026-07-21')
    expect(window.location.search).toContain('to=2026-07-25')

    await user.click(screen.getByRole('button', { name: 'common.clearAllFilters' }))
    await waitFor(() => expect(mocks.fetchOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '', to: '', page: 1 }),
    ))
    expect(window.location.search).not.toContain('from=')
    expect(window.location.search).not.toContain('to=')
  })

  it('không còn nút "Làm mới" thủ công trong toolbar — websocket là nguồn cập nhật chính', async () => {
    renderScreen()
    await screen.findByText('BB-2026-0001')

    expect(screen.queryByRole('button', { name: 'orders.refresh' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'orders.refreshing' })).not.toBeInTheDocument()
  })

  it('làm mới dữ liệu khi có thông báo đơn hàng thời gian thực ở mọi bộ lọc', async () => {
    mocks.fetchOrders.mockImplementation(async (query) => orderResponse({
      items: [pendingOrder],
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 21,
      totalPages: 2,
    }))
    renderScreen({ search: '?orderStatus=PROCESSING&page=2' })
    await screen.findByText('BB-2026-0001')

    expect(mocks.subscribeAdminWs).toHaveBeenCalledWith(
      '/topic/admin/orders',
      expect.any(Function),
    )
    const callsBeforeMessage = mocks.fetchOrders.mock.calls.length

    await act(async () => {
      mocks.wsHandler()
    })

    await waitFor(() => expect(mocks.fetchOrders.mock.calls.length).toBeGreaterThan(callsBeforeMessage))
  })
})
