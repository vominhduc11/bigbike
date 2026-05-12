"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { applyCoupon, clearCart, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath, toProductListPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
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

function CartItemThumb({ item }: { item: CartItem }) {
  return (
    <div className="wp-cart-item-thumb">
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={144} height={144} />
      ) : (
        <span className="wp-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
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
    if (!window.confirm("Xoá toàn bộ giỏ hàng?")) return;
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
  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <span>Giỏ hàng</span>
      </div>

      <div className="wp-cart-page bb-container">
        <div className="wp-cart-title-row">
          <h1>Giỏ hàng</h1>
        </div>

        {error && <p className="wp-error-text">{error}</p>}

        <div className="wp-cart-grid">
          <div className="wp-cart-main">
            {!hasItems ? (
              <div className="wp-cart-empty">
                <b>Giỏ hàng trống</b>
                <p>Bạn chưa thêm sản phẩm nào vào giỏ hàng.</p>
                <Link href={toProductListPath()} className="wp-btn-primary">
                  Xem sản phẩm
                </Link>
              </div>
            ) : (
              <>
                <div className="wp-cart-avalable">
                  <h3>
                    GIỎ HÀNG CỦA BẠN <span><b>{itemCount}</b></span>
                  </h3>
                </div>

                <div className="wp-cart-table">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="wp-cart-row"
                      style={{ opacity: mutating[item.id] ? 0.5 : 1 }}
                    >
                      <div className="wp-cart-row-thumb">
                        <CartItemThumb item={item} />
                      </div>

                      <div className="wp-cart-row-info">
                        <h3>{item.productName}</h3>
                        {item.variantName && <p className="wp-cart-row-meta">{item.variantName}</p>}
                        {item.sku && <p className="wp-cart-row-meta">SKU: {item.sku}</p>}
                        <p className="wp-cart-row-price">
                          <b>
                            {item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
                          </b>
                        </p>
                      </div>

                      <div className="wp-cart-row-qty">
                        <div className="wp-cart-qty-vertical">
                          <button
                            type="button"
                            className="plus"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            disabled={mutating[item.id]}
                            aria-label="Tăng"
                          >
                            +
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="quantity-input"
                            value={item.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (Number.isFinite(v) && v >= 1) handleQuantityChange(item.id, v);
                            }}
                            disabled={mutating[item.id]}
                          />
                          <button
                            type="button"
                            className="minus"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={mutating[item.id] || item.quantity <= 1}
                            aria-label="Giảm"
                          >
                            −
                          </button>
                        </div>
                      </div>

                      <div className="wp-cart-row-action">
                        <button
                          type="button"
                          className="wp-cart-row-remove"
                          onClick={() => handleRemove(item.id)}
                          disabled={mutating[item.id]}
                          aria-label="Xoá sản phẩm"
                        >
                          <svg width="15" height="15" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
                            <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="wp-cart-checkout-row">
                  <Link href={toProductListPath()} className="wp-cart-continue">
                    <span aria-hidden="true">‹</span> TIẾP TỤC MUA HÀNG
                  </Link>
                  <button type="button" className="wp-cart-clear-link" onClick={handleClear}>
                    Xoá toàn bộ
                  </button>
                  <Link href={toCheckoutPath()} className="wp-cart-checkout-btn">
                    THANH TOÁN
                  </Link>
                </div>
              </>
            )}
          </div>

          <aside className="wp-cart-side">
            <div className="wp-cart-summary">
              <div className="wp-cart-summary-row">
                <p>Tạm tính:</p>
                <p><b>{cart ? formatVnd(cart.totals.subtotalAmount) : "0"}</b></p>
              </div>
              {cart && cart.totals.discountAmount > 0 && (
                <div className="wp-cart-summary-row">
                  <p>Giảm giá:</p>
                  <p className="discount"><b>−{formatVnd(cart.totals.discountAmount)}</b></p>
                </div>
              )}
              <div className="wp-cart-summary-row">
                <p>Phí vận chuyển:</p>
                <p>
                  {cart && cart.totals.shippingAmount > 0
                    ? <b>{formatVnd(cart.totals.shippingAmount)}</b>
                    : <span className="wp-cart-ship-note">Tính ở bước thanh toán</span>}
                </p>
              </div>
            </div>

            <div className="wp-cart-promotion">
              {cart?.couponCodes && cart.couponCodes.length > 0 && (
                <div className="wp-cart-applied-codes">
                  {cart.couponCodes.map((code) => (
                    <div key={code} className="wp-cart-applied-code">
                      <p>#{code}</p>
                      <button
                        type="button"
                        className="wp-cart-applied-remove"
                        onClick={() => handleRemoveCoupon(code)}
                        disabled={couponLoading}
                        aria-label="Xoá mã"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form className="wp-cart-promo-form" onSubmit={handleApplyCoupon}>
                <fieldset>
                  <legend>Nhập mã khuyến mãi</legend>
                </fieldset>
                <div className="wp-cart-promo-group">
                  <input
                    type="text"
                    placeholder="Nhập mã khuyến mãi..."
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value); setCouponError(""); }}
                    disabled={couponLoading}
                  />
                  <button type="submit" disabled={couponLoading || !couponInput.trim()}>
                    {couponLoading ? "..." : "ÁP DỤNG"}
                  </button>
                </div>
                {couponError && <p className="wp-cart-coupon-error">{couponError}</p>}
              </form>
            </div>

            <div className="wp-cart-total-summary">
              <div className="wp-cart-summary-row">
                <p>Total</p>
                <p className="wp-cart-total-price">
                  <b>{cart ? formatVnd(cart.totals.totalAmount) : "0"}</b>
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
