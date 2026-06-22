import { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { DropdownPopover } from '../../components/DropdownPopover'
import { formatCurrencyVnd } from '../../lib/formatters'
import { fetchCustomers, fetchCustomerCredit, posCreateOrder } from '../../lib/adminApi'
import { Modal, FormField } from '../../components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { generateId } from '@/lib/utils'
import { PAYMENT_METHODS } from './constants'

export function PaymentModal({ cart, total, onClose, onSuccess, canOverrideCreditLimit }) {
  const { t } = useTranslation()
  const [method, setMethod] = useState('CASH')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [tendered, setTendered] = useState('')
  const [cardRef, setCardRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [idempotencyKey] = useState(() =>
    generateId()
  )

  // Walk-in customer link (CASH / CARD_TERMINAL)
  const [walkInQuery, setWalkInQuery] = useState('')
  const [walkInResults, setWalkInResults] = useState([])
  const [walkInCustomer, setWalkInCustomer] = useState(null)
  const [walkInSearching, setWalkInSearching] = useState(false)
  // Gợi ý khách quen theo số điện thoại đang gõ
  const [phoneMatches, setPhoneMatches] = useState([])

  // CREDIT state
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerCredit, setCustomerCredit] = useState(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const tenderedNum = tendered === '' ? 0 : Number(String(tendered).replace(/\D/g, ''))
  const change = method === 'CASH' && tenderedNum > 0 ? tenderedNum - total : null
  const insufficientTendered = method === 'CASH' && tendered !== '' && tenderedNum < total

  // Credit eligibility checks
  const creditEnabled = customerCredit?.creditEnabled === true
  const creditActive = customerCredit?.creditStatus === 'ACTIVE'
  const availableCredit = customerCredit?.availableCredit ?? null
  const overLimit = method === 'CREDIT' && availableCredit !== null && total > availableCredit
  const creditBlocked = method === 'CREDIT' && selectedCustomer && customerCredit && (!creditEnabled || !creditActive)
  const creditOverLimitBlocked = overLimit && !canOverrideCreditLimit
  // SĐT bắt buộc cho mọi đơn POS (POS_CUSTOMER_001) — là khóa nhận diện/tạo hồ sơ khách
  const phoneMissing = !customerPhone.trim()
  const submitDisabled = submitting || insufficientTendered || creditBlocked || creditOverLimitBlocked
      || phoneMissing
      || (method === 'CREDIT' && !selectedCustomer)

  function handleMethodChange(m) {
    setMethod(m)
    if (m !== 'CREDIT') {
      setSelectedCustomer(null)
      setCustomerCredit(null)
      setCustomerResults([])
      setCustomerQuery('')
    } else {
      setWalkInCustomer(null)
      setWalkInQuery('')
      setWalkInResults([])
    }
  }

  async function searchCustomers(q) {
    if (!q || q.length < 2) { setCustomerResults([]); setCustomerSearching(false); return }
    setCustomerSearching(true)
    try {
      const res = await fetchCustomers({ search: q, page: 1, pageSize: 10 })
      setCustomerResults(res.items || [])
    } catch { setCustomerResults([]) }
    finally { setCustomerSearching(false) }
  }

  async function searchWalkIn(q) {
    if (!q || q.length < 2) { setWalkInResults([]); setWalkInSearching(false); return }
    setWalkInSearching(true)
    try {
      const res = await fetchCustomers({ search: q, page: 1, pageSize: 5 })
      setWalkInResults(res.items || [])
    } catch { setWalkInResults([]) }
    finally { setWalkInSearching(false) }
  }

  // Tự gợi ý khách quen khi gõ SĐT (POS_CUSTOMER_002) — chỉ khi chưa liên kết khách nào
  async function searchByPhone(raw) {
    const digits = String(raw).replace(/\D/g, '')
    if (digits.length < 8 || walkInCustomer || method === 'CREDIT') { setPhoneMatches([]); return }
    try {
      const res = await fetchCustomers({ search: digits, page: 1, pageSize: 5 })
      setPhoneMatches(res.items || [])
    } catch { setPhoneMatches([]) }
  }

  function handleSelectWalkIn(c) {
    setWalkInCustomer(c)
    setWalkInQuery('')
    setWalkInResults([])
    setPhoneMatches([])
    if (!customerName) setCustomerName(c.displayName || '')
    if (!customerPhone && c.phone) setCustomerPhone(c.phone)
  }

  async function loadCustomerCredit(customerId) {
    setCreditLoading(true)
    try {
      const credit = await fetchCustomerCredit(customerId)
      setCustomerCredit(credit)
    } catch (e) {
      setCustomerCredit(null)
      toast.error(e.message || t('common.error'))
    }
    finally { setCreditLoading(false) }
  }

  function handleSelectCustomer(c) {
    setSelectedCustomer(c)
    setCustomerResults([])
    setCustomerQuery(c.displayName || c.email || '')
    if (!customerName) setCustomerName(c.displayName || '')
    if (c.phone) setCustomerPhone(c.phone)
    loadCustomerCredit(c.id)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitDisabled) return
    setError('')
    setSubmitting(true)
    try {
      const basePayload = {
        paymentMethod: method,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        staffNote: staffNote.trim() || undefined,
        posIdempotencyKey: idempotencyKey,
        ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
        ...(walkInCustomer ? { customerId: walkInCustomer.id } : {}),
        items: cart.map((item) => ({
          productId: item.productId,
          productVariantId: item.variantId,
          quantity: item.qty,
          ...(item.overriddenPrice != null ? { unitPriceOverride: item.overriddenPrice } : {}),
        })),
      }
      let payload
      if (method === 'CASH') {
        payload = { ...basePayload, tenderedAmount: tenderedNum > 0 ? tenderedNum : undefined }
      } else if (method === 'CARD_TERMINAL') {
        payload = { ...basePayload, cardReferenceNumber: cardRef.trim() || undefined }
      } else if (method === 'CREDIT') {
        payload = {
          ...basePayload,
          customerId: selectedCustomer.id,
        }
      } else {
        payload = basePayload
      }
      const result = await posCreateOrder(payload)
      toast.success(
        `${t('pos.orderCreated', { defaultValue: 'Đã tạo đơn' })} ${result?.orderNumber || ''}`.trim(),
      )
      onSuccess({ ...result, _cardRef: method === 'CARD_TERMINAL' ? cardRef.trim() : null }, method)
    } catch (err) {
      setError(err.message || t('pos.orderCreateError', { defaultValue: 'Lỗi khi tạo đơn hàng.' }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={t('pos.paymentMethod')} onClose={onClose}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <FormField
              label={t('pos.customerNameLabel', { defaultValue: 'Tên khách (tuỳ chọn)' })}
              htmlFor="pos-customer-name"
            >
              <Input
                id="pos-customer-name"
                placeholder="Nguyễn Văn A"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
               />
            </FormField>
            <div>
              <FormField
                label={t('pos.customerPhoneLabel', { defaultValue: 'Số điện thoại' })}
                htmlFor="pos-customer-phone"
                required
                error={phoneMissing ? t('pos.customerPhoneRequired', { defaultValue: 'Cần số điện thoại để lưu hồ sơ khách.' }) : undefined}
              >
                <Input
                  id="pos-customer-phone"
                  placeholder="0901 234 567"
                  value={customerPhone}
                  onChange={(e) => { setCustomerPhone(e.target.value); searchByPhone(e.target.value) }}
                 />
              </FormField>
              {method !== 'CREDIT' && !walkInCustomer && phoneMatches.length > 0 && (
                <div className="mt-1 border border-border rounded-md bg-surface overflow-hidden">
                  <p className="px-2.5 py-1 text-xs text-muted-foreground">SĐT này là khách quen — bấm để liên kết:</p>
                  {phoneMatches.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="block w-full text-left px-2.5 py-1.5 bg-transparent border-none cursor-pointer text-sm hover:bg-surface-hover"
                      onClick={() => handleSelectWalkIn(c)}
                    >
                      <strong>{c.displayName || c.phone || c.email}</strong>
                      {c.phone && <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {method !== 'CREDIT' && (
            <div className="mb-3">
              <label className="field-label" htmlFor="pos-walkin-search">{t('pos.walkInLinkLabel', { defaultValue: 'Liên kết khách hàng cũ (tuỳ chọn)' })}</label>
              {!walkInCustomer ? (
                <DropdownPopover
                  open={walkInResults.length > 0 || (walkInSearching && walkInQuery.trim().length >= 2)}
                  onOpenChange={(next) => { if (!next) setWalkInResults([]) }}
                  anchor={
                    <Input
                      id="pos-walkin-search"
                      placeholder="Tìm theo tên, SĐT hoặc email..."
                      value={walkInQuery}
                      onChange={(e) => { setWalkInQuery(e.target.value); searchWalkIn(e.target.value) }}
                      autoComplete="off"
                    />
                  }
                >
                  {walkInSearching && walkInResults.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">{t('pos.searching', { defaultValue: 'Đang tìm…' })}</p>
                  ) : walkInResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="block w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer text-sm hover:bg-surface-hover"
                      onClick={() => handleSelectWalkIn(c)}
                    >
                      <strong>{c.displayName || c.email}</strong>
                      {c.email && c.displayName && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                    </button>
                  ))}
                </DropdownPopover>
              ) : (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface border border-border rounded-md">
                  <span className="flex-1 text-sm">Đã liên kết: <strong>{walkInCustomer.displayName || walkInCustomer.email}</strong></span>
                  <button type="button" onClick={() => { setWalkInCustomer(null); setWalkInQuery('') }} className="bg-transparent border-none cursor-pointer p-0.5 flex">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pos-method-grid">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={`pos-method-btn${method === m ? ' active' : ''}`}
                onClick={() => handleMethodChange(m)}
              >
                {t(`pos.method.${m}`, { defaultValue: m })}
              </button>
            ))}
          </div>

          {method === 'CASH' && (
            <div className="mt-3">
              <FormField
                label={t('pos.tenderedLabel', { defaultValue: 'Tiền khách đưa (tuỳ chọn)' })}
                htmlFor="pos-tendered"
                error={insufficientTendered ? t('pos.tenderedInsufficient', { defaultValue: 'Tiền đưa chưa đủ tổng thanh toán.' }) : undefined}
              >
                <Input
                  id="pos-tendered"
                  type="number"
                  min={0}
                  placeholder="Nhập số tiền khách đưa..."
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                 />
              </FormField>
              {change !== null && change >= 0 && (
                <p className="mt-1 text-sm text-success">
                  Tiền thừa trả lại: <strong>{formatCurrencyVnd(change)}</strong>
                </p>
              )}
              {method === 'CASH' && (tendered === '' || tenderedNum === 0) && !insufficientTendered && (
                <Alert className="mt-2 py-1.5 text-xs" role="note">
                  Chưa nhập tiền khách đưa — không thể tính tiền thừa.
                </Alert>
              )}
            </div>
          )}

          {method === 'CARD_TERMINAL' && (
            <div className="mt-3">
              <FormField
                label={t('pos.cardRefLabel', { defaultValue: 'Mã giao dịch thẻ (tuỳ chọn)' })}
                htmlFor="pos-card-ref"
              >
                <Input
                  id="pos-card-ref"
                  placeholder="REF-12345"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                 />
              </FormField>
            </div>
          )}

          {method === 'CREDIT' && (
            <div className="mt-3">
              <label className="field-label" htmlFor="pos-credit-search">{t('pos.creditSearchLabel', { defaultValue: 'Tìm khách hàng' })} *</label>
              <DropdownPopover
                open={customerResults.length > 0 || (customerSearching && customerQuery.trim().length >= 2)}
                onOpenChange={(next) => { if (!next) setCustomerResults([]) }}
                anchor={
                  <Input
                    id="pos-credit-search"
                    placeholder="Nhập tên, SĐT hoặc email khách hàng..."
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value)
                      setSelectedCustomer(null)
                      setCustomerCredit(null)
                      searchCustomers(e.target.value)
                    }}
                    autoComplete="off"
                  />
                }
              >
                {customerSearching && customerResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t('pos.searching', { defaultValue: 'Đang tìm…' })}</p>
                ) : customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="block w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer text-sm hover:bg-surface-hover"
                    onClick={() => handleSelectCustomer(c)}
                  >
                    <strong>{c.displayName || c.email}</strong>
                    {c.email && c.displayName && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                  </button>
                ))}
              </DropdownPopover>

              {creditLoading && <p className="text-sm text-muted-foreground mt-1.5">Đang tải thông tin tín dụng...</p>}

              {selectedCustomer && customerCredit && !creditLoading && (
                <div className="mt-2.5 px-3 py-2.5 bg-surface border border-border rounded-md text-sm">
                  <div className="flex justify-between mb-1">
                    <span>Bán chịu:</span>
                    <strong className={creditEnabled ? 'text-success' : 'text-danger'}>
                      {creditEnabled ? 'Được phép' : 'Bị tắt'}
                    </strong>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Trạng thái:</span>
                    <strong>{customerCredit.creditStatus}</strong>
                  </div>
                  {customerCredit.creditLimit != null && (
                    <>
                      <div className="flex justify-between mb-1">
                        <span>Hạn mức:</span>
                        <span>{formatCurrencyVnd(customerCredit.creditLimit)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Đang nợ:</span>
                        <span>{formatCurrencyVnd(customerCredit.currentOutstanding)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Còn có thể bán chịu:</span>
                        <strong className={availableCredit >= total ? 'text-success' : 'text-warning'}>
                          {formatCurrencyVnd(availableCredit)}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              )}

              {creditBlocked && (
                <p className="field-error mt-1.5 flex items-center gap-1" role="alert">
                  <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
                  <span>
                    Khách hàng không đủ điều kiện bán chịu
                    {!creditEnabled ? ' (chưa được bật tín dụng)' : ` (trạng thái: ${customerCredit?.creditStatus})`}.
                  </span>
                </p>
              )}

              {overLimit && canOverrideCreditLimit && (
                <p className="mt-1.5 text-sm text-warning">
                  Vượt hạn mức tín dụng — sẽ override (bạn có quyền).
                </p>
              )}

              {creditOverLimitBlocked && (
                <p className="field-error mt-1.5 flex items-center gap-1" role="alert">
                  <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
                  <span>
                    Vượt hạn mức tín dụng ({formatCurrencyVnd(total)} &gt; còn lại {formatCurrencyVnd(availableCredit)}). Bạn không có quyền override.
                  </span>
                </p>
              )}

            </div>
          )}

          <div className="mt-3">
            <FormField
              label={t('pos.couponLabel', { defaultValue: 'Mã giảm giá (tuỳ chọn)' })}
              htmlFor="pos-coupon"
            >
              <Input
                id="pos-coupon"
                placeholder="Nhập mã giảm giá POS..."
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                autoComplete="off"
               />
            </FormField>
          </div>

          <div className="mt-3">
            <FormField label={t('pos.note')} htmlFor="pos-note">
              <Input
                id="pos-note"
                placeholder={t('pos.notePlaceholder')}
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
               />
            </FormField>
          </div>

          <div className="pos-pay-total">
            <span>{t('pos.total')}</span>
            <strong>{formatCurrencyVnd(total)}</strong>
          </div>

          {error && (
            <p className="field-error mb-2 flex items-center gap-1" role="alert">
              <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
              <span>{error}</span>
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            disabled={submitDisabled}
          >
            {t('pos.confirmPayment')}
          </Button>
        </form>
    </Modal>
  )
}
