import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchCustomerDetail, updateCustomer, updateCustomerStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'

const CUSTOMER_STATUSES = ['ACTIVE', 'DISABLED', 'BLOCKED']

const SEGMENT_COLORS = {
  VIP: '#7c3aed',
  LOYAL: '#2563eb',
  REGULAR: '#16a34a',
  NEW: '#d97706',
  INACTIVE: '#9ca3af',
}

function SegmentBadge({ segment }) {
  const color = SEGMENT_COLORS[segment] ?? '#9ca3af'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '9999px',
      background: color + '20',
      color,
      fontWeight: 600,
      fontSize: '0.78rem',
      letterSpacing: '0.02em',
    }}>
      {segment}
    </span>
  )
}

export function CustomerDetailScreen({ customerId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', customer: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', phone: '' })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchCustomerDetail(customerId)
      .then((r) => { if (!active) return; setState({ status: 'success', customer: r.item, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', customer: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [customerId])

  async function handleStatusChange(e) {
    setSaving(true)
    try {
      const r = await updateCustomerStatus(customerId, e.target.value)
      setState((p) => ({ ...p, customer: r.item }))
      toast.success(t('customers.detail.statusUpdated'))
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function handleEditOpen(customer) {
    setEditForm({ displayName: customer.displayName || customer.fullName || '', phone: customer.phone || '' })
    setEditOpen(true)
  }

  function handleEditCancel() {
    setEditOpen(false)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setEditSaving(true)
    try {
      const r = await updateCustomer(customerId, { displayName: editForm.displayName, phone: editForm.phone })
      setState((p) => ({ ...p, customer: r.item }))
      setEditOpen(false)
      toast.success('Thông tin đã được cập nhật.')
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setEditSaving(false)
    }
  }

  if (state.status === 'loading') return <StatePanel tone="info" title={t('customers.detail.loading')} description={t('common.pleaseWait')} />
  if (state.status === 'error') return <StatePanel tone="danger" title={t('customers.detail.error')} description={state.error} actionLabel={t('common.back')} onAction={() => navigate('/admin/customers')} />
  if (!state.customer) return <StatePanel tone="neutral" title={t('customers.detail.notFound')} description={`ID: ${customerId}`} actionLabel={t('common.back')} onAction={() => navigate('/admin/customers')} />

  const { customer } = state

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('customers.detail.eyebrow')}</p>
          <h1>{formatText(customer.fullName)}</h1>
          <p>{formatText(customer.email)}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/customers')}>
          {t('customers.detail.backToList')}
        </button>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <DetailSection title={t('customers.detail.sectionAccount')}>
          <p><strong>{t('customers.detail.email')}</strong> {formatText(customer.email)}</p>
          <p><strong>{t('customers.detail.phone')}</strong> {formatText(customer.phone)}</p>
          <p><strong>{t('customers.detail.registered')}</strong> {formatDateTime(customer.createdAt)}</p>
          <p>
            <strong>Email xác thực:</strong>{' '}
            {customer.emailVerifiedAt ? formatDateTime(customer.emailVerifiedAt) : 'Chưa xác thực'}
          </p>
          {customer.lastLoginAt && (
            <p><strong>Đăng nhập gần nhất:</strong> {formatDateTime(customer.lastLoginAt)}</p>
          )}
        </DetailSection>

        <DetailSection title={t('customers.detail.sectionStatus')}>
          <label>
            {t('customers.detail.accountStatus')}
            <select
              className="control-select"
              value={customer.status}
              onChange={handleStatusChange}
              disabled={!canUpdate || saving}
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>{t(`status.customer.${s}`, { defaultValue: s })}</option>
              ))}
            </select>
          </label>
        </DetailSection>

        <DetailSection title="Chỉnh sửa hồ sơ">
          {!editOpen ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleEditOpen(customer)}
              disabled={!canUpdate}
            >
              Chỉnh sửa
            </button>
          ) : (
            <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label>
                Tên hiển thị
                <input
                  className="control-input"
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                  disabled={editSaving}
                />
              </label>
              <label>
                Email
                <input
                  className="control-input"
                  type="text"
                  value={customer.email || ''}
                  readOnly
                  disabled
                  style={{ opacity: 0.6 }}
                />
              </label>
              <label>
                Số điện thoại
                <input
                  className="control-input"
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  disabled={editSaving}
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleEditCancel} disabled={editSaving}>
                  Hủy
                </button>
              </div>
            </form>
          )}
        </DetailSection>

        {/* Customer value stats */}
        <DetailSection title={t('customers.detail.sectionStats')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 2 }}>
                {t('customers.detail.orderCount', { defaultValue: 'Tổng đơn hàng' })}
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>{customer.orderCount}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 2 }}>
                {t('customers.detail.totalSpent', { defaultValue: 'Tổng chi tiêu (LTV)' })}
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>{formatCurrencyVnd(customer.totalSpent)}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 2 }}>
                {t('customers.detail.avgOrderValue', { defaultValue: 'Giá trị đơn TB (AOV)' })}
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1 }}>{formatCurrencyVnd(customer.avgOrderValue)}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 4 }}>
                {t('customers.detail.segment', { defaultValue: 'Phân khúc' })}
              </p>
              <SegmentBadge segment={customer.segment} />
            </div>
            {customer.firstOrderAt && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 2 }}>
                  {t('customers.detail.firstOrder', { defaultValue: 'Đơn đầu tiên' })}
                </p>
                <p style={{ fontSize: '0.85rem' }}>{formatDateTime(customer.firstOrderAt)}</p>
              </div>
            )}
            {customer.lastOrderAt && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', marginBottom: 2 }}>
                  {t('customers.detail.lastOrder', { defaultValue: 'Đơn gần nhất' })}
                </p>
                <p style={{ fontSize: '0.85rem' }}>{formatDateTime(customer.lastOrderAt)}</p>
              </div>
            )}
          </div>
        </DetailSection>

        {/* Latest orders mini-list */}
        {customer.latestOrders && customer.latestOrders.length > 0 && (
          <DetailSection title={t('customers.detail.sectionLatestOrders', { defaultValue: 'Đơn hàng gần đây' })}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customer.latestOrders.map((o) => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--admin-color-text-muted)' }}>#{o.orderNumber}</span>
                  <StatusBadge status={o.status} type="order" />
                  <span style={{ fontWeight: 600 }}>{formatCurrencyVnd(o.totalAmount)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}
      </div>
    </section>
  )
}
