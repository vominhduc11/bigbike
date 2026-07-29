import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditLogListScreen } from './AuditLogListScreen'

const mocks = vi.hoisted(() => ({
  fetchAuditLogs: vi.fn(),
  exportToCsv: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, values = {}) => {
      if (values && 'defaultValue' in values && typeof values.defaultValue === 'string') {
        return values.defaultValue.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
      }
      return key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? name))
    },
    i18n: { language: 'vi' },
  }),
}))

vi.mock('../lib/adminApi', () => ({ fetchAuditLogs: mocks.fetchAuditLogs }))

// Giữ nguyên phần còn lại của constants, chỉ thay hàm xuất tệp (jsdom không có
// URL.createObjectURL) để kiểm tra ĐÚNG dữ liệu nào được đưa đi xuất.
vi.mock('./audit-log-list/constants', async (importOriginal) => ({
  ...(await importOriginal()),
  exportToCsv: mocks.exportToCsv,
}))

// Bảng thật dùng Radix + nhiều lớp bọc; ở đây chỉ cần biết nó nhận dòng nào và
// cho phép kích hoạt sắp xếp / bấm dòng.
vi.mock('../components/AdminTable', () => ({
  AdminTable: ({ rows, columns, loading, onRowClick, onSortChange, rowClassName }) => (
    <div data-testid="audit-table" data-loading={String(!!loading)}>
      {rows.map((row) => (
        <div key={row.id} data-testid="audit-row" data-row-class={rowClassName ? rowClassName(row) : ''}>
          <button type="button" onClick={() => onRowClick(row)}>mo-{row.id}</button>
          {columns.map((column) => (
            <span key={column.key} data-col={column.key}>
              {column.render ? column.render(row) : row[column.key]}
            </span>
          ))}
        </div>
      ))}
      <button type="button" onClick={() => onSortChange('actor', 'asc')}>sap-xep-nguoi-thuc-hien</button>
    </div>
  ),
}))

vi.mock('../components/ColumnVisibilityToggle', () => ({
  ColumnVisibilityToggle: () => <div data-testid="column-toggle" />,
}))

vi.mock('./audit-log-list/AuditDetailDrawer', () => ({
  AuditDetailDrawer: ({ log, onClose }) => (
    <div role="dialog" aria-label="chi-tiet">
      <span data-testid="drawer-log-id">{log.id}</span>
      <button type="button" onClick={onClose}>dong-drawer</button>
    </div>
  ),
}))

vi.mock('./audit-log-list/MobileFilterDrawer', () => ({
  MobileFilterDrawer: ({ onClose }) => (
    <div data-testid="mobile-filter"><button type="button" onClick={onClose}>dong-loc</button></div>
  ),
}))

function makeLog(overrides = {}) {
  return {
    id: 'log-1',
    actorType: 'ADMIN',
    actorId: 'admin-1',
    actorDisplayName: 'Minh',
    actorEmail: 'minh@bigbike.vn',
    action: 'PRODUCT_UPDATED',
    resourceType: 'PRODUCT',
    resourceId: null,
    resourceDisplayName: 'Mũ bảo hiểm LS2',
    resourceCode: null,
    beforeData: null,
    afterData: null,
    ipAddress: '203.0.113.9',
    createdAt: '2026-07-25T03:00:00Z',
    ...overrides,
  }
}

// Ô ngày phải đặt giá trị trong một lần — `user.type` gõ từng ký tự sẽ tạo ra
// hàng loạt giá trị trung gian và kéo theo nhiều lượt gọi máy chủ.
function setDateRange(from, to) {
  if (from !== null) fireEvent.change(screen.getByLabelText(/auditLog.filterFrom/), { target: { value: from } })
  if (to !== null) fireEvent.change(screen.getByLabelText(/auditLog.filterTo/), { target: { value: to } })
}

function resolveWith(items, pagination) {
  mocks.fetchAuditLogs.mockResolvedValue({
    items,
    pagination: pagination ?? { page: 1, pageSize: 20, totalItems: items.length, totalPages: 1 },
    mode: 'live',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/admin/audit-logs')
  localStorage.clear()
})

describe('tải danh sách', () => {
  it('hiện khung chờ rồi thay bằng dữ liệu', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)

    expect(screen.getByTestId('audit-table')).toHaveAttribute('data-loading', 'true')
    await waitFor(() => expect(screen.getByTestId('audit-table')).toHaveAttribute('data-loading', 'false'))
    // Bảng desktop và danh sách thẻ mobile cùng render một bản ghi.
    expect(screen.getAllByText('Mũ bảo hiểm LS2').length).toBeGreaterThan(0)
  })

  it('gọi máy chủ đúng một lần khi mở màn hình', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(mocks.fetchAuditLogs).toHaveBeenCalledTimes(1))
    expect(mocks.fetchAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20, actorType: 'ALL', resourceType: 'ALL' }),
    )
  })

  it('đánh dấu dòng nguy hiểm cho thao tác xoá vĩnh viễn', async () => {
    resolveWith([makeLog({ id: 'log-hard', action: 'PRODUCT_HARD_DELETED' })])
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())
    expect(screen.getByTestId('audit-row').dataset.rowClass).toContain('bb-row-accent--danger')
  })

  it('không đánh dấu nguy hiểm cho thao tác cập nhật thường', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())
    expect(screen.getByTestId('audit-row').dataset.rowClass).not.toContain('bb-row-accent--danger')
  })

  it('không hiển thị undefined/null khi bản ghi thiếu dữ liệu', async () => {
    resolveWith([makeLog({
      actorDisplayName: null, actorEmail: null, resourceDisplayName: null, resourceCode: null,
      resourceId: null, action: '', resourceType: '',
    })])
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())
    expect(screen.getByTestId('audit-row').textContent).not.toMatch(/undefined|null|NaN|\[object Object\]/)
  })
})

describe('trạng thái rỗng và lỗi', () => {
  it('chưa có nhật ký nào thì báo trống, không kèm nút xoá lọc', async () => {
    resolveWith([], { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 })
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByText('auditLog.empty')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'auditLog.resetFilters' })).not.toBeInTheDocument()
  })

  it('lọc không ra kết quả thì báo khác và cho xoá lọc', async () => {
    const user = userEvent.setup()
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    resolveWith([], { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 })
    await user.type(screen.getByPlaceholderText('auditLog.filterSearchPlaceholder'), 'khong-co-gi')
    await user.click(screen.getByRole('button', { name: 'auditLog.filterQuickSearch' }))

    await waitFor(() => expect(screen.getByText('auditLog.emptyFiltered')).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: 'auditLog.resetFilters' }).length).toBeGreaterThan(0)
  })

  it('lỗi tải hiện thông báo của máy chủ và cho thử lại', async () => {
    const user = userEvent.setup()
    mocks.fetchAuditLogs.mockRejectedValueOnce(new Error('Không thể kết nối máy chủ, vui lòng kiểm tra mạng'))
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByText('auditLog.errorLoadTitle')).toBeInTheDocument())
    expect(screen.getByText('Không thể kết nối máy chủ, vui lòng kiểm tra mạng')).toBeInTheDocument()

    resolveWith([makeLog()])
    await user.click(screen.getByRole('button', { name: 'auditLog.errorRetry' }))
    await waitFor(() => expect(screen.getAllByText('Mũ bảo hiểm LS2').length).toBeGreaterThan(0))
    expect(screen.queryByText('auditLog.errorLoadTitle')).not.toBeInTheDocument()
  })

  it('bảng trống thì nút xuất tệp bị khoá', async () => {
    resolveWith([], { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 })
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByText('auditLog.empty')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /auditLog.exportBtn/ })).toBeDisabled()
  })
})

describe('khoảng ngày ngược', () => {
  it('báo lỗi ngay và KHÔNG gọi máy chủ', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())
    const callsBefore = mocks.fetchAuditLogs.mock.calls.length

    setDateRange('2026-07-25', '2026-07-01')

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    ))
    // Khoảng ngày ngược chắc chắn ra 0 kết quả — không tốn thêm lượt gọi nào.
    expect(mocks.fetchAuditLogs.mock.calls.length).toBe(callsBefore + 1)
    expect(mocks.fetchAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-07-25', to: '' }))
  })

  it('không hiện panel "không tìm thấy" gây hiểu nhầm khi khoảng ngày sai', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    setDateRange('2026-07-25', '2026-07-01')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText('auditLog.emptyFiltered')).not.toBeInTheDocument()
    expect(screen.queryByText('auditLog.empty')).not.toBeInTheDocument()
    // Không còn khung chờ quay mãi.
    expect(screen.queryByTestId('audit-table')).not.toBeInTheDocument()
  })

  it('đánh dấu 2 ô ngày là không hợp lệ để người dùng biết sửa ở đâu', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    setDateRange('2026-07-25', '2026-07-01')

    await waitFor(() => expect(screen.getByLabelText(/auditLog.filterFrom/)).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByLabelText(/auditLog.filterTo/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('sửa lại khoảng ngày hợp lệ thì gọi máy chủ trở lại', async () => {
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    setDateRange('2026-07-25', '2026-07-01')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    setDateRange(null, '2026-07-26')

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(mocks.fetchAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-07-25', to: '2026-07-26' }),
    )
  })
})

describe('xuất tệp', () => {
  it('xuất theo đúng thứ tự đang hiển thị sau khi sắp xếp', async () => {
    const user = userEvent.setup()
    resolveWith([
      makeLog({ id: 'log-z', actorDisplayName: 'Zũng' }),
      makeLog({ id: 'log-a', actorDisplayName: 'An' }),
    ])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getAllByTestId('audit-row')).toHaveLength(2))

    await user.click(screen.getByRole('button', { name: 'sap-xep-nguoi-thuc-hien' }))
    await user.click(screen.getByRole('button', { name: /auditLog.exportBtn/ }))

    expect(mocks.exportToCsv).toHaveBeenCalledTimes(1)
    const exported = mocks.exportToCsv.mock.calls[0][0].map((log) => log.id)
    expect(exported).toEqual(['log-a', 'log-z'])
  })

  it('ghi rõ giới hạn chỉ xuất trang đang xem khi còn nhiều trang', async () => {
    resolveWith([makeLog()], { page: 1, pageSize: 20, totalItems: 95, totalPages: 5 })
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByText(
      'Sắp xếp và xuất dữ liệu chỉ áp dụng cho các dòng trong trang đang xem.',
    )).toBeInTheDocument())
  })

  it('không hiện ghi chú giới hạn khi kết quả gọn trong một trang', async () => {
    resolveWith([makeLog()], { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 })
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())
    expect(screen.queryByText(
      'Sắp xếp và xuất dữ liệu chỉ áp dụng cho các dòng trong trang đang xem.',
    )).not.toBeInTheDocument()
  })
})

describe('bảng chi tiết', () => {
  it('bấm vào dòng thì mở chi tiết và ghi vào địa chỉ trang', async () => {
    const user = userEvent.setup()
    resolveWith([makeLog({ id: 'log-42' })])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'mo-log-42' }))

    expect(screen.getByTestId('drawer-log-id')).toHaveTextContent('log-42')
    expect(new URLSearchParams(window.location.search).get('detail')).toBe('log-42')
  })

  it('đóng chi tiết thì gỡ tham số khỏi địa chỉ trang', async () => {
    const user = userEvent.setup()
    resolveWith([makeLog({ id: 'log-42' })])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'mo-log-42' }))
    await user.click(screen.getByRole('button', { name: 'dong-drawer' }))

    expect(screen.queryByRole('dialog', { name: 'chi-tiet' })).not.toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('detail')).toBeNull()
  })

  it('mở thẳng bằng liên kết có sẵn thì tự bật chi tiết', async () => {
    window.history.replaceState({}, '', '/admin/audit-logs?detail=log-77')
    resolveWith([makeLog({ id: 'log-77' })])
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByTestId('drawer-log-id')).toHaveTextContent('log-77'))
  })

  it('liên kết trỏ tới bản ghi không có trong trang thì gỡ tham số, không treo', async () => {
    window.history.replaceState({}, '', '/admin/audit-logs?detail=khong-ton-tai')
    resolveWith([makeLog({ id: 'log-1' })])
    render(<AuditLogListScreen />)

    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())
    expect(screen.queryByRole('dialog', { name: 'chi-tiet' })).not.toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('detail')).toBeNull()
  })
})

describe('bộ lọc', () => {
  it('tìm kiếm gửi từ khoá và quay về trang 1', async () => {
    const user = userEvent.setup()
    resolveWith([makeLog()], { page: 3, pageSize: 20, totalItems: 95, totalPages: 5 })
    render(<AuditLogListScreen />)
    await waitFor(() => expect(mocks.fetchAuditLogs).toHaveBeenCalledTimes(1))

    await user.type(screen.getByPlaceholderText('auditLog.filterSearchPlaceholder'), 'LS2')
    await user.click(screen.getByRole('button', { name: 'auditLog.filterQuickSearch' }))

    await waitFor(() => expect(mocks.fetchAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'LS2', page: 1 }),
    ))
  })

  it('hiện thẻ bộ lọc đang áp dụng và cho gỡ từng cái', async () => {
    const user = userEvent.setup()
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('auditLog.filterSearchPlaceholder'), 'LS2')
    await user.click(screen.getByRole('button', { name: 'auditLog.filterQuickSearch' }))

    const chips = await screen.findByRole('group', { name: 'Bộ lọc đang áp dụng' })
    expect(within(chips).getByText('Tìm: "LS2"')).toBeInTheDocument()
  })

  it('xoá lọc đưa mọi điều kiện về mặc định', async () => {
    const user = userEvent.setup()
    resolveWith([makeLog()])
    render(<AuditLogListScreen />)
    await waitFor(() => expect(screen.getByTestId('audit-row')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('auditLog.filterSearchPlaceholder'), 'LS2')
    await user.click(screen.getByRole('button', { name: 'auditLog.filterQuickSearch' }))
    await waitFor(() => expect(mocks.fetchAuditLogs).toHaveBeenCalledTimes(2))

    await user.click(screen.getAllByRole('button', { name: 'auditLog.resetFilters' })[0])

    await waitFor(() => expect(mocks.fetchAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '', from: '', to: '', actorType: 'ALL', resourceType: 'ALL', page: 1 }),
    ))
    expect(screen.getByPlaceholderText('auditLog.filterSearchPlaceholder')).toHaveValue('')
  })
})
