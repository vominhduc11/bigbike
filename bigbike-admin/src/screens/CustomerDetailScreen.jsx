import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  CreditCard,
  Edit3,
  ImageOff,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Save,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { recordRecentItem } from '@/lib/useRecentItems'
import { CustomerStatusReasonModal } from '../components/CustomerStatusReasonModal'
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
import { FormField, Screen, ScreenHeader } from '../components/layout'
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

function stripTrailingColon(label) {
  return typeof label === 'string' ? label.replace(/:\s*$/, '') : label
}

function stripLeadingArrow(label) {
  return typeof label === 'string' ? label.replace(/^←\s*/, '') : label
}

// Tone bb-badge cho từng phân khúc — không dùng đỏ primary (dành riêng cho CTA/active/
// selected theo CLAUDE.md), VIP nổi bật bằng tone warning thay vì màu thương hiệu.
const SEGMENT_BADGE_TONE = {
  VIP:      'warning',
  LOYAL:    'info',
  REGULAR:  'success',
  NEW:      'neutral',
  INACTIVE: 'muted',
}

// Ảnh đại diện khách hàng: có avatarUrl thì hiện ảnh tròn; không thì hiện chữ cái
// đầu trên nền trung tính (đây là công cụ nội bộ, không phải bề mặt thương hiệu
// khách hàng nên không dùng đỏ brand như trên web).
function CustomerAvatar({ avatarUrl, name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-muted-foreground"
    >
      {initial}
    </span>
  )
}

// Cùng ngôn ngữ hình ảnh với StatusBadge (bb-badge + dot) thay vì tự vẽ pill riêng,
// để nhất quán với các badge khác trên cùng màn hình (nguồn tài khoản, trạng thái đơn).
function SegmentBadge({ segment }) {
  const { t } = useTranslation()
  const tone = SEGMENT_BADGE_TONE[segment] ?? 'muted'
  return (
    <span className={`bb-badge bb-badge-${tone}`}>
      <span className="dot" aria-hidden="true" />
      {t(`customers.segment.${segment}`, { defaultValue: segment })}
    </span>
  )
}

function DetailRow({ label, icon: Icon, children }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {Icon ? <Icon size={15} aria-hidden="true" className="shrink-0" /> : null}
        {stripTrailingColon(label)}
      </dt>
      <dd className="m-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  )
}

function EmptyInline({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {Icon ? <Icon size={18} aria-hidden="true" className="shrink-0" /> : null}
      <span>{children}</span>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, tone = 'info', money = false, hint }) {
  return (
    <div className="bb-kpi">
      <div className="bb-kpi-head">
        <span>{stripTrailingColon(label)}</span>
        <span className={`bb-kpi-icon ${tone}`}>
          {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        </span>
      </div>
      <div className={money ? 'bb-kpi-value bb-kpi-value--money' : 'bb-kpi-value'}>{value}</div>
      {hint ? (
        <div className="bb-kpi-foot">
          <span className="bb-kpi-foot-label">{hint}</span>
        </div>
      ) : null}
    </div>
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
  // Đổi trạng thái sang BLOCKED/DISABLED mở modal xin lý do (tùy chọn) — value đang chờ xác nhận.
  const [reasonModal, setReasonModal] = useState(null)

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
    // mở modal xin lý do (tùy chọn) bằng câu trung tính, không khẳng định chặn đăng
    // nhập/mua hàng.
    if (value === 'BLOCKED' || value === 'DISABLED') {
      setReasonModal({ value })
      return
    }
    await applyStatusChange(value)
  }

  async function applyStatusChange(value, reason) {
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
      const r = await updateCustomerStatus(customerId, value, reason)
      setState((p) => ({ ...p, customer: r.item }))
      // Đồng bộ lại danh sách + số liệu tổng quan để trạng thái mới hiển thị khi quay lại.
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
      toast.success(t('customers.detail.statusUpdated'))
      return true
    } catch (err) {
      if (isOptimistic) {
        setState((p) => ({ ...p, customer: { ...p.customer, status: previousStatus } }))
      }
      toast.error(err.message || t('common.error'))
      return false
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

  if (state.status === 'loading') return <Screen><StatePanel tone="info" title={t('customers.detail.loading')} description={t('common.pleaseWait')} /></Screen>
  if (state.status === 'error') return <Screen><StatePanel tone="danger" title={t('customers.detail.error')} description={state.error} actionLabel={t('common.retry', { defaultValue: 'Thử lại' })} onAction={handleRetry} /></Screen>
  if (!state.customer) return <Screen><StatePanel tone="neutral" title={t('customers.detail.notFound')} description={`ID: ${customerId}`} actionLabel={t('common.back')} onAction={() => navigate('/admin/customers')} /></Screen>

  const { customer } = state

  const phoneError = isPhoneInvalid(editForm.phone)
  const editAction = !editOpen ? (
    <Button type="button" variant="secondary" className="min-h-11" onClick={() => handleEditOpen(customer)} disabled={!canUpdate}>
      <Edit3 size={16} aria-hidden="true" />
      {t('common.edit')}
    </Button>
  ) : null

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('customers.detail.eyebrow')}
        title={(
          <span className="flex min-w-0 items-center gap-3">
            <CustomerAvatar avatarUrl={customer.avatarUrl} name={customer.fullName} />
            <span className="min-w-0 truncate">{formatText(customer.fullName)}</span>
          </span>
        )}
        description={formatText(customer.email)}
        badge={<StatusBadge type="customer" status={customer.status} />}
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
          {customer.avatarUrl && (
            <Button type="button" variant="outline" className="min-h-11" onClick={handleRemoveAvatar} disabled={!canUpdate || saving}>
              <ImageOff size={16} aria-hidden="true" />
              {t('customers.detail.removeAvatar', { defaultValue: 'Xoá ảnh đại diện' })}
            </Button>
          )}
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => navigate(`/admin/customers${readListQuery()}`)}>
            <ArrowLeft size={16} aria-hidden="true" />
            {stripLeadingArrow(t('customers.detail.backToList'))}
          </Button>
        </div>
        )}
      />

      {state.warning && <ReadOnlyBanner warning={state.warning} />}
      {!canUpdate && (
        <ReadOnlyBanner warning={t('customers.detail.readOnlyHint', { defaultValue: 'Bạn chỉ có quyền xem hồ sơ khách hàng. Liên hệ quản trị để được cấp quyền chỉnh sửa.' })} />
      )}

      <div className="bb-kpi-grid bb-kpi-grid-4">
        <MetricCard
          icon={ShoppingBag}
          tone="info"
          label={t('customers.detail.orderCount', { defaultValue: 'Tổng đơn hàng' })}
          value={(customer.orderCount ?? 0).toLocaleString()}
          hint={customer.lastOrderAt ? t('customers.detail.lastOrder', { defaultValue: 'Đơn gần nhất' }) : t('customers.detail.noOrdersYet', { defaultValue: 'Chưa có đơn hàng' })}
        />
        <MetricCard
          icon={CreditCard}
          tone="success"
          money
          label={t('customers.detail.totalSpent', { defaultValue: 'Tổng chi tiêu' })}
          value={formatCurrencyVnd(customer.totalSpent)}
          hint={t('customers.detail.lifetimeValueHint', { defaultValue: 'Giá trị tích luỹ của khách' })}
        />
        <MetricCard
          icon={ReceiptText}
          tone="warning"
          money
          label={t('customers.detail.avgOrderValue', { defaultValue: 'Giá trị đơn TB (AOV)' })}
          value={formatCurrencyVnd(customer.avgOrderValue)}
          hint={t('customers.detail.avgOrderValueHint', { defaultValue: 'Trung bình mỗi đơn hàng' })}
        />
        <MetricCard
          icon={UserRound}
          tone="brand"
          label={t('customers.detail.segment', { defaultValue: 'Phân khúc' })}
          value={<SegmentBadge segment={customer.segment} />}
          hint={t('customers.detail.segmentHint', { defaultValue: 'Dựa trên số đơn và tổng chi tiêu' })}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <DetailSection title={t('customers.detail.sectionAccount')}>
            <dl className="m-0">
              <DetailRow label={t('customers.detail.source', { defaultValue: 'Nguồn tài khoản' })} icon={UserRound}>
                <StatusBadge type="source" status={customer.isSynthetic} />
              </DetailRow>
              <DetailRow label={t('customers.detail.email')} icon={Mail}>
                {formatText(customer.email)}
              </DetailRow>
              <DetailRow label={t('customers.detail.phone')} icon={Phone}>
                {formatText(customer.phone)}
              </DetailRow>
              <DetailRow label={t('customers.detail.registered')} icon={CalendarDays}>
                {formatDateTime(customer.createdAt)}
              </DetailRow>
              <DetailRow label={t('customers.detail.emailVerified', { defaultValue: 'Email xác thực' })} icon={ShieldCheck}>
                {customer.emailVerifiedAt
                  ? formatDateTime(customer.emailVerifiedAt)
                  : t('customers.detail.emailNotVerified', { defaultValue: 'Chưa xác thực' })}
              </DetailRow>
              <DetailRow label={t('customers.detail.lastLogin', { defaultValue: 'Đăng nhập gần nhất' })} icon={Clock3}>
                {formatDateTime(customer.lastLoginAt)}
              </DetailRow>
            </dl>
          </DetailSection>

          <DetailSection title={t('customers.detail.sectionAddresses', { defaultValue: 'Địa chỉ đã lưu' })}>
            {customer.addresses?.length ? (
              <div className="divide-y divide-border">
                {customer.addresses.map((addr, i) => (
                  <div key={`${addr.type || 'address'}-${i}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold break-words">{formatText(addr.fullName)}</span>
                      {addr.type && (
                        <span className="bb-badge bb-badge-neutral text-xs">
                          <span className="dot" aria-hidden="true" />
                          {addressTypeLabel(addr.type, t)}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-1 text-sm text-muted-foreground">
                      {addr.phone ? <span>{addr.phone}</span> : null}
                      <span className="text-foreground">
                        {[addr.addressLine1, addr.addressLine2, addr.ward, addr.district, addr.province]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyInline icon={MapPin}>{t('customers.detail.noAddresses', { defaultValue: 'Khách hàng chưa lưu địa chỉ.' })}</EmptyInline>
            )}
          </DetailSection>

          <DetailSection title={t('customers.detail.sectionStats')}>
            <dl className="m-0">
              <DetailRow label={t('customers.detail.firstOrder', { defaultValue: 'Đơn đầu tiên' })} icon={CalendarDays}>
                {formatDateTime(customer.firstOrderAt)}
              </DetailRow>
              <DetailRow label={t('customers.detail.lastOrder', { defaultValue: 'Đơn gần nhất' })} icon={Clock3}>
                {formatDateTime(customer.lastOrderAt)}
              </DetailRow>
            </dl>
          </DetailSection>

          <DetailSection title={t('customers.detail.sectionLatestOrders', { defaultValue: 'Đơn hàng gần đây' })}>
            {customer.latestOrders?.length ? (
              <div className="divide-y divide-border">
                {customer.latestOrders.map((o) => (
                  <div key={o.id || o.orderNumber} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <p className="m-0 truncate font-mono text-sm font-semibold">#{formatText(o.orderNumber, o.id)}</p>
                      <p className="m-0 text-xs text-muted-foreground">{formatDateTime(o.placedAt)}</p>
                    </div>
                    <StatusBadge status={o.status} type="order" />
                    <span className="text-sm font-semibold">{formatCurrencyVnd(o.totalAmount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyInline icon={ReceiptText}>{t('customers.detail.noLatestOrders', { defaultValue: 'Chưa có đơn hàng gần đây.' })}</EmptyInline>
            )}
          </DetailSection>
        </div>

        <aside className="grid h-fit gap-6 lg:sticky lg:top-4">
          <DetailSection title={t('customers.detail.sectionStatus')}>
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-muted-foreground">{t('customers.detail.accountStatus')}</span>
                <StatusBadge type="customer" status={customer.status} />
              </div>
              {/* Trạng thái ngoài nhóm set-được (vd PENDING "chờ duyệt") → huy hiệu chỉ-đọc,
                  không để Select trống trông như lỗi (audit P0-5). */}
              {(canUpdate && CUSTOMER_STATUSES.includes(customer.status)) ? (
                <Select
                  value={customer.status}
                  onValueChange={handleStatusChange}
                  disabled={saving}
                >
                  <SelectTrigger aria-label={t('customers.detail.accountStatus')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`status.customer.${s}`, { defaultValue: s })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">
                  {t('customers.detail.statusReadOnly', { defaultValue: 'Trạng thái này chỉ có thể xem tại màn hiện tại.' })}
                </p>
              )}
            </div>
          </DetailSection>

          <DetailSection title={t('customers.detail.sectionEditProfile', { defaultValue: 'Chỉnh sửa hồ sơ' })}>
            {!editOpen ? (
              <div className="grid gap-3">
                <p className="m-0 text-sm text-muted-foreground">
                  {canUpdate
                    ? t('customers.detail.editProfileHint', { defaultValue: 'Cập nhật tên hiển thị và số điện thoại của khách hàng.' })
                    : t('customers.detail.noEditPermission', { defaultValue: 'Bạn không có quyền chỉnh sửa hồ sơ này.' })}
                </p>
                {editAction}
              </div>
            ) : (
              <form onSubmit={handleEditSave} className="grid gap-3">
                <FormField label={t('customers.detail.fieldDisplayName', { defaultValue: 'Tên hiển thị (tùy chọn)' })} error={fieldErrors.displayName}>
                  <Input
                    type="text"
                    value={editForm.displayName}
                    maxLength={120}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, displayName: e.target.value }))
                      if (fieldErrors.displayName) setFieldErrors((p) => ({ ...p, displayName: undefined }))
                    }}
                    disabled={editSaving}
                  />
                </FormField>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <FormField label={t('customers.detail.fieldFirstName', { defaultValue: 'Tên' })} error={fieldErrors.firstName}>
                    <Input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => {
                        setEditForm((p) => ({ ...p, firstName: e.target.value }))
                        if (fieldErrors.firstName) setFieldErrors((p) => ({ ...p, firstName: undefined }))
                      }}
                      disabled={editSaving}
                    />
                  </FormField>
                  <FormField label={t('customers.detail.fieldLastName', { defaultValue: 'Họ' })} error={fieldErrors.lastName}>
                    <Input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => {
                        setEditForm((p) => ({ ...p, lastName: e.target.value }))
                        if (fieldErrors.lastName) setFieldErrors((p) => ({ ...p, lastName: undefined }))
                      }}
                      disabled={editSaving}
                    />
                  </FormField>
                </div>
                <FormField label={t('customers.detail.fieldEmail', { defaultValue: 'Email' })}>
                  <Input
                    type="text"
                    value={customer.email || ''}
                    readOnly
                    disabled
                    className="opacity-60"
                  />
                </FormField>
                <FormField
                  label={t('customers.detail.fieldPhone', { defaultValue: 'Số điện thoại' })}
                  error={phoneError
                    ? t('customers.detail.phoneFormatHint', { defaultValue: 'Số điện thoại phải gồm 8–15 chữ số (có thể bắt đầu bằng dấu +).' })
                    : fieldErrors.phone}
                  helper={t('customers.detail.phoneEmptyHint', { defaultValue: 'Để trống nếu chưa có. VD: 0901234567' })}
                >
                  <Input
                    type="text"
                    inputMode="tel"
                    value={editForm.phone}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, phone: e.target.value }))
                      if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }))
                    }}
                    disabled={editSaving}
                  />
                </FormField>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" className="min-h-11" loading={editSaving} disabled={phoneError}>
                    <Save size={16} aria-hidden="true" />
                    {t('common.save')}
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleEditCancel} disabled={editSaving}>
                    <X size={16} aria-hidden="true" />
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            )}
          </DetailSection>
        </aside>
      </div>

      {reasonModal && (
        <CustomerStatusReasonModal
          title={t('customers.detail.statusConfirmTitle', { defaultValue: 'Đổi trạng thái tài khoản' })}
          description={t('customers.detail.statusConfirmBody', {
            status: t(`status.customer.${reasonModal.value}`, { defaultValue: reasonModal.value }),
            defaultValue: `Đánh dấu tài khoản là "{{status}}". Trạng thái này dùng để quản lý nội bộ.`,
          })}
          confirmLabel={t('customers.detail.statusConfirmOk', { defaultValue: 'Đổi trạng thái' })}
          loading={saving}
          onConfirm={async (reason) => {
            const ok = await applyStatusChange(reasonModal.value, reason)
            if (ok) setReasonModal(null)
          }}
          onClose={() => setReasonModal(null)}
        />
      )}
    </Screen>
  )
}
