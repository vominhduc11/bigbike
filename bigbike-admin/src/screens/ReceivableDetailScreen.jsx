import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, X } from 'lucide-react'
import {
  fetchReceivableDetail,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { StatePanel } from '../components/StatePanel'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER']

const STATUS_COLOR_MAP = {
  OPEN:           '#3b82f6',
  PARTIALLY_PAID: '#f59e0b',
  OVERDUE:        '#ef4444',
  CLOSED:         '#10b981',
  WRITTEN_OFF:    '#6b7280',
}

function formatCurrency(amount, locale = 'vi-VN') {
  if (amount == null) return '—'
  return Number(amount).toLocaleString(locale) + ' ₫'
}

function statusBadge(status, t) {
  const bg = STATUS_COLOR_MAP[status] ?? '#6b7280'
  const label = t(`receivables.statusLabel.${status}`, { defaultValue: status })
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
      background: bg, color: '#fff', fontSize: 13, fontWeight: 600,
    }}>{label}</span>
  )
}

function RecordPaymentModal({ receivable, onClose, onSuccess }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const queryClient = useQueryClient()

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
      onSuccess()
    },
    onError: (e) => setError(e.message),
  })

  const outstanding = receivable.outstandingAmount

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{t('receivables.recordPayment.title')}</h3>
          <button type="button" onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 12px', color: 'var(--admin-text-secondary)' }}>
          {t('receivables.recordPayment.outstanding')} <strong>{formatCurrency(outstanding, locale)}</strong>
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>{t('receivables.recordPayment.amountLabel')}</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={t('receivables.recordPayment.amountPlaceholder', { max: Number(outstanding).toLocaleString(locale) })}
          style={inputStyle}
          min="1"
          max={outstanding}
        />

        <label style={labelStyle}>{t('receivables.recordPayment.methodLabelShort')}</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label style={labelStyle}>{t('receivables.recordPayment.refLabelShort')}</label>
        <input type="text" value={ref} onChange={e => setRef(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>{t('receivables.recordPayment.noteLabel')}</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, height: 64, resize: 'vertical' }} />

        {amount > 0 && Number(amount) <= outstanding && (
          <div style={{ background: 'var(--admin-bg-subtle)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
            {t('receivables.recordPayment.afterCollection', { amount: formatCurrency(outstanding - Number(amount), locale) })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>{t('receivables.recordPayment.cancel')}</button>
          <button
            type="button"
            disabled={!amount || Number(amount) <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            style={primaryBtnStyle}
          >
            {mutation.isPending ? t('receivables.recordPayment.saving') : t('receivables.recordPayment.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function WriteOffModal({ receivable, onClose, onSuccess }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => writeOffReceivable(receivable.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivable', receivable.id] })
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      onSuccess()
    },
    onError: (e) => setError(e.message),
  })

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#dc2626' }}>{t('receivables.writeOff.title')}</h3>
          <button type="button" onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 8px' }}>
          {t('receivables.writeOff.outstanding')} <strong>{formatCurrency(receivable.outstandingAmount, locale)}</strong>
        </p>
        <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>
          {t('receivables.writeOff.irreversible')}
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>{t('receivables.writeOff.reasonLabel')}</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('receivables.writeOff.reasonPlaceholderShort')}
          style={{ ...inputStyle, height: 80, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>{t('receivables.writeOff.cancel')}</button>
          <button
            type="button"
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            style={{ ...primaryBtnStyle, background: '#dc2626' }}
          >
            {mutation.isPending ? t('receivables.writeOff.processing') : t('receivables.writeOff.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReceivableDetailScreen({ receivableId, navigate, canRecordPayment, canWriteOff }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'
  const [paymentModal, setPaymentModal] = useState(false)
  const [writeOffModal, setWriteOffModal] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['receivable', receivableId],
    queryFn: () => fetchReceivableDetail(receivableId),
    enabled: !!receivableId,
  })

  const ar = data?.item

  if (isLoading) return <StatePanel tone="info" title={t('receivables.detail.loading')} />
  if (isError)   return <StatePanel tone="danger" title={t('receivables.detail.loadError')} description={error?.message} />
  if (!ar)       return <StatePanel tone="neutral" title={t('receivables.detail.notFound')} />

  const canAct = !['CLOSED', 'WRITTEN_OFF'].includes(ar.status)

  return (
    <div className="page-inner">
      <button type="button" onClick={() => navigate('/admin/receivables')} style={backBtnStyle}>
        <ArrowLeft size={16} /> {t('receivables.detail.backToList')}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('receivables.title')} — {ar.orderNumber || ar.orderId?.slice(0, 8)}</h2>
          <div style={{ marginTop: 6 }}>{statusBadge(ar.status, t)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canRecordPayment && canAct && (
            <button type="button" onClick={() => setPaymentModal(true)} style={primaryBtnStyle}>
              {t('receivables.detail.recordPaymentBtn')}
            </button>
          )}
          {canWriteOff && canAct && (
            <button type="button" onClick={() => setWriteOffModal(true)} style={{ ...primaryBtnStyle, background: '#dc2626' }}>
              {t('receivables.detail.writeOffBtn')}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Section title={t('receivables.detail.sectionFinancial')}>
          <Row label={t('receivables.detail.rowOriginalAmount')} value={formatCurrency(ar.originalAmount, locale)} />
          <Row label={t('receivables.detail.rowPaidAmount')} value={formatCurrency(ar.paidAmount, locale)} />
          <Row label={t('receivables.detail.rowOutstandingAmount')} value={<span style={{ color: ar.outstandingAmount > 0 ? '#ef4444' : 'inherit', fontWeight: 700 }}>{formatCurrency(ar.outstandingAmount, locale)}</span>} />
          {ar.writtenOffAmount > 0 && <Row label={t('receivables.detail.rowWrittenOffAmount')} value={formatCurrency(ar.writtenOffAmount, locale)} />}
          <Row label={t('receivables.detail.rowDueDate')} value={ar.dueDate || '—'} />
          {ar.overdueDays != null && (
            <Row label={t('receivables.detail.rowOverdueDays')} value={<span style={{ color: '#ef4444', fontWeight: 600 }}>{t('receivables.detail.overdueDays', { days: ar.overdueDays })}</span>} />
          )}
          <Row label={t('receivables.detail.rowPaymentTermsDays')} value={ar.paymentTermsDays != null ? t('receivables.detail.paymentTermsDays', { days: ar.paymentTermsDays }) : '—'} />
          <Row label={t('receivables.detail.rowCreditLimitSnapshot')} value={ar.creditLimitSnapshot != null ? formatCurrency(ar.creditLimitSnapshot, locale) : '—'} />
          <Row label={t('receivables.detail.rowCreatedFrom')} value={ar.createdFrom} />
        </Section>

        <Section title={t('receivables.detail.sectionCustomer')}>
          <Row label={t('receivables.detail.rowCustomerName')} value={ar.customerName || '—'} />
          <Row label={t('receivables.detail.rowCustomerPhone')} value={ar.customerPhone || '—'} />
          {ar.customerId && (
            <Row label={t('receivables.detail.rowCustomerId')} value={
              <button type="button" onClick={() => navigate(`/admin/customers/${ar.customerId}`)} style={linkStyle}>
                {t('receivables.detail.viewProfile')}
              </button>
            } />
          )}
          <Row label={t('receivables.detail.rowOrderId')} value={
            <button type="button" onClick={() => navigate(`/admin/orders/${ar.orderId}`)} style={linkStyle}>
              {ar.orderNumber || ar.orderId}
            </button>
          } />
        </Section>

        {(ar.note || ar.writeOffReason) && (
          <Section title={t('receivables.detail.sectionNotes')} style={{ gridColumn: '1 / -1' }}>
            {ar.note && <p style={{ margin: '0 0 8px' }}>{ar.note}</p>}
            {ar.writeOffReason && (
              <div style={{ background: '#fef2f2', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#dc2626' }}>
                <strong>{t('receivables.detail.writeOffReason')}</strong> {ar.writeOffReason}
              </div>
            )}
          </Section>
        )}
      </div>

      {paymentModal && (
        <RecordPaymentModal
          receivable={ar}
          onClose={() => setPaymentModal(false)}
          onSuccess={() => setPaymentModal(false)}
        />
      )}
      {writeOffModal && (
        <WriteOffModal
          receivable={ar}
          onClose={() => setWriteOffModal(false)}
          onSuccess={() => setWriteOffModal(false)}
        />
      )}
    </div>
  )
}

function Section({ title, children, style }) {
  return (
    <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: 10, padding: 20, ...style }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: 'var(--admin-text-secondary)', letterSpacing: 0.5 }}>{title}</h4>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--admin-border)', fontSize: 14 }}>
      <span style={{ color: 'var(--admin-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle = { padding: '6px 10px', border: '1px solid var(--admin-border)', borderRadius: 6, background: 'var(--admin-bg-input)', color: 'var(--admin-text)', fontSize: 14, width: '100%', boxSizing: 'border-box' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, marginTop: 12 }
const primaryBtnStyle = { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 14 }
const secondaryBtnStyle = { padding: '8px 16px', borderRadius: 6, border: '1px solid var(--admin-border)', cursor: 'pointer', background: 'transparent', fontSize: 14 }
const backBtnStyle = { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-text-secondary)', fontSize: 14, padding: 0 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle = { background: 'var(--admin-bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }
const iconBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }
const errorStyle = { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }
const linkStyle = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-accent)', fontWeight: 600, padding: 0, fontSize: 14, textDecoration: 'underline' }
