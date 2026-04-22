import { useEffect, useState } from 'react'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchCustomerDetail, updateCustomerStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE', 'BANNED']

export function CustomerDetailScreen({ customerId, navigate, canUpdate }) {
  const [state, setState] = useState({ status: 'loading', customer: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let active = true
    fetchCustomerDetail(customerId)
      .then((r) => { if (!active) return; setState({ status: 'success', customer: r.item, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', customer: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [customerId])

  async function handleStatusChange(e) {
    setSaving(true)
    setSaveError('')
    try {
      const r = await updateCustomerStatus(customerId, e.target.value)
      setState((p) => ({ ...p, customer: r.item }))
    } catch (err) {
      setSaveError(err.message || 'Lỗi cập nhật')
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') return <StatePanel tone="info" title="Đang tải" description="Vui lòng chờ..." />
  if (state.status === 'error') return <StatePanel tone="danger" title="Lỗi" description={state.error} actionLabel="Quay lại" onAction={() => navigate('/admin/customers')} />
  if (!state.customer) return <StatePanel tone="neutral" title="Không tìm thấy khách hàng" description={`ID: ${customerId}`} actionLabel="Quay lại" onAction={() => navigate('/admin/customers')} />

  const { customer } = state

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Commerce / Khách hàng</p>
          <h1>{formatText(customer.fullName)}</h1>
          <p>{formatText(customer.email)}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/customers')}>← Danh sách</button>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}
      {saveError && <p style={{ color: 'var(--c-danger)', marginBottom: '1rem' }}>{saveError}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <DetailSection title="Thông tin tài khoản">
          <p><strong>Email:</strong> {formatText(customer.email)}</p>
          <p><strong>Điện thoại:</strong> {formatText(customer.phone)}</p>
          <p><strong>Ngày đăng ký:</strong> {formatDateTime(customer.createdAt)}</p>
        </DetailSection>
        <DetailSection title="Trạng thái">
          <label>
            Trạng thái tài khoản
            <select className="control-select" value={customer.status} onChange={handleStatusChange} disabled={!canUpdate || saving}>
              {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </DetailSection>
        <DetailSection title="Thống kê mua hàng">
          <p><strong>Số đơn hàng:</strong> {customer.orderCount}</p>
          <p><strong>Tổng chi tiêu:</strong> {formatCurrencyVnd(customer.totalSpent)}</p>
        </DetailSection>
      </div>
    </section>
  )
}
