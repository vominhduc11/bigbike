import { useEffect, useMemo, useState } from 'react'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { deleteReview, fetchReviews, updateReviewStatus } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

const STATUS_OPTIONS = ['ALL', 'APPROVED', 'PENDING', 'SPAM', 'TRASH']
const STATUS_TONES = { APPROVED: 'success', PENDING: 'warning', SPAM: 'neutral', TRASH: 'neutral' }

const INITIAL_QUERY = { search: '', status: 'ALL', page: 1, pageSize: 20 }

export function ReviewListScreen({ canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })

  useEffect(() => {
    let active = true
    fetchReviews(query)
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [query])

  async function handleStatusChange(review, newStatus) {
    try {
      const r = await updateReviewStatus(review.id, newStatus)
      setState((p) => ({ ...p, items: p.items.map((rv) => rv.id === review.id ? r.item : rv) }))
    } catch (e) { alert(e.message) }
  }

  async function handleDelete(reviewId) {
    if (!window.confirm('Xoá đánh giá này?')) return
    try {
      await deleteReview(reviewId)
      setState((p) => ({ ...p, items: p.items.filter((rv) => rv.id !== reviewId) }))
    } catch (e) { alert(e.message) }
  }

  const columns = useMemo(() => [
    { key: 'author', label: 'Tác giả', render: (r) => r.authorName || '(ẩn danh)' },
    { key: 'productId', label: 'Sản phẩm', render: (r) => <code style={{ fontSize: '0.75rem' }}>{r.productId}</code> },
    { key: 'rating', label: '★', render: (r) => r.rating },
    { key: 'body', label: 'Nội dung', render: (r) => <span style={{ fontSize: '0.85rem' }}>{r.body?.slice(0, 80)}{r.body?.length > 80 ? '...' : ''}</span> },
    { key: 'status', label: 'Trạng thái', render: (r) => <span className={`status-badge status-${STATUS_TONES[r.status] || 'neutral'}`}>{r.status}</span> },
    { key: 'createdAt', label: 'Ngày', render: (r) => formatDateTime(r.createdAt) },
    canUpdate ? {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
          {r.status !== 'APPROVED' && <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleStatusChange(r, 'APPROVED')}>Duyệt</button>}
          {r.status !== 'SPAM' && <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleStatusChange(r, 'SPAM')}>Spam</button>}
          <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDelete(r.id)}>Xoá</button>
        </div>
      ),
    } : null,
  ].filter(Boolean), [canUpdate])

  function updateQuery(partial, options = { resetPage: false }) {
    setState((p) => ({ ...p, status: 'loading' }))
    setQuery((p) => ({ ...p, ...partial, page: options.resetPage ? 1 : p.page }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Đánh giá sản phẩm</h1>
          <p>Duyệt và quản lý đánh giá của khách hàng.</p>
        </div>
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>Tìm kiếm
          <input className="control-input" type="search" value={query.search}
            onChange={(e) => updateQuery({ search: e.target.value }, { resetPage: true })} placeholder="Tên tác giả, nội dung" />
        </label>
        <label>Trạng thái
          <select className="control-select" value={query.status} onChange={(e) => updateQuery({ status: e.target.value }, { resetPage: true })}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </section>

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải đánh giá" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi" description={state.error} actionLabel="Thử lại" onAction={() => setQuery((p) => ({ ...p }))} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title="Không có đánh giá" description="Không tìm thấy đánh giá nào." actionLabel="Xoá lọc" onAction={() => setQuery(INITIAL_QUERY)} />}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <AdminTable caption="Danh sách đánh giá" columns={columns} rows={state.items} />
          <PaginationControls pagination={state.pagination} onPageChange={(p) => updateQuery({ page: p })} />
        </>
      )}
    </section>
  )
}
