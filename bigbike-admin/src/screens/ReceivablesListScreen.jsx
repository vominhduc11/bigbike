import { useCallback, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterSearchInput } from '../components/FilterSearchInput'
import { FilterChips } from '../components/FilterChips'
import { PageSizeSelect } from '../components/PageSizeSelect'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, FileX, Wallet } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  fetchReceivables,
  fetchReceivableSummary,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { useUrlQuery } from '../lib/useUrlQuery'
import { PaginationControls } from '../components/PaginationControls'
import { AdminTable } from '../components/AdminTable'
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

  const handleSearch = useCallback((value) => {
    setUrlQuery({ search: value, page: 1 })
  }, [setUrlQuery])

  const handleTabChange = useCallback((key) => {
    setUrlQuery({ status: key, page: 1 })
  }, [setUrlQuery])

  const handlePage = useCallback((p) => setUrlQuery({ page: p }), [setUrlQuery])

  const activeTab = tabKeyFromStatus(urlQuery.status)
  const hasSearch = !!(urlQuery.search || '').trim()
  const isFiltered = hasSearch || activeTab !== 'ALL'

  const searchChips = hasSearch
    ? [{
        key: 'search',
        label: t('receivables.chip.search', {
          defaultValue: 'Tìm kiếm: {{value}}',
          value: urlQuery.search,
        }),
        onRemove: () => handleSearch(''),
        removeLabel: t('common.resetFilters', { defaultValue: 'Xóa bộ lọc' }),
      }]
    : []

  const renderRowActions = (item) => {
    const closed = ['CLOSED', 'WRITTEN_OFF'].includes(item.status)
    if (closed || (!canRecordPayment && !canWriteOff)) return null
    return (
      <div className="flex gap-1 justify-end" style={{ flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
        {canRecordPayment && (
          <button type="button" className="bb-btn bb-btn-primary bb-btn-sm" onClick={() => setPaymentTarget(item)}>
            {t('receivables.btn.recordPayment')}
          </button>
        )}
        {canWriteOff && (
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
    )
  }

  const columns = [
    {
      key: 'orderNumber',
      label: t('receivables.col.orderNumber'),
      render: (item) => (
        <span className="mono">{item.orderNumber || (item.orderId ? item.orderId.slice(0, 8) : '—')}</span>
      ),
    },
    { key: 'customer', label: t('receivables.col.customer'), render: (item) => item.customerName || '—' },
    {
      key: 'phone',
      label: t('receivables.col.phone'),
      render: (item) => <span style={{ fontSize: 12 }}>{item.customerPhone || '—'}</span>,
    },
    {
      key: 'originalAmount',
      label: t('receivables.col.originalAmount'),
      align: 'right',
      render: (item) => formatCurrency(item.originalAmount, locale),
    },
    {
      key: 'paidAmount',
      label: t('receivables.col.paidAmount'),
      align: 'right',
      render: (item) => formatCurrency(item.paidAmount, locale),
    },
    {
      key: 'outstandingAmount',
      label: t('receivables.col.outstandingAmount'),
      align: 'right',
      render: (item) => (
        <span className={item.outstandingAmount > 0 ? 'text-danger' : ''} style={{ fontWeight: 700 }}>
          {formatCurrency(item.outstandingAmount, locale)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      label: t('receivables.col.dueDate'),
      render: (item) => (
        <span style={{ fontSize: 12 }}>
          <div>{item.dueDate || '—'}</div>
          {item.overdueDays != null && (
            <div className="text-danger" style={{ fontWeight: 600 }}>
              {t('receivables.overdueDays', { days: item.overdueDays })}
            </div>
          )}
        </span>
      ),
    },
    { key: 'status', label: t('receivables.col.status'), render: (item) => <StatusBadge status={item.status} t={t} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: renderRowActions,
    },
  ]

  const mobileCard = (item) => {
    const closed = ['CLOSED', 'WRITTEN_OFF'].includes(item.status)
    const showActions = (canRecordPayment || canWriteOff) && !closed
    return {
      title: <span className="mono">{item.orderNumber || (item.orderId ? item.orderId.slice(0, 8) : '—')}</span>,
      subtitle: item.customerName || '—',
      status: <StatusBadge status={item.status} t={t} />,
      meta: [
        { label: t('receivables.col.phone'), value: item.customerPhone || '—' },
        { label: t('receivables.col.originalAmount'), value: formatCurrency(item.originalAmount, locale) },
        { label: t('receivables.col.paidAmount'), value: formatCurrency(item.paidAmount, locale) },
        {
          label: t('receivables.col.outstandingAmount'),
          value: formatCurrency(item.outstandingAmount, locale),
          tone: item.outstandingAmount > 0 ? 'danger' : 'strong',
        },
        {
          label: t('receivables.col.dueDate'),
          value: (
            <span>
              <span>{item.dueDate || '—'}</span>
              {item.overdueDays != null && (
                <span className="text-danger" style={{ fontWeight: 600 }}>
                  {' '}{t('receivables.overdueDays', { days: item.overdueDays })}
                </span>
              )}
            </span>
          ),
          tone: item.overdueDays != null ? 'danger' : undefined,
        },
      ],
      actions: showActions ? renderRowActions(item) : undefined,
      onClick: () => navigate(`/admin/receivables/${item.id}`),
    }
  }

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
        <FilterSearchInput
          value={urlQuery.search || ''}
          onChange={handleSearch}
          placeholder={t('receivables.filterSearchPlaceholder')}
          wrapperClassName="flex-1 min-w-[200px]"
        />
        <PageSizeSelect
          value={urlQuery.pageSize}
          onChange={(n) => setUrlQuery({ pageSize: n, page: 1 })}
        />
      </div>

      <FilterChips
        chips={searchChips}
        ariaLabel={t('receivables.filterChipsLabel', { defaultValue: 'Bộ lọc đang áp dụng' })}
      />

      {isError && <StatePanel tone="danger" title={t('receivables.loadError')} description={error?.message} />}

      {!isLoading && !isError && items.length === 0 && (
        <StatePanel
          tone="neutral"
          title={isFiltered
            ? t('receivables.emptyFiltered', { defaultValue: t('receivables.empty') })
            : t('receivables.empty')}
          description={isFiltered
            ? t('receivables.emptyFilteredDesc', { defaultValue: t('receivables.emptyDesc') })
            : t('receivables.emptyDesc')}
          actionLabel={isFiltered
            ? t('common.resetFilters', { defaultValue: 'Xóa bộ lọc' })
            : t('receivables.emptyCreateAction', { defaultValue: 'Tạo đơn bán chịu từ POS' })}
          onAction={isFiltered
            ? () => setUrlQuery({ status: 'ALL', search: '', page: 1 })
            : () => navigate('/admin/pos')}
        />
      )}

      {!isError && (isLoading || items.length > 0) && (
        <div className="bb-card">
          <div className="bb-card-body bb-card-body--flush">
            <AdminTable
              columns={columns}
              rows={items}
              loading={isLoading}
              pageSize={urlQuery.pageSize}
              onRowClick={(item) => navigate(`/admin/receivables/${item.id}`)}
              mobileCard={mobileCard}
            />
          </div>
          {!isLoading && pagination && (
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
  const fieldId = useId()
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
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
      toast.success(t('receivables.recordPayment.success', {
        defaultValue: 'Đã ghi nhận thanh toán {{amount}}',
        amount: formatCurrency(Number(amount), locale),
      }))
      handleClose()
    },
    onError: (e) => setError(e.message),
  })

  function handleClose() {
    setAmount('')
    setAmountTouched(false)
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
  const amountError = amountTouched && !validAmount
    ? t('receivables.recordPayment.amountError', {
        defaultValue: 'Số tiền phải lớn hơn 0 và không vượt quá công nợ {{max}}',
        max: formatCurrency(outstanding, locale),
      })
    : undefined

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

      {error && <div className="modal-note modal-note--error" role="alert">{error}</div>}

      <FormField
        label={t('receivables.recordPayment.amountLabel')}
        required
        htmlFor={`${fieldId}-amount`}
        error={amountError}
      >
        <Input
          id={`${fieldId}-amount`}
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setAmountTouched(true) }}
          onBlur={() => setAmountTouched(true)}
          placeholder={t('receivables.recordPayment.amountPlaceholder', { max: Number(outstanding).toLocaleString(locale) })}
          min="1"
          max={outstanding}
         />
      </FormField>

      <FormField label={t('receivables.recordPayment.methodLabel')} required htmlFor={`${fieldId}-method`}>
        <Select value={method} onValueChange={setMethod}><SelectTrigger id={`${fieldId}-method`}><SelectValue /></SelectTrigger><SelectContent>
          {PAYMENT_METHODS.map((m) => (
            <SelectItem key={m} value={m}>{t(`receivables.paymentMethod.${m}`)}</SelectItem>
          ))}
        </SelectContent></Select>
      </FormField>

      <FormField label={t('receivables.recordPayment.refLabel')} helper={t('receivables.recordPayment.refHelper')} htmlFor={`${fieldId}-ref`}>
        <Input
          id={`${fieldId}-ref`}
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
         />
      </FormField>

      <FormField label={t('receivables.recordPayment.noteLabel')} htmlFor={`${fieldId}-note`}>
        <Textarea
          id={`${fieldId}-note`}
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
  const fieldId = useId()
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
      toast.success(t('receivables.writeOff.success', { defaultValue: 'Đã xóa nợ khoản công nợ' }))
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

      {error && <div className="modal-note modal-note--error" role="alert">{error}</div>}

      <FormField label={t('receivables.writeOff.reasonLabel')} required htmlFor={`${fieldId}-reason`}>
        <Textarea
          id={`${fieldId}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('receivables.writeOff.reasonPlaceholder')}
         />
      </FormField>
    </Modal>
  )
}
