import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchOrders } from '../lib/adminApi'
import { subscribeAdminWs } from '../lib/adminWebSocket'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const ORDER_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  ON_HOLD: 'Tạm giữ',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn',
  UNKNOWN: 'Không rõ',
}

const STATUS_TONES = {
  PENDING: 'warning',
  ON_HOLD: 'warning',
  PROCESSING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  UNKNOWN: 'neutral',
}

function OrderStatusBadge({ value }) {
  const tone = STATUS_TONES[value] || 'neutral'
  return <span className={`status-badge status-${tone}`}>{ORDER_STATUS_LABELS[value] || value}</span>
}

const INITIAL_QUERY = {
  search: '',
  orderStatus: 'ALL',
  sort: 'createdAt:desc',
  page: 1,
  pageSize: 10,
}

export function OrderListScreen({ navigate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  // Incremented by WS events to trigger a silent background refetch
  const [wsRevision, setWsRevision] = useState(0)
  const isFirstPage = query.page === 1 && query.orderStatus === 'ALL' && !query.search

  useEffect(() => {
    let active = true
    fetchOrders(query)
      .then((response) => {
        if (!active) return
        setState({ status: 'success', items: response.items, pagination: response.pagination, warning: response.mode === 'mock' ? response.warning : '' })
      })
      .catch((error) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: error.message })
      })
    return () => { active = false }
  }, [query, wsRevision])

  // Re-fetch silently when a new order or status change arrives — only on page 1 / no filters
  // to avoid disrupting admins who are in the middle of filtering.
  useEffect(() => {
    if (!isFirstPage) return
    const unsubscribe = subscribeAdminWs('/topic/admin/orders', () => {
      setWsRevision((r) => r + 1)
    })
    return unsubscribe
  }, [isFirstPage])

  const columns = useMemo(() => [
    {
      key: 'orderNumber',
      label: 'Đơn hàng',
      render: (order) => (
        <div>
          <strong>{formatText(order.orderNumber)}</strong>
          <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{formatText(order.customerEmail)}</p>
        </div>
      ),
    },
    { key: 'customerName', label: 'Khách hàng', render: (order) => formatText(order.customerName) },
    { key: 'orderStatus', label: 'Trạng thái', render: (order) => <OrderStatusBadge value={order.orderStatus} /> },
    { key: 'total', label: 'Tổng tiền', render: (order) => formatCurrencyVnd(order.total) },
    { key: 'createdAt', label: 'Ngày đặt', render: (order) => formatDateTime(order.createdAt) },
    {
      key: 'actions', label: '', align: 'right',
      render: (order) => (
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/admin/orders/${order.id}`)}>Chi tiết</button>
      ),
    },
  ], [navigate])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((prev) => ({ ...prev, status: 'loading' }))
    setQuery((prev) => ({ ...prev, ...partial, page: options.resetPage ? 1 : prev.page }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Commerce</p>
          <h1>Đơn hàng</h1>
          <p>Quản lý và xử lý đơn hàng từ khách hàng.</p>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>
          Tìm kiếm
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })}
            placeholder="Số đơn, email khách hàng" />
        </label>
        <label>
          Trạng thái
          <select className="control-select" value={query.orderStatus}
            onChange={(e) => updateQuery({ orderStatus: e.target.value }, { resetPage: true })}>
            <option value="ALL">Tất cả</option>
            {Object.entries(ORDER_STATUS_LABELS).filter(([k]) => k !== 'UNKNOWN').map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sắp xếp
          <select className="control-select" value={query.sort}
            onChange={(e) => updateQuery({ sort: e.target.value }, { resetPage: true })}>
            <option value="createdAt:desc">Mới nhất</option>
            <option value="createdAt:asc">Cũ nhất</option>
            <option value="total:desc">Giá trị cao nhất</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải đơn hàng" description="Vui lòng chờ..." />}
      {state.status === 'error' && (
        <StatePanel tone="danger" title="Lỗi tải đơn hàng" description={state.error}
          actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Không có đơn hàng" description="Chưa có đơn hàng nào khớp với điều kiện lọc."
          actionLabel="Xoá lọc" onAction={() => setQuery(INITIAL_QUERY)} />
      )}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <AdminTable caption="Danh sách đơn hàng" columns={columns} rows={state.items} />
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
