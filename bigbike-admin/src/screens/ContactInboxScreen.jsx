import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchContactMessageDetail, fetchContactMessages, updateContactMessage } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const EDITABLE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const STATUS_LABELS_VI = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  CLOSED: 'Đã đóng',
}

const STATUS_CLASSES = {
  OPEN:        'text-warning font-semibold text-xs',
  IN_PROGRESS: 'text-info font-semibold text-xs',
  RESOLVED:    'text-success font-semibold text-xs',
  CLOSED:      'text-muted-foreground font-semibold text-xs',
}

function StatusBadge({ status }) {
  return (
    <span className={STATUS_CLASSES[status] ?? 'text-muted-foreground font-semibold text-xs'}>
      {STATUS_LABELS_VI[status] ?? status}
    </span>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function ContactDetailModal({ message, onClose, onUpdate, canUpdate, userId }) {
  const [detail, setDetail] = useState(message)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [status, setStatus] = useState(message.status)
  const [note, setNote] = useState(message.adminNote || '')
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchContactMessageDetail(message.id)
      .then((d) => {
        if (d) {
          setDetail(d)
          setStatus(d.status)
          setNote(d.adminNote || '')
        }
      })
      .finally(() => setLoadingDetail(false))
  }, [message.id])

  async function applyPatch(body, onDone) {
    setError('')
    try {
      const updated = await updateContactMessage(detail.id, body)
      setDetail(updated)
      setStatus(updated.status)
      setNote(updated.adminNote || '')
      onUpdate(updated)
      onDone?.()
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật tin liên hệ.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await applyPatch(
      { status, adminNote: note },
      () => toast.success(`Đã cập nhật: ${STATUS_LABELS_VI[status] ?? status}`),
    )
    setSaving(false)
  }

  async function handleAssignToMe() {
    if (!userId) return
    setAssigning(true)
    await applyPatch(
      { assignedAdminId: userId },
      () => toast.success('Đã nhận xử lý tin này.'),
    )
    setAssigning(false)
  }

  const dirty = status !== detail.status || (note || '') !== (detail.adminNote || '')

  return (
    <Modal open wide title="Chi tiết tin liên hệ" onClose={onClose}>
        <div className="flex flex-col gap-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <span className="text-muted-foreground">Họ tên: </span>
              <strong>{detail.fullName || '—'}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Trạng thái: </span>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <span className="text-muted-foreground">Điện thoại: </span>
              <span>{detail.phone || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              <span>{detail.email || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ngày gửi: </span>
              <span>{formatDateTime(detail.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Người xử lý: </span>
              <span>{detail.assignedAdminName || 'Chưa gán'}</span>
            </div>
            {detail.resolvedAt && (
              <div>
                <span className="text-muted-foreground">Ngày xử lý xong: </span>
                <span>{formatDateTime(detail.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Message content */}
          <div className="rounded-sm bg-surface-muted px-3.5 py-2.5 text-sm">
            <p className="mb-1 font-semibold text-muted-foreground">Nội dung khách gửi</p>
            <p className="whitespace-pre-wrap">{detail.content || '—'}</p>
          </div>

          {/* Existing admin note */}
          {detail.adminNote && (
            <div className="rounded-sm border border-warning-border bg-warning-bg px-3.5 py-2.5 text-sm">
              <p className="mb-1 font-semibold text-warning">Ghi chú nội bộ hiện tại</p>
              <p className="whitespace-pre-wrap text-warning">{detail.adminNote}</p>
            </div>
          )}

          {loadingDetail && (
            <p className="text-sm text-muted-foreground">Đang tải chi tiết…</p>
          )}

          {/* Update form */}
          {canUpdate ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 border-t border-border pt-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Trạng thái</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EDITABLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS_VI[s] ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold">Ghi chú nội bộ</label>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú xử lý (chỉ admin thấy)" />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                {!detail.assignedAdminId && userId && (
                  <Button type="button" variant="outline" size="sm" loading={assigning} onClick={handleAssignToMe}>
                    Nhận xử lý
                  </Button>
                )}
                <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              Bạn không có quyền cập nhật tin liên hệ.
            </p>
          )}
        </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { status: 'ALL', q: '', page: 1, pageSize: 20 }

export function ContactInboxScreen({ canUpdate, userId }) {
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })
  const [detailMsg, setDetailMsg] = useState(null)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    fetchContactMessages(query)
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
      key: 'fullName', label: 'Khách hàng', skeletonWidth: '70%',
      render: (m) => (
        <div>
          <div className="font-medium">{m.fullName || '—'}</div>
          <div className="text-xs text-muted-foreground">{m.phone}</div>
        </div>
      ),
    },
    {
      key: 'email', label: 'Email', skeletonWidth: '65%',
      render: (m) => <span className="text-xs">{m.email || '—'}</span>,
    },
    {
      key: 'contentPreview', label: 'Nội dung', skeletonWidth: '90%',
      render: (m) => <span className="text-xs">{m.contentPreview || '—'}</span>,
    },
    {
      key: 'status', label: 'Trạng thái', skeletonWidth: '45%',
      render: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: 'createdAt', label: 'Ngày gửi', skeletonWidth: '60%',
      render: (m) => <span className="text-xs">{formatDateTime(m.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '55%',
      render: (m) => (
        <Button variant="outline" size="sm" onClick={() => setDetailMsg(m)}>
          Xem
        </Button>
      ),
    },
  ], [])

  function handleUpdateSuccess(updated) {
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)) }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Chăm sóc khách hàng</p>
          <h1>Hộp thư liên hệ</h1>
          <p>Tin nhắn khách gửi qua form liên hệ trên website. Cập nhật trạng thái và ghi chú xử lý.</p>
        </div>
      </header>

      <section className="filter-bar">
        <label>
          Tìm kiếm
          <Input type="search" placeholder="Tên, số điện thoại, email, nội dung"
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </label>
        <label>
          Trạng thái
          <Select value={query.status}
            onValueChange={(val) => setQuery((q) => ({ ...q, status: val, page: 1 }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s === 'ALL' ? 'Tất cả' : (STATUS_LABELS_VI[s] ?? s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title="Không tải được hộp thư liên hệ" description={state.error}
          actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Chưa có tin liên hệ"
          description="Tin nhắn khách gửi qua form liên hệ sẽ hiển thị ở đây." />
      )}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption="Danh sách tin liên hệ"
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

      {detailMsg && (
        <ContactDetailModal
          key={detailMsg.id}
          message={detailMsg}
          onClose={() => setDetailMsg(null)}
          onUpdate={handleUpdateSuccess}
          canUpdate={canUpdate}
          userId={userId}
        />
      )}
    </section>
  )
}
