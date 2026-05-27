import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, Receipt, Wallet } from 'lucide-react'
import { fetchReceivableDetail } from '../lib/adminApi'
import { StatePanel } from '../components/StatePanel'
import { RecordPaymentModal, WriteOffModal } from './ReceivablesListScreen'

// AR status → bb-badge class.
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
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">
            <a onClick={(e) => { e.preventDefault(); navigate('/admin/receivables') }} style={{ cursor: 'pointer' }}>
              ← {t('receivables.detail.backToList')}
            </a>
          </p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {t('receivables.title')}{' '}
            <span className="mono" style={{ color: 'var(--admin-color-brand-red)' }}>
              {ar.orderNumber || ar.orderId?.slice(0, 8) || ''}
            </span>
            <StatusBadge status={ar.status} t={t} />
          </h1>
        </div>
      </div>

      {/* KPI cards */}
      <div className="bb-kpi-grid">
        <div className="bb-kpi">
          <div className="bb-kpi-head"><span className="bb-kpi-icon info"><Receipt size={15} /></span><span>{t('receivables.detail.kpiOriginalAmount')}</span></div>
          <div className="bb-kpi-value">{formatCurrency(ar.originalAmount, locale)}</div>
        </div>
        <div className="bb-kpi">
          <div className="bb-kpi-head"><span className="bb-kpi-icon success"><Wallet size={15} /></span><span>{t('receivables.detail.kpiPaidAmount')}</span></div>
          <div className="bb-kpi-value">{formatCurrency(ar.paidAmount, locale)}</div>
        </div>
        <div className="bb-kpi">
          <div className="bb-kpi-head">
            <span className={`bb-kpi-icon ${ar.outstandingAmount > 0 ? 'danger' : ''}`}><AlertTriangle size={15} /></span>
            <span>{t('receivables.detail.kpiOutstandingAmount')}</span>
          </div>
          <div className="bb-kpi-value">{formatCurrency(ar.outstandingAmount, locale)}</div>
        </div>
        <div className="bb-kpi">
          <div className="bb-kpi-head">
            <span className={`bb-kpi-icon ${ar.overdueDays != null ? 'danger' : 'warning'}`}><CalendarClock size={15} /></span>
            <span>{t('receivables.detail.kpiDueDate')}</span>
          </div>
          <div className="bb-kpi-value">{ar.dueDate || '—'}</div>
          <div className="bb-kpi-foot"><span className="bb-kpi-foot-label">{dueDateHint(ar, t)}</span></div>
        </div>
      </div>

      <div className="grid-2">
        {/* Financial */}
        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('receivables.detail.sectionFinancial')}</h2></div>
          <div className="bb-card-body">
            <dl className="info-grid">
              <dt>{t('receivables.detail.rowOriginalAmount')}</dt>
              <dd>{formatCurrency(ar.originalAmount, locale)}</dd>
              <dt>{t('receivables.detail.rowPaidAmount')}</dt>
              <dd>{formatCurrency(ar.paidAmount, locale)}</dd>
              <dt>{t('receivables.detail.rowOutstandingAmount')}</dt>
              <dd className={ar.outstandingAmount > 0 ? 'text-danger strong' : 'strong'}>
                {formatCurrency(ar.outstandingAmount, locale)}
              </dd>
              {ar.writtenOffAmount > 0 && (
                <>
                  <dt>{t('receivables.detail.rowWrittenOffAmount')}</dt>
                  <dd>{formatCurrency(ar.writtenOffAmount, locale)}</dd>
                </>
              )}
              <dt>{t('receivables.detail.rowDueDate')}</dt>
              <dd>{ar.dueDate || '—'}</dd>
              {ar.overdueDays != null && (
                <>
                  <dt>{t('receivables.detail.rowOverdueDays')}</dt>
                  <dd className="text-danger strong">{t('receivables.detail.overdueDays', { days: ar.overdueDays })}</dd>
                </>
              )}
              <dt>{t('receivables.detail.rowPaymentTermsDays')}</dt>
              <dd>{ar.paymentTermsDays != null ? t('receivables.detail.paymentTermsDays', { days: ar.paymentTermsDays }) : '—'}</dd>
              <dt>{t('receivables.detail.rowCreditLimitSnapshot')}</dt>
              <dd>{ar.creditLimitSnapshot != null ? formatCurrency(ar.creditLimitSnapshot, locale) : '—'}</dd>
              <dt>{t('receivables.detail.rowCreatedFrom')}</dt>
              <dd>{ar.createdFrom || '—'}</dd>
            </dl>
          </div>
        </div>

        {/* Customer */}
        <div className="bb-card">
          <div className="bb-card-header"><h2>{t('receivables.detail.sectionCustomer')}</h2></div>
          <div className="bb-card-body">
            <dl className="info-grid">
              <dt>{t('receivables.detail.rowCustomerName')}</dt>
              <dd>{ar.customerName || '—'}</dd>
              <dt>{t('receivables.detail.rowCustomerPhone')}</dt>
              <dd>{ar.customerPhone || '—'}</dd>
              {ar.customerId && (
                <>
                  <dt>{t('receivables.detail.rowCustomerId')}</dt>
                  <dd>
                    <button
                      type="button"
                      className="text-xs font-semibold"
                      style={{ color: 'var(--bb-brand)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/customers/${ar.customerId}`)}
                    >
                      {t('receivables.detail.viewProfile')}
                    </button>
                  </dd>
                </>
              )}
              <dt>{t('receivables.detail.rowOrderId')}</dt>
              <dd>
                <button
                  type="button"
                  className="btn-ghost text-xs text-primary-red fw-600"
                  onClick={() => navigate(`/admin/orders/${ar.orderId}`)}
                >
                  {ar.orderNumber || ar.orderId}
                </button>
              </dd>
            </dl>
          </div>
        </div>
      </div>

      {(ar.note || ar.writeOffReason) && (
        <div className="bb-card mt-4">
          <div className="bb-card-header"><h2>{t('receivables.detail.sectionNotes')}</h2></div>
          <div className="bb-card-body">
            {ar.note && <p className="mb-3">{ar.note}</p>}
            {ar.writeOffReason && (
              <div
                className="text-sm"
                style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--admin-color-status-warning-bg)',
                  border: '1px solid var(--admin-color-status-warning-border)',
                  color: 'var(--admin-color-status-warning-text)',
                }}
              >
                <strong>{t('receivables.detail.writeOffReason')}</strong> {ar.writeOffReason}
              </div>
            )}
          </div>
        </div>
      )}

      {closed && (
        <div className="mt-4">
          <StatePanel tone="neutral" title={t('receivables.detail.closedNotice')} />
        </div>
      )}

      {showActions && (
        <div className="bb-card mt-4">
          <div className="bb-card-body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {canRecordPayment && (
              <button type="button" className="bb-btn bb-btn-primary" onClick={() => setPaymentTarget(ar)}>
                {t('receivables.detail.recordPaymentBtn')}
              </button>
            )}
            {canWriteOff && (
              <button
                type="button"
                className="bb-btn bb-btn-secondary"
                style={{ color: 'var(--bb-danger)' }}
                onClick={() => setWriteOffTarget(ar)}
                title={t('receivables.btn.writeOffTooltip')}
              >
                {t('receivables.detail.writeOffBtn')}
              </button>
            )}
          </div>
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
