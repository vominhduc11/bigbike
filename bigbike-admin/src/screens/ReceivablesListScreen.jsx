import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, DollarSign, FileX, X } from 'lucide-react'
import {
  fetchReceivables,
  fetchReceivableSummary,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { useUrlQuery } from '../lib/useUrlQuery'
import { StatePanel } from '../components/StatePanel'

const STATUS_OPTION_KEYS = ['ALL', 'OPEN', 'PARTIALLY_PAID', 'OVERDUE', 'CLOSED', 'WRITTEN_OFF']
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
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      background: bg,
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
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

        <label style={labelStyle}>{t('receivables.recordPayment.methodLabel')}</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label style={labelStyle}>{t('receivables.recordPayment.refLabel')}</label>
        <input type="text" value={ref} onChange={e => setRef(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>{t('receivables.recordPayment.noteLabel')}</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, height: 72, resize: 'vertical' }} />

        {amount > 0 && (
          <div style={{ background: 'var(--admin-bg-subtle)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
            {t('receivables.recordPayment.afterCollection', { amount: formatCurrency(outstanding - Number(amount), locale) })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
      queryClient.invalidateQueries({ queryKey: ['receivables'] })
      queryClient.invalidateQueries({ queryKey: ['receivable-summary'] })
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

        <p style={{ margin: '0 0 12px' }}>
          {t('receivables.writeOff.subject', {
            orderNumber: receivable.orderNumber,
            amount: formatCurrency(receivable.outstandingAmount, locale),
          })}
        </p>
        <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>
          {t('receivables.writeOff.irreversibleList')}
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>{t('receivables.writeOff.reasonLabel')}</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={t('receivables.writeOff.reasonPlaceholder')}
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

export function ReceivablesListScreen({ navigate, canRecordPayment, canWriteOff }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const [urlQuery, setUrlQuery] = useUrlQuery({
    page: 1, pageSize: 20, status: 'ALL', search: '',
  })
  const [paymentModal, setPaymentModal] = useState(null)
  const [writeOffModal, setWriteOffModal] = useState(null)

  const { data: summaryData } = useQuery({
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

  const handleStatusChange = useCallback((e) => {
    setUrlQuery({ status: e.target.value, page: 1 })
  }, [setUrlQuery])

  const handlePage = useCallback((p) => setUrlQuery({ page: p }), [setUrlQuery])

  const summary = summaryData || {}

  const TABLE_HEADERS = [
    'col.orderNumber', 'col.customer', 'col.phone',
    'col.originalAmount', 'col.paidAmount', 'col.outstandingAmount',
    'col.dueDate', 'col.overdueDays', 'col.status', 'col.actions',
  ]

  return (
    <div className="page-inner">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('receivables.title')}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--admin-text-secondary)', fontSize: 14 }}>
            {t('receivables.description')}
          </p>
        </div>
      </div>

      {/* KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <SummaryCard label={t('receivables.kpi.totalOutstanding')} value={formatCurrency(summary.totalOutstanding, locale)} icon={<DollarSign size={20} />} color="#3b82f6" />
        <SummaryCard label={t('receivables.kpi.overdueOutstanding')} value={formatCurrency(summary.overdueOutstanding, locale)} icon={<AlertTriangle size={20} />} color="#ef4444" />
        <SummaryCard label={t('receivables.kpi.countOpen')} value={summary.countOpen ?? 0} icon={<Clock size={20} />} color="#f59e0b" />
        <SummaryCard label={t('receivables.kpi.writtenOffTotal')} value={formatCurrency(summary.writtenOffTotal, locale)} icon={<FileX size={20} />} color="#6b7280" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="text"
          placeholder={t('receivables.searchPlaceholder')}
          value={urlQuery.search || ''}
          onChange={handleSearch}
          style={{ ...inputStyle, width: 240 }}
        />
        <select value={urlQuery.status || 'ALL'} onChange={handleStatusChange} style={{ ...inputStyle, width: 'auto' }}>
          {STATUS_OPTION_KEYS.map(key => (
            <option key={key} value={key}>{t(`receivables.statusLabel.${key}`)}</option>
          ))}
        </select>
      </div>

      {isLoading && <StatePanel tone="info" title={t('receivables.loading')} />}
      {isError && <StatePanel tone="danger" title={t('receivables.loadError')} description={error?.message} />}

      {!isLoading && !isError && (
        <>
          {items.length === 0 ? (
            <StatePanel tone="neutral" title={t('receivables.empty')} description={t('receivables.emptyDesc')} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {TABLE_HEADERS.map(key => (
                      <th key={key} style={thStyle}>{t(`receivables.${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} style={trStyle}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/receivables/${item.id}`)}
                          style={linkBtnStyle}
                        >
                          {item.orderNumber || item.orderId?.slice(0, 8)}
                        </button>
                      </td>
                      <td style={tdStyle}>{item.customerName || '—'}</td>
                      <td style={tdStyle}>{item.customerPhone || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.originalAmount, locale)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.paidAmount, locale)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.outstandingAmount > 0 ? '#ef4444' : 'inherit' }}>
                        {formatCurrency(item.outstandingAmount, locale)}
                      </td>
                      <td style={tdStyle}>{item.dueDate || '—'}</td>
                      <td style={tdStyle}>
                        {item.overdueDays != null ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>
                            {t('receivables.overdueDays', { days: item.overdueDays })}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>{statusBadge(item.status, t)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {canRecordPayment && !['CLOSED', 'WRITTEN_OFF'].includes(item.status) && (
                          <button
                            type="button"
                            onClick={() => setPaymentModal(item)}
                            style={{ ...actionBtnStyle, background: '#3b82f6', marginRight: 4 }}
                          >
                            {t('receivables.btn.recordPayment')}
                          </button>
                        )}
                        {canWriteOff && !['CLOSED', 'WRITTEN_OFF'].includes(item.status) && (
                          <button
                            type="button"
                            onClick={() => setWriteOffModal(item)}
                            style={{ ...actionBtnStyle, background: '#dc2626' }}
                          >
                            {t('receivables.btn.writeOff')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/receivables/${item.id}`)}
                          style={{ ...actionBtnStyle, background: '#6b7280', marginLeft: 4 }}
                        >
                          {t('receivables.btn.detail')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
              <button type="button" disabled={pagination.page <= 1} onClick={() => handlePage(pagination.page - 1)} style={pageBtnStyle}>
                {t('receivables.paginationPrev')}
              </button>
              <span style={{ lineHeight: '32px', fontSize: 13 }}>{pagination.page} / {pagination.totalPages}</span>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePage(pagination.page + 1)} style={pageBtnStyle}>
                {t('receivables.paginationNext')}
              </button>
            </div>
          )}
        </>
      )}

      {paymentModal && (
        <RecordPaymentModal
          receivable={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => setPaymentModal(null)}
        />
      )}
      {writeOffModal && (
        <WriteOffModal
          receivable={writeOffModal}
          onClose={() => setWriteOffModal(null)}
          onSuccess={() => setWriteOffModal(null)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, color }) {
  return (
    <div style={{ background: 'var(--admin-bg-card)', border: '1px solid var(--admin-border)', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 8 }}>{icon}<span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span></div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle = {
  padding: '6px 10px',
  border: '1px solid var(--admin-border)',
  borderRadius: 6,
  background: 'var(--admin-bg-input)',
  color: 'var(--admin-text)',
  fontSize: 14,
}
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = { padding: '8px 12px', background: 'var(--admin-bg-subtle)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--admin-border)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 12px', borderBottom: '1px solid var(--admin-border)', verticalAlign: 'middle' }
const trStyle = { transition: 'background 0.1s' }
const actionBtnStyle = { padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600 }
const linkBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-accent)', fontWeight: 600, padding: 0, fontSize: 13, textDecoration: 'underline' }
const pageBtnStyle = { padding: '4px 12px', borderRadius: 4, border: '1px solid var(--admin-border)', cursor: 'pointer', background: 'var(--admin-bg-card)', fontSize: 13 }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle = { background: 'var(--admin-bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, marginTop: 12 }
const primaryBtnStyle = { padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 14 }
const secondaryBtnStyle = { padding: '8px 16px', borderRadius: 6, border: '1px solid var(--admin-border)', cursor: 'pointer', background: 'transparent', fontSize: 14 }
const errorStyle = { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12 }
const iconBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }
