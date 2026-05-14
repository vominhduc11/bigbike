import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Wallet, Receipt, AlertTriangle, CalendarClock } from 'lucide-react'
import { fetchReceivableDetail } from '../lib/adminApi'
import { StatePanel } from '../components/StatePanel'
import { DetailSection } from '../components/DetailSection'
import {
  Screen,
  ScreenHeader,
  SummaryCard,
  SummaryCardGrid,
  StickyActionBar,
} from '../components/layout'
import { RecordPaymentModal, WriteOffModal } from './ReceivablesListScreen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const AR_STATUS_VARIANT = {
  OPEN: 'info',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  CLOSED: 'success',
  WRITTEN_OFF: 'muted',
}

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

function dueDateHint(ar, t) {
  if (['CLOSED', 'WRITTEN_OFF'].includes(ar.status)) {
    return t('receivables.detail.kpiDueDateClosed')
  }
  if (ar.overdueDays != null) {
    return t('receivables.detail.kpiDueDateOverdue', { days: ar.overdueDays })
  }
  if (ar.dueDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(ar.dueDate)
    if (Number.isFinite(due.getTime())) {
      const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft >= 0) return t('receivables.detail.kpiDueDateOnTime', { days: daysLeft })
    }
  }
  return null
}

export function ReceivableDetailScreen({ receivableId, navigate, canRecordPayment, canWriteOff }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [writeOffTarget, setWriteOffTarget] = useState(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['receivable', receivableId],
    queryFn: () => fetchReceivableDetail(receivableId),
    enabled: !!receivableId,
  })

  const ar = data?.item

  if (isLoading) return <StatePanel tone="info" title={t('receivables.detail.loading')} />
  if (isError)   return <StatePanel tone="danger" title={t('receivables.detail.loadError')} description={error?.message} />
  if (!ar)       return <StatePanel tone="neutral" title={t('receivables.detail.notFound')} />

  const closed = ['CLOSED', 'WRITTEN_OFF'].includes(ar.status)
  const showActions = (canRecordPayment || canWriteOff) && !closed

  return (
    <Screen>
      <Button variant="ghost" size="sm"
        type="button"
        onClick={() => navigate('/admin/receivables')}
        style={{ alignSelf: 'flex-start' }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {t('receivables.detail.backToList')}
      </Button>

      <ScreenHeader
        eyebrow={t('receivables.eyebrow')}
        title={`${t('receivables.title')} — ${ar.orderNumber || ar.orderId?.slice(0, 8) || ''}`}
        badge={<StatusBadge status={ar.status} t={t} />}
      />

      <SummaryCardGrid>
        <SummaryCard
          tone="info"
          icon={<Receipt size={16} />}
          label={t('receivables.detail.kpiOriginalAmount')}
          value={formatCurrency(ar.originalAmount, locale)}
        />
        <SummaryCard
          tone="success"
          icon={<Wallet size={16} />}
          label={t('receivables.detail.kpiPaidAmount')}
          value={formatCurrency(ar.paidAmount, locale)}
        />
        <SummaryCard
          tone={ar.outstandingAmount > 0 ? 'danger' : 'neutral'}
          icon={<AlertTriangle size={16} />}
          label={t('receivables.detail.kpiOutstandingAmount')}
          value={formatCurrency(ar.outstandingAmount, locale)}
        />
        <SummaryCard
          tone={ar.overdueDays != null ? 'danger' : 'warning'}
          icon={<CalendarClock size={16} />}
          label={t('receivables.detail.kpiDueDate')}
          value={ar.dueDate || '—'}
          hint={dueDateHint(ar, t)}
        />
      </SummaryCardGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--admin-space-4)' }}>
        <DetailSection title={t('receivables.detail.sectionFinancial')}>
          <div className="info-grid">
            <span className="info-grid-label">{t('receivables.detail.rowOriginalAmount')}</span>
            <span className="info-grid-value">{formatCurrency(ar.originalAmount, locale)}</span>

            <span className="info-grid-label">{t('receivables.detail.rowPaidAmount')}</span>
            <span className="info-grid-value">{formatCurrency(ar.paidAmount, locale)}</span>

            <span className="info-grid-label">{t('receivables.detail.rowOutstandingAmount')}</span>
            <span className={`info-grid-value ${ar.outstandingAmount > 0 ? 'info-grid-value--danger' : 'info-grid-value--strong'}`}>
              {formatCurrency(ar.outstandingAmount, locale)}
            </span>

            {ar.writtenOffAmount > 0 && (
              <>
                <span className="info-grid-label">{t('receivables.detail.rowWrittenOffAmount')}</span>
                <span className="info-grid-value">{formatCurrency(ar.writtenOffAmount, locale)}</span>
              </>
            )}

            <span className="info-grid-label">{t('receivables.detail.rowDueDate')}</span>
            <span className="info-grid-value">{ar.dueDate || '—'}</span>

            {ar.overdueDays != null && (
              <>
                <span className="info-grid-label">{t('receivables.detail.rowOverdueDays')}</span>
                <span className="info-grid-value info-grid-value--danger">
                  {t('receivables.detail.overdueDays', { days: ar.overdueDays })}
                </span>
              </>
            )}

            <span className="info-grid-label">{t('receivables.detail.rowPaymentTermsDays')}</span>
            <span className="info-grid-value">
              {ar.paymentTermsDays != null
                ? t('receivables.detail.paymentTermsDays', { days: ar.paymentTermsDays })
                : '—'}
            </span>

            <span className="info-grid-label">{t('receivables.detail.rowCreditLimitSnapshot')}</span>
            <span className="info-grid-value">
              {ar.creditLimitSnapshot != null ? formatCurrency(ar.creditLimitSnapshot, locale) : '—'}
            </span>

            <span className="info-grid-label">{t('receivables.detail.rowCreatedFrom')}</span>
            <span className="info-grid-value">{ar.createdFrom || '—'}</span>
          </div>
        </DetailSection>

        <DetailSection title={t('receivables.detail.sectionCustomer')}>
          <div className="info-grid">
            <span className="info-grid-label">{t('receivables.detail.rowCustomerName')}</span>
            <span className="info-grid-value">{ar.customerName || '—'}</span>

            <span className="info-grid-label">{t('receivables.detail.rowCustomerPhone')}</span>
            <span className="info-grid-value">{ar.customerPhone || '—'}</span>

            {ar.customerId && (
              <>
                <span className="info-grid-label">{t('receivables.detail.rowCustomerId')}</span>
                <span className="info-grid-value">
                  <Button variant="ghost" size="sm"
                    type="button"
                    onClick={() => navigate(`/admin/customers/${ar.customerId}`)}
                  >
                    {t('receivables.detail.viewProfile')}
                  </Button>
                </span>
              </>
            )}

            <span className="info-grid-label">{t('receivables.detail.rowOrderId')}</span>
            <span className="info-grid-value">
              <Button variant="ghost" size="sm"
                type="button"
                onClick={() => navigate(`/admin/orders/${ar.orderId}`)}
              >
                {ar.orderNumber || ar.orderId}
              </Button>
            </span>
          </div>
        </DetailSection>
      </div>

      {(ar.note || ar.writeOffReason) && (
        <DetailSection title={t('receivables.detail.sectionNotes')}>
          {ar.note && <p style={{ margin: '0 0 var(--admin-space-3)' }}>{ar.note}</p>}
          {ar.writeOffReason && (
            <div className="modal-note modal-note--warn">
              <strong>{t('receivables.detail.writeOffReason')}</strong> {ar.writeOffReason}
            </div>
          )}
        </DetailSection>
      )}

      {closed && (
        <StatePanel tone="neutral" title={t('receivables.detail.closedNotice')} />
      )}

      {showActions && (
        <StickyActionBar>
          {canRecordPayment && (
            <Button
              type="button"
              onClick={() => setPaymentTarget(ar)}
            >
              {t('receivables.detail.recordPaymentBtn')}
            </Button>
          )}
          {canWriteOff && (
            <Button variant="ghost" className="text-danger hover:bg-danger-bg has-tooltip"
              type="button"
              onClick={() => setWriteOffTarget(ar)}
              title={t('receivables.btn.writeOffTooltip')}
            >
              {t('receivables.detail.writeOffBtn')}
            </Button>
          )}
        </StickyActionBar>
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
