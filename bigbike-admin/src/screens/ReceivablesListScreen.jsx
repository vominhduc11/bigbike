import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, FileX, Wallet } from 'lucide-react'
import {
  fetchReceivables,
  fetchReceivableSummary,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { useUrlQuery } from '../lib/useUrlQuery'
import { StatePanel } from '../components/StatePanel'
import {
  Screen,
  ScreenHeader,
  FilterBar,
  FilterField,
  SummaryCard,
  SummaryCardGrid,
  Tabs,
  Modal,
  FormField,
  MobileCardList,
  MobileCard,
} from '../components/layout'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER']
const TAB_KEYS = ['ALL', 'OPEN', 'OVERDUE', 'CLOSED']
const AR_STATUS_VARIANT = { OPEN: 'info', PARTIALLY_PAID: 'warning', OVERDUE: 'danger', CLOSED: 'success', WRITTEN_OFF: 'muted' }

function formatCurrency(amount, locale) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString(locale) + ' ₫'
}

function StatusBadge({ status, t }) {
  return (
    <Badge variant={AR_STATUS_VARIANT[status] ?? 'muted'}>
      {t(`receivables.statusLabel.${status}`, { defaultValue: status })}
    </Badge>
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

  const tabs = useMemo(() => TAB_KEYS.map((key) => ({
    key,
    label: t(`receivables.tabs.${key}`),
  })), [t])

  const activeTab = tabKeyFromStatus(urlQuery.status)

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('receivables.eyebrow')}
        title={t('receivables.title')}
        description={t('receivables.description')}
      />

      <SummaryCardGrid>
        <SummaryCard
          tone="brand"
          icon={<Wallet size={16} />}
          label={t('receivables.kpi.totalOutstanding')}
          value={formatCurrency(summary.totalOutstanding, locale)}
          hint={t('receivables.kpi.totalOutstandingHint')}
          active={urlQuery.status === 'ALL'}
          onClick={() => handleTabChange('ALL')}
        />
        <SummaryCard
          tone="danger"
          icon={<AlertTriangle size={16} />}
          label={t('receivables.kpi.overdueOutstanding')}
          value={formatCurrency(summary.overdueOutstanding, locale)}
          hint={t('receivables.kpi.overdueOutstandingHint')}
          active={urlQuery.status === 'OVERDUE'}
          onClick={() => handleTabChange('OVERDUE')}
        />
        <SummaryCard
          tone="warning"
          icon={<Clock size={16} />}
          label={t('receivables.kpi.countOpen')}
          value={summary.countOpen ?? 0}
          hint={t('receivables.kpi.countOpenHint')}
          active={urlQuery.status === 'OPEN'}
          onClick={() => handleTabChange('OPEN')}
        />
        <SummaryCard
          tone="neutral"
          icon={<FileX size={16} />}
          label={t('receivables.kpi.writtenOffTotal')}
          value={formatCurrency(summary.writtenOffTotal, locale)}
          hint={t('receivables.kpi.writtenOffTotalHint')}
          active={urlQuery.status === 'WRITTEN_OFF'}
          onClick={() => setUrlQuery({ status: 'WRITTEN_OFF', page: 1 })}
        />
      </SummaryCardGrid>

      <Tabs
        items={tabs}
        value={activeTab}
        onChange={handleTabChange}
        ariaLabel={t('receivables.title')}
      />

      <FilterBar>
        <FilterField label={t('receivables.filterSearchLabel')}>
          <Input
            type="text"
            placeholder={t('receivables.filterSearchPlaceholder')}
            value={urlQuery.search || ''}
            onChange={handleSearch}
           />
        </FilterField>
      </FilterBar>

      {isLoading && <StatePanel tone="info" title={t('receivables.loading')} />}
      {isError && <StatePanel tone="danger" title={t('receivables.loadError')} description={error?.message} />}

      {!isLoading && !isError && items.length === 0 && (
        <StatePanel tone="neutral" title={t('receivables.empty')} description={t('receivables.emptyDesc')} />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          {/* Desktop / tablet table */}
          <div className="table-wrap hide-on-mobile">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{t('receivables.col.orderNumber')}</th>
                  <th scope="col">{t('receivables.col.customer')}</th>
                  <th scope="col" className="hide-on-tablet">{t('receivables.col.phone')}</th>
                  <th scope="col" className="align-right hide-on-tablet">{t('receivables.col.originalAmount')}</th>
                  <th scope="col" className="align-right hide-on-tablet">{t('receivables.col.paidAmount')}</th>
                  <th scope="col" className="align-right">{t('receivables.col.outstandingAmount')}</th>
                  <th scope="col">{t('receivables.col.dueDate')}</th>
                  <th scope="col">{t('receivables.col.status')}</th>
                  <th scope="col">{t('receivables.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const closed = ['CLOSED', 'WRITTEN_OFF'].includes(item.status)
                  return (
                    <tr key={item.id}>
                      <td>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 font-semibold"
                          onClick={() => navigate(`/admin/receivables/${item.id}`)}
                        >
                          {item.orderNumber || (item.orderId ? item.orderId.slice(0, 8) : '—')}
                        </Button>
                      </td>
                      <td>{item.customerName || '—'}</td>
                      <td className="hide-on-tablet">{item.customerPhone || '—'}</td>
                      <td className="align-right hide-on-tablet">{formatCurrency(item.originalAmount, locale)}</td>
                      <td className="align-right hide-on-tablet">{formatCurrency(item.paidAmount, locale)}</td>
                      <td className="align-right">
                        <strong className={item.outstandingAmount > 0 ? 'text-danger' : ''}>
                          {formatCurrency(item.outstandingAmount, locale)}
                        </strong>
                      </td>
                      <td>
                        <div>{item.dueDate || '—'}</div>
                        {item.overdueDays != null && (
                          <div className="text-xs text-danger font-semibold">
                            {t('receivables.overdueDays', { days: item.overdueDays })}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge status={item.status} t={t} /></td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap">
                          {canRecordPayment && !closed && (
                            <Button size="sm" onClick={() => setPaymentTarget(item)}>
                              {t('receivables.btn.recordPayment')}
                            </Button>
                          )}
                          {canWriteOff && !closed && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setWriteOffTarget(item)}
                              title={t('receivables.btn.writeOffTooltip')}
                            >
                              {t('receivables.btn.writeOff')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/receivables/${item.id}`)}
                          >
                            {t('receivables.btn.detail')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <MobileCardList>
            {items.map((item) => {
              const closed = ['CLOSED', 'WRITTEN_OFF'].includes(item.status)
              return (
                <MobileCard
                  key={item.id}
                  title={item.orderNumber || (item.orderId ? item.orderId.slice(0, 8) : '—')}
                  subtitle={item.customerName || t('receivables.mobileCard.noPhone')}
                  status={<StatusBadge status={item.status} t={t} />}
                  meta={[
                    {
                      label: t('receivables.mobileCard.outstandingLabel'),
                      value: formatCurrency(item.outstandingAmount, locale),
                      tone: item.outstandingAmount > 0 ? 'danger' : 'strong',
                    },
                    {
                      label: t('receivables.mobileCard.dueDateLabel'),
                      value: item.overdueDays != null
                        ? `${item.dueDate || '—'} · ${t('receivables.overdueDays', { days: item.overdueDays })}`
                        : (item.dueDate || '—'),
                    },
                    {
                      label: t('receivables.mobileCard.totalLabel'),
                      value: formatCurrency(item.originalAmount, locale),
                    },
                    {
                      label: t('receivables.mobileCard.paidLabel'),
                      value: formatCurrency(item.paidAmount, locale),
                    },
                  ]}
                  actions={
                    <>
                      {canRecordPayment && !closed && (
                        <Button size="sm" onClick={() => setPaymentTarget(item)}>
                          {t('receivables.btn.recordPayment')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/receivables/${item.id}`)}
                      >
                        {t('receivables.btn.detail')}
                      </Button>
                    </>
                  }
                />
              )
            })}
          </MobileCardList>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex gap-2 justify-center items-center mt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePage(pagination.page - 1)}
              >
                {t('receivables.paginationPrev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('receivables.paginationOf', { page: pagination.page, total: pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePage(pagination.page + 1)}
              >
                {t('receivables.paginationNext')}
              </Button>
            </div>
          )}
        </>
      )}

      <RecordPaymentModal
        receivable={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
      <WriteOffModal
        receivable={writeOffTarget}
        onClose={() => setWriteOffTarget(null)}
      />
    </Screen>
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
