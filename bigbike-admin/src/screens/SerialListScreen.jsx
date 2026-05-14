import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchAllSerials, updateSerialStatus } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_CLASSES,
  SERIAL_ALLOWED_TRANSITIONS,
  NOTE_REQUIRED_STATUSES,
} from '../lib/serialStateMachine'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const ALL_STATUSES = ['ALL', 'IN_STOCK', 'RESERVED', 'SOLD', 'RETURNED', 'INSPECTION', 'DAMAGED', 'SCRAPPED']

function SerialStatusBadge({ status }) {
  const classes = SERIAL_STATUS_CLASSES[status] ?? 'text-muted-foreground bg-muted'
  const label = SERIAL_STATUS_LABELS[status] ?? status
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

// ── Detail modal ──────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(['SCRAPPED'])

function SerialDetailModal({ item, onClose, onUpdated, canUpdate }) {
  const [detail, setDetail] = useState(item)
  const [changingStatus, setChangingStatus] = useState(false)
  const [targetStatus, setTargetStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmTerminal, setConfirmTerminal] = useState(false)

  const transitions = SERIAL_ALLOWED_TRANSITIONS[detail.status] ?? []
  const noteRequired = NOTE_REQUIRED_STATUSES.has(targetStatus)

  async function handleStatusChange(e) {
    e.preventDefault()
    if (!targetStatus) return
    if (noteRequired && !statusNote.trim()) {
      setError('Lý do bắt buộc khi chuyển sang trạng thái này.')
      return
    }
    if (TERMINAL_STATES.has(targetStatus) && !confirmTerminal) {
      setConfirmTerminal(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await updateSerialStatus(detail.id, targetStatus, statusNote.trim() || undefined)
      setDetail(res.item)
      onUpdated(res.item)
      setChangingStatus(false)
      setTargetStatus('')
      setStatusNote('')
      setConfirmTerminal(false)
      toast.success(`Đã chuyển serial sang ${SERIAL_STATUS_LABELS[targetStatus] ?? targetStatus}.`)
    } catch (err) {
      setError(err.message || 'Lỗi khi đổi trạng thái.')
      setConfirmTerminal(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="serial-detail-title">
      <div className="modal-box modal-box--flex" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" id="serial-detail-title">Chi tiết serial</h2>
          <button type="button" className="btn-icon btn-secondary-ghost" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="modal-body flex flex-col gap-4">
          {/* Serial number */}
          <div className="bg-surface border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Số serial</p>
            <p className="font-mono text-xl font-bold tracking-wide">{detail.serialNumber}</p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <span className="text-muted-foreground">Sản phẩm: </span>
              <span className="font-medium">{detail.productName || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Phiên bản: </span>
              <span>{detail.variantName || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Trạng thái: </span>
              <SerialStatusBadge status={detail.status} />
            </div>
            <div>
              <span className="text-muted-foreground">Ngày nhập: </span>
              <span>{formatDate(detail.receivedAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ngày bán: </span>
              <span>{formatDate(detail.soldAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ngày trả: </span>
              <span>{formatDate(detail.returnedAt)}</span>
            </div>
            {detail.reservedUntil && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Giữ đến: </span>
                <span className="text-primary">{formatDateTime(detail.reservedUntil)}</span>
              </div>
            )}
            {detail.note && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Ghi chú: </span>
                <span>{detail.note}</span>
              </div>
            )}
          </div>

          {/* Status change */}
          {canUpdate && transitions.length > 0 && !changingStatus && (
            <button
              type="button"
              className="btn btn-secondary self-start"
              onClick={() => setChangingStatus(true)}
            >
              Đổi trạng thái
            </button>
          )}

          {canUpdate && changingStatus && (
            <form onSubmit={handleStatusChange} className="flex flex-col gap-2.5 border-t border-border pt-3">
              <p className="text-sm font-semibold">Chuyển sang trạng thái mới</p>
              <label className="text-sm">
                Trạng thái
                <Select value={targetStatus || '__all__'}
                  onValueChange={(val) => { setTargetStatus(val === '__all__' ? '' : val); setError(''); setConfirmTerminal(false) }}
                  required
                ><SelectTrigger><SelectValue placeholder="— Chọn —" /></SelectTrigger><SelectContent>
                  {transitions.map((s) => (
                    <SelectItem key={s} value={s}>{SERIAL_STATUS_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent></Select>
              </label>
              <label className="text-sm">
                Ghi chú {noteRequired && <span className="text-destructive">*</span>}
                <Input
                  type="text"
                  placeholder="Lý do thay đổi…"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  required={noteRequired}
                />
              </label>
              {confirmTerminal && (
                <div className="bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  Trạng thái <strong>{SERIAL_STATUS_LABELS[targetStatus]}</strong> không thể hoàn tác. Bấm Xác nhận lần nữa để tiếp tục.
                </div>
              )}
              {error && <p className="text-destructive text-xs">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving || !targetStatus}>
                  {saving ? 'Đang lưu…' : confirmTerminal ? 'Xác nhận lần cuối' : 'Xác nhận'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setChangingStatus(false); setTargetStatus(''); setStatusNote(''); setError(''); setConfirmTerminal(false) }}>
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
              <SelectItem key={s} value={s}>{s === 'ALL' ? 'Tất cả' : SERIAL_STATUS_LABELS[s] ?? s}</SelectItem>
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
