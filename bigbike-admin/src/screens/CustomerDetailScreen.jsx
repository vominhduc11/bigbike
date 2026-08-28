import { useCallback, useEffect, useRef, useState } from 'react'
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
import { readDraft, useDraftAutosave } from '../lib/useDraftAutosave'
import { recordRecentItem } from '@/lib/useRecentItems'
import { CustomerStatusReasonModal } from '../components/CustomerStatusReasonModal'
import { DetailSection } from '../components/DetailSection'
import { KpiCard } from '../components/KpiCard'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchCustomerDetail, mapValidationErrors, removeCustomerAvatar, updateCustomer, updateCustomerStatus } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormField, Screen, ScreenHeader, StickyActionBar } from '../components/layout'
import { useQueryClient } from '@tanstack/react-query'

const CUSTOMER_STATUSES = ['ACTIVE', 'PENDING', 'DISABLED', 'BLOCKED']

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
const PHONE_INPUT_PATTERN = /^\+?[0-9\s().-]+$/
const NORMALIZED_PHONE_PATTERN = /^[0-9]{8,15}$/

function normalizePhoneInput(phone) {
  const raw = (phone || '').trim()
  if (!raw) return ''

  let digits = raw.replace(/[^0-9]/g, '')
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`
  }
  return digits
}

function isPhoneInvalid(phone) {
  const raw = (phone || '').trim()
  if (!raw) return false
  if (!PHONE_INPUT_PATTERN.test(raw)) return true
  return !NORMALIZED_PHONE_PATTERN.test(normalizePhoneInput(raw))
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
  const [failedUrl, setFailedUrl] = useState('')
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'

  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="size-14 shrink-0 rounded-full object-cover"
        onError={() => setFailedUrl(avatarUrl)}
      />
    )
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
  return <KpiCard label={stripTrailingColon(label)} value={value} icon={Icon ? <Icon size={15} aria-hidden="true" /> : null} tone={tone} money={money} detail={hint} />
}

export function CustomerDetailScreen({ customerId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', customer: null, warning: '' })
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', phone: '' })
  const [editBaseline, setEditBaseline] = useState(null)
  const mutationLockRef = useRef(false)
  const [mutationAction, setMutationAction] = useState(null)
  // F1: lỗi validate backend gắn theo từng ô (vd SĐT trùng), tách khỏi toast.
  const [fieldErrors, setFieldErrors] = useState({})
  // Every non-ACTIVE target revokes all active sessions, so it requires an
  // explicit confirmation. The optional reason is stored in the audit log.
  const [reasonModal, setReasonModal] = useState(null)

  // F6: form sửa hồ sơ đang mở và nội dung khác baseline → còn thay đổi chưa lưu.
  const normalizedEditForm = {
    displayName: editForm.displayName,
    phone: normalizePhoneInput(editForm.phone),
  }
  const isDirty = editOpen && editBaseline != null &&
    JSON.stringify(normalizedEditForm) !== JSON.stringify(editBaseline)
  useUnsavedChanges(isDirty)

  const customerDraftKey = `draft:customer-detail:${customerId}`
  const { clear: clearCustomerDraft } = useDraftAutosave(
    customerDraftKey,
    { customerId, form: editForm },
    { enabled: Boolean(canUpdate && editOpen), dirty: isDirty },
  )

  const beginMutation = useCallback((action) => {
    if (mutationLockRef.current) return false
    mutationLockRef.current = true
    setMutationAction(action)
    return true
  }, [])

  const endMutation = useCallback(() => {
    mutationLockRef.current = false
    setMutationAction(null)
  }, [])

  const mutationBusy = mutationAction != null
  const statusSaving = mutationAction === 'status'
  const avatarSaving = mutationAction === 'avatar'
  const editSaving = mutationAction === 'profile'

  // N2: tách hàm tải để nút "Thử lại" gọi lại được khi lỗi mạng/API.
  // active flag: chỉ áp kết quả khi component còn mount / lần tải còn hiệu lực.
  const fetchInto = useCallback((isActive) => {
    fetchCustomerDetail(customerId)
      .then((r) => { if (isActive()) setState({ status: 'success', customer: r.item, warning: '' }) })
      .catch((e) => {
        if (!isActive()) return
        if (e?.status === 404) {
          setState({ status: 'success', customer: null, warning: '' })
          return
        }
        setState({
          status: 'error',
          customer: null,
          warning: '',
          error: e?.message || '',
        })
      })
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
    if (mutationLockRef.current || !value || value === state.customer?.status) return
    if (value !== 'ACTIVE') {
      setReasonModal({ value })
      return
    }
    await applyStatusChange(value)
  }

  async function applyStatusChange(value, reason) {
    if (!beginMutation('status')) return false
    // N7: transition không phá huỷ (vd chuyển sang ACTIVE) — cập nhật lạc quan ngay
    // trên UI, rollback về giá trị cũ nếu API lỗi (theo pattern optimistic đã có ở
    // ReviewListScreen.handleStatusChange).
    const previousStatus = state.customer?.status
    const isOptimistic = value === 'ACTIVE'
    if (isOptimistic) {
      setState((p) => ({ ...p, customer: { ...p.customer, status: value } }))
    }
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
      endMutation()
    }
  }

  async function handleRemoveAvatar() {
    if (mutationLockRef.current) return
    const ok = await showConfirm(
      t('customers.detail.avatarRemoveConfirmBody', {
        defaultValue: 'Xoá ảnh đại diện của khách hàng này? Khách sẽ cần tự tải ảnh mới nếu muốn.',
      }),
      t('customers.detail.avatarRemoveConfirmTitle', { defaultValue: 'Xoá ảnh đại diện' }),
      { variant: 'danger', confirmLabel: t('customers.detail.avatarRemoveConfirmOk', { defaultValue: 'Xoá ảnh' }) },
    )
    if (!ok) return
    if (!beginMutation('avatar')) return
    try {
      const r = await removeCustomerAvatar(customerId)
      setState((p) => ({ ...p, customer: r.item }))
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer-summary'] })
      toast.success(t('customers.detail.avatarRemoved', { defaultValue: 'Đã xoá ảnh đại diện.' }))
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      endMutation()
    }
  }

  function handleEditOpen(customer) {
    if (mutationLockRef.current) return
    const initial = {
      displayName: customer.displayName || '',
      phone: customer.phone || '',
    }
    const saved = readDraft(customerDraftKey)
    const savedForm = saved?.value?.customerId != null
      && String(saved.value.customerId) === String(customerId)
      ? saved.value.form
      : null
    setEditForm(savedForm ? { ...initial, ...savedForm } : initial)
    setEditBaseline({
      displayName: initial.displayName,
      phone: normalizePhoneInput(initial.phone),
    })
    setFieldErrors({})
    setEditOpen(true)
    if (savedForm) toast.info(t('customers.detail.draftRestored', { defaultValue: 'Đã khôi phục bản nháp thông tin khách hàng.' }))
  }

  function handleEditCancel() {
    clearCustomerDraft()
    setEditOpen(false)
    setEditBaseline(null)
    setFieldErrors({})
  }

  const handleEditSave = useCallback(async (e) => {
    e.preventDefault()
    if (!isDirty || mutationLockRef.current) return
    if (isPhoneInvalid(editForm.phone)) {
      toast.error(t('customers.detail.phoneInvalidToast', { defaultValue: 'Số điện thoại không hợp lệ.' }))
      return
    }
    if (!beginMutation('profile')) return
    setFieldErrors({})
    try {
      const payload = {}
      if (editForm.displayName !== editBaseline.displayName) {
        payload.displayName = editForm.displayName
      }
      if (normalizedEditForm.phone !== editBaseline.phone) {
        payload.phone = normalizedEditForm.phone
      }
      const r = await updateCustomer(customerId, payload)
      setState((p) => ({ ...p, customer: r.item }))
      clearCustomerDraft()
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
      endMutation()
    }
  }, [
    beginMutation,
    customerId,
    editBaseline,
    editForm.displayName,
    editForm.phone,
    endMutation,
    isDirty,
    clearCustomerDraft,
    normalizedEditForm.phone,
    queryClient,
    t,
  ])

  // O3: Ctrl/Cmd+S lưu form sửa hồ sơ khi đang mở.
  useSaveShortcut(editOpen && !mutationBusy, handleEditSave)

  if (state.status === 'loading') return <Screen><StatePanel tone="info" title={t('customers.detail.loading')} description={t('common.pleaseWait')} /></Screen>
  if (state.status === 'error') return <Screen><StatePanel tone="danger" title={t('customers.detail.error')} description={state.error || t('common.error')} actionLabel={t('common.retry', { defaultValue: 'Thử lại' })} onAction={handleRetry} /></Screen>
  if (!state.customer) return (
    <Screen>
      <StatePanel
        tone="neutral"
        title={t('customers.detail.notFound')}
        description={t('customers.detail.notFoundDesc')}
        actionLabel={t('common.back')}
        onAction={() => navigate('/admin/customers')}
      />
    </Screen>
  )

  const { customer } = state

  const phoneError = isPhoneInvalid(editForm.phone)
  const editAction = !editOpen ? (
    <Button
      type="button"
      variant="secondary"
      className="min-h-11"
      onClick={() => handleEditOpen(customer)}
      disabled={!canUpdate || mutationBusy}
      aria-disabled={!canUpdate || mutationBusy}
    >
      <Edit3 size={16} aria-hidden="true" />
      {t('common.edit')}
    </Button>
  ) : null

  return (
    <Screen>
      <ScreenHeader
        group="sales"
        title={(
          <span className="flex min-w-0 items-center gap-3">
            <CustomerAvatar avatarUrl={customer.avatarUrl} name={customer.fullName || customer.email} />
            <span className="min-w-0 truncate">{formatText(customer.fullName, customer.email)}</span>
          </span>
        )}
        description={customer.fullName ? formatText(customer.email) : undefined}
        badge={<StatusBadge type="customer" status={customer.status} />}
        actions={(
          <div className="flex flex-wrap justify-end gap-2">
          {customer.avatarUrl && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={handleRemoveAvatar}
              loading={avatarSaving}
              disabled={!canUpdate || mutationBusy}
            >
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
              {customer.firstName ? (
                <DetailRow label={t('customers.detail.fieldFirstName')} icon={UserRound}>
                  {formatText(customer.firstName)}
                </DetailRow>
              ) : null}
              {customer.lastName ? (
                <DetailRow label={t('customers.detail.fieldLastName')} icon={UserRound}>
                  {formatText(customer.lastName)}
                </DetailRow>
              ) : null}
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
              {/* Unknown status, synthetic records, or view-only permission use a
                  read-only explanation instead of an empty Select. */}
              {(canUpdate && !customer.isSynthetic && CUSTOMER_STATUSES.includes(customer.status)) ? (
                <Select
                  value={customer.status}
                  onValueChange={handleStatusChange}
                  disabled={mutationBusy}
                >
                  <SelectTrigger className="min-h-11" aria-label={t('customers.detail.accountStatus')}>
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
                  {customer.isSynthetic
                    ? t('customers.detail.syntheticStatusReadOnly')
                    : t('customers.detail.statusReadOnly')}
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
                    maxLength={255}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, displayName: e.target.value }))
                      if (fieldErrors.displayName) setFieldErrors((p) => ({ ...p, displayName: undefined }))
                    }}
                    disabled={mutationBusy}
                  />
                </FormField>
                <FormField
                  label={t('customers.detail.fieldPhone', { defaultValue: 'Số điện thoại' })}
                  error={phoneError
                    ? t('customers.detail.phoneFormatHint', { defaultValue: 'Số điện thoại sau chuẩn hoá phải gồm 8–15 chữ số; có thể nhập dấu +, khoảng trắng, dấu chấm, gạch ngang hoặc ngoặc.' })
                    : fieldErrors.phone}
                  helper={t('customers.detail.phoneEmptyHint', { defaultValue: 'Để trống nếu chưa có.' })}
                >
                  <Input
                    type="text"
                    inputMode="tel"
                    maxLength={50}
                    value={editForm.phone}
                    onChange={(e) => {
                      setEditForm((p) => ({ ...p, phone: e.target.value }))
                      if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }))
                    }}
                    disabled={mutationBusy}
                  />
                </FormField>
                <StickyActionBar ariaLabel={t('common.actions')}>
                  <Button type="button" variant="outline" className="min-h-11" onClick={handleEditCancel} disabled={mutationBusy}>
                    <X size={16} aria-hidden="true" />
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    className="min-h-11"
                    loading={editSaving}
                    disabled={mutationBusy || phoneError || !isDirty}
                  >
                    <Save size={16} aria-hidden="true" />
                    {t('common.save')}
                  </Button>
                </StickyActionBar>
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
          })}
          confirmLabel={t('customers.detail.statusConfirmOk', { defaultValue: 'Đổi trạng thái' })}
          confirmVariant={reasonModal.value === 'BLOCKED' || reasonModal.value === 'DISABLED' ? 'danger' : 'default'}
          loading={statusSaving}
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
