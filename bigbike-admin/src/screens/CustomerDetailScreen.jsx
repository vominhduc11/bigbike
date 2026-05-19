import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DetailSection } from '../components/DetailSection'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { StatusBadge } from '../components/StatusBadge'
import { fetchCustomerCredit, fetchCustomerDetail, sendCouponGift, updateCustomer, updateCustomerCredit, updateCustomerStatus } from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime, formatText } from '../lib/formatters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

const CUSTOMER_STATUSES = ['ACTIVE', 'DISABLED', 'BLOCKED']

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

const CREDIT_STATUS_LABELS = { ACTIVE: 'Hoạt động', SUSPENDED: 'Tạm khóa', BLOCKED: 'Chặn vĩnh viễn' }

const CREDIT_STATUS_CLASSES = {
  ACTIVE:    'text-success bg-success-bg',
  SUSPENDED: 'text-warning bg-warning-bg',
  BLOCKED:   'text-danger bg-danger-bg',
}

function CreditStatusBadge({ status }) {
  const cls = CREDIT_STATUS_CLASSES[status] ?? 'text-muted-foreground bg-surface-muted'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {CREDIT_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function CustomerDetailScreen({ customerId, navigate, canUpdate, hasPermission }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', customer: null, warning: '' })
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', phone: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Credit profile state
  const [credit, setCredit] = useState(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const [creditEditOpen, setCreditEditOpen] = useState(false)
  const [creditForm, setCreditForm] = useState({
    creditEnabled: false, creditLimit: '', paymentTermsDays: '', creditStatus: 'ACTIVE', creditNote: '',
  })
  const [creditSaving, setCreditSaving] = useState(false)
  const canReadReceivables = hasPermission ? hasPermission('receivables.read') : false
  const canEditCredit = hasPermission ? hasPermission('receivables.create') : false
  const canSendCoupon = hasPermission ? hasPermission('coupons.write') : false

  // Coupon gift state
  const EMPTY_COUPON_FORM = { discountType: 'FIXED', amount: '', minimumAmount: '', validDays: '', channel: 'ALL' }
  const [couponGiftOpen, setCouponGiftOpen] = useState(false)
  const [couponGiftForm, setCouponGiftForm] = useState(EMPTY_COUPON_FORM)
  const [couponGiftSaving, setCouponGiftSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetchCustomerDetail(customerId)
      .then((r) => { if (!active) return; setState({ status: 'success', customer: r.item, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', customer: null, warning: '', error: e.message }) })
    return () => { active = false }
  }, [customerId])

  useEffect(() => {
    if (!canReadReceivables) return
    let active = true
    queueMicrotask(() => { if (active) setCreditLoading(true) })
    fetchCustomerCredit(customerId)
      .then((r) => {
        if (!active) return
        setCredit(r)
        setCreditForm({
          creditEnabled: r.creditEnabled ?? false,
          creditLimit: r.creditLimit != null ? String(r.creditLimit) : '',
          paymentTermsDays: r.paymentTermsDays != null ? String(r.paymentTermsDays) : '',
          creditStatus: r.creditStatus ?? 'ACTIVE',
          creditNote: r.creditNote ?? '',
        })
      })
      .catch(() => { if (active) setCredit(null) })
      .finally(() => { if (active) setCreditLoading(false) })
    return () => { active = false }
  }, [customerId, canReadReceivables])

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

  async function handleCreditSave(e) {
    e.preventDefault()
    setCreditSaving(true)
    try {
      const payload = {
        creditEnabled: creditForm.creditEnabled,
        creditLimit: creditForm.creditLimit !== '' ? Number(creditForm.creditLimit) : null,
        paymentTermsDays: creditForm.paymentTermsDays !== '' ? Number(creditForm.paymentTermsDays) : null,
        creditStatus: creditForm.creditStatus,
        creditNote: creditForm.creditNote || null,
      }
      const updated = await updateCustomerCredit(customerId, payload)
      setCredit(updated)
      setCreditEditOpen(false)
      toast.success('Hồ sơ tín dụng đã được cập nhật.')
    } catch (err) {
      toast.error(err.message || t('common.error'))
    } finally {
      setCreditSaving(false)
    }
  }

  async function handleCouponGiftSend(e) {
    e.preventDefault()
    if (!couponGiftForm.amount || Number(couponGiftForm.amount) <= 0) {
      toast.error('Vui lòng nhập giá trị giảm giá hợp lệ.')
      return
    }
    setCouponGiftSaving(true)
    try {
      const payload = {
        discountType: couponGiftForm.discountType,
        amount: Number(couponGiftForm.amount),
        minimumAmount: couponGiftForm.minimumAmount !== '' ? Number(couponGiftForm.minimumAmount) : null,
        validDays: couponGiftForm.validDays !== '' ? Number(couponGiftForm.validDays) : null,
        usageLimit: 1,
        channel: couponGiftForm.channel,
      }
      const result = await sendCouponGift(customerId, payload)
      toast.success(`Đã tạo và gửi mã "${result.item?.code ?? ''}" cho khách hàng.`)
      setCouponGiftOpen(false)
      setCouponGiftForm(EMPTY_COUPON_FORM)
    } catch (err) {
      toast.error(err.message || 'Gửi mã thất bại.')
    } finally {
      setCouponGiftSaving(false)
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
        <Button variant="outline" onClick={() => navigate('/admin/customers')}>
          {t('customers.detail.backToList')}
        </Button>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div className="grid grid-cols-2 gap-6">
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
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  disabled={editSaving}
                 />
              </label>
              <div className="flex gap-2">
                <Button type="submit" disabled={editSaving}>
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
          <div className="grid grid-cols-2 gap-y-3 gap-x-6">
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

      {/* Credit profile section — full width below the grid */}
      {canReadReceivables && (
        <div className="mt-6">
          <DetailSection title="Hồ sơ tín dụng (Công nợ)">
            {creditLoading ? (
              <p className="text-muted-foreground text-sm">Đang tải...</p>
            ) : credit === null ? (
              <p className="text-muted-foreground text-sm">Không có dữ liệu tín dụng.</p>
            ) : !creditEditOpen ? (
              <>
                <div className="grid grid-cols-3 gap-y-4 gap-x-8 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Bán chịu</p>
                    <p className="font-bold">{credit.creditEnabled ? 'Được phép' : 'Không cho phép'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Trạng thái tín dụng</p>
                    <CreditStatusBadge status={credit.creditStatus} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Hạn mức tín dụng</p>
                    <p className="font-bold">{credit.creditLimit != null ? formatCurrencyVnd(credit.creditLimit) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Thời hạn thanh toán</p>
                    <p className="font-semibold">{credit.paymentTermsDays != null ? `${credit.paymentTermsDays} ngày` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Dư nợ hiện tại</p>
                    <p className={`font-bold${credit.currentOutstanding > 0 ? ' text-danger' : ''}`}>
                      {formatCurrencyVnd(credit.currentOutstanding ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Hạn mức còn lại</p>
                    <p className={`font-bold ${credit.availableCredit <= 0 ? 'text-danger' : 'text-success'}`}>
                      {credit.creditLimit != null ? formatCurrencyVnd(credit.availableCredit ?? 0) : '—'}
                    </p>
                  </div>
                </div>
                {credit.creditNote && (
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong>Ghi chú:</strong> {credit.creditNote}
                  </p>
                )}
                <div className="flex gap-3 items-center">
                  {canEditCredit && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreditForm({
                          creditEnabled: credit.creditEnabled ?? false,
                          creditLimit: credit.creditLimit != null ? String(credit.creditLimit) : '',
                          paymentTermsDays: credit.paymentTermsDays != null ? String(credit.paymentTermsDays) : '',
                          creditStatus: credit.creditStatus ?? 'ACTIVE',
                          creditNote: credit.creditNote ?? '',
                        })
                        setCreditEditOpen(true)
                      }}
                    >
                      Chỉnh sửa tín dụng
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/admin/receivables?customerId=${customerId}`)}
                  >
                    Xem công nợ →
                  </Button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreditSave} className="flex flex-col gap-3 max-w-[480px]">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={creditForm.creditEnabled}
                    onCheckedChange={(checked) => setCreditForm((p) => ({ ...p, creditEnabled: checked === true }))}
                    disabled={creditSaving}
                   />
                  Cho phép bán chịu
                </label>
                <label>
                  Trạng thái tín dụng
                  <Select
                    value={creditForm.creditStatus}
                    onValueChange={(val) => setCreditForm((p) => ({ ...p, creditStatus: val }))}
                    disabled={creditSaving}
                  ><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="ACTIVE">Hoạt động</SelectItem>
                    <SelectItem value="SUSPENDED">Tạm khóa</SelectItem>
                    <SelectItem value="BLOCKED">Chặn vĩnh viễn</SelectItem>
                  </SelectContent></Select>
                </label>
                <label>
                  Hạn mức tín dụng (VND)
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={creditForm.creditLimit}
                    onChange={(e) => setCreditForm((p) => ({ ...p, creditLimit: e.target.value }))}
                    placeholder="Không giới hạn nếu để trống"
                    disabled={creditSaving}
                   />
                </label>
                <label>
                  Thời hạn thanh toán (ngày)
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={creditForm.paymentTermsDays}
                    onChange={(e) => setCreditForm((p) => ({ ...p, paymentTermsDays: e.target.value }))}
                    placeholder="VD: 30"
                    disabled={creditSaving}
                   />
                </label>
                <label>
                  Ghi chú tín dụng
                  <Input
                    type="text"
                    value={creditForm.creditNote}
                    onChange={(e) => setCreditForm((p) => ({ ...p, creditNote: e.target.value }))}
                    disabled={creditSaving}
                   />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" disabled={creditSaving}>
                    {creditSaving ? 'Đang lưu...' : 'Lưu'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCreditEditOpen(false)} disabled={creditSaving}>
                    Hủy
                  </Button>
                </div>
              </form>
            )}
          </DetailSection>
        </div>
      )}

      {/* Coupon gift section — full width below credit */}
      {canSendCoupon && customer.email && (
        <div className="mt-6">
          <DetailSection title="Gửi mã giảm giá">
            {!couponGiftOpen ? (
              <div className="flex items-center gap-4">
                <Button onClick={() => { setCouponGiftForm(EMPTY_COUPON_FORM); setCouponGiftOpen(true) }}>
                  Tạo & gửi mã giảm giá
                </Button>
                <span className="text-sm text-muted-foreground">
                  Mã sẽ được gửi qua email đến <strong>{customer.email}</strong>
                </span>
              </div>
            ) : (
              <form onSubmit={handleCouponGiftSend} className="flex flex-col gap-3 max-w-[480px]">
                <label>
                  Loại giảm giá
                  <Select
                    value={couponGiftForm.discountType}
                    onValueChange={(val) => setCouponGiftForm((p) => ({ ...p, discountType: val }))}
                    disabled={couponGiftSaving}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Giảm tiền cố định (VND)</SelectItem>
                      <SelectItem value="PERCENT">Giảm theo % đơn hàng</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label>
                  {couponGiftForm.discountType === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VND)'}
                  <Input
                    type="number"
                    min="1"
                    max={couponGiftForm.discountType === 'PERCENT' ? '100' : undefined}
                    step={couponGiftForm.discountType === 'PERCENT' ? '1' : '1000'}
                    value={couponGiftForm.amount}
                    onChange={(e) => setCouponGiftForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder={couponGiftForm.discountType === 'PERCENT' ? 'VD: 10' : 'VD: 50000'}
                    disabled={couponGiftSaving}
                    required
                  />
                </label>

                <label>
                  Đơn hàng tối thiểu (VND) — để trống nếu không yêu cầu
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={couponGiftForm.minimumAmount}
                    onChange={(e) => setCouponGiftForm((p) => ({ ...p, minimumAmount: e.target.value }))}
                    placeholder="Không giới hạn"
                    disabled={couponGiftSaving}
                  />
                </label>

                <label>
                  Hiệu lực (số ngày) — để trống nếu không hết hạn
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={couponGiftForm.validDays}
                    onChange={(e) => setCouponGiftForm((p) => ({ ...p, validDays: e.target.value }))}
                    placeholder="VD: 30"
                    disabled={couponGiftSaving}
                  />
                </label>

                <label>
                  Kênh áp dụng
                  <Select
                    value={couponGiftForm.channel}
                    onValueChange={(val) => setCouponGiftForm((p) => ({ ...p, channel: val }))}
                    disabled={couponGiftSaving}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả kênh</SelectItem>
                      <SelectItem value="ONLINE">Chỉ online</SelectItem>
                      <SelectItem value="POS">Chỉ tại quầy (POS)</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <div className="flex gap-2 mt-1">
                  <Button type="submit" disabled={couponGiftSaving}>
                    {couponGiftSaving ? 'Đang gửi...' : 'Tạo & gửi mã'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCouponGiftOpen(false)} disabled={couponGiftSaving}>
                    Hủy
                  </Button>
                </div>
              </form>
            )}
          </DetailSection>
        </div>
      )}
    </section>
  )
}
