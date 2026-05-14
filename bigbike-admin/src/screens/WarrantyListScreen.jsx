import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchWarranties, voidWarranty } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUSES = ['ALL', 'ACTIVE', 'EXPIRED', 'VOIDED']
const STATUS_COLORS = {
  ACTIVE: '#16a34a',
  EXPIRED: '#d97706',
  VOIDED: '#dc2626',
}
const STATUS_LABELS = {
  ACTIVE: 'Còn hiệu lực',
  EXPIRED: 'Hết hạn',
  VOIDED: 'Đã huỷ',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? '#9ca3af'
  return <span style={{ color, fontWeight: 600, fontSize: '0.8rem' }}>{STATUS_LABELS[status] ?? status}</span>
}

function formatDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('vi-VN')
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function WarrantyDetailModal({ item, onClose, onVoided, canUpdate }) {
  const [detail, setDetail] = useState(item)
  const [voiding, setVoiding] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  async function handleVoid() {
    setVoiding(true)
    setError('')
    try {
      const updated = await voidWarranty(detail.id)
      setDetail(updated)
      onVoided(updated)
      setConfirm(false)
      toast.success('Đã huỷ phiếu bảo hành.')
    } catch (err) {
      setError(err.message || 'Lỗi khi huỷ phiếu bảo hành.')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Chi tiết bảo hành</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Trạng thái: </span>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày tạo: </span>
              <span>{formatDateTime(detail.createdAt)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Email KH: </span>
              <span>{detail.customerEmail ?? '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>SĐT KH: </span>
              <span>{detail.customerPhone ?? '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Bắt đầu: </span>
              <span>{formatDate(detail.startDate)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Kết thúc: </span>
              <span>{formatDate(detail.endDate)}</span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Serial ID: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{detail.serialId}</span>
            </div>
          </div>

          {canUpdate && detail.status !== 'VOIDED' && (
            <div style={{ borderTop: '1px solid var(--admin-color-border)', paddingTop: 14 }}>
              {!confirm ? (
                <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setConfirm(true)}>
                  Huỷ phiếu bảo hành
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: '0.85rem', color: '#dc2626', margin: 0 }}>
                    Xác nhận huỷ phiếu bảo hành này? Hành động không thể hoàn tác.
                  </p>
                  {error && <p className="field-error">{error}</p>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}
                      disabled={voiding}>Không</button>
                    <button type="button" className="btn btn-danger" onClick={handleVoid}
                      disabled={voiding}>{voiding ? 'Đang huỷ…' : 'Xác nhận huỷ'}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { status: 'ALL', page: 1, pageSize: 20 }

export function WarrantyListScreen({ canUpdate }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })
  const [detailItem, setDetailItem] = useState(null)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false }
    let active = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchWarranties(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, error: e.message })
      })
    return () => { active = false }
  }, [query])

  const columns = useMemo(() => [
    {
      key: 'customerEmail', label: 'Email khách hàng', skeletonWidth: '70%',
      render: (r) => <span style={{ fontSize: '0.82rem' }}>{r.customerEmail ?? '—'}</span>,
    },
    {
      key: 'customerPhone', label: 'SĐT', skeletonWidth: '50%',
      render: (r) => <span style={{ fontSize: '0.82rem' }}>{r.customerPhone ?? '—'}</span>,
    },
    {
      key: 'startDate', label: 'Bắt đầu', skeletonWidth: '45%',
      render: (r) => formatDate(r.startDate),
    },
    {
      key: 'endDate', label: 'Kết thúc', skeletonWidth: '45%',
      render: (r) => formatDate(r.endDate),
    },
    {
      key: 'status', label: 'Trạng thái', skeletonWidth: '40%',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'createdAt', label: 'Ngày tạo', skeletonWidth: '55%',
      render: (r) => <span style={{ fontSize: '0.78rem' }}>{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '40%',
      render: (r) => (
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }}
          onClick={() => setDetailItem(r)}>
          Xem
        </button>
      ),
    },
  ], [])

  function handleVoided(updated) {
    setState((s) => ({ ...s, items: s.items.map((i) => i.id === updated.id ? updated : i) }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Hậu mãi · BigBike</p>
          <h1>Quản lý bảo hành</h1>
          <p>Danh sách phiếu bảo hành theo đơn hàng. Có thể huỷ phiếu nếu cần.</p>
        </div>
      </header>

      <section className="filter-bar">
        <label>
          Trạng thái
          <Select value={query.status}
            onValueChange={(val) => setQuery((q) => ({ ...q, status: val, page: 1 }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? 'Tất cả' : (STATUS_LABELS[s] ?? s)}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title="Không tải được danh sách" description={state.error}
          actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Không có phiếu bảo hành" description="Chưa có phiếu bảo hành nào khớp bộ lọc." />
      )}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption="Danh sách bảo hành"
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
          />
          {state.status === 'success' && state.pagination && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </>
      )}

      {detailItem && (
        <WarrantyDetailModal
          key={detailItem.id}
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onVoided={handleVoided}
          canUpdate={canUpdate}
        />
      )}
    </section>
  )
}
