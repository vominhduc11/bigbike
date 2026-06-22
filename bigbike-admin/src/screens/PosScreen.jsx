import { useEffect, useRef, useState } from 'react'
import { Minus, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { formatCurrencyVnd } from '../lib/formatters'
import { posSearchProducts } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useDebounce } from '../lib/useDebounce'
import { Input } from '@/components/ui/input'
import { POS_CART_KEY, POS_CART_TTL_MS, priceOf, summarizeOptions, effectivePrice } from './pos/constants'
import { PaymentModal } from './pos/PaymentModal'
import { ReceiptModal } from './pos/ReceiptModal'

export function PosScreen({ canUpdate, userId, canOverrideCreditLimit, canOverridePrice, canRefund }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const dq = useDebounce(q, 300)
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

  // Price override editing state
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [priceInput, setPriceInput] = useState('')
  const priceInputRef = useRef(null)

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

  useEffect(() => {
    if (editingPriceId && priceInputRef.current) priceInputRef.current.focus()
  }, [editingPriceId])

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
    // Variants synthesized for product-level serials have id = null; key by product id instead.
    const cartKey = variant.id ?? ('p:' + product.id)
    setCart((prev) => {
      const existing = prev.find((c) => c.cartKey === cartKey)
      if (existing) {
        return prev.map((c) => c.cartKey === cartKey ? { ...c, qty: Math.min(c.stock, c.qty + 1) } : c)
      }
      return [...prev, {
        cartKey,
        productId: product.id,
        variantId: variant.id ?? null,
        productName: product.name,
        variantName: summarizeOptions(variant.options),
        sku: variant.sku,
        price: unitPrice,
        overriddenPrice: null,
        thumbnail: product.image?.url ?? null,
        qty: 1,
        stock: variant.stockQuantity ?? 999,
        hasSerial: variant.trackSerials === true,
      }]
    })
  }

  function handleVariantClick(variant, product) {
    if (!canUpdate) return
    addToCart(variant, product)
  }

  function updateQty(cartKey, delta) {
    setCart((prev) => prev
      .map((c) => c.cartKey === cartKey ? { ...c, qty: Math.max(1, Math.min(c.stock, c.qty + delta)) } : c)
      .filter((c) => c.qty > 0)
    )
  }

  function removeFromCart(cartKey) {
    setCart((prev) => prev.filter((c) => c.cartKey !== cartKey))
  }

  function startEditPrice(item) {
    setEditingPriceId(item.cartKey)
    setPriceInput(String(item.overriddenPrice != null ? item.overriddenPrice : item.price))
  }

  function commitEditPrice(cartKey) {
    const parsed = Number(priceInput)
    if (!isNaN(parsed) && parsed > 0) {
      setCart((prev) => prev.map((c) =>
        c.cartKey === cartKey ? { ...c, overriddenPrice: parsed === c.price ? null : parsed } : c
      ))
    }
    setEditingPriceId(null)
  }

  function cancelEditPrice() {
    setEditingPriceId(null)
  }

  const total = cart.reduce((s, c) => s + effectivePrice(c) * c.qty, 0)

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('pos.eyebrow')}</p>
          <h1>{t('pos.title')}</h1>
          <p className="bb-muted">{t('pos.searchHint')}</p>
        </div>
      </div>

      <div className="pos-layout">
        {/* Product picker */}
        <div className="pos-search-col">
          <div className="pos-search-wrap">
            <span className="pos-search-icon"><Search size={14} /></span>
            <input
              className="bb-input pos-search-input"
              placeholder={t('pos.searchPlaceholder')}
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoFocus
            />
          </div>

          {searching && (
            <div className="pos-product-grid" role="status" aria-label={t('common.loading')}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="pos-product-card animate-pulse" aria-hidden="true">
                  <div className="pos-product-img bg-surface-muted" />
                  <div className="pos-product-info flex flex-col gap-1.5">
                    <div className="h-3 rounded-xs bg-surface-muted" style={{ width: '40%' }} />
                    <div className="h-3.5 rounded-xs bg-surface-muted" style={{ width: '80%' }} />
                    <div className="h-3 rounded-xs bg-surface-muted" style={{ width: '55%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && results.length === 0 && dq.trim() && (
            <StatePanel tone="neutral" title={t('pos.noResults')} description={t('pos.noResultsDesc')} />
          )}

          {!searching && results.length === 0 && !dq.trim() && (
            <div className="pos-empty-hint">
              <Search size={28} />
              <span>{t('pos.searchHint')}</span>
            </div>
          )}

          <div className="pos-product-grid">
            {results.map((product) =>
              (product.variants || []).filter((v) => v.stockQuantity === null || v.stockQuantity > 0).map((variant) => {
                const displayPrice = priceOf(variant.price ?? product.price)
                const variantLabel = summarizeOptions(variant.options)
                const outOfStock = variant.stockQuantity !== null && variant.stockQuantity <= 0
                const disabled = !canUpdate || outOfStock
                return (
                  <div
                    key={variant.id ?? ('p:' + product.id)}
                    className="pos-product-card"
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled}
                    style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    onClick={() => { if (!disabled) handleVariantClick(variant, product) }}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        handleVariantClick(variant, product)
                      }
                    }}
                  >
                    <div className="pos-product-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-color-text-muted)' }}>
                      {product.image?.url
                        ? <img src={product.image.url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <ShoppingCart size={28} />}
                    </div>
                    <div className="pos-product-info">
                      {variant.sku && <div className="pos-product-attrs">{variant.sku}</div>}
                      <div className="pos-product-name">{product.name}</div>
                      {variantLabel && <div className="pos-product-attrs">{variantLabel}</div>}
                      <div className="pos-product-price">{formatCurrencyVnd(displayPrice)}</div>
                      {outOfStock
                        ? <div className="pos-product-stock out">{t('pos.outOfStock', { defaultValue: 'Hết hàng' })}</div>
                        : variant.stockQuantity != null
                          ? <div className="pos-product-stock">{t('pos.inStock', { count: variant.stockQuantity, defaultValue: `Còn ${variant.stockQuantity}` })}</div>
                          : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="pos-cart-col">
          <div className="pos-cart-header">
            <span style={{ flex: 1 }}>{t('pos.cart')} ({cart.length})</span>
            {cart.length > 0 && (
              <button
                type="button"
                className="bb-btn bb-btn-ghost bb-btn-sm"
                onClick={async () => {
                  const ok = await showConfirm(
                    t('pos.clearCartConfirm', { defaultValue: 'Xoá toàn bộ giỏ hàng?' }),
                    t('pos.clearCartConfirmTitle', { defaultValue: 'Xoá giỏ hàng' }),
                    { variant: 'danger', confirmLabel: t('pos.clearCart', { defaultValue: 'Xoá hết' }), cancelLabel: t('common.cancel') },
                  )
                  if (ok) {
                    setCart([])
                    try { localStorage.removeItem(POS_CART_KEY) } catch { /* ignore */ }
                  }
                }}
              >
                <Trash2 size={13} />{t('pos.clearCart', { defaultValue: 'Xoá hết' })}
              </button>
            )}
          </div>

          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div className="pos-cart-empty">
                <ShoppingCart size={28} />
                <strong>{t('pos.cartEmpty')}</strong>
                <span>{t('pos.searchHint')}</span>
              </div>
            ) : cart.map((item) => (
              <div key={item.cartKey} className="pos-cart-item">
                <div className="pos-cart-item-info">
                  <div className="pos-cart-item-name">{item.productName}</div>
                  {(item.variantName || item.sku) && (
                    <div className="pos-cart-item-sku">{item.variantName || item.sku}</div>
                  )}
                  <div className="pos-cart-item-price">
                    {editingPriceId === item.cartKey ? (
                      <Input
                        ref={priceInputRef}
                        type="number"
                        min={0}
                        className="w-[110px] py-0.5 px-1.5 text-xs h-auto inline-block"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEditPrice(item.cartKey)
                          if (e.key === 'Escape') cancelEditPrice()
                        }}
                        onBlur={() => commitEditPrice(item.cartKey)}
                      />
                    ) : (
                      <>
                        {formatCurrencyVnd(effectivePrice(item))}
                        {item.overriddenPrice != null && (
                          <span style={{ textDecoration: 'line-through', marginLeft: 4, color: 'var(--admin-color-text-muted)' }}>
                            {formatCurrencyVnd(item.price)}
                          </span>
                        )}
                        {canOverridePrice && (
                          <button
                            type="button"
                            className="bb-icon-btn"
                            title="Sửa giá"
                            style={{ width: 20, height: 20, marginLeft: 4 }}
                            onClick={() => startEditPrice(item)}
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="pos-cart-item-qty">
                  <button type="button" className="bb-btn bb-btn-secondary" style={{ width: 24, height: 24, padding: 0, minWidth: 24 }} onClick={() => updateQty(item.cartKey, -1)}><Minus size={12} /></button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontSize: 'var(--admin-text-sm)', fontWeight: 600 }}>{item.qty}</span>
                  <button type="button" className="bb-btn bb-btn-secondary" style={{ width: 24, height: 24, padding: 0, minWidth: 24 }} onClick={() => updateQty(item.cartKey, 1)}><Plus size={12} /></button>
                </div>
                <div className="pos-cart-item-subtotal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span>{formatCurrencyVnd(effectivePrice(item) * item.qty)}</span>
                  <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm" style={{ fontSize: 11, padding: '0 6px', height: 20 }} onClick={() => removeFromCart(item.cartKey)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pos-cart-footer">
            <div className="pos-cart-total" style={{ fontSize: 'var(--admin-text-sm)', fontWeight: 400 }}>
              <span>{t('pos.itemCount', { count: cart.length, defaultValue: `Tạm tính (${cart.length} mục)` })}</span>
              <span>{formatCurrencyVnd(total)}</span>
            </div>
            <div className="pos-cart-total">
              <span>{t('pos.total')}</span>
              <strong style={{ color: 'var(--admin-color-primary)' }}>{formatCurrencyVnd(total)}</strong>
            </div>
            <button
              type="button"
              className="pos-checkout-btn bb-btn bb-btn-primary"
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
            const cartSnapshot = [...cart]
            setLastOrder({ ...order, usedMethod, cartSnapshot })
            setCart([])
            try { localStorage.removeItem(POS_CART_KEY) } catch { /* ignore */ }
            setQ('')
            setResults([])
            setModal('receipt')
          }}
        />
      )}

      {modal === 'receipt' && (
        <ReceiptModal
          order={lastOrder}
          paymentMethod={lastOrder?.usedMethod}
          cart={lastOrder?.cartSnapshot}
          canRefund={canRefund}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  )
}
