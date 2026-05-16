import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { fetchContactMessageDetail, fetchContactMessages, updateContactMessage } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const EDITABLE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const STATUS_COLORS = {
  OPEN: '#d97706',
  IN_PROGRESS: '#2563eb',
  RESOLVED: '#16a34a',
  CLOSED: '#6b7280',
}
const STATUS_LABELS_VI = {
  OPEN: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
  CLOSED: 'Đã đóng',
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? '#9ca3af'
  return (
    <span style={{ color, fontWeight: 600, fontSize: '0.8rem' }}>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 620, overflowY: 'auto', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Chi tiết tin liên hệ</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Customer info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Họ tên: </span>
              <strong>{detail.fullName || '—'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Trạng thái: </span>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Điện thoại: </span>
              <span>{detail.phone || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Email: </span>
              <span>{detail.email || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày gửi: </span>
              <span>{formatDateTime(detail.createdAt)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Người xử lý: </span>
              <span>{detail.assignedAdminName || 'Chưa gán'}</span>
            </div>
            {detail.resolvedAt && (
              <div>
                <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày xử lý xong: </span>
                <span>{formatDateTime(detail.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Message content */}
          <div style={{ background: 'var(--admin-color-bg-subtle)', borderRadius: 6, padding: '10px 14px', fontSize: '0.85rem' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              Nội dung khách gửi
            </p>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detail.content || '—'}</p>
          </div>

          {/* Existing admin note */}
          {detail.adminNote && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#92400e' }}>Ghi chú nội bộ hiện tại</p>
              <p style={{ margin: 0, color: '#78350f', whiteSpace: 'pre-wrap' }}>{detail.adminNote}</p>
            </div>
          )}

          {loadingDetail && (
            <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>Đang tải chi tiết…</p>
          )}

          {/* Update form */}
          {canUpdate ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--admin-color-border)', paddingTop: 14 }}>
              <div className="form-field">
                <label className="field-label">Trạng thái</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EDITABLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS_VI[s] ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-field">
                <label className="field-label">Ghi chú nội bộ</label>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú xử lý (chỉ admin thấy)" />
              </div>
              {error && <p className="field-error">{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                {!detail.assignedAdminId && userId && (
                  <button type="button" className="btn btn-secondary" disabled={assigning}
                    onClick={handleAssignToMe}>
                    {assigning ? 'Đang gán…' : 'Nhận xử lý'}
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
                  {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--admin-color-text-muted)', borderTop: '1px solid var(--admin-color-border)', paddingTop: 14 }}>
              Bạn không có quyền cập nhật tin liên hệ.
            </p>
          )}
        </div>
      </div>
    </div>
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
          <div style={{ fontWeight: 500 }}>{m.fullName || '—'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)' }}>{m.phone}</div>
        </div>
      ),
    },
    {
      key: 'email', label: 'Email', skeletonWidth: '65%',
      render: (m) => <span style={{ fontSize: '0.8rem' }}>{m.email || '—'}</span>,
    },
    {
      key: 'contentPreview', label: 'Nội dung', skeletonWidth: '90%',
      render: (m) => <span style={{ fontSize: '0.82rem' }}>{m.contentPreview || '—'}</span>,
    },
    {
      key: 'status', label: 'Trạng thái', skeletonWidth: '45%',
      render: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: 'createdAt', label: 'Ngày gửi', skeletonWidth: '60%',
      render: (m) => <span style={{ fontSize: '0.8rem' }}>{formatDateTime(m.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '55%',
      render: (m) => (
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }}
          onClick={() => setDetailMsg(m)}>
          Xem
        </button>
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
