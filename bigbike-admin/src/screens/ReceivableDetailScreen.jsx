import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, X } from 'lucide-react'
import {
  fetchReceivableDetail,
  recordReceivablePayment,
  writeOffReceivable,
} from '../lib/adminApi'
import { StatePanel } from '../components/StatePanel'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CARD_TERMINAL', 'OTHER']

function formatCurrency(amount) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString('vi-VN') + ' ₫'
}

function statusBadge(status) {
  const styles = {
    OPEN:           { bg: '#3b82f6', label: 'Đang nợ' },
    PARTIALLY_PAID: { bg: '#f59e0b', label: 'Trả một phần' },
    OVERDUE:        { bg: '#ef4444', label: 'Quá hạn' },
    CLOSED:         { bg: '#10b981', label: 'Đã thu đủ' },
    WRITTEN_OFF:    { bg: '#6b7280', label: 'Đã xóa nợ' },
  }
  const s = styles[status] || { bg: '#6b7280', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
      background: s.bg, color: '#fff', fontSize: 13, fontWeight: 600,
    }}>{s.label}</span>
  )
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

        <label style={labelStyle}>Phương thức *</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <label style={labelStyle}>Mã giao dịch</label>
        <input type="text" value={ref} onChange={e => setRef(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>Ghi chú</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, height: 64, resize: 'vertical' }} />

        {amount > 0 && Number(amount) <= outstanding && (
          <div style={{ background: 'var(--admin-bg-subtle)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
            Sau khi thu: còn nợ <strong>{formatCurrency(outstanding - Number(amount))}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
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
          <h3 style={{ margin: 0, color: '#dc2626' }}>Xóa nợ (Write-off)</h3>
          <button type="button" onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        <p style={{ margin: '0 0 8px' }}>Còn nợ: <strong>{formatCurrency(receivable.outstandingAmount)}</strong></p>
        <p style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 13 }}>Hành động này không thể hoàn tác.</p>

        {error && <div style={errorStyle}>{error}</div>}

        <label style={labelStyle}>Lý do xóa nợ *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Nhập lý do..."
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

export function ReceivableDetailScreen({ receivableId, navigate, canRecordPayment, canWriteOff }) {
  const [paymentModal, setPaymentModal] = useState(false)
  const [writeOffModal, setWriteOffModal] = useState(false)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['receivable', receivableId],
    queryFn: () => fetchReceivableDetail(receivableId),
    enabled: !!receivableId,
  })

  const ar = data?.item

  if (isLoading) return <StatePanel tone="info" title="Đang tải..." />
  if (isError)   return <StatePanel tone="danger" title="Lỗi" description={error?.message} />
  if (!ar)       return <StatePanel tone="neutral" title="Không tìm thấy công nợ" />

  const canAct = !['CLOSED', 'WRITTEN_OFF'].includes(ar.status)

  return (
    <div className="page-inner">
      <button type="button" onClick={() => navigate('/admin/receivables')} style={backBtnStyle}>
        <ArrowLeft size={16} /> Quay lại Công nợ
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Công nợ — {ar.orderNumber || ar.orderId?.slice(0, 8)}</h2>
          <div style={{ marginTop: 6 }}>{statusBadge(ar.status)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canRecordPayment && canAct && (
            <button type="button" onClick={() => setPaymentModal(true)} style={primaryBtnStyle}>
              Thu tiền
            </button>
          )}
          {canWriteOff && canAct && (
            <button type="button" onClick={() => setWriteOffModal(true)} style={{ ...primaryBtnStyle, background: '#dc2626' }}>
              Xóa nợ
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Thông tin tài chính */}
        <Section title="Thông tin công nợ">
          <Row label="Tổng tiền gốc" value={formatCurrency(ar.originalAmount)} />
          <Row label="Đã thu" value={formatCurrency(ar.paidAmount)} />
          <Row label="Còn nợ" value={<span style={{ color: ar.outstandingAmount > 0 ? '#ef4444' : 'inherit', fontWeight: 700 }}>{formatCurrency(ar.outstandingAmount)}</span>} />
          {ar.writtenOffAmount > 0 && <Row label="Đã xóa nợ" value={formatCurrency(ar.writtenOffAmount)} />}
          <Row label="Hạn thanh toán" value={ar.dueDate || '—'} />
          {ar.overdueDays != null && (
            <Row label="Quá hạn" value={<span style={{ color: '#ef4444', fontWeight: 600 }}>+{ar.overdueDays} ngày</span>} />
          )}
          <Row label="Số ngày tín dụng" value={ar.paymentTermsDays != null ? `${ar.paymentTermsDays} ngày` : '—'} />
          <Row label="Hạn mức tín dụng (lúc tạo)" value={ar.creditLimitSnapshot != null ? formatCurrency(ar.creditLimitSnapshot) : '—'} />
          <Row label="Nguồn tạo" value={ar.createdFrom} />
        </Section>

        {/* Thông tin khách hàng */}
        <Section title="Khách hàng">
          <Row label="Tên" value={ar.customerName || '—'} />
          <Row label="SĐT" value={ar.customerPhone || '—'} />
          {ar.customerId && (
            <Row label="Mã KH" value={
              <button type="button" onClick={() => navigate(`/admin/customers/${ar.customerId}`)} style={linkStyle}>
                Xem hồ sơ →
              </button>
            } />
          )}
          <Row label="Mã đơn hàng" value={
            <button type="button" onClick={() => navigate(`/admin/orders/${ar.orderId}`)} style={linkStyle}>
              {ar.orderNumber || ar.orderId}
            </button>
          } />
        </Section>

        {/* Ghi chú / Write-off */}
        {(ar.note || ar.writeOffReason) && (
          <Section title="Ghi chú" style={{ gridColumn: '1 / -1' }}>
            {ar.note && <p style={{ margin: '0 0 8px' }}>{ar.note}</p>}
            {ar.writeOffReason && (
              <div style={{ background: '#fef2f2', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#dc2626' }}>
                <strong>Lý do xóa nợ:</strong> {ar.writeOffReason}
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
