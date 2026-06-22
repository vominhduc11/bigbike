import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSelect } from '../components/FilterSelect'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
import { FilterChips } from '../components/FilterChips'
import { Modal } from '../components/layout'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchReturnDetail, fetchReturns, inspectReturnItem, updateReturnStatus } from '../lib/adminApi'
import { computeReturnedItemsValue, suggestedRefundAmount, validateRefundAmount } from '../lib/returns'
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
import { Label } from '@/components/ui/label'

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
  const refundableAmount = Number(detail.orderRefundableAmount || 0)
  // Partial-coverage RMA → refund only the returned (non-FAIL) items' value, capped at
  // what's still refundable. Full coverage → refund the whole remaining amount.
  const isPartialCoverage = detail.fullReturnCoverage === false
  const returnedItemsValue = computeReturnedItemsValue(items)
  const suggestedRefund = suggestedRefundAmount({ isPartialCoverage, returnedItemsValue, refundableAmount })

  useEffect(() => {
    fetchReturnDetail(ret.id)
      .then((d) => { if (d) setDetail(d) })
      .catch((e) => setError(e.message || t('common.error')))
      .finally(() => setLoadingDetail(false))
  }, [ret.id, t])

  // When the admin picks REFUNDED, prefill the amount: full coverage → whole refundable
  // amount; partial coverage → the returned items' value (capped at refundable).
  function applyStatus(value) {
    setNewStatus(value)
    if (value === 'REFUNDED' && suggestedRefund > 0) {
      setRefundAmount((current) => current || String(suggestedRefund))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const refundNum = refundAmount ? Number(refundAmount) : 0
    if (newStatus === 'REFUNDED') {
      const refundError = validateRefundAmount({ amount: refundNum, refundableAmount, isPartialCoverage })
      if (refundError === 'required') {
        setError(t('returns.errorRefundRequired')); return
      }
      if (refundError === 'exceeds') {
        setError(t('returns.errorRefundExceeds', { amount: formatCurrencyVnd(refundableAmount) })); return
      }
      if (refundError === 'mustMatch') {
        setError(t('returns.errorRefundMustMatch', { amount: formatCurrencyVnd(refundableAmount) })); return
      }
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
            {detail.orderPaidAmount > 0 && (
              <div>
                <span className="text-muted-foreground">{t('returns.metaOrderPaid')}: </span>
                <span>{formatCurrencyVnd(detail.orderPaidAmount)}</span>
              </div>
            )}
            {detail.orderRefundableAmount > 0 && (
              <div>
                <span className="text-muted-foreground">{t('returns.metaOrderRefundable')}: </span>
                <strong>{formatCurrencyVnd(detail.orderRefundableAmount)}</strong>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t('returns.modalCreatedAtLabel')}: </span>
              <span>{formatDateTime(detail.createdAt)}</span>
            </div>
          </div>

          {/* Partial-coverage info — refund covers only the returned items' value.
              Static explanatory notice → tone="info" + role="status" (polite, not
              assertive) so it does not interrupt screen readers. */}
          {isPartialCoverage && next.includes('REFUNDED') && (
            <Alert tone="info" role="status">
              <p className="m-0">{t('returns.refundPartialInfo')}</p>
            </Alert>
          )}

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
              <div className="overflow-x-auto">
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

          {/* QC incomplete hint — shared Alert (icon + border + role) so the caution
              does not rely on color alone. */}
          {detail.status === 'INSPECTING' && !allInspected && (
            <Alert tone="warning" size="sm">
              <p className="m-0">{t('returns.modalQcWarning')}</p>
            </Alert>
          )}

          {/* Update status form */}
          {canUpdate && next.length > 0 && !showUpdateForm && (
            <Button size="sm" onClick={() => { setShowUpdateForm(true); applyStatus(next[0]) }}>
              {t('returns.updateBtn')}
            </Button>
          )}
          {showUpdateForm && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 border-t border-border pt-4">
              <div className="form-field">
                <Label htmlFor="return-new-status">{t('returns.formNewStatus')} <span aria-hidden="true">*</span></Label>
                <Select value={newStatus} onValueChange={applyStatus} required>
                  <SelectTrigger id="return-new-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {next.map((s) => <SelectItem key={s} value={s}>{t(`returns.status.${s}`, { defaultValue: s })}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {newStatus === 'REFUNDED' && (
                <div className="form-field">
                  <Label htmlFor="return-refund-amount">{t('returns.detailRefund')} <span aria-hidden="true">*</span></Label>
                  <Input id="return-refund-amount" type="number" value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)} placeholder="0" min="1"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'return-refund-hint return-form-error' : 'return-refund-hint'} />
                  <p id="return-refund-hint" className="text-xs text-muted-foreground mt-1">{t(isPartialCoverage ? 'returns.refundPartialHint' : 'returns.refundFullHint')}</p>
                  {/* Refund (money) error → placed beside the field, announced via Alert role="alert". */}
                  {error && (
                    <Alert id="return-form-error" tone="danger" size="sm" className="mt-1.5">
                      <p className="m-0">{error}</p>
                    </Alert>
                  )}
                </div>
              )}
              <div className="form-field">
                <Label htmlFor="return-admin-note">{t('returns.detailAdminNote')}</Label>
                <Textarea id="return-admin-note" rows={2} value={note}
                  onChange={(e) => setNote(e.target.value)}  />
              </div>
              {/* Non-refund errors (status / server) → announced at bottom of form. */}
              {error && newStatus !== 'REFUNDED' && (
                <Alert id="return-form-error" tone="danger" size="sm">
                  <p className="m-0">{error}</p>
                </Alert>
              )}
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
  const debouncedSearch = useDebounce(searchInput, 300)
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
  const isFiltered = query.status !== 'ALL' || !!query.q

  function resetFilters() {
    setSearchInput('')
    setQuery((q) => ({ ...q, status: 'ALL', q: '', page: 1 }))
  }

  const columns = [
    { key: 'returnNumber', label: t('returns.colRma'), render: (r) => <span className="id-cell">{r.returnNumber}</span>, skeletonWidth: '60%' },
    {
      key: 'order',
      label: t('returns.colOrder'),
      render: (r) => r.orderNumber ? (
        <button
          type="button"
          className="text-xs font-semibold text-primary"
          onClick={(e) => { e.stopPropagation(); navigate(`/admin/orders/${r.orderId}`) }}
        >
          #{r.orderNumber}
        </button>
      ) : (
        <span className="bb-muted text-xs">{r.orderId?.slice(0, 8)}…</span>
      ),
    },
    { key: 'customerEmail', label: t('returns.colCustomer'), render: (r) => <span className="text-xs">{r.customerEmail ?? '—'}</span> },
    { key: 'reason', label: t('returns.colReason'), render: (r) => t(`returns.reason.${r.reason}`, { defaultValue: r.reason?.replace('_', ' ') }) },
    { key: 'status', label: t('returns.colStatus'), render: (r) => <StatusBadge type="return" status={r.status} /> },
    { key: 'refundAmount', label: t('returns.colRefund'), align: 'right', render: (r) => r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—' },
    { key: 'createdAt', label: t('returns.colDate'), render: (r) => <span className="bb-muted text-xs">{formatDateTime(r.createdAt)}</span> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" onClick={(e) => { e.stopPropagation(); setDetailRet(r) }}>
          {t('returns.viewBtn')}
        </button>
      ),
    },
  ]

  const mobileCard = (r) => ({
    title: r.returnNumber,
    subtitle: r.customerEmail ?? '—',
    status: <StatusBadge type="return" status={r.status} />,
    meta: [
      { label: t('returns.colOrder'), value: r.orderNumber ? `#${r.orderNumber}` : `${r.orderId?.slice(0, 8)}…` },
      { label: t('returns.colReason'), value: t(`returns.reason.${r.reason}`, { defaultValue: r.reason?.replace('_', ' ') }) },
      { label: t('returns.colRefund'), value: r.refundAmount > 0 ? formatCurrencyVnd(r.refundAmount) : '—', tone: 'strong' },
      { label: t('returns.colDate'), value: formatDateTime(r.createdAt) },
    ],
    onClick: () => setDetailRet(r),
  })

  const filterChips = []
  if (query.status !== 'ALL') {
    filterChips.push({
      key: 'status',
      label: `${t('returns.filterStatus')}: ${t(`returns.status.${query.status}`, { defaultValue: query.status })}`,
      onRemove: () => setQuery((q) => ({ ...q, status: 'ALL', page: 1 })),
    })
  }
  if (query.q) {
    filterChips.push({
      key: 'q',
      label: `${t('returns.searchPlaceholder')}: ${query.q}`,
      onRemove: () => { setSearchInput(''); setQuery((q) => ({ ...q, q: '', page: 1 })) },
    })
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('returns.eyebrow')}</p>
          <h1>{t('returns.title')}</h1>
          <p className="bb-muted">{t('returns.description')}</p>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div className="bb-filter-bar">
        <FilterSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t('returns.searchPlaceholder')}
        />
        <FilterSelect
          value={query.status}
          onValueChange={(v) => setQuery((q) => ({ ...q, status: v, page: 1 }))}
          ariaLabel={t('returns.filterStatus')}
          options={STATUSES.map((s) => ({
            value: s,
            label: s === 'ALL' ? t('returns.filterStatus') : t(`returns.status.${s}`, { defaultValue: s }),
          }))}
        />
        <PageSizeSelect
          value={query.pageSize}
          onChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
        />
      </div>

      <FilterChips
        chips={filterChips}
        onClearAll={filterChips.length > 1 ? resetFilters : undefined}
        clearAllLabel={t('common.resetFilters')}
        ariaLabel={t('returns.filterStatus')}
      />

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('returns.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => state.refetch()} />
      )}
      {state.status === 'success' && items.length === 0 && (
        <StatePanel tone="neutral"
          title={isFiltered ? t('returns.emptyFiltered', { defaultValue: 'Không có kết quả khớp' }) : t('returns.empty')}
          description={isFiltered ? t('returns.emptyFilteredDesc', { defaultValue: 'Thử đổi bộ lọc trạng thái hoặc từ khoá tìm kiếm.' }) : t('returns.emptyDesc')}
          actionLabel={isFiltered ? t('common.resetFilters') : undefined}
          onAction={isFiltered ? resetFilters : undefined} />
      )}

      {(state.status === 'loading' || (state.status === 'success' && items.length > 0)) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={state.status === 'loading'}
              pageSize={query.pageSize}
              onRowClick={(r) => setDetailRet(r)}
              mobileCard={mobileCard}
            />
          </div>
          {state.status === 'success' && pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            />
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
