import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Modal } from '../components/layout'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchReturnDetail, fetchReturns, inspectReturnItem, updateReturnStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useAdminList } from '../lib/useAdminList'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { readQueryFromUrl, syncQueryToUrl } from '../lib/useUrlQuery'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'REFUNDED']

// Mirrors AdminReturnService.TRANSITIONS. INSPECTING is the optional QC step
// required for high-risk goods (mũ bảo hiểm, áo giáp) before closing the return.
const NEXT_STATUSES = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['RECEIVED'],
  RECEIVED: ['INSPECTING', 'COMPLETED', 'REFUNDED'],
  INSPECTING: ['COMPLETED', 'REFUNDED'],
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
      setError(t('returns.errorRefundRequired'))
      return
    }
    if (newStatus === 'REFUNDED') {
      const ok = await showConfirm(
        t('returns.confirmRefund', { amount: formatCurrencyVnd(refundNum), rma: detail.returnNumber }),
        t('returns.confirmRefundTitle'),
      )
      if (!ok) return
    } else if (newStatus === 'REJECTED') {
      const ok = await showConfirm(
        t('returns.confirmReject', { rma: detail.returnNumber }),
        t('returns.confirmRejectTitle'),
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
      toast.success(t('returns.toastUpdated', { status: t(`returns.status.${newStatus}`, { defaultValue: newStatus }) }))
    } catch (err) {
      setError(err.message || t('returns.errorUpdateStatus'))
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
      setError(err.message || t('returns.errorInspect'))
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
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 align-baseline font-mono text-sm"
                  onClick={() => { navigate(`/admin/orders/${detail.orderId}`); onClose() }}
                >
                  #{detail.orderNumber}
                </Button>
              ) : <span className="font-mono">{detail.orderId?.slice(0, 8)}…</span>}
            </div>
            <div>
              <span className="text-muted-foreground">{t('returns.detailCustomer')}: </span>
              <span>{detail.customerEmail ?? '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('returns.modalStatusLabel')}: </span>
              <StatusBadge type="return" status={detail.status} />
            </div>
            <div>
              <span className="text-muted-foreground">{t('returns.modalReasonLabel')}: </span>
              <span>{t(`returns.reason.${detail.reason}`, { defaultValue: detail.reason })}</span>
            </div>
            {detail.refundAmount > 0 && (
              <div>
                <span className="text-muted-foreground">{t('returns.detailRefund')}: </span>
                <strong className="text-success">{formatCurrencyVnd(detail.refundAmount)}</strong>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t('returns.modalCreatedAtLabel')}: </span>
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
            <Alert tone="warning">
              <p className="mb-1 font-semibold">{t('returns.detailAdminNote')}</p>
              <p className="m-0">{detail.adminNote}</p>
            </Alert>
          )}

          {/* Items */}
          {loadingDetail ? (
            <p className="text-sm text-muted-foreground">{t('returns.modalLoading')}</p>
          ) : items.length > 0 && (
            <div>
              <p className="mb-2 font-semibold text-sm">{t('returns.detailItems')}</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 font-semibold">{t('returns.modalItemProduct')}</th>
                    <th className="text-center py-1 px-1.5 font-semibold">{t('returns.modalItemQty')}</th>
                    <th className="text-right py-1 font-semibold">{t('returns.modalItemPrice')}</th>
                    <th className="text-right py-1 pl-1.5 font-semibold">{t('returns.modalItemQcResult')}</th>
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
                              {item.inspectionResult === 'PASS' ? t('returns.modalQcPass') : t('returns.modalQcFail')}
                            </div>
                          )}
                          {inspectable ? (
                            <div className={`inline-flex gap-1 ${item.inspectionResult ? 'mt-1' : ''}`}>
                              <Button type="button" size="sm"
                                variant={item.inspectionResult === 'PASS' ? 'success' : 'outline'}
                                disabled={busy}
                                onClick={() => handleInspect(item.id, 'PASS')}>{t('returns.modalQcPass')}</Button>
                              <Button type="button" size="sm"
                                variant={item.inspectionResult === 'FAIL' ? 'danger' : 'outline'}
                                disabled={busy}
                                onClick={() => handleInspect(item.id, 'FAIL')}>{t('returns.modalQcFail')}</Button>
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
                        ? <><StatusBadge type="return" status={h.fromStatus} />{' → '}<StatusBadge type="return" status={h.toStatus} /></>
                        : <StatusBadge type="return" status={h.toStatus} />}
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
              {t('returns.modalQcWarning')}
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
                <label className="field-label">{t('returns.formNewStatus')} *</label>
                <Select value={newStatus} onValueChange={setNewStatus} required><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {next.map((s) => <SelectItem key={s} value={s}>{t(`returns.status.${s}`, { defaultValue: s })}</SelectItem>)}
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
                <Button type="button" variant="outline" size="sm" onClick={() => setShowUpdateForm(false)}>{t('returns.formCancel')}</Button>
                <Button type="submit" size="sm" loading={saving}
                  disabled={!newStatus || (newStatus === 'REFUNDED' && !(Number(refundAmount) > 0))}>
                  {t('returns.formConfirm')}
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


  function handleUpdateSuccess() {
    queryClient.invalidateQueries({ queryKey: ['returns'] })
  }

  const items = state.items || []
  const pagination = state.pagination

  return (
    <div>
      <div className="screen-header">
        <div>
          <p className="eyebrow">{t('returns.eyebrow')}</p>
          <h1>{t('returns.title')}</h1>
          <p className="desc">{t('returns.description')}</p>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={14} />
          <input
            type="search"
            placeholder={t('returns.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={query.status}
          onChange={(e) => setQuery((q) => ({ ...q, status: e.target.value, page: 1 }))}
          aria-label={t('returns.filterStatus')}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? t('returns.filterStatus') : t(`returns.status.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('returns.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral" title={t('returns.empty')} description={t('returns.emptyDesc')} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="card">
          <div className="card-body card-body--flush">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('returns.colRma')}</th>
                    <th>{t('returns.colOrder')}</th>
                    <th>{t('returns.colCustomer')}</th>
                    <th>{t('returns.colReason')}</th>
                    <th>{t('returns.colStatus')}</th>
                    <th className="num">{t('returns.colRefund')}</th>
                    <th>{t('returns.colDate')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading' && items.length === 0 && (
                    [...Array(8)].map((_, i) => (
                      <tr key={`sk-${i}`}>
                        <td colSpan={8}><div className="dash-skeleton-block" style={{ height: 28 }} /></td>
                      </tr>
                    ))
                  )}
                  {items.map((r) => (
                    <tr key={r.id} onClick={() => setDetailRet(r)}>
                      <td className="id-cell">{r.returnNumber}</td>
                      <td className="id-cell" onClick={(e) => e.stopPropagation()}>
                        {r.orderNumber ? (
                          <button
                            type="button"
                            className="btn-ghost text-xs text-primary-red fw-600"
                            onClick={() => navigate(`/admin/orders/${r.orderId}`)}
                          >
                            #{r.orderNumber}
                          </button>
                        ) : (
                          <span className="muted text-xs">{r.orderId?.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="text-xs">{r.customerEmail ?? '—'}</td>
                      <td>{t(`returns.reason.${r.reason}`, { defaultValue: r.reason?.replace('_', ' ') })}</td>
                      <td><StatusBadge type="return" status={r.status} /></td>
                      <td className="num">{r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—'}</td>
                      <td className="muted text-xs">{formatDateTime(r.createdAt)}</td>
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailRet(r)}>
                          {t('returns.viewBtn')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {state.status === 'success' && pagination && pagination.totalPages > 1 && (
            <div className="card-foot">
              <span>{t('common.paginationSummary', { defaultValue: `${items.length} / ${pagination.totalItems}`, count: items.length, total: pagination.totalItems })}</span>
              <div className="pager">
                <button type="button" disabled={pagination.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>‹</button>
                <button type="button" className="active">{pagination.page}</button>
                <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>›</button>
              </div>
            </div>
          )}
        </div>
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
    </div>
  )
}
