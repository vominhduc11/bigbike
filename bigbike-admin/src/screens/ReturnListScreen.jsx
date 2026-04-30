import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchReturnDetail, fetchReturns, updateReturnStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'REFUNDED']
const STATUS_COLORS = {
  PENDING: '#d97706',
  APPROVED: '#2563eb',
  RECEIVED: '#7c3aed',
  COMPLETED: '#16a34a',
  REFUNDED: '#16a34a',
  REJECTED: '#dc2626',
}
const STATUS_LABELS_VI = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  RECEIVED: 'Đã nhận hàng',
  COMPLETED: 'Hoàn thành',
  REFUNDED: 'Đã hoàn tiền',
  REJECTED: 'Từ chối',
}
const REASON_LABELS_VI = {
  DEFECTIVE: 'Hàng bị lỗi',
  WRONG_ITEM: 'Sai sản phẩm',
  NOT_AS_DESCRIBED: 'Không như mô tả',
  CHANGED_MIND: 'Đổi ý',
  OTHER: 'Khác',
}
const NEXT_STATUSES = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED'],
  RECEIVED: ['COMPLETED', 'REFUNDED'],
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

function ReturnDetailModal({ ret, onClose, onUpdate, canUpdate, navigate }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(ret)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [note, setNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const next = NEXT_STATUSES[detail.status] || []

  useEffect(() => {
    setLoadingDetail(true)
    fetchReturnDetail(ret.id)
      .then((d) => { if (d) setDetail(d) })
      .finally(() => setLoadingDetail(false))
  }, [ret.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        status: newStatus,
        adminNote: note || undefined,
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
      }
      const updated = await updateReturnStatus(detail.id, body)
      setDetail(updated)
      onUpdate(updated)
      setShowUpdateForm(false)
      setNote('')
      setRefundAmount('')
      toast.success(`Đã cập nhật: ${STATUS_LABELS_VI[newStatus] ?? newStatus}`)
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật trạng thái.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 620, overflowY: 'auto', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('returns.detailTitle')} — <span style={{ fontFamily: 'monospace' }}>{detail.returnNumber}</span></h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>{t('returns.detailOrder')}: </span>
              {detail.orderNumber ? (
                <button type="button" className="bb-link" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  onClick={() => { navigate(`/admin/orders/${detail.orderId}`); onClose() }}>
                  #{detail.orderNumber}
                </button>
              ) : <span style={{ fontFamily: 'monospace' }}>{detail.orderId?.slice(0, 8)}…</span>}
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>{t('returns.detailCustomer')}: </span>
              <span>{detail.customerEmail ?? '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Trạng thái: </span>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Lý do: </span>
              <span>{REASON_LABELS_VI[detail.reason] ?? detail.reason}</span>
            </div>
            {detail.refundAmount > 0 && (
              <div>
                <span style={{ color: 'var(--admin-color-text-muted)' }}>{t('returns.detailRefund')}: </span>
                <strong style={{ color: '#16a34a' }}>{formatCurrencyVnd(detail.refundAmount)}</strong>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--admin-color-text-muted)' }}>Ngày tạo: </span>
              <span>{formatDateTime(detail.createdAt)}</span>
            </div>
          </div>

          {/* Customer note */}
          {detail.customerNote && (
            <div style={{ background: 'var(--admin-color-bg-subtle)', borderRadius: 6, padding: '10px 14px', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
                {t('returns.detailCustomerNote')}
              </p>
              <p style={{ margin: 0 }}>{detail.customerNote}</p>
            </div>
          )}

          {/* Admin note */}
          {detail.adminNote && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#92400e' }}>{t('returns.detailAdminNote')}</p>
              <p style={{ margin: 0, color: '#78350f' }}>{detail.adminNote}</p>
            </div>
          )}

          {/* Items */}
          {loadingDetail ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>Đang tải chi tiết…</p>
          ) : detail.items?.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.85rem' }}>{t('returns.detailItems')}</p>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 600 }}>Sản phẩm</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}>SL</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>Đơn giá</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--admin-color-border-subtle)' }}>
                      <td style={{ padding: '6px 0' }}>
                        <div>{item.productName}</div>
                        {item.variantName && <div style={{ color: 'var(--admin-color-text-muted)', fontSize: '0.78rem' }}>{item.variantName}</div>}
                        {item.reason && <div style={{ color: 'var(--admin-color-text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>{item.reason}</div>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '6px' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '6px 0' }}>{formatCurrencyVnd(item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* History */}
          {detail.history?.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.85rem' }}>{t('returns.detailHistory')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detail.history.map((h, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--admin-color-text-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(h.createdAt)}</span>
                    <span>
                      {h.fromStatus
                        ? <><StatusBadge status={h.fromStatus} />{' → '}<StatusBadge status={h.toStatus} /></>
                        : <StatusBadge status={h.toStatus} />}
                      {h.note && <span style={{ color: 'var(--admin-color-text-muted)' }}> — {h.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Update status form */}
          {canUpdate && next.length > 0 && !showUpdateForm && (
            <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}
              onClick={() => { setShowUpdateForm(true); setNewStatus(next[0]) }}>
              {t('returns.updateBtn')}
            </button>
          )}
          {showUpdateForm && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--admin-color-border)', paddingTop: 14 }}>
              <div className="form-field">
                <label className="field-label">Trạng thái mới *</label>
                <select className="control-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
                  {next.map((s) => <option key={s} value={s}>{STATUS_LABELS_VI[s] ?? s}</option>)}
                </select>
              </div>
              {newStatus === 'REFUNDED' && (
                <div className="form-field">
                  <label className="field-label">{t('returns.detailRefund')}</label>
                  <input type="number" className="control-input" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)} placeholder="0" min="0" />
                </div>
              )}
              <div className="form-field">
                <label className="field-label">{t('returns.detailAdminNote')}</label>
                <textarea className="control-input" rows={2} value={note}
                  onChange={(e) => setNote(e.target.value)} />
              </div>
              {error && <p className="field-error">{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateForm(false)}>Huỷ</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !newStatus}>
                  {saving ? 'Đang lưu…' : 'Xác nhận'}
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

const INITIAL_QUERY = { status: 'ALL', q: '', page: 1, pageSize: 20 }

export function ReturnListScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [detailRet, setDetailRet] = useState(null)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, status: 'loading' }))
    fetchReturns(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query])

  function navigate(path) {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const columns = useMemo(() => [
    {
      key: 'returnNumber', label: t('returns.colRma'), skeletonWidth: '70%',
      render: (r) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{r.returnNumber}</span>,
    },
    {
      key: 'orderNumber', label: t('returns.colOrder'), skeletonWidth: '55%',
      render: (r) => r.orderNumber
        ? <button type="button" className="bb-link" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
            onClick={() => navigate(`/admin/orders/${r.orderId}`)}>#{r.orderNumber}</button>
        : <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--admin-color-text-muted)' }}>{r.orderId?.slice(0, 8)}…</span>,
    },
    {
      key: 'customerEmail', label: t('returns.colCustomer'), skeletonWidth: '65%',
      render: (r) => <span style={{ fontSize: '0.8rem' }}>{r.customerEmail ?? '—'}</span>,
    },
    {
      key: 'reason', label: t('returns.colReason'), skeletonWidth: '60%',
      render: (r) => REASON_LABELS_VI[r.reason] ?? r.reason?.replace('_', ' '),
    },
    {
      key: 'status', label: t('returns.colStatus'), skeletonWidth: '45%',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'refundAmount', label: t('returns.colRefund'), align: 'right', skeletonWidth: '50%',
      render: (r) => r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—',
    },
    {
      key: 'createdAt', label: t('returns.colDate'), skeletonWidth: '60%',
      render: (r) => <span style={{ fontSize: '0.8rem' }}>{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '55%',
      render: (r) => (
        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem' }}
          onClick={() => setDetailRet(r)}>
          {t('returns.viewBtn')}
        </button>
      ),
    },
  ].filter(Boolean), [t])

  function handleUpdateSuccess(updated) {
    setState((s) => ({ ...s, items: s.items.map((i) => i.id === updated.id ? updated : i) }))
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('returns.eyebrow')}</p>
          <h1>{t('returns.title')}</h1>
          <p>{t('returns.description')}</p>
        </div>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <section className="filter-bar">
        <label>
          {t('returns.searchLabel')}
          <input type="search" className="control-input" placeholder={t('returns.searchPlaceholder')}
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </label>
        <label>
          {t('returns.filterStatus')}
          <select className="control-select" value={query.status}
            onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'ALL' ? t('common.all') : (STATUS_LABELS_VI[s] ?? s)}</option>)}
          </select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('returns.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('returns.empty')} description={t('returns.emptyDesc')} />
      )}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <AdminTable
            caption={t('returns.tableCaption')}
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

      {detailRet && (
        <ReturnDetailModal
          ret={detailRet}
          onClose={() => setDetailRet(null)}
          onUpdate={handleUpdateSuccess}
          canUpdate={canUpdate}
          navigate={navigate}
        />
      )}
    </section>
  )
}
