import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { recordRecentItem } from '@/lib/useRecentItems'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchCustomerDetail, mapValidationErrors, removeCustomerAvatar, updateCustomer, updateCustomerStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useQueryClient } from '@tanstack/react-query'

const CUSTOMER_STATUSES = ['ACTIVE', 'DISABLED', 'BLOCKED']

// T9: đọc lại query string (filter/trang) mà CustomerListScreen đã lưu trước khi
// điều hướng sang trang chi tiết, để nút "Quay lại danh sách" không làm mất bộ lọc.
function readListQuery() {
  try {
    return sessionStorage.getItem('customers:listQuery') || ''
  } catch {
    return ''
  }
}

// Kiểm tra tại form, cùng quy tắc backend (chỉ báo trước, backend vẫn là chốt chặn cuối).
// Các ô đều tùy chọn: để trống là hợp lệ, chỉ chặn khi nhập giá trị sai.
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/
function isPhoneInvalid(phone) {
  const v = (phone || '').trim()
  return v !== '' && !PHONE_PATTERN.test(v)
}
// Nhãn loại địa chỉ đã lưu (i18n, có fallback về mã gốc nếu là loại lạ).
function addressTypeLabel(type, t) {
  if (type === 'BILLING') return t('customers.detail.addressBilling', { defaultValue: 'Thanh toán' })
  if (type === 'SHIPPING') return t('customers.detail.addressShipping', { defaultValue: 'Giao hàng' })
  return type
}

const SEGMENT_BADGE_CLASSES = {
  VIP:      'text-primary bg-surface-selected',
  LOYAL:    'text-info bg-info-bg',
  REGULAR:  'text-success bg-success-bg',
  NEW:      'text-warning bg-warning-bg',
  INACTIVE: 'text-muted-foreground bg-surface-muted',
}

// Ảnh đại diện khách hàng: có avatarUrl thì hiện ảnh tròn; không thì hiện chữ cái
// đầu trên nền trung tính (đây là công cụ nội bộ, không phải bề mặt thương hiệu
// khách hàng nên không dùng đỏ brand như trên web).
function CustomerAvatar({ avatarUrl, name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-muted-foreground"
    >
      {initial}
    </span>
  )
}

function SegmentBadge({ segment }) {
  const { t } = useTranslation()
  const cls = SEGMENT_BADGE_CLASSES[segment] ?? 'text-muted-foreground bg-surface-muted'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${cls}`}>
      {t(`customers.segment.${segment}`, { defaultValue: segment })}
    </span>
  )
}

// F1: cùng pattern hiển thị lỗi của phoneError (icon AlertCircle + chữ đỏ) — dùng
// chung cho lỗi field-level backend trả về khi lưu form sửa hồ sơ.
function FieldError({ message }) {
  if (!message) return null
  return (
    <span className="mt-1 flex items-center gap-1 text-xs text-danger font-semibold" role="alert">
      <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
      {message}
    </span>
  )
}

export function CustomerDetailScreen({ customerId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', customer: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', phone: '' })
  const [editBaseline, setEditBaseline] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  // F1: lỗi validate backend gắn theo từng ô (vd SĐT trùng), tách khỏi toast.
  const [fieldErrors, setFieldErrors] = useState({})

  // F6: form sửa hồ sơ đang mở và nội dung khác baseline → còn thay đổi chưa lưu.
  const isDirty = editOpen && editBaseline != null &&
    JSON.stringify(editForm) !== JSON.stringify(editBaseline)
  useUnsavedChanges(isDirty)

  // N2: tách hàm tải để nút "Thử lại" gọi lại được khi lỗi mạng/API.
  // active flag: chỉ áp kết quả khi component còn mount / lần tải còn hiệu lực.
  const fetchInto = useCallback((isActive) => {
    fetchCustomerDetail(customerId)
      .then((r) => { if (isActive()) setState({ status: 'success', customer: r.item, warning: '' }) })
      .catch((e) => { if (isActive()) setState({ status: 'error', customer: null, warning: '', error: e.message }) })
  }, [customerId])

  useEffect(() => {
    let active = true
    fetchInto(() => active)
    return () => { active = false }
  }, [fetchInto])

  // O9: ghi lại khách hàng vừa xem để hiện trong widget "Vừa xem gần đây" ở danh sách.
  useEffect(() => {
    if (state.customer?.id) {
      recordRecentItem('recent:customers', {
        id: state.customer.id,
        label: formatText(state.customer.fullName, state.customer.email),
      })
    }
  }, [state.customer?.id, state.customer?.fullName, state.customer?.email])

  // Nút "Thử lại" khi lỗi: về trạng thái loading rồi tải lại.
  function handleRetry() {
    setState({ status: 'loading', customer: null, warning: '' })
    fetchInto(() => true)
  }

  async function handleStatusChange(value) {
    // Radix Select truyền thẳng value (chuỗi), không phải DOM event.
    if (!value || value === state.customer?.status) return
    // Q4: DISABLED/BLOCKED là nhãn quản lý nội bộ (lifecycle chưa được xác thực) →
    // xác nhận bằng câu trung tính, không khẳng định chặn đăng nhập/mua hàng.
    if (value === 'BLOCKED' || value === 'DISABLED') {
      const label = t(`status.customer.${value}`, { defaultValue: value })
      const ok = await showConfirm(
        t('customers.detail.statusConfirmBody', {
          status: label,
          defaultValue: `Đánh dấu tài khoản là "${label}". Trạng thái này dùng để quản lý nội bộ.`,
        }),
        t('customers.detail.statusConfirmTitle', { defaultValue: 'Đổi trạng thái tài khoản' }),
        { confirmLabel: t('customers.detail.statusConfirmOk', { defaultValue: 'Đổi trạng thái' }) },
      )
      if (!ok) return
    }
    // N7: transition không phá huỷ (vd chuyển sang ACTIVE) — cập nhật lạc quan ngay
    // trên UI, rollback về giá trị cũ nếu API lỗi (theo pattern optimistic đã có ở
    // ReviewListScreen.handleStatusChange).
    const previousStatus = state.customer?.status
    const isOptimistic = value === 'ACTIVE'
    if (isOptimistic) {
      setState((p) => ({ ...p, customer: { ...p.customer, status: value } }))
    }
    setSaving(true)
    try {
      const r = await updateCustomerStatus(customerId, value)
      setState((p) => ({ ...p, customer: r.item }))
      // Đồng bộ lại danh sách + số liệu tổng quan để trạng thái mới hiển thị khi quay lại.
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
      toast.success(t('customers.detail.statusUpdated'))
    } catch (err) {
      if (isOptimistic) {
        setState((p) => ({ ...p, customer: { ...p.customer, status: previousStatus } }))
      }
      toast.error(err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveAvatar() {
    const ok = await showConfirm(
      t('customers.detail.avatarRemoveConfirmBody', {
        defaultValue: 'Xoá ảnh đại diện của khách hàng này? Khách sẽ cần tự tải ảnh mới nếu muốn.',
      }),
      t('customers.detail.avatarRemoveConfirmTitle', { defaultValue: 'Xoá ảnh đại diện' }),
      { variant: 'danger', confirmLabel: t('customers.detail.avatarRemoveConfirmOk', { defaultValue: 'Xoá ảnh' }) },
    )
    if (!ok) return
    setSaving(true)
    try {
      const r = await removeCustomerAvatar(customerId)
      setState((p) => ({ ...p, customer: r.item }))
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
      toast.success(t('customers.detail.avatarRemoved', { defaultValue: 'Đã xoá ảnh đại diện.' }))
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function handleEditOpen(customer) {
    const initial = {
      displayName: customer.displayName || customer.fullName || '',
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      phone: customer.phone || '',
    }
    setEditForm(initial)
    setEditBaseline(initial)
    setFieldErrors({})
    setEditOpen(true)
  }

  function handleEditCancel() {
    setEditOpen(false)
    setEditBaseline(null)
    setFieldErrors({})
  }

  const handleEditSave = useCallback(async (e) => {
    e.preventDefault()
    if (isPhoneInvalid(editForm.phone)) {
      toast.error(t('customers.detail.phoneInvalidToast', { defaultValue: 'Số điện thoại không hợp lệ.' }))
      return
    }
    setEditSaving(true)
    setFieldErrors({})
    try {
      const r = await updateCustomer(customerId, {
        displayName: editForm.displayName,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
      })
      setState((p) => ({ ...p, customer: r.item }))
      setEditOpen(false)
      setEditBaseline(null)
      // Đồng bộ lại danh sách khách hàng để tên/SĐT vừa sửa hiển thị khi quay lại.
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success(t('customers.detail.profileUpdated', { defaultValue: 'Thông tin đã được cập nhật.' }))
    } catch (err) {
      // F1: gắn thêm lỗi vào đúng ô (vd SĐT trùng) khi backend trả field-level detail,
      // bên cạnh toast — không tự bịa field nếu backend không xác định được.
      const fieldErrs = mapValidationErrors(err)
      if (Object.keys(fieldErrs).length > 0) {
        setFieldErrors(fieldErrs)
      }
      toast.error(err.message || t('common.error'))
    } finally {
      setEditSaving(false)
    }
  }, [customerId, editForm, t, queryClient])

  // O3: Ctrl/Cmd+S lưu form sửa hồ sơ khi đang mở.
  useSaveShortcut(editOpen, handleEditSave)

  if (state.status === 'loading') return <StatePanel tone="info" title={t('customers.detail.loading')} description={t('common.pleaseWait')} />
  if (state.status === 'error') return <StatePanel tone="danger" title={t('customers.detail.error')} description={state.error} actionLabel={t('common.retry', { defaultValue: 'Thử lại' })} onAction={handleRetry} />
  if (!state.customer) return <StatePanel tone="neutral" title={t('customers.detail.notFound')} description={`ID: ${customerId}`} actionLabel={t('common.back')} onAction={() => navigate('/admin/customers')} />

  const { customer } = state

  const phoneError = isPhoneInvalid(editForm.phone)

  return (
    <div>
      <div className="bb-screen-header">
        <div className="flex items-center gap-4">
          <CustomerAvatar avatarUrl={customer.avatarUrl} name={customer.fullName} />
          <div className="bb-screen-title">
            <p className="bb-screen-eyebrow">{t('customers.detail.eyebrow')}</p>
            <h1>{formatText(customer.fullName)}</h1>
            <p className="bb-muted">{formatText(customer.email)}</p>
          </div>
        </div>
        <div className="bb-screen-actions">
          {customer.avatarUrl && (
            <Button variant="outline" onClick={handleRemoveAvatar} disabled={!canUpdate || saving}>
              {t('customers.detail.removeAvatar', { defaultValue: 'Xoá ảnh đại diện' })}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/admin/customers${readListQuery()}`)}>
            {t('customers.detail.backToList')}
          </Button>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}
      {!canUpdate && (
        <ReadOnlyBanner warning={t('customers.detail.readOnlyHint', { defaultValue: 'Bạn chỉ có quyền xem hồ sơ khách hàng. Liên hệ quản trị để được cấp quyền chỉnh sửa.' })} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DetailSection title={t('customers.detail.sectionAccount')}>
          <p><strong>{t('customers.detail.email')}</strong> {formatText(customer.email)}</p>
          <p><strong>{t('customers.detail.phone')}</strong> {formatText(customer.phone)}</p>
          <p><strong>{t('customers.detail.registered')}</strong> {formatDateTime(customer.createdAt)}</p>
          <p>
            <strong>{t('customers.detail.emailVerified', { defaultValue: 'Email xác thực:' })}</strong>{' '}
            {customer.emailVerifiedAt
              ? formatDateTime(customer.emailVerifiedAt)
              : t('customers.detail.emailNotVerified', { defaultValue: 'Chưa xác thực' })}
          </p>
          {customer.lastLoginAt && (
            <p><strong>{t('customers.detail.lastLogin', { defaultValue: 'Đăng nhập gần nhất:' })}</strong> {formatDateTime(customer.lastLoginAt)}</p>
          )}
        </DetailSection>

        <DetailSection title={t('customers.detail.sectionStatus')}>
          <label>
            {t('customers.detail.accountStatus')}
            {/* Trạng thái ngoài nhóm set-được (vd PENDING "chờ duyệt") → huy hiệu chỉ-đọc,
                không để Select trống trông như lỗi (audit P0-5). */}
            {(canUpdate && CUSTOMER_STATUSES.includes(customer.status)) ? (
              <Select
                value={customer.status}
                onValueChange={handleStatusChange}
                disabled={saving}
              ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                {CUSTOMER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{t(`status.customer.${s}`, { defaultValue: s })}</SelectItem>
                ))}
              </SelectContent></Select>
            ) : (
              <div className="mt-1"><StatusBadge type="customer" status={customer.status} /></div>
            )}
          </label>
        </DetailSection>

        {customer.addresses && customer.addresses.length > 0 && (
          <DetailSection title={t('customers.detail.sectionAddresses', { defaultValue: 'Địa chỉ đã lưu' })}>
            <div className="flex flex-col gap-3">
              {customer.addresses.map((addr, i) => (
                <div key={i} className="text-sm border border-border rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold break-words">{formatText(addr.fullName)}</span>
                    {addr.type && (
                      <span className="bb-badge bb-badge-neutral text-xs">
                        {addressTypeLabel(addr.type, t)}
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

        <DetailSection title={t('customers.detail.sectionEditProfile', { defaultValue: 'Chỉnh sửa hồ sơ' })}>
          {!editOpen ? (
            <Button variant="outline" onClick={() => handleEditOpen(customer)} disabled={!canUpdate}>
              {t('common.edit')}
            </Button>
          ) : (
            <form onSubmit={handleEditSave} className="flex flex-col gap-3">
              <label>
                {t('customers.detail.fieldDisplayName', { defaultValue: 'Tên hiển thị' })}
                <OptionalMark t={t} />
                <Input
                  type="text"
                  value={editForm.displayName}
                  maxLength={120}
                  onChange={(e) => {
                    setEditForm((p) => ({ ...p, displayName: e.target.value }))
                    if (fieldErrors.displayName) setFieldErrors((p) => ({ ...p, displayName: undefined }))
                  }}
                  disabled={editSaving}
                  aria-invalid={fieldErrors.displayName ? true : undefined}
                 />
                <FieldError message={fieldErrors.displayName} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  Tên
                  <Input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, firstName: e.target.value }))
                      if (fieldErrors.firstName) setFieldErrors((p) => ({ ...p, firstName: undefined }))
                    }}
                    disabled={editSaving}
                    aria-invalid={fieldErrors.firstName ? true : undefined}
                   />
                  <FieldError message={fieldErrors.firstName} />
                </label>
                <label>
                  Họ
                  <Input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, lastName: e.target.value }))
                      if (fieldErrors.lastName) setFieldErrors((p) => ({ ...p, lastName: undefined }))
                    }}
                    disabled={editSaving}
                    aria-invalid={fieldErrors.lastName ? true : undefined}
                   />
                  <FieldError message={fieldErrors.lastName} />
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
                  onChange={(e) => {
                    setEditForm((p) => ({ ...p, phone: e.target.value }))
                    if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }))
                  }}
                  disabled={editSaving}
                  aria-invalid={(phoneError || !!fieldErrors.phone) || undefined}
                 />
                {phoneError ? (
                  <span className="mt-1 flex items-center gap-1 text-xs text-danger font-semibold" role="alert">
                    <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
                    Số điện thoại phải gồm 8–15 chữ số (có thể bắt đầu bằng dấu +).
                  </span>
                ) : fieldErrors.phone ? (
                  <FieldError message={fieldErrors.phone} />
                ) : (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Để trống nếu chưa có. VD: 0901234567
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <Button type="submit" loading={editSaving} disabled={phoneError}>
                  Lưu
                </Button>
                <Button type="button" variant="outline" onClick={handleEditCancel} disabled={editSaving}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          )}
        </DetailSection>

        {/* Customer value stats */}
        <DetailSection title={t('customers.detail.sectionStats')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t('customers.detail.orderCount', { defaultValue: 'Tổng đơn hàng' })}
              </p>
              <p className="text-xl font-bold leading-none">{customer.orderCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t('customers.detail.totalSpent', { defaultValue: 'Tổng chi tiêu (LTV)' })}
              </p>
              <p className="text-xl font-bold leading-none">{formatCurrencyVnd(customer.totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
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
                <p className="text-xs text-muted-foreground mb-1">
                  {t('customers.detail.firstOrder', { defaultValue: 'Đơn đầu tiên' })}
                </p>
                <p className="text-sm">{formatDateTime(customer.firstOrderAt)}</p>
              </div>
            )}
            {customer.lastOrderAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
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
