import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, FileX, Search, Wallet } from 'lucide-react'
import {
  fetchReceivables,
  fetchReceivableSummary,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { useUrlQuery } from '../lib/useUrlQuery'
import { PaginationControls } from '../components/PaginationControls'
import { StatePanel } from '../components/StatePanel'
import { Modal, FormField } from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER']
const TAB_KEYS = ['ALL', 'OPEN', 'OVERDUE', 'CLOSED']
const AR_STATUS_BADGE = {
  OPEN: 'bb-badge-info',
  PARTIALLY_PAID: 'bb-badge-warning',
  OVERDUE: 'bb-badge-danger',
  CLOSED: 'bb-badge-success',
  WRITTEN_OFF: 'bb-badge-neutral',
}

function formatCurrency(amount, locale) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString(locale) + ' ₫'
}

function StatusBadge({ status, t }) {
  return (
    <span className={`bb-badge ${AR_STATUS_BADGE[status] || 'bb-badge-neutral'}`}>
      {t(`receivables.statusLabel.${status}`, { defaultValue: status })}
    </span>
  )
}

function tabKeyFromStatus(status) {
  if (TAB_KEYS.includes(status)) return status
  return 'ALL'
}

export function ReceivablesListScreen({ navigate, canRecordPayment, canWriteOff }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const [urlQuery, setUrlQuery] = useUrlQuery({
    page: 1, pageSize: 20, status: 'ALL', search: '',
  })
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [writeOffTarget, setWriteOffTarget] = useState(null)

  const { data: summary = {} } = useQuery({
    queryKey: ['receivable-summary'],
    queryFn: fetchReceivableSummary,
  })

  const { data: listData, isLoading, isError, error } = useQuery({
    queryKey: ['receivables', urlQuery],
    queryFn: () => fetchReceivables(urlQuery),
  })

  const items = listData?.items ?? []
  const pagination = listData?.pagination

  const handleSearch = useCallback((e) => {
    setUrlQuery({ search: e.target.value, page: 1 })
  }, [setUrlQuery])

  const handleTabChange = useCallback((key) => {
    setUrlQuery({ status: key, page: 1 })
  }, [setUrlQuery])

  const handlePage = useCallback((p) => setUrlQuery({ page: p }), [setUrlQuery])

  const activeTab = tabKeyFromStatus(urlQuery.status)

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('receivables.eyebrow')}</p>
          <h1>{t('receivables.title')}</h1>
          <p className="bb-muted">{t('receivables.description')}</p>
        </div>
      </div>

      {/* KPI cards — clicking one switches the status filter */}
      <div className="bb-kpi-grid">
        <div className="bb-kpi" style={{ cursor: 'pointer' }} onClick={() => handleTabChange('ALL')}>
          <div className="bb-kpi-head">
            <span className="bb-kpi-icon danger"><Wallet size={15} /></span>
            <span>{t('receivables.kpi.totalOutstanding')}</span>
          </div>
          <div className="bb-kpi-value">{formatCurrency(summary.totalOutstanding, locale)}</div>
          <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('receivables.kpi.totalOutstandingHint')}</span></div>
        </div>
        <div className="bb-kpi" style={{ cursor: 'pointer' }} onClick={() => handleTabChange('OVERDUE')}>
          <div className="bb-kpi-head">
            <span className="bb-kpi-icon warning"><AlertTriangle size={15} /></span>
            <span>{t('receivables.kpi.overdueOutstanding')}</span>
          </div>
          <div className="bb-kpi-value">{formatCurrency(summary.overdueOutstanding, locale)}</div>
          <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('receivables.kpi.overdueOutstandingHint')}</span></div>
        </div>
        <div className="bb-kpi" style={{ cursor: 'pointer' }} onClick={() => handleTabChange('OPEN')}>
          <div className="bb-kpi-head">
            <span className="bb-kpi-icon info"><Clock size={15} /></span>
            <span>{t('receivables.kpi.countOpen')}</span>
          </div>
          <div className="bb-kpi-value">{summary.countOpen ?? 0}</div>
          <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('receivables.kpi.countOpenHint')}</span></div>
        </div>
        <div className="bb-kpi" style={{ cursor: 'pointer' }} onClick={() => setUrlQuery({ status: 'WRITTEN_OFF', page: 1 })}>
          <div className="bb-kpi-head">
            <span className="bb-kpi-icon"><FileX size={15} /></span>
            <span>{t('receivables.kpi.writtenOffTotal')}</span>
          </div>
          <div className="bb-kpi-value">{formatCurrency(summary.writtenOffTotal, locale)}</div>
          <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{t('receivables.kpi.writtenOffTotalHint')}</span></div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="bb-seg" style={{ marginBottom: 16 }} role="tablist" aria-label={t('receivables.title')}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={activeTab === key ? 'active' : ''}
            onClick={() => handleTabChange(key)}
          >
            {t(`receivables.tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className="bb-filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder={t('receivables.filterSearchPlaceholder')}
            value={urlQuery.search || ''}
            onChange={handleSearch}
            className="bb-input"
            style={{ paddingLeft: 28, width: '100%' }}
          />
        </div>
      </div>

      {isLoading && <StatePanel tone="info" title={t('receivables.loading')} />}
      {isError && <StatePanel tone="danger" title={t('receivables.loadError')} description={error?.message} />}

      {!isLoading && !isError && items.length === 0 && (
        <StatePanel tone="neutral" title={t('receivables.empty')} description={t('receivables.emptyDesc')} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>{t('receivables.col.orderNumber')}</th>
                    <th>{t('receivables.col.customer')}</th>
                    <th>{t('receivables.col.phone')}</th>
                    <th className="num">{t('receivables.col.originalAmount')}</th>
                    <th className="num">{t('receivables.col.paidAmount')}</th>
                    <th className="num">{t('receivables.col.outstandingAmount')}</th>
                    <th>{t('receivables.col.dueDate')}</th>
                    <th>{t('receivables.col.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const closed = ['CLOSED', 'WRITTEN_OFF'].includes(item.status)
                    return (
                      <tr key={item.id} onClick={() => navigate(`/admin/receivables/${item.id}`)}>
                        <td className="mono">{item.orderNumber || (item.orderId ? item.orderId.slice(0, 8) : '—')}</td>
                        <td>{item.customerName || '—'}</td>
                        <td style={{ fontSize: 12 }}>{item.customerPhone || '—'}</td>
                        <td className="num">{formatCurrency(item.originalAmount, locale)}</td>
                        <td className="num">{formatCurrency(item.paidAmount, locale)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          <span className={item.outstandingAmount > 0 ? 'text-danger' : ''}>
                            {formatCurrency(item.outstandingAmount, locale)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div>{item.dueDate || '—'}</div>
                          {item.overdueDays != null && (
                            <div className="text-danger" style={{ fontWeight: 600 }}>
                              {t('receivables.overdueDays', { days: item.overdueDays })}
                            </div>
                          )}
                        </td>
                        <td><StatusBadge status={item.status} t={t} /></td>
                        <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end" style={{ flexWrap: 'wrap' }}>
                            {canRecordPayment && !closed && (
                              <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" onClick={() => setPaymentTarget(item)}>
                                {t('receivables.btn.recordPayment')}
                              </button>
                            )}
                            {canWriteOff && !closed && (
                              <button
                                type="button"
                                className="bb-btn bb-btn-ghost bb-btn-sm"
                                style={{ color: 'var(--bb-danger)' }}
                                onClick={() => setWriteOffTarget(item)}
                                title={t('receivables.btn.writeOffTooltip')}
                              >
                                {t('receivables.btn.writeOff')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {pagination && (
            <PaginationControls
              pagination={pagination}
              onPageChange={handlePage}
            />
          )}
        </div>
      )}

      <RecordPaymentModal
        receivable={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
      <WriteOffModal
        receivable={writeOffTarget}
        onClose={() => setWriteOffTarget(null)}
      />
    </div>
  )
}

// ─── Modals (shared with detail screen via export) ──────────────────────────
export function RecordPaymentModal({ receivable, onClose }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const queryClient = useQueryClient()

  const open = !!receivable

  const mutation = useMutation({
    mutationFn: () => recordReceivablePayment(receivable.id, {
      amount: Number(amount),
      paymentMethod: method,
      referenceNumber: ref || undefined,
      note: note || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivable', receivable.id] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['receivable-summary'] })
      handleClose()
    },
    onError: (e) => setError(e.message),
  })

  function handleClose() {
    setAmount('')
    setMethod('CASH')
    setRef('')
    setNote('')
    setError(null)
    onClose?.()
  }

  if (!open) return null
  const outstanding = receivable.outstandingAmount

  const numericAmount = Number(amount)
  const validAmount = numericAmount > 0 && numericAmount <= outstanding

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeLabel={t('receivables.recordPayment.cancel')}
      title={
        <>
          <div>{t('receivables.recordPayment.title')}</div>
          <div className="text-sm font-normal text-muted-foreground mt-0.5">
            {t('receivables.recordPayment.subtitle', { orderNumber: receivable.orderNumber || receivable.orderId?.slice(0, 8) })}
          </div>
        </>
      }
      actions={
        <>
          <Button variant="outline" onClick={handleClose}>
            {t('receivables.recordPayment.cancel')}
          </Button>
          <Button
            loading={mutation.isPending}
            disabled={!validAmount}
            onClick={() => mutation.mutate()}
          >
            {t('receivables.recordPayment.confirm')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-muted-foreground">
        {t('receivables.recordPayment.outstanding')}{' '}
        <strong className="text-danger">{formatCurrency(outstanding, locale)}</strong>
      </p>

      {error && <div className="modal-note modal-note--error">{error}</div>}

      <FormField label={t('receivables.recordPayment.amountLabel')} required>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t('receivables.recordPayment.amountPlaceholder', { max: Number(outstanding).toLocaleString(locale) })}
          min="1"
          max={outstanding}
         />
      </FormField>

      <FormField label={t('receivables.recordPayment.methodLabel')} required>
        <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>{t(`receivables.paymentMethod.${m}`)}</SelectItem>
          ))}
        </SelectContent></Select>
      </FormField>

      <FormField label={t('receivables.recordPayment.refLabel')} helper={t('receivables.recordPayment.refHelper')}>
        <Input
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
         />
      </FormField>

      <FormField label={t('receivables.recordPayment.noteLabel')}>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
         />
      </FormField>

      {validAmount && (
        <div className="modal-note">
          {t('receivables.recordPayment.afterCollection', {
            amount: formatCurrency(outstanding - numericAmount, locale),
          })}
        </div>
      )}
    </Modal>
  )
}

export function WriteOffModal({ receivable, onClose }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const queryClient = useQueryClient()

  const open = !!receivable

  const mutation = useMutation({
    mutationFn: () => writeOffReceivable(receivable.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivable', receivable.id] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['receivable-summary'] })
      handleClose()
    },
    onError: (e) => setError(e.message),
  })

  function handleClose() {
    setReason('')
    setError(null)
    onClose?.()
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeLabel={t('receivables.writeOff.cancel')}
      title={
        <>
          <div>{t('receivables.writeOff.title')}</div>
          <div className="text-sm font-normal text-muted-foreground mt-0.5">
            {t('receivables.writeOff.subtitle', { orderNumber: receivable.orderNumber || receivable.orderId?.slice(0, 8) })}
          </div>
        </>
      }
      actions={
        <>
          <Button variant="outline" onClick={handleClose}>
            {t('receivables.writeOff.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            disabled={!reason.trim()}
            onClick={() => mutation.mutate()}
          >
            {t('receivables.writeOff.confirm')}
          </Button>
        </>
      }
    >
      <p className="mb-2">{t('receivables.writeOff.intro')}</p>
      <p className="mb-4 text-muted-foreground">
        {t('receivables.writeOff.outstanding')}{' '}
        <strong className="text-danger">{formatCurrency(receivable.outstandingAmount, locale)}</strong>
      </p>

      <div className="modal-note modal-note--warn">{t('receivables.writeOff.irreversible')}</div>

      {error && <div className="modal-note modal-note--error">{error}</div>}

      <FormField label={t('receivables.writeOff.reasonLabel')} required>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('receivables.writeOff.reasonPlaceholder')}
         />
      </FormField>
    </Modal>
  )
}
