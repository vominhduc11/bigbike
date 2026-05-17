import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchAllSerials, updateSerialStatus, getWarrantyBySerial } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
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

// ── Warranty panel ────────────────────────────────────────────────────────────

const WARRANTY_STATUS_CLASSES = {
  ACTIVE: 'text-primary bg-primary/10',
  EXPIRED: 'text-muted-foreground bg-muted',
  VOIDED: 'text-destructive bg-destructive/10',
}
const WARRANTY_STATUS_LABELS = {
  ACTIVE: 'Còn bảo hành',
  EXPIRED: 'Hết hạn',
  VOIDED: 'Đã hủy',
}

function WarrantyStatusBadge({ status }) {
  const classes = WARRANTY_STATUS_CLASSES[status] ?? 'text-muted-foreground bg-muted'
  const label = WARRANTY_STATUS_LABELS[status] ?? status
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  )
}

// Fetches warranty for one serial only when its detail modal is open — never for the table.
function SerialWarrantyPanel({ serialId, canRead }) {
  const [state, setState] = useState({ status: 'loading' })

  // The panel is mounted with key={serialId} by the modal, so each serial gets
  // a fresh component instance starting from the 'loading' initial state — no
  // need to reset state inside the effect.
  useEffect(() => {
    if (!canRead || !serialId) return
    let active = true
    getWarrantyBySerial(serialId)
      .then((w) => { if (active) setState({ status: 'success', warranty: w }) })
      .catch((err) => {
        if (!active) return
        if (err?.status === 404) setState({ status: 'empty' })
        else if (err?.status === 403) setState({ status: 'forbidden' })
        else setState({ status: 'error', error: err?.message || 'Lỗi khi tải thông tin bảo hành.' })
      })
    return () => { active = false }
  }, [serialId, canRead])

  if (!canRead) return null

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm font-semibold">Bảo hành</p>
      {state.status === 'loading' && (
        <p className="text-sm text-muted-foreground">Đang tải thông tin bảo hành…</p>
      )}
      {state.status === 'empty' && (
        <p className="text-sm text-muted-foreground">Chưa có bảo hành cho serial này.</p>
      )}
      {state.status === 'forbidden' && (
        <p className="text-sm text-muted-foreground">Bạn không có quyền xem thông tin bảo hành.</p>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.status === 'success' && (
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <span className="text-muted-foreground">Trạng thái: </span>
            <WarrantyStatusBadge status={state.warranty.status} />
          </div>
          <div>
            <span className="text-muted-foreground">Bắt đầu: </span>
            <span>{formatDate(state.warranty.startDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Kết thúc: </span>
            <span>{formatDate(state.warranty.endDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email KH: </span>
            <span>{state.warranty.customerEmail || '—'}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">SĐT KH: </span>
            <span>{state.warranty.customerPhone || '—'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(['SCRAPPED'])

function SerialDetailModal({ item, onClose, onUpdated, canUpdate, canReadWarranty }) {
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
    <Modal open title="Chi tiết serial" onClose={onClose}>
        <div className="flex flex-col gap-4">
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

          {/* Warranty */}
          <SerialWarrantyPanel key={detail.id} serialId={detail.id} canRead={canReadWarranty} />

          {/* Status change */}
          {canUpdate && transitions.length > 0 && !changingStatus && (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setChangingStatus(true)}>
              Đổi trạng thái
            </Button>
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
                <Button type="submit" size="sm" loading={saving} disabled={!targetStatus}>
                  {confirmTerminal ? 'Xác nhận lần cuối' : 'Xác nhận'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setChangingStatus(false); setTargetStatus(''); setStatusNote(''); setError(''); setConfirmTerminal(false) }}>
                  Huỷ
                </Button>
              </div>
            </form>
          )}
        </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', status: 'ALL', page: 1, pageSize: 20 }

export function SerialListScreen({ canUpdate = false, canReadWarranty = false }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [selected, setSelected] = useState(null)

  const state = useAdminList(['serials', query], () => fetchAllSerials(query))

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function handleUpdated(updatedItem) {
    queryClient.invalidateQueries({ queryKey: ['serials'] })
    setSelected(updatedItem)
  }

  const columns = [
    {
      key: 'serialNumber',
      label: 'Số serial',
      skeletonWidth: '70%',
      render: (item) => (
        <span className="font-mono font-semibold">{item.serialNumber}</span>
      ),
    },
    {
      key: 'product',
      label: 'Sản phẩm / Phiên bản',
      skeletonWidth: '80%',
      render: (item) => (
        <span>
          <p className="font-medium">{item.productName || '—'}</p>
          {item.variantName && (
            <p className="text-xs text-muted-foreground">{item.variantName}</p>
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
        <span className="text-xs text-muted-foreground">
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
        <span className={`text-xs ${item.soldAt ? 'text-foreground' : 'text-muted-foreground'}`}>
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
          onAction={() => state.refetch()}
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
          canReadWarranty={canReadWarranty}
        />
      )}
    </section>
  )
}
