import { useCallback, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Clock, DollarSign, FileX, X } from 'lucide-react'
import {
  fetchReceivables,
  fetchReceivableSummary,
  fetchReceivableAging,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { useUrlQuery } from '../lib/useUrlQuery'
import { StatePanel } from '../components/StatePanel'

const STATUS_OPTIONS = [
  { value: 'ALL',          label: 'Tất cả' },
  { value: 'OPEN',         label: 'Đang nợ' },
  { value: 'PARTIALLY_PAID', label: 'Trả một phần' },
  { value: 'OVERDUE',      label: 'Quá hạn' },
  { value: 'CLOSED',       label: 'Đã thu đủ' },
  { value: 'WRITTEN_OFF',  label: 'Đã xóa nợ' },
]

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER']

function statusBadge(status) {
  const styles = {
    OPEN:          { bg: '#3b82f6', label: 'Đang nợ' },
    PARTIALLY_PAID:{ bg: '#f59e0b', label: 'Trả một phần' },
    OVERDUE:       { bg: '#ef4444', label: 'Quá hạn' },
    CLOSED:        { bg: '#10b981', label: 'Đã thu đủ' },
    WRITTEN_OFF:   { bg: '#6b7280', label: 'Xóa nợ' },
  }
  const s = styles[status] || { bg: '#6b7280', label: status }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      background: s.bg,
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function formatCurrency(amount) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString('vi-VN') + ' ₫'
}

function RecordPaymentModal({ receivable, onClose, onSuccess }) {
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
          <h3 style={{ margin: 0 }}>Ghi nhận thanh toán</h3>
          <button type="button" onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 12px', color: 'var(--admin-text-secondary)' }}>
          Còn nợ: <strong>{formatCurrency(outstanding)}</strong>
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>Số tiền thu *</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={`Tối đa ${Number(outstanding).toLocaleString('vi-VN')}`}
          style={inputStyle}
          min="1"
          max={outstanding}
        />

        <label style={labelStyle}>Phương thức thanh toán *</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label style={labelStyle}>Mã giao dịch / Reference</label>
        <input type="text" value={ref} onChange={e => setRef(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Ghi chú</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, height: 72, resize: 'vertical' }} />

        {amount > 0 && (
          <div style={{ background: 'var(--admin-bg-subtle)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
            Sau khi thu: còn nợ {formatCurrency(outstanding - Number(amount))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>Hủy</button>
          <button
            type="button"
            disabled={!amount || Number(amount) <= 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            style={primaryBtnStyle}
          >
            {mutation.isPending ? 'Đang lưu…' : 'Xác nhận thu tiền'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WriteOffModal({ receivable, onClose, onSuccess }) {
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
          <h3 style={{ margin: 0, color: '#dc2626' }}>Xóa nợ (Write-off)</h3>
          <button type="button" onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 12px' }}>
          Công nợ <strong>{receivable.orderNumber}</strong> — {formatCurrency(receivable.outstandingAmount)}
        </p>
        <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>
          Hành động này không thể hoàn tác. Công nợ sẽ chuyển trạng thái WRITTEN_OFF.
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>Lý do xóa nợ *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Nhập lý do xóa nợ..."
          style={{ ...inputStyle, height: 80, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle}>Hủy</button>
          <button
            type="button"
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            style={{ ...primaryBtnStyle, background: '#dc2626' }}
          >
            {mutation.isPending ? 'Đang xử lý…' : 'Xác nhận xóa nợ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReceivablesListScreen({ navigate, canRecordPayment, canWriteOff }) {
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

  return (
    <div className="page-inner">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Công nợ</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--admin-text-secondary)', fontSize: 14 }}>
            Quản lý bán chịu và thu hồi công nợ
          </p>
        </div>
      </div>

      {/* KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Tổng còn nợ" value={formatCurrency(summary.totalOutstanding)} icon={<DollarSign size={20} />} color="#3b82f6" />
        <SummaryCard label="Quá hạn" value={formatCurrency(summary.overdueOutstanding)} icon={<AlertTriangle size={20} />} color="#ef4444" />
        <SummaryCard label="Số phiếu mở" value={summary.countOpen ?? 0} icon={<Clock size={20} />} color="#f59e0b" />
        <SummaryCard label="Đã xóa nợ" value={formatCurrency(summary.writtenOffTotal)} icon={<FileX size={20} />} color="#6b7280" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Tìm tên, SĐT khách..."
          value={urlQuery.search || ''}
          onChange={handleSearch}
          style={{ ...inputStyle, width: 240 }}
        />
        <select value={urlQuery.status || 'ALL'} onChange={handleStatusChange} style={{ ...inputStyle, width: 'auto' }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isLoading && <StatePanel tone="info" title="Đang tải..." />}
      {isError && <StatePanel tone="danger" title="Lỗi tải dữ liệu" description={error?.message} />}

      {!isLoading && !isError && (
        <>
          {items.length === 0 ? (
            <StatePanel tone="neutral" title="Không có công nợ nào" description="Thử thay đổi bộ lọc hoặc tạo đơn bán chịu từ POS." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Mã đơn', 'Khách hàng', 'SĐT', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Hạn TT', 'Quá hạn', 'Trạng thái', 'Thao tác'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
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
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.originalAmount)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(item.paidAmount)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.outstandingAmount > 0 ? '#ef4444' : 'inherit' }}>
                        {formatCurrency(item.outstandingAmount)}
                      </td>
                      <td style={tdStyle}>{item.dueDate || '—'}</td>
                      <td style={tdStyle}>
                        {item.overdueDays != null ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>+{item.overdueDays} ngày</span>
                        ) : '—'}
                      </td>
                      <td style={tdStyle}>{statusBadge(item.status)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {canRecordPayment && !['CLOSED', 'WRITTEN_OFF'].includes(item.status) && (
                          <button
                            type="button"
                            onClick={() => setPaymentModal(item)}
                            style={{ ...actionBtnStyle, background: '#3b82f6', marginRight: 4 }}
                          >
                            Thu tiền
                          </button>
                        )}
                        {canWriteOff && !['CLOSED', 'WRITTEN_OFF'].includes(item.status) && (
                          <button
                            type="button"
                            onClick={() => setWriteOffModal(item)}
                            style={{ ...actionBtnStyle, background: '#dc2626' }}
                          >
                            Xóa nợ
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/receivables/${item.id}`)}
                          style={{ ...actionBtnStyle, background: '#6b7280', marginLeft: 4 }}
                        >
                          Chi tiết
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
              <button type="button" disabled={pagination.page <= 1} onClick={() => handlePage(pagination.page - 1)} style={pageBtnStyle}>← Trước</button>
              <span style={{ lineHeight: '32px', fontSize: 13 }}>{pagination.page} / {pagination.totalPages}</span>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePage(pagination.page + 1)} style={pageBtnStyle}>Sau →</button>
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
