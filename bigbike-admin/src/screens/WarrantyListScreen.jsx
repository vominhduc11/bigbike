import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchWarranties, voidWarranty } from '../lib/adminApi'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { formatDateTime } from '../lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUSES = ['ALL', 'ACTIVE', 'EXPIRED', 'VOIDED']
const STATUS_LABELS = {
  ACTIVE: 'Còn hiệu lực',
  EXPIRED: 'Hết hạn',
  VOIDED: 'Đã huỷ',
}

const STATUS_BADGE_CLASSES = {
  ACTIVE:  'text-success',
  EXPIRED: 'text-warning',
  VOIDED:  'text-danger',
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE_CLASSES[status] ?? 'text-muted-foreground'
  return <span className={`text-sm font-semibold ${cls}`}>{STATUS_LABELS[status] ?? status}</span>
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
    <Modal open title="Chi tiết bảo hành" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div>
            <span className="text-muted-foreground">Trạng thái: </span>
            <StatusBadge status={detail.status} />
          </div>
          <div>
            <span className="text-muted-foreground">Ngày tạo: </span>
            <span>{formatDateTime(detail.createdAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email KH: </span>
            <span>{detail.customerEmail ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">SĐT KH: </span>
            <span>{detail.customerPhone ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Bắt đầu: </span>
            <span>{formatDate(detail.startDate)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Kết thúc: </span>
            <span>{formatDate(detail.endDate)}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Serial ID: </span>
            <span className="font-mono text-xs">{detail.serialId}</span>
          </div>
        </div>

        {canUpdate && detail.status !== 'VOIDED' && (
          <div className="border-t border-border pt-4">
            {!confirm ? (
              <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
                Huỷ phiếu bảo hành
              </Button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm text-destructive m-0">
                  Xác nhận huỷ phiếu bảo hành này? Hành động không thể hoàn tác.
                </p>
                {error && <p className="field-error">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirm(false)} disabled={voiding}>Không</Button>
                  <Button variant="danger" size="sm" onClick={handleVoid} disabled={voiding}>
                    {voiding ? 'Đang huỷ…' : 'Xác nhận huỷ'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { status: 'ALL', q: '', page: 1, pageSize: 20 }

export function WarrantyListScreen({ canUpdate }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [detailItem, setDetailItem] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirstSearch = useRef(true)

  useEffect(() => {
    if (isFirstSearch.current) { isFirstSearch.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  const state = useAdminList(['warranties', query], () => fetchWarranties(query))

  const columns = useMemo(() => [
    {
      key: 'customerEmail', label: 'Email khách hàng', skeletonWidth: '70%',
      render: (r) => <span className="text-xs">{r.customerEmail ?? '—'}</span>,
    },
    {
      key: 'customerPhone', label: 'SĐT', skeletonWidth: '50%',
      render: (r) => <span className="text-xs">{r.customerPhone ?? '—'}</span>,
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
      render: (r) => <span className="text-xs">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '40%',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={() => setDetailItem(r)}>
          Xem
        </Button>
      ),
    },
  ], [])

  function handleVoided() {
    queryClient.invalidateQueries({ queryKey: ['warranties'] })
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
          Tìm kiếm
          <Input
            type="search"
            placeholder="Email hoặc số điện thoại khách hàng…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
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
          actionLabel="Thử lại" onAction={() => state.refetch()} />
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
