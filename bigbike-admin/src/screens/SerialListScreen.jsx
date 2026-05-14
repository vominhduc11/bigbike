import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchAllSerials, updateSerialStatus } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const ALL_STATUSES = ['ALL', 'IN_STOCK', 'RESERVED', 'SOLD', 'RETURNED', 'INSPECTION', 'DAMAGED', 'SCRAPPED']

const STATUS_LABELS = {
  IN_STOCK: 'Còn hàng',
  RESERVED: 'Đang giữ',
  SOLD: 'Đã bán',
  RETURNED: 'Khách trả',
  INSPECTION: 'Đang kiểm',
  DAMAGED: 'Hỏng',
  SCRAPPED: 'Đã hủy',
}

const STATUS_COLORS = {
  IN_STOCK: '#16a34a',
  RESERVED: '#2563eb',
  SOLD: '#7c3aed',
  RETURNED: '#d97706',
  INSPECTION: '#0891b2',
  DAMAGED: '#dc2626',
  SCRAPPED: '#9ca3af',
}

const ALLOWED_TRANSITIONS = {
  IN_STOCK: ['DAMAGED', 'SCRAPPED'],
  RESERVED: ['IN_STOCK'],
  SOLD: ['RETURNED'],
  RETURNED: ['INSPECTION'],
  INSPECTION: ['IN_STOCK', 'DAMAGED', 'SCRAPPED'],
  DAMAGED: ['SCRAPPED'],
  SCRAPPED: [],
}

function SerialStatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? '#9ca3af'
  const label = STATUS_LABELS[status] ?? status
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: color + '18', color, fontWeight: 600, fontSize: '0.78rem',
    }}>
      {label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function SerialDetailModal({ item, onClose, onUpdated, canUpdate }) {
  const [detail, setDetail] = useState(item)
  const [changingStatus, setChangingStatus] = useState(false)
  const [targetStatus, setTargetStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const transitions = ALLOWED_TRANSITIONS[detail.status] ?? []

  async function handleStatusChange(e) {
    e.preventDefault()
    if (!targetStatus) return
    setSaving(true)
    setError('')
    try {
      const res = await updateSerialStatus(detail.id, targetStatus, statusNote || undefined)
      setDetail(res.item)
      onUpdated(res.item)
      setChangingStatus(false)
      setTargetStatus('')
      setStatusNote('')
      toast.success(`Đã chuyển serial sang ${STATUS_LABELS[targetStatus] ?? targetStatus}.`)
    } catch (err) {
      setError(err.message || 'Lỗi khi đổi trạng thái.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Chi tiết serial</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Serial number */}
          <div style={{
            background: 'var(--admin-color-surface)', border: '1px solid var(--admin-color-border)',
            borderRadius: 8, padding: '12px 16px', textAlign: 'center',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 4 }}>Số serial</p>
            <p style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, letterSpacing: 1 }}>
              {detail.serialNumber}
            </p>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Sản phẩm: </span>
              <span style={{ fontWeight: 500 }}>{detail.productName || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Phiên bản: </span>
              <span>{detail.variantName || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Trạng thái: </span>
              <SerialStatusBadge status={detail.status} />
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày nhập: </span>
              <span>{formatDate(detail.receivedAt)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày bán: </span>
              <span>{formatDate(detail.soldAt)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày trả: </span>
              <span>{formatDate(detail.returnedAt)}</span>
            </div>
            {detail.reservedUntil && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--admin-color-text-muted)' }}>Giữ đến: </span>
                <span style={{ color: '#2563eb' }}>{formatDateTime(detail.reservedUntil)}</span>
              </div>
            )}
            {detail.note && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--admin-color-text-muted)' }}>Ghi chú: </span>
                <span>{detail.note}</span>
              </div>
            )}
          </div>

          {/* Status change */}
          {canUpdate && transitions.length > 0 && !changingStatus && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setChangingStatus(true)}
            >
              Đổi trạng thái
            </button>
          )}

          {canUpdate && changingStatus && (
            <form onSubmit={handleStatusChange} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--admin-color-border)', paddingTop: 12 }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Chuyển sang trạng thái mới</p>
              <label style={{ fontSize: '0.85rem' }}>
                Trạng thái
                <Select value={(targetStatus) || '__all__'}
                  onValueChange={(val) => setTargetStatus(val === '__all__' ? '' : val)}
                  required
                ><SelectTrigger><SelectValue placeholder="— Chọn —" /></SelectTrigger><SelectContent>
                  {transitions.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent></Select>
              </label>
              <label style={{ fontSize: '0.85rem' }}>
                Ghi chú {(targetStatus === 'DAMAGED' || targetStatus === 'SCRAPPED') && <span style={{ color: '#dc2626' }}>*</span>}
                <Input
                  type="text"
                  placeholder="Lý do thay đổi…"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                 />
              </label>
              {error && <p style={{ color: '#dc2626', fontSize: '0.8rem' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving || !targetStatus}>
                  {saving ? 'Đang lưu…' : 'Xác nhận'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setChangingStatus(false); setTargetStatus(''); setStatusNote(''); setError('') }}>
                  Huỷ
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', status: 'ALL', page: 1, pageSize: 20 }

export function SerialListScreen({ canUpdate = false }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchAllSerials(query)
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

  function handleUpdated(updatedItem) {
    setState((s) => ({
      ...s,
      items: s.items.map((i) => i.id === updatedItem.id ? updatedItem : i),
    }))
    setSelected(updatedItem)
  }

  const columns = [
    {
      key: 'serialNumber',
      label: 'Số serial',
      skeletonWidth: '70%',
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.serialNumber}</span>
      ),
    },
    {
      key: 'product',
      label: 'Sản phẩm / Phiên bản',
      skeletonWidth: '80%',
      render: (item) => (
        <span>
          <p style={{ fontWeight: 500 }}>{item.productName || '—'}</p>
          {item.variantName && (
            <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)' }}>{item.variantName}</p>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      skeletonWidth: '50%',
      render: (item) => <SerialStatusBadge status={item.status} />,
    },
    {
      key: 'receivedAt',
      label: 'Ngày nhập',
      align: 'right',
      skeletonWidth: '45%',
      render: (item) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--admin-color-text-muted)' }}>
          {formatDate(item.receivedAt)}
        </span>
      ),
    },
    {
      key: 'soldAt',
      label: 'Ngày bán',
      align: 'right',
      skeletonWidth: '45%',
      render: (item) => (
        <span style={{ fontSize: '0.82rem', color: item.soldAt ? 'var(--admin-color-text)' : 'var(--admin-color-text-muted)' }}>
          {formatDate(item.soldAt)}
        </span>
      ),
    },
  ]

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Kho hàng</p>
          <h1>Quản lý serial</h1>
          <p>Tìm kiếm và theo dõi toàn bộ serial trên tất cả sản phẩm.</p>
        </div>
      </header>

      <section className="filter-bar">
        <label>
          Tìm kiếm
          <Input
            type="search"
            placeholder="Nhập số serial…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
           />
        </label>
        <label>
          Trạng thái
          <Select
            value={query.status}
            onValueChange={(val) => setQuery((q) => ({ ...q, status: val, page: 1 }))}
          ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? 'Tất cả' : STATUS_LABELS[s] ?? s}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel
          tone="danger"
          title="Lỗi tải dữ liệu"
          description={state.error}
          actionLabel="Thử lại"
          onAction={() => setQuery((q) => ({ ...q }))}
        />
      )}

      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Không tìm thấy serial" description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm." />
      )}

      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption="Danh sách serial"
            columns={columns}
            rows={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
            onRowClick={(item) => setSelected(item)}
          />
          {state.status === 'success' && state.pagination && (
            <PaginationControls
              pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
          )}
        </>
      )}

      {selected && (
        <SerialDetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          canUpdate={canUpdate}
        />
      )}
    </section>
  )
}
