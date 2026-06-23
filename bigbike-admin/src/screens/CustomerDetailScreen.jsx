import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { toast } from '@/lib/toast'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchCustomerDetail, updateCustomer, updateCustomerStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const CUSTOMER_STATUSES = ['ACTIVE', 'DISABLED', 'BLOCKED']

// Kiểm tra tại form, cùng quy tắc backend (chỉ báo trước, backend vẫn là chốt chặn cuối).
// Các ô đều tùy chọn: để trống là hợp lệ, chỉ chặn khi nhập giá trị sai.
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/
function isPhoneInvalid(phone) {
  const v = (phone || '').trim()
  return v !== '' && !PHONE_PATTERN.test(v)
}
const SEGMENT_BADGE_CLASSES = {
  VIP:      'text-primary bg-surface-selected',
  LOYAL:    'text-info bg-info-bg',
  REGULAR:  'text-success bg-success-bg',
  NEW:      'text-warning bg-warning-bg',
  INACTIVE: 'text-muted-foreground bg-surface-muted',
}

function SegmentBadge({ segment }) {
  const cls = SEGMENT_BADGE_CLASSES[segment] ?? 'text-muted-foreground bg-surface-muted'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${cls}`}>
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
      .then((r) => { if (!active) return; setState({ status: 'success', customer: r.item, warning: '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', customer: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [customerId])

  async function handleStatusChange(value) {
    // Radix Select truyền thẳng value (chuỗi), không phải DOM event.
    if (!value || value === state.customer?.status) return
    // DISABLED/BLOCKED khóa khách khỏi đăng nhập/mua hàng → xác nhận hậu quả trước khi áp dụng.
    if (value === 'BLOCKED' || value === 'DISABLED') {
      const label = t(`status.customer.${value}`, { defaultValue: value })
      const ok = await showConfirm(
        t('customers.detail.statusConfirmBody', {
          status: label,
          defaultValue: `Chuyển tài khoản sang "${label}" sẽ chặn khách hàng đăng nhập và mua hàng. Tiếp tục?`,
        }),
        t('customers.detail.statusConfirmTitle', { defaultValue: 'Đổi trạng thái tài khoản' }),
        { confirmLabel: t('customers.detail.statusConfirmOk', { defaultValue: 'Đổi trạng thái' }) },
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      const r = await updateCustomerStatus(customerId, value)
      setState((p) => ({ ...p, customer: r.item }))
      toast.success(t('customers.detail.statusUpdated'))
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function handleEditOpen(customer) {
    setEditForm({
      displayName: customer.displayName || customer.fullName || '',
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      phone: customer.phone || '',
    })
    setEditOpen(true)
  }

  function handleEditCancel() {
    setEditOpen(false)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    if (isPhoneInvalid(editForm.phone)) {
      toast.error('Số điện thoại không hợp lệ.')
      return
    }
    setEditSaving(true)
    try {
      const r = await updateCustomer(customerId, {
        displayName: editForm.displayName,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
      })
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

  const phoneError = isPhoneInvalid(editForm.phone)

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('customers.detail.eyebrow')}</p>
          <h1>{formatText(customer.fullName)}</h1>
          <p className="bb-muted">{formatText(customer.email)}</p>
        </div>
        <div className="bb-screen-actions">
          <Button variant="outline" onClick={() => navigate('/admin/customers')}>
            {t('customers.detail.backToList')}
          </Button>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <Select
              value={customer.status}
              onValueChange={handleStatusChange}
              disabled={!canUpdate || saving}
            ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {CUSTOMER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`status.customer.${s}`, { defaultValue: s })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>
        </DetailSection>

        {customer.addresses && customer.addresses.length > 0 && (
          <DetailSection title="Địa chỉ đã lưu">
            <div className="flex flex-col gap-3">
              {customer.addresses.map((addr, i) => (
                <div key={i} className="text-sm border border-border rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{formatText(addr.fullName)}</span>
                    {addr.type && (
                      <span className="bb-badge bb-badge-neutral text-xs">
                        {addr.type === 'BILLING' ? 'Thanh toán' : addr.type === 'SHIPPING' ? 'Giao hàng' : addr.type}
                      </span>
                    )}
                  </div>
                  {addr.phone && <p className="text-muted-foreground">{addr.phone}</p>}
                  <p>
                    {[addr.addressLine1, addr.addressLine2, addr.ward, addr.district, addr.province]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                </div>
              ))}
            </div>
          </DetailSection>
        )}

        <DetailSection title="Chỉnh sửa hồ sơ">
          {!editOpen ? (
            <Button variant="outline" onClick={() => handleEditOpen(customer)} disabled={!canUpdate}>
              Chỉnh sửa
            </Button>
          ) : (
            <form onSubmit={handleEditSave} className="flex flex-col gap-3">
              <label>
                Tên hiển thị
                <Input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                  disabled={editSaving}
                 />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  Tên
                  <Input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((p) => ({ ...p, firstName: e.target.value }))}
                    disabled={editSaving}
                   />
                </label>
                <label>
                  Họ
                  <Input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((p) => ({ ...p, lastName: e.target.value }))}
                    disabled={editSaving}
                   />
                </label>
              </div>
              <label>
                Email
                <Input
                  type="text"
                  value={customer.email || ''}
                  readOnly
                  disabled
                  className="opacity-60"
                 />
              </label>
              <label>
                Số điện thoại
                <Input
                  type="text"
                  inputMode="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  disabled={editSaving}
                  aria-invalid={phoneError || undefined}
                 />
                {phoneError ? (
                  <span className="mt-1 flex items-center gap-1 text-xs text-danger font-semibold" role="alert">
                    <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
                    Số điện thoại phải gồm 8–15 chữ số (có thể bắt đầu bằng dấu +).
                  </span>
                ) : (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Để trống nếu chưa có. VD: 0901234567
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <Button type="submit" disabled={editSaving || phoneError}>
                  {editSaving ? 'Đang lưu...' : 'Lưu'}
                </Button>
                <Button type="button" variant="outline" onClick={handleEditCancel} disabled={editSaving}>
                  Hủy
                </Button>
              </div>
            </form>
          )}
        </DetailSection>

        {/* Customer value stats */}
        <DetailSection title={t('customers.detail.sectionStats')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {t('customers.detail.orderCount', { defaultValue: 'Tổng đơn hàng' })}
              </p>
              <p className="text-xl font-bold leading-none">{customer.orderCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {t('customers.detail.totalSpent', { defaultValue: 'Tổng chi tiêu (LTV)' })}
              </p>
              <p className="text-xl font-bold leading-none">{formatCurrencyVnd(customer.totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {t('customers.detail.avgOrderValue', { defaultValue: 'Giá trị đơn TB (AOV)' })}
              </p>
              <p className="text-lg font-semibold leading-none">{formatCurrencyVnd(customer.avgOrderValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t('customers.detail.segment', { defaultValue: 'Phân khúc' })}
              </p>
              <SegmentBadge segment={customer.segment} />
            </div>
            {customer.firstOrderAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  {t('customers.detail.firstOrder', { defaultValue: 'Đơn đầu tiên' })}
                </p>
                <p className="text-sm">{formatDateTime(customer.firstOrderAt)}</p>
              </div>
            )}
            {customer.lastOrderAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  {t('customers.detail.lastOrder', { defaultValue: 'Đơn gần nhất' })}
                </p>
                <p className="text-sm">{formatDateTime(customer.lastOrderAt)}</p>
              </div>
            )}
          </div>
        </DetailSection>

        {/* Latest orders mini-list */}
        {customer.latestOrders && customer.latestOrders.length > 0 && (
          <DetailSection title={t('customers.detail.sectionLatestOrders', { defaultValue: 'Đơn hàng gần đây' })}>
            <div className="flex flex-col gap-2">
              {customer.latestOrders.map((o) => (
                <div key={o.id} className="flex justify-between items-center text-sm">
                  <span className="font-mono text-muted-foreground">#{o.orderNumber}</span>
                  <StatusBadge status={o.status} type="order" />
                  <span className="font-semibold">{formatCurrencyVnd(o.totalAmount)}</span>
                </div>
              ))}
            </div>
          </DetailSection>
        )}
      </div>
    </div>
  )
}
