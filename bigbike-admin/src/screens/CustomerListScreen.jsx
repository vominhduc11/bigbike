import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchCustomers } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const STATUS_LABELS = { ACTIVE: 'Hoạt động', INACTIVE: 'Tạm khoá', BANNED: 'Bị cấm', UNKNOWN: 'Không rõ' }
const STATUS_TONES = { ACTIVE: 'success', INACTIVE: 'warning', BANNED: 'danger', UNKNOWN: 'neutral' }

function CustomerStatusBadge({ value }) {
  const tone = STATUS_TONES[value] || 'neutral'
  return <span className={`status-badge status-${tone}`}>{STATUS_LABELS[value] || value}</span>
}

const INITIAL_QUERY = { search: '', status: 'ALL', sort: 'createdAt:desc', page: 1, pageSize: 10 }

export function CustomerListScreen({ navigate, canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })

  useEffect(() => {
    let active = true
    fetchCustomers(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Khách hàng',
      render: (c) => (
        <div>
          <strong>{formatText(c.fullName)}</strong>
          <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{formatText(c.email)}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Điện thoại', render: (c) => formatText(c.phone) },
    { key: 'status', label: 'Trạng thái', render: (c) => <CustomerStatusBadge value={c.status} /> },
    { key: 'orderCount', label: 'Đơn hàng', render: (c) => c.orderCount },
    { key: 'totalSpent', label: 'Tổng chi', render: (c) => formatCurrencyVnd(c.totalSpent) },
    { key: 'createdAt', label: 'Ngày đăng ký', render: (c) => formatDateTime(c.createdAt) },
    {
      key: 'actions', label: '', align: 'right',
      render: (c) => (
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/admin/customers/${c.id}`)}>Chi tiết</button>
      ),
    },
  ], [navigate])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => ({ ...p, ...partial, page: options.resetPage ? 1 : p.page }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Commerce</p>
          <h1>Khách hàng</h1>
          <p>Quản lý tài khoản và thông tin khách hàng.</p>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          Tìm kiếm
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })}
            placeholder="Tên, email, số điện thoại" />
        </label>
        <label>
          Trạng thái
          <select className="control-select" value={query.status}
            onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Tạm khoá</option>
            <option value="BANNED">Bị cấm</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải khách hàng" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi tải dữ liệu" description={state.error} actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title="Không có khách hàng" description="Chưa có khách hàng nào khớp điều kiện." actionLabel="Xoá lọc" onAction={() => setQuery(INITIAL_QUERY)} />}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <AdminTable caption="Danh sách khách hàng" columns={columns} rows={state.items} />
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
