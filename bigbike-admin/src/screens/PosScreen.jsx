import { useEffect, useState } from 'react'
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { formatCurrencyVnd } from '../lib/formatters'
import { fetchCustomers, fetchCustomerCredit, posCreateOrder, posSearchProducts } from '../lib/adminApi'
import { useDebounce } from '../lib/useDebounce'

const PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL', 'CREDIT']

function priceOf(priceObj) {
  if (priceObj == null) return 0
  if (typeof priceObj === 'number') return priceObj
  return Number(priceObj.salePrice ?? priceObj.retailPrice ?? 0)
}

function summarizeOptions(options) {
  if (!Array.isArray(options) || options.length === 0) return ''
  return options.map((o) => o.value ?? o.name ?? '').filter(Boolean).join(' / ')
}

function PaymentModal({ cart, total, onClose, onSuccess, canOverrideCreditLimit }) {
  const { t } = useTranslation()
  const [method, setMethod] = useState('CASH')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [tendered, setTendered] = useState('')
  const [cardRef, setCardRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  )

  // CREDIT state
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerCredit, setCustomerCredit] = useState(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const [downPayment, setDownPayment] = useState('')

  const tenderedNum = tendered === '' ? 0 : Number(String(tendered).replace(/\D/g, ''))
  const change = method === 'CASH' && tenderedNum > 0 ? tenderedNum - total : null
  const insufficientTendered = method === 'CASH' && tendered !== '' && tenderedNum < total

  const downPaymentNum = downPayment === '' ? 0 : Number(downPayment)
  const downPaymentInvalid = method === 'CREDIT' && downPayment !== '' && (downPaymentNum < 0 || downPaymentNum > total)

  // Credit eligibility checks
  const creditEnabled = customerCredit?.creditEnabled === true
  const creditActive = customerCredit?.creditStatus === 'ACTIVE'
  const availableCredit = customerCredit?.availableCredit ?? null
  const overLimit = method === 'CREDIT' && availableCredit !== null && total > availableCredit
  const creditBlocked = method === 'CREDIT' && selectedCustomer && customerCredit && (!creditEnabled || !creditActive)
  const creditOverLimitBlocked = overLimit && !canOverrideCreditLimit
  const submitDisabled = submitting || insufficientTendered || downPaymentInvalid || creditBlocked || creditOverLimitBlocked
      || (method === 'CREDIT' && !selectedCustomer)

  function handleMethodChange(m) {
    setMethod(m)
    if (m !== 'CREDIT') {
      setSelectedCustomer(null)
      setCustomerCredit(null)
      setDownPayment('')
      setCustomerResults([])
      setCustomerQuery('')
    }
  }

  async function searchCustomers(q) {
    if (!q || q.length < 2) { setCustomerResults([]); return }
    try {
      const res = await fetchCustomers({ search: q, page: 1, pageSize: 10 })
      setCustomerResults(res.items || [])
    } catch { setCustomerResults([]) }
  }

  async function loadCustomerCredit(customerId) {
    setCreditLoading(true)
    try {
      const credit = await fetchCustomerCredit(customerId)
      setCustomerCredit(credit)
    } catch { setCustomerCredit(null) }
    finally { setCreditLoading(false) }
  }

  function handleSelectCustomer(c) {
    setSelectedCustomer(c)
    setCustomerResults([])
    setCustomerQuery(c.displayName || c.email || '')
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
        items: cart.map((item) => ({
          productId: item.productId,
          productVariantId: item.variantId,
          quantity: item.qty,
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
          ...(downPaymentNum > 0 ? { downPayment: downPaymentNum } : {}),
        }
      } else {
        payload = basePayload
      }
      const result = await posCreateOrder(payload)
      onSuccess(result, method)
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo đơn hàng.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pos-modal-close btn btn-secondary btn-icon" onClick={onClose}>
          <X size={16} />
        </button>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>{t('pos.paymentMethod')}</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <label className="field-label">Tên khách (tuỳ chọn)</label>
              <input
                className="control-input"
                style={{ width: '100%' }}
                placeholder="Nguyễn Văn A"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Số điện thoại (tuỳ chọn)</label>
              <input
                className="control-input"
                style={{ width: '100%' }}
                placeholder="0901 234 567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

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
            <div style={{ marginTop: 12 }}>
              <label className="field-label">Tiền khách đưa (tuỳ chọn)</label>
              <input
                className="control-input"
                style={{ width: '100%' }}
                type="number"
                min={0}
                placeholder="Nhập số tiền khách đưa..."
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
              />
              {change !== null && change >= 0 && (
                <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--admin-color-success, #22c55e)' }}>
                  Tiền thừa trả lại: <strong>{formatCurrencyVnd(change)}</strong>
                </p>
              )}
              {insufficientTendered && (
                <p className="field-error" style={{ marginTop: 4 }}>Tiền đưa chưa đủ tổng thanh toán.</p>
              )}
            </div>
          )}

          {method === 'CARD_TERMINAL' && (
            <div style={{ marginTop: 12 }}>
              <label className="field-label">Mã giao dịch thẻ (tuỳ chọn)</label>
              <input
                className="control-input"
                style={{ width: '100%' }}
                placeholder="REF-12345"
                value={cardRef}
                onChange={(e) => setCardRef(e.target.value)}
              />
            </div>
          )}

          {method === 'CREDIT' && (
            <div style={{ marginTop: 12 }}>
              <label className="field-label">Tìm khách hàng *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="control-input"
                  style={{ width: '100%' }}
                  placeholder="Nhập tên hoặc email khách hàng..."
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value)
                    setSelectedCustomer(null)
                    setCustomerCredit(null)
                    searchCustomers(e.target.value)
                  }}
                  autoComplete="off"
                />
                {customerResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--admin-color-surface-raised)',
                    border: '1px solid var(--admin-color-border-subtle)',
                    borderRadius: 'var(--admin-radius-md)',
                    boxShadow: 'var(--admin-shadow-md)',
                    maxHeight: 200, overflowY: 'auto',
                  }}>
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 12px', background: 'none', border: 'none',
                          cursor: 'pointer', fontSize: '0.875rem',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--admin-color-surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        onClick={() => handleSelectCustomer(c)}
                      >
                        <strong>{c.displayName || c.email}</strong>
                        {c.email && c.displayName && <span style={{ color: 'var(--admin-color-text-muted)', marginLeft: 8, fontSize: '0.75rem' }}>{c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {creditLoading && <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)', marginTop: 6 }}>Đang tải thông tin tín dụng...</p>}

              {selectedCustomer && customerCredit && !creditLoading && (
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: 'var(--admin-color-surface-base)',
                  border: '1px solid var(--admin-color-border-subtle)',
                  borderRadius: 'var(--admin-radius-md)',
                  fontSize: '0.85rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Bán chịu:</span>
                    <strong style={{ color: creditEnabled ? 'var(--admin-color-success, #22c55e)' : 'var(--admin-color-danger, #ef4444)' }}>
                      {creditEnabled ? 'Được phép' : 'Bị tắt'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Trạng thái:</span>
                    <strong>{customerCredit.creditStatus}</strong>
                  </div>
                  {customerCredit.creditLimit != null && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Hạn mức:</span>
                        <span>{formatCurrencyVnd(customerCredit.creditLimit)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Đang nợ:</span>
                        <span>{formatCurrencyVnd(customerCredit.currentOutstanding)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Còn có thể bán chịu:</span>
                        <strong style={{ color: availableCredit >= total ? 'var(--admin-color-success, #22c55e)' : 'var(--admin-color-warning, #f59e0b)' }}>
                          {formatCurrencyVnd(availableCredit)}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              )}

              {creditBlocked && (
                <p className="field-error" style={{ marginTop: 6 }}>
                  Khách hàng không đủ điều kiện bán chịu
                  {!creditEnabled ? ' (chưa được bật tín dụng)' : ` (trạng thái: ${customerCredit?.creditStatus})`}.
                </p>
              )}

              {overLimit && canOverrideCreditLimit && (
                <p style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--admin-color-warning, #f59e0b)' }}>
                  Vượt hạn mức tín dụng — sẽ override (bạn có quyền).
                </p>
              )}

              {creditOverLimitBlocked && (
                <p className="field-error" style={{ marginTop: 6 }}>
                  Vượt hạn mức tín dụng ({formatCurrencyVnd(total)} &gt; còn lại {formatCurrencyVnd(availableCredit)}). Bạn không có quyền override.
                </p>
              )}

              {selectedCustomer && !creditBlocked && (
                <div style={{ marginTop: 10 }}>
                  <label className="field-label">Thanh toán trước (tùy chọn)</label>
                  <input
                    className="control-input"
                    style={{ width: '100%' }}
                    type="number"
                    min={0}
                    max={total}
                    placeholder="0 = ghi nợ toàn bộ"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                  />
                  {downPaymentInvalid && (
                    <p className="field-error" style={{ marginTop: 4 }}>Thanh toán trước phải từ 0 đến {formatCurrencyVnd(total)}.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <label className="field-label">{t('pos.note')}</label>
            <input
              className="control-input"
              style={{ width: '100%' }}
              placeholder={t('pos.notePlaceholder')}
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
            />
          </div>

          <div className="pos-pay-total">
            <span>{t('pos.total')}</span>
            <strong>{formatCurrencyVnd(total)}</strong>
          </div>

          {error && <p className="field-error" style={{ marginBottom: 8 }}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={submitDisabled}
          >
            {submitting ? t('common.saving') : t('pos.confirmPayment')}
          </button>
        </form>
      </div>
    </div>
  )
}

function ReceiptModal({ order, paymentMethod, onClose }) {
  const { t } = useTranslation()
  const isCreditOrder = paymentMethod === 'CREDIT' || order?.paymentMethod === 'CREDIT'
  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pos-modal-close btn btn-secondary btn-icon" onClick={onClose}>
          <X size={16} />
        </button>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--admin-color-success,#22c55e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
          </svg>
          <h3 style={{ marginTop: 8 }}>{t('pos.success')}</h3>
          <p style={{ color: 'var(--admin-color-text-muted)', fontSize: '0.85rem' }}>
            {t('pos.orderNumber')}: <strong>{order?.orderNumber || '—'}</strong>
          </p>
          {isCreditOrder && (
            <p style={{ fontSize: '0.85rem', marginTop: 4, color: 'var(--admin-color-warning, #f59e0b)' }}>
              Công nợ: <strong>{order?.paymentStatus || 'UNPAID'}</strong>
            </p>
          )}
          {!isCreditOrder && order?.changeAmount != null && order.changeAmount > 0 && (
            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Tiền thừa: <strong style={{ color: 'var(--admin-color-success, #22c55e)' }}>{formatCurrencyVnd(order.changeAmount)}</strong>
            </p>
          )}
        </div>
        <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
          {t('pos.newSale')}
        </button>
      </div>
    </div>
  )
}

const POS_CART_KEY = 'pos_cart'
const POS_CART_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

export function PosScreen({ canUpdate, userId, canOverrideCreditLimit }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 200)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(POS_CART_KEY)
      if (!raw) return []
      const saved = JSON.parse(raw)
      const isExpired = !saved.savedAt || (Date.now() - saved.savedAt) > POS_CART_TTL_MS
      const isWrongUser = userId && saved.userId && saved.userId !== userId
      if (isExpired || isWrongUser) { localStorage.removeItem(POS_CART_KEY); return [] }
      return saved.items || []
    } catch { return [] }
  })
  const [modal, setModal] = useState(null) // null | 'payment' | 'receipt'
  const [lastOrder, setLastOrder] = useState(null)
  // Persist cart to localStorage with expiry metadata
  useEffect(() => {
    try { localStorage.setItem(POS_CART_KEY, JSON.stringify({ items: cart, savedAt: Date.now(), userId: userId ?? null })) } catch { /* ignore */ }
  }, [cart, userId])

  useEffect(() => {
    if (!dq.trim()) return
    let cancelled = false
    posSearchProducts(dq)
      .then((r) => { if (!cancelled) setResults(r.items || []) })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [dq])

  function handleSearchChange(value) {
    setQ(value)
    if (!value.trim()) {
      setSearching(false)
      setResults([])
      return
    }
    setSearching(true)
  }

  function addToCart(variant, product) {
    const unitPrice = priceOf(variant.price ?? product.price)
    setCart((prev) => {
      const existing = prev.find((c) => c.variantId === variant.id)
      if (existing) {
        return prev.map((c) => c.variantId === variant.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, {
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantName: summarizeOptions(variant.options),
        sku: variant.sku,
        price: unitPrice,
        thumbnail: product.image?.url ?? null,
        qty: 1,
        stock: variant.stockQuantity ?? 999,
      }]
    })
  }

  function handleVariantClick(variant, product) {
    if (!canUpdate) return
    addToCart(variant, product)
  }

  function updateQty(cartKey, delta) {
    setCart((prev) => prev
      .map((c) => c.variantId === cartKey ? { ...c, qty: Math.max(1, Math.min(c.stock, c.qty + delta)) } : c)
      .filter((c) => c.qty > 0)
    )
  }

  function removeFromCart(cartKey) {
    setCart((prev) => prev.filter((c) => c.variantId !== cartKey))
  }

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)

  return (
    <section className="screen pos-screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('pos.eyebrow')}</p>
          <h1>{t('pos.title')}</h1>
        </div>
      </header>

      <div className="pos-layout">
        <div className="pos-search-col">
          <div className="pos-search-wrap">
            <Search size={16} className="pos-search-icon" />
            <input
              className="control-input pos-search-input"
              placeholder={t('pos.searchPlaceholder')}
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoFocus
            />
          </div>

          {searching && (
            <p style={{ padding: '8px 0', color: 'var(--admin-color-text-muted)', fontSize: '0.85rem' }}>{t('common.loading')}...</p>
          )}

          {!searching && results.length === 0 && dq.trim() && (
            <StatePanel tone="neutral" title={t('pos.noResults')} description={t('pos.noResultsDesc')} />
          )}

          {!searching && results.length === 0 && !dq.trim() && (
            <div className="pos-empty-hint">
              <Search size={32} opacity={0.2} />
              <p>{t('pos.searchHint')}</p>
            </div>
          )}

          <div className="pos-product-grid">
            {results.map((product) =>
              (product.variants || []).map((variant) => {
                const displayPrice = priceOf(variant.price ?? product.price)
                const variantLabel = summarizeOptions(variant.options)
                const outOfStock = variant.stockQuantity !== null && variant.stockQuantity <= 0
                return (
                  <button
                    key={variant.id}
                    type="button"
                    className="pos-product-card"
                    onClick={() => handleVariantClick(variant, product)}
                    disabled={!canUpdate || outOfStock}
                  >
                    {product.image?.url && (
                      <img src={product.image.url} alt={product.name} className="pos-product-img" />
                    )}
                    <div className="pos-product-info">
                      <span className="pos-product-name">{product.name}</span>
                      {variantLabel && <span className="pos-product-attrs">{variantLabel}</span>}
                      <span className="pos-product-price">{formatCurrencyVnd(displayPrice)}</span>
                      <span className={`pos-product-stock${outOfStock ? ' out' : ''}`}>
                        {outOfStock ? 'Hết hàng' : variant.stockQuantity != null ? `Kho: ${variant.stockQuantity}` : ''}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="pos-cart-col">
          <div className="pos-cart-header">
            <ShoppingCart size={16} />
            <span>{t('pos.cart')} ({cart.length})</span>
          </div>

          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <ShoppingCart size={28} opacity={0.2} />
              <p>{t('pos.cartEmpty')}</p>
            </div>
          ) : (
            <div className="pos-cart-items">
              {cart.map((item) => (
                <div key={item.variantId} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <span className="pos-cart-item-name">{item.productName}</span>
                    {(item.variantName || item.sku) && (
                      <span className="pos-cart-item-sku">{item.variantName || item.sku}</span>
                    )}
                    <span className="pos-cart-item-price">{formatCurrencyVnd(item.price)}</span>
                  </div>
                  <div className="pos-cart-item-qty">
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => updateQty(item.variantId, -1)}><Minus size={12} /></button>
                    <span>{item.qty}</span>
                    <button type="button" className="btn btn-icon btn-sm" onClick={() => updateQty(item.variantId, 1)}><Plus size={12} /></button>
                    <button type="button" className="btn btn-icon btn-sm btn-danger-ghost" onClick={() => removeFromCart(item.variantId)}><Trash2 size={12} /></button>
                  </div>
                  <span className="pos-cart-item-subtotal">{formatCurrencyVnd(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pos-cart-footer">
            <div className="pos-cart-total">
              <span>{t('pos.total')}</span>
              <strong>{formatCurrencyVnd(total)}</strong>
            </div>
            <button
              type="button"
              className="btn btn-primary pos-checkout-btn"
              disabled={cart.length === 0 || !canUpdate}
              onClick={() => setModal('payment')}
            >
              {t('pos.checkout')}
            </button>
          </div>
        </div>
      </div>

      {modal === 'payment' && (
        <PaymentModal
          cart={cart}
          total={total}
          canOverrideCreditLimit={canOverrideCreditLimit}
          onClose={() => setModal(null)}
          onSuccess={(order, usedMethod) => {
            setLastOrder({ ...order, usedMethod })
            setCart([])
            try { localStorage.removeItem('pos_cart') } catch { /* ignore */ }
            setQ('')
            setResults([])
            setModal('receipt')
          }}
        />
      )}

      {modal === 'receipt' && (
        <ReceiptModal order={lastOrder} paymentMethod={lastOrder?.usedMethod} onClose={() => setModal(null)} />
      )}

    </section>
  )
}
