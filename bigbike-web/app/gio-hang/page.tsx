"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { applyCoupon, clearCart, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath, toProductListPath } from "@/lib/utils/routes";
import { CartSkeleton } from "@/components/ui/Skeletons";

function toGtmCartItems(items: CartItem[]) {
  return items.map((item) => ({
    item_id: item.productId ?? item.sku ?? item.id,
    item_name: item.productName,
    price: item.unitPrice,
    quantity: item.quantity,
    currency: "VND",
  }));
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    fetchCart()
      .then((c) => {
        setCart(c);
        pushDataLayer("view_cart", {
          currency: c.currency ?? "VND",
          value: c.totals.totalAmount,
          items: toGtmCartItems(c.items),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const setItemMutating = (id: string, val: boolean) =>
    setMutating((p) => ({ ...p, [id]: val }));

  const handleQuantityChange = useCallback(async (itemId: string, qty: number) => {
    if (qty < 1) return;
    setItemMutating(itemId, true);
    try {
      const updated = await updateCartItem(itemId, qty);
      setCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, []);

  const handleRemove = useCallback(async (itemId: string) => {
    setItemMutating(itemId, true);
    try {
      const updated = await removeCartItem(itemId);
      setCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, []);

  const handleClear = useCallback(async () => {
    if (!cart?.items.length) return;
    try {
      const updated = await clearCart();
      setCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [cart]);

  const handleApplyCoupon = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const updated = await applyCoupon(code);
      setCart(updated);
      setCouponInput("");
    } catch (e: unknown) {
      setCouponError((e as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput]);

  const handleRemoveCoupon = useCallback(async (code: string) => {
    setCouponLoading(true);
    setCouponError("");
    try {
      const updated = await removeCoupon(code);
      setCart(updated);
    } catch (e: unknown) {
      setCouponError((e as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }, []);

  if (loading) {
    return <CartSkeleton />;
  }

  const hasItems = cart && cart.items.length > 0;

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <span>Giỏ hàng</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Mua sắm</span>
        <h1>Giỏ hàng</h1>
      </div>

      {error && (
        <div style={{ maxWidth: 1440, margin: "0 auto 16px", padding: "0 24px" }}>
          <p className="wp-error-text">{error}</p>
        </div>
      )}

      <div className="wp-cart-layout">
        {/* Left: cart items */}
        <div>
          {!hasItems ? (
            <div className="wp-cart-list">
              <div className="wp-cart-empty">
                <b>Giỏ hàng trống</b>
                <p>Bạn chưa thêm sản phẩm nào vào giỏ hàng.</p>
                <Link href={toProductListPath()} className="wp-btn-primary">
                  Xem sản phẩm
                </Link>
              </div>
            </div>
          ) : (
            <div className="wp-cart-list">
              <div className="wp-cart-header-row">
                <span>Sản phẩm</span>
                <span style={{ textAlign: "center" }}>Số lượng</span>
                <span style={{ textAlign: "right" }}>Đơn giá</span>
                <span style={{ textAlign: "right" }}>Thành tiền</span>
                <span />
              </div>

              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="wp-cart-item"
                  style={{ opacity: mutating[item.id] ? 0.5 : 1 }}
                >
                  <div className="wp-cart-item-prod">
                    <div className="wp-cart-item-thumb">
                      <span className="wp-thumb-initials" style={{ fontSize: 11 }}>
                        {item.productName.slice(0, 2)}
                      </span>
                    </div>
                    <div className="wp-cart-item-info">
                      <p className="wp-cart-item-name">{item.productName}</p>
                      {item.variantName && (
                        <p className="wp-cart-item-variant">{item.variantName}</p>
                      )}
                      {item.sku && (
                        <p className="wp-cart-item-variant">SKU: {item.sku}</p>
                      )}
                    </div>
                  </div>

                  <div className="wp-pdp-qty-stepper" style={{ justifySelf: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={mutating[item.id] || item.quantity <= 1}
                      aria-label="Giảm"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isFinite(v) && v >= 1) handleQuantityChange(item.id, v);
                      }}
                      disabled={mutating[item.id]}
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={mutating[item.id]}
                      aria-label="Tăng"
                    >
                      +
                    </button>
                  </div>

                  <span className="wp-cart-price" style={{ justifySelf: "end" }}>
                    {formatVnd(item.unitPrice)}
                  </span>

                  <span className="wp-cart-subtotal" style={{ justifySelf: "end" }}>
                    {formatVnd(item.lineTotal)}
                  </span>

                  <button
                    type="button"
                    className="wp-cart-remove"
                    onClick={() => handleRemove(item.id)}
                    disabled={mutating[item.id]}
                    aria-label="Xoá"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              <div className="wp-cart-footer">
                <Link href={toProductListPath()} className="link">
                  ← Tiếp tục mua hàng
                </Link>
                <button type="button" className="link" onClick={handleClear}>
                  Xoá toàn bộ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: order summary */}
        <div className="wp-summary-card">
          <h3>Tổng đơn hàng</h3>

          {cart && (
            <>
              <div className="wp-summary-row">
                <span>Tạm tính</span>
                <b>{formatVnd(cart.totals.subtotalAmount)}</b>
              </div>
              {cart.totals.discountAmount > 0 && (
                <div className="wp-summary-row discount">
                  <span>Giảm giá</span>
                  <b>−{formatVnd(cart.totals.discountAmount)}</b>
                </div>
              )}
              {cart.totals.shippingAmount > 0 && (
                <div className="wp-summary-row">
                  <span>Phí vận chuyển</span>
                  <b>{formatVnd(cart.totals.shippingAmount)}</b>
                </div>
              )}
              <div className="wp-summary-total">
                <span>Tổng cộng</span>
                <b>{formatVnd(cart.totals.totalAmount)}</b>
              </div>

              {/* Applied coupons */}
              {cart.couponCodes && cart.couponCodes.length > 0 && (
                <div className="wp-coupon-list">
                  {cart.couponCodes.map((code) => (
                    <div key={code} className="wp-coupon-tag">
                      <span className="wp-coupon-code">{code}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCoupon(code)}
                        disabled={couponLoading}
                        className="wp-coupon-remove"
                        aria-label="Xoá mã giảm giá"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Coupon input */}
              <form onSubmit={handleApplyCoupon} className="wp-coupon-form">
                <input
                  className="wp-input"
                  style={{ flex: 1, fontSize: 13 }}
                  placeholder="Mã giảm giá"
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value); setCouponError(""); }}
                  disabled={couponLoading}
                />
                <button
                  type="submit"
                  className="wp-btn-secondary"
                  style={{ flex: "none", padding: "0 14px", fontSize: 13 }}
                  disabled={couponLoading || !couponInput.trim()}
                >
                  {couponLoading ? "..." : "Áp dụng"}
                </button>
              </form>
              {couponError && <p className="wp-coupon-error">{couponError}</p>}
            </>
          )}

          <Link
            href={toCheckoutPath()}
            className="wp-summary-cta"
            style={{ pointerEvents: hasItems ? undefined : "none", opacity: hasItems ? 1 : 0.4 }}
            aria-disabled={!hasItems}
          >
            {loading ? "Đang tải..." : "Tiến hành thanh toán"}
          </Link>

          <div className="wp-summary-trust">
            {["Hàng chính hãng", "COD toàn quốc", "Bảo hành hãng", "Đổi trả 7 ngày"].map((t) => (
              <div key={t}>
                <span className="dot" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
