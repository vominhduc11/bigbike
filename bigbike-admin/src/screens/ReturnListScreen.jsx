import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchReturnDetail, fetchReturns, inspectReturnItem, updateReturnStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useAdminList } from '../lib/useAdminList'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'REFUNDED']
const STATUS_BADGE_CLASSES = {
  PENDING:    'text-warning',
  APPROVED:   'text-info',
  RECEIVED:   'text-info',
  INSPECTING: 'text-info',
  COMPLETED:  'text-success',
  REFUNDED:   'text-success',
  REJECTED:   'text-danger',
}
const STATUS_LABELS_VI = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  RECEIVED: 'Đã nhận hàng',
  INSPECTING: 'Đang kiểm tra',
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
// Mirrors AdminReturnService.TRANSITIONS. INSPECTING is the optional QC step
// required for high-risk goods (mũ bảo hiểm, áo giáp) before closing the return.
const NEXT_STATUSES = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED'],
  RECEIVED: ['INSPECTING', 'COMPLETED', 'REFUNDED'],
  INSPECTING: ['COMPLETED', 'REFUNDED'],
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE_CLASSES[status] ?? 'text-muted-foreground'
  return (
    <span className={`font-semibold text-sm ${cls}`}>
      {STATUS_LABELS_VI[status] ?? status}
    </span>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function ReturnDetailModal({ ret, onClose, onUpdate, canUpdate, navigate }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(ret)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [note, setNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [inspectingId, setInspectingId] = useState(null)

  const next = NEXT_STATUSES[detail.status] || []
  const items = detail.items ?? []
  const allInspected = items.length > 0 && items.every((i) => i.inspectionResult)

  useEffect(() => {
    fetchReturnDetail(ret.id)
      .then((d) => { if (d) setDetail(d) })
      .finally(() => setLoadingDetail(false))
  }, [ret.id])

  async function handleSubmit(e) {
    e.preventDefault()
    const refundNum = refundAmount ? Number(refundAmount) : 0
    // REFUNDED records money back to the customer — require a positive amount.
    if (newStatus === 'REFUNDED' && !(refundNum > 0)) {
      setError('Nhập số tiền hoàn lớn hơn 0 trước khi xác nhận hoàn tiền.')
      return
    }
    if (newStatus === 'REFUNDED') {
      const ok = await showConfirm(
        `Xác nhận hoàn ${formatCurrencyVnd(refundNum)} cho yêu cầu đổi trả ${detail.returnNumber}?\n\nThao tác này ghi nhận khoản hoàn tiền cho khách hàng.`,
        'Xác nhận hoàn tiền',
      )
      if (!ok) return
    } else if (newStatus === 'REJECTED') {
      const ok = await showConfirm(
        `Từ chối yêu cầu đổi trả ${detail.returnNumber}?\n\nKhách hàng sẽ thấy yêu cầu bị từ chối.`,
        'Xác nhận từ chối',
      )
      if (!ok) return
    }
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

  async function handleInspect(itemId, result) {
    setInspectingId(itemId)
    setError('')
    try {
      const updated = await inspectReturnItem(detail.id, itemId, { result })
      setDetail(updated)
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Lỗi khi lưu kết quả kiểm tra.')
    } finally {
      setInspectingId(null)
    }
  }

  return (
    <Modal open wide title={<>{t('returns.detailTitle')} — <span className="font-mono">{detail.returnNumber}</span></>} onClose={onClose}>
        <div className="flex flex-col gap-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <span className="text-muted-foreground">{t('returns.detailOrder')}: </span>
              {detail.orderNumber ? (
                <button type="button" className="bb-link font-mono text-sm"
                  onClick={() => { navigate(`/admin/orders/${detail.orderId}`); onClose() }}>
                  #{detail.orderNumber}
                </button>
              ) : <span className="font-mono">{detail.orderId?.slice(0, 8)}…</span>}
            </div>
            <div>
              <span className="text-muted-foreground">{t('returns.detailCustomer')}: </span>
              <span>{detail.customerEmail ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Trạng thái: </span>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <span className="text-muted-foreground">Lý do: </span>
              <span>{REASON_LABELS_VI[detail.reason] ?? detail.reason}</span>
            </div>
            {detail.refundAmount > 0 && (
              <div>
                <span className="text-muted-foreground">{t('returns.detailRefund')}: </span>
                <strong className="text-success">{formatCurrencyVnd(detail.refundAmount)}</strong>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Ngày tạo: </span>
              <span>{formatDateTime(detail.createdAt)}</span>
            </div>
          </div>

          {/* Customer note */}
          {detail.customerNote && (
            <div className="bg-surface-muted rounded-sm px-3.5 py-2.5 text-sm">
              <p className="mb-1 font-semibold text-muted-foreground">
                {t('returns.detailCustomerNote')}
              </p>
              <p className="m-0">{detail.customerNote}</p>
            </div>
          )}

          {/* Admin note */}
          {detail.adminNote && (
            <div className="bg-warning-bg border border-warning-border rounded-sm px-3.5 py-2.5 text-sm">
              <p className="mb-1 font-semibold text-warning">{t('returns.detailAdminNote')}</p>
              <p className="m-0 text-warning">{detail.adminNote}</p>
            </div>
          )}

          {/* Items */}
          {loadingDetail ? (
            <p className="text-sm text-muted-foreground">Đang tải chi tiết…</p>
          ) : items.length > 0 && (
            <div>
              <p className="mb-2 font-semibold text-sm">{t('returns.detailItems')}</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 font-semibold">Sản phẩm</th>
                    <th className="text-center py-1 px-1.5 font-semibold">SL</th>
                    <th className="text-right py-1 font-semibold">Đơn giá</th>
                    <th className="text-right py-1 pl-1.5 font-semibold">Kiểm tra QC</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const inspectable = detail.status === 'INSPECTING' && canUpdate
                    const busy = inspectingId === item.id
                    return (
                      <tr key={item.id} className="border-b border-border">
                        <td className="py-1.5">
                          <div>{item.productName}</div>
                          {item.variantName && <div className="text-muted-foreground">{item.variantName}</div>}
                          {item.reason && <div className="text-muted-foreground italic">{item.reason}</div>}
                        </td>
                        <td className="text-center py-1.5 px-1.5">{item.quantity}</td>
                        <td className="text-right py-1.5">{formatCurrencyVnd(item.unitPrice)}</td>
                        <td className="text-right py-1.5 pl-1.5">
                          {item.inspectionResult && (
                            <div className={`font-semibold ${item.inspectionResult === 'PASS' ? 'text-success' : 'text-danger'}`}>
                              {item.inspectionResult === 'PASS' ? 'Đạt' : 'Không đạt'}
                            </div>
                          )}
                          {inspectable ? (
                            <div className={`inline-flex gap-1 ${item.inspectionResult ? 'mt-1' : ''}`}>
                              <Button type="button" size="sm"
                                variant={item.inspectionResult === 'PASS' ? 'success' : 'outline'}
                                disabled={busy}
                                onClick={() => handleInspect(item.id, 'PASS')}>Đạt</Button>
                              <Button type="button" size="sm"
                                variant={item.inspectionResult === 'FAIL' ? 'danger' : 'outline'}
                                disabled={busy}
                                onClick={() => handleInspect(item.id, 'FAIL')}>Không đạt</Button>
                            </div>
                          ) : !item.inspectionResult ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* History */}
          {detail.history?.length > 0 && (
            <div>
              <p className="mb-2 font-semibold text-sm">{t('returns.detailHistory')}</p>
              <div className="flex flex-col gap-1.5">
                {detail.history.map((h, i) => (
                  <div key={i} className="text-sm flex gap-2 items-start">
                    <span className="text-muted-foreground whitespace-nowrap">{formatDateTime(h.createdAt)}</span>
                    <span>
                      {h.fromStatus
                        ? <><StatusBadge status={h.fromStatus} />{' → '}<StatusBadge status={h.toStatus} /></>
                        : <StatusBadge status={h.toStatus} />}
                      {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QC incomplete hint */}
          {detail.status === 'INSPECTING' && !allInspected && (
            <p className="text-sm text-warning">
              Còn sản phẩm chưa có kết quả kiểm tra QC. Cần đánh dấu Đạt / Không đạt cho tất cả sản phẩm trước khi chuyển sang Hoàn thành hoặc Hoàn tiền.
            </p>
          )}

          {/* Update status form */}
          {canUpdate && next.length > 0 && !showUpdateForm && (
            <Button size="sm" onClick={() => { setShowUpdateForm(true); setNewStatus(next[0]) }}>
              {t('returns.updateBtn')}
            </Button>
          )}
          {showUpdateForm && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 border-t border-border pt-4">
              <div className="form-field">
                <label className="field-label">Trạng thái mới *</label>
                <Select value={newStatus} onValueChange={setNewStatus} required><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {next.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS_VI[s] ?? s}</SelectItem>)}
                </SelectContent></Select>
              </div>
              {newStatus === 'REFUNDED' && (
                <div className="form-field">
                  <label className="field-label">{t('returns.detailRefund')} *</label>
                  <Input type="number" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)} placeholder="0" min="1"  />
                </div>
              )}
              <div className="form-field">
                <label className="field-label">{t('returns.detailAdminNote')}</label>
                <Textarea rows={2} value={note}
                  onChange={(e) => setNote(e.target.value)}  />
              </div>
              {error && <p className="field-error">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowUpdateForm(false)}>Huỷ</Button>
                <Button type="submit" size="sm" loading={saving}
                  disabled={!newStatus || (newStatus === 'REFUNDED' && !(Number(refundAmount) > 0))}>
                  Xác nhận
                </Button>
              </div>
            </form>
          )}
        </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { status: 'ALL', q: '', page: 1, pageSize: 20 }

export function ReturnListScreen({ canUpdate, navigate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(() => readQueryFromUrl(INITIAL_QUERY))
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('q') || INITIAL_QUERY.q
  })
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [detailRet, setDetailRet] = useState(null)

  const state = useAdminList(['returns', query], () => fetchReturns(query))

  useEffect(() => {
    syncQueryToUrl(query, INITIAL_QUERY)
  }, [query])

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])


  const columns = useMemo(() => [
    {
      key: 'returnNumber', label: t('returns.colRma'), skeletonWidth: '70%',
      render: (r) => <span className="font-mono font-medium">{r.returnNumber}</span>,
    },
    {
      key: 'orderNumber', label: t('returns.colOrder'), skeletonWidth: '55%',
      render: (r) => r.orderNumber
        ? <button type="button" className="bb-link font-mono text-xs"
            onClick={() => navigate(`/admin/orders/${r.orderId}`)}>#{r.orderNumber}</button>
        : <span className="font-mono text-xs text-muted-foreground">{r.orderId?.slice(0, 8)}…</span>,
    },
    {
      key: 'customerEmail', label: t('returns.colCustomer'), skeletonWidth: '65%',
      render: (r) => <span className="text-xs">{r.customerEmail ?? '—'}</span>,
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
      render: (r) => <span className="text-xs">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions', label: '', align: 'right', skeletonWidth: '55%',
      render: (r) => (
        <Button variant="outline" size="sm" onClick={() => setDetailRet(r)}>
          {t('returns.viewBtn')}
        </Button>
      ),
    },
  ].filter(Boolean), [t, navigate])

  function handleUpdateSuccess() {
    queryClient.invalidateQueries({ queryKey: ['returns'] })
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
          <Input type="search" placeholder={t('returns.searchPlaceholder')}
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)}  />
        </label>
        <label>
          {t('returns.filterStatus')}
          <Select value={query.status}
            onValueChange={(val) => setQuery((q) => ({ ...q, status: val, page: 1 }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === 'ALL' ? t('common.all') : (STATUS_LABELS_VI[s] ?? s)}</SelectItem>)}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('returns.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
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
          key={detailRet.id}
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
