"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyCoupon, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toProductListPath, toCheckoutPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";

const COPY = {
  title: "Giỏ hàng",
  home: "Bigbike.vn",
  emptyMessage: "Chưa có sản phẩm nào trong giỏ hàng.",
  returnToShop: "Quay trở lại cửa hàng",
  cartHeading: "GIỎ HÀNG CỦA BẠN",
  updateCart: "Cập nhật giỏ hàng",
  updating: "Đang cập nhật...",
  continueShopping: "TIẾP TỤC MUA HÀNG",
  checkoutShort: "THANH TOÁN",
  checkoutProceed: "Tiến hành thanh toán",
  totalsHeading: "Tổng cộng giỏ hàng",
  subtotal: "Tạm tính",
  discount: "Khuyến mãi",
  shipping: "Phí vận chuyển",
  shippingPending: "Phí vận chuyển là 35.000đ và miễn phí vận chuyển với đơn hàng từ 2.000.000đ",
  total: "Tổng",
  couponLegend: "Nhập mã khuyến mãi",
  couponPlaceholder: "Nhập mã giảm giá",
  couponApply: "Áp dụng",
  couponApplying: "...",
  loadFailed: "Không tải được giỏ hàng.",
  removeItem: "Xóa sản phẩm",
  removeCoupon: "Xóa mã",
};

function toGtmCartItems(items: CartItem[]) {
  return items.map((item) => ({
    item_id: item.productId ?? item.sku ?? item.id,
    item_name: item.productName,
    price: item.unitPrice,
    quantity: item.quantity,
    currency: "VND",
  }));
}

function cartToDrafts(cart: Cart): Record<string, number> {
  return Object.fromEntries(cart.items.map((item) => [item.id, item.quantity]));
}

function CartHeading() {
  return (
    <div className="bb-cart-heading-row">
      <div className="bb-cart-heading-col">
        <h1>{COPY.title}</h1>
        <nav className="bb-cart-breadcrumb" aria-label="Breadcrumb">
          <ul>
            <li>
              <Link href="/">{COPY.home}</Link>
            </li>
            <li aria-current="page">
              <span>{COPY.title}</span>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function CartItemThumb({ item }: { item: CartItem }) {
  return (
    <div className="bb-cart-item-thumb">
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={130} height={130} />
      ) : (
        <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

function RemoveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="15" fill="red" aria-hidden="true">
      <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
    </svg>
  );
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const [cartUpdating, setCartUpdating] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const syncCart = useCallback((nextCart: Cart) => {
    setCart(nextCart);
    setQuantityDrafts(cartToDrafts(nextCart));
  }, []);

  useEffect(() => {
    fetchCart()
      .then((c) => {
        syncCart(c);
        pushDataLayer("view_cart", {
          currency: c.currency ?? "VND",
          value: c.totals.totalAmount,
          items: toGtmCartItems(c.items),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [syncCart]);

  const setItemMutating = useCallback((id: string, val: boolean) => {
    setMutating((p) => ({ ...p, [id]: val }));
  }, []);

  const handleQuantityDraft = useCallback((itemId: string, qty: number) => {
    const nextQty = Number.isFinite(qty) ? Math.max(1, Math.trunc(qty)) : 1;
    setQuantityDrafts((p) => ({ ...p, [itemId]: nextQty }));
  }, []);

  const handleQuantityStep = useCallback((itemId: string, direction: 1 | -1) => {
    setQuantityDrafts((p) => {
      const current = p[itemId] ?? 1;
      return { ...p, [itemId]: Math.max(1, current + direction) };
    });
  }, []);

  const handleUpdateCart = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart) return;

    const changedItems = cart.items
      .map((item) => ({
        item,
        quantity: Math.max(1, quantityDrafts[item.id] ?? item.quantity),
      }))
      .filter(({ item, quantity }) => item.quantity !== quantity);

    if (changedItems.length === 0) return;

    setCartUpdating(true);
    changedItems.forEach(({ item }) => setItemMutating(item.id, true));
    setError("");

    try {
      let updatedCart = cart;
      for (const { item, quantity } of changedItems) {
        updatedCart = await updateCartItem(item.id, quantity);
      }
      syncCart(updatedCart);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      changedItems.forEach(({ item }) => setItemMutating(item.id, false));
      setCartUpdating(false);
    }
  }, [cart, quantityDrafts, setItemMutating, syncCart]);

  const handleRemove = useCallback(async (itemId: string) => {
    setItemMutating(itemId, true);
    setError("");
    try {
      const updated = await removeCartItem(itemId);
      syncCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, [setItemMutating, syncCart]);

  const handleApplyCoupon = useCallback(async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const updated = await applyCoupon(code);
      syncCart(updated);
      setCouponInput("");
    } catch (e: unknown) {
      setCouponError((e as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, syncCart]);

  const handleRemoveCoupon = useCallback(async (code: string) => {
    setCouponLoading(true);
    setCouponError("");
    try {
      const updated = await removeCoupon(code);
      syncCart(updated);
    } catch (e: unknown) {
      setCouponError((e as Error).message);
    } finally {
      setCouponLoading(false);
    }
  }, [syncCart]);

  const hasQuantityChanges = useMemo(() => {
    if (!cart) return false;
    return cart.items.some((item) => (quantityDrafts[item.id] ?? item.quantity) !== item.quantity);
  }, [cart, quantityDrafts]);

  if (loading) {
    return (
      <div id="main-content" className="bb-cart-page" aria-busy="true">
        <div className="bb-container">
          <CartHeading />
          <div className="cart-table">
            <div className="woocommerce-notices-wrapper" />
          </div>
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div id="main-content" className="bb-cart-page">
        <div className="bb-container">
          <CartHeading />
          <div className="cart-table">
            <div className="woocommerce-notices-wrapper">
              <div className="woocommerce-error" role="alert">{error || COPY.loadFailed}</div>
            </div>
            <p className="return-to-shop">
              <Link className="button wc-backward" href="/gio-hang/">
                {COPY.updateCart}
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasItems = cart.items.length > 0;
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const hasUnavailable = cart.items.some((i) => !i.available);
  const continueHref = toProductListPath();

  return (
    <div id="main-content" className="bb-cart-page">
      <div className="bb-container">
        <CartHeading />

        <div className="cart-table">
          <div className="woocommerce-notices-wrapper">
            {error && <div className="woocommerce-error" role="alert">{error}</div>}
            {couponError && <div className="woocommerce-error" role="alert">{couponError}</div>}
          </div>

          {!hasItems ? (
            <>
              <div className="wc-empty-cart-message">
                <div className="cart-empty woocommerce-info" role="status">
                  {COPY.emptyMessage}
                </div>
              </div>
              <p className="return-to-shop">
                <Link className="button wc-backward" href={continueHref}>
                  {COPY.returnToShop}
                </Link>
              </p>
            </>
          ) : (
            <form className="woocommerce-cart-form" onSubmit={handleUpdateCart}>
              <div className="bb-cart-content-row">
                <div className="bb-cart-content-main">
                  <div className="cart-avalable">
                    <h3>
                      {COPY.cartHeading} <span><b>{itemCount}</b></span>
                    </h3>
                  </div>

                  <div className="table" role="list">
                    {cart.items.map((item) => {
                      const draftQuantity = quantityDrafts[item.id] ?? item.quantity;
                      const isMutating = mutating[item.id];

                      return (
                        <div
                          key={item.id}
                          className={`table--items bb-cart-line-item${isMutating ? " is-mutating" : ""}`}
                          role="listitem"
                        >
                          <div className="table--items-item thumbnail">
                            <CartItemThumb item={item} />
                          </div>

                          <div className="table--items-item cart-information">
                            <h3>{item.productName}</h3>
                            {item.variantName ? <p>{item.variantName}</p> : <p aria-hidden="true">&nbsp;</p>}
                            <p className="price">
                              <b>
                                {item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
                              </b>
                            </p>
                          </div>

                          <div className="table--items-item quantity">
                            <div className="quantity-form js-quantity-wrap">
                              <button
                                type="button"
                                className="plus js-plus"
                                onClick={() => handleQuantityStep(item.id, 1)}
                                disabled={isMutating || !item.available}
                                aria-label={`Tăng số lượng ${item.productName}`}
                              >
                                +
                              </button>
                              <div className="quantity">
                                <input
                                  type="number"
                                  className="quantity-input"
                                  min={1}
                                  step={1}
                                  value={draftQuantity}
                                  onChange={(e) => handleQuantityDraft(item.id, Number(e.target.value))}
                                  disabled={isMutating || !item.available}
                                  aria-label={`Số lượng ${item.productName}`}
                                  inputMode="numeric"
                                />
                              </div>
                              <button
                                type="button"
                                className="minus js-minus"
                                onClick={() => handleQuantityStep(item.id, -1)}
                                disabled={isMutating || !item.available || draftQuantity <= 1}
                                aria-label={`Giảm số lượng ${item.productName}`}
                              >
                                -
                              </button>
                            </div>
                          </div>

                          <div className="table--items-item action">
                            <div className="delete text-right">
                              <button
                                type="button"
                                className="remove"
                                onClick={() => handleRemove(item.id)}
                                disabled={isMutating}
                                aria-label={COPY.removeItem}
                              >
                                <RemoveIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="check-out">
                    <div className="bb-cart-update-row">
                      <button
                        type="submit"
                        className="button"
                        name="update_cart"
                        value={COPY.updateCart}
                        disabled={!hasQuantityChanges || cartUpdating}
                      >
                        {cartUpdating ? COPY.updating : COPY.updateCart}
                      </button>
                    </div>

                    <div className="bb-cart-action-row">
                      <Link className="btn btn-continue-shopping" href={continueHref}>
                        <span aria-hidden="true">‹</span> {COPY.continueShopping}
                      </Link>
                      {hasUnavailable ? (
                        <span className="btn btn-submit disabled" aria-disabled="true">
                          {COPY.checkoutShort}
                        </span>
                      ) : (
                        <Link className="btn btn-submit" href={toCheckoutPath()}>
                          {COPY.checkoutShort}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bb-cart-content-side">
                  <div className="summary">
                    <div className="cart_totals">
                      <h2>{COPY.totalsHeading}</h2>

                      <div className="summary--items">
                        <div className="summary--items-item">
                          <p>{COPY.subtotal}</p>
                        </div>
                        <div className="summary--items-item text-right">
                          <p><b>{formatVnd(cart.totals.subtotalAmount)}</b></p>
                        </div>
                      </div>

                      {cart.totals.discountAmount > 0 && (
                        <div className="summary--items">
                          <div className="summary--items-item">
                            <p>{COPY.discount}</p>
                          </div>
                          <div className="summary--items-item text-right">
                            <p className="discount"><b>-{formatVnd(cart.totals.discountAmount)}</b></p>
                          </div>
                        </div>
                      )}

                      <div className="bb-cart-shipping-block">
                        <p>
                          {cart.totals.shippingAmount > 0 ? (
                            <>
                              {COPY.shipping}: <b>{formatVnd(cart.totals.shippingAmount)}</b>
                            </>
                          ) : (
                            COPY.shippingPending
                          )}
                        </p>
                      </div>

                      <div className="wc-proceed-to-checkout">
                        {hasUnavailable ? (
                          <span className="checkout-button button alt wc-forward disabled" aria-disabled="true">
                            {COPY.checkoutProceed}
                          </span>
                        ) : (
                          <Link href={toCheckoutPath()} className="checkout-button button alt wc-forward">
                            {COPY.checkoutProceed}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="promotion">
                    {cart.couponCodes && cart.couponCodes.length > 0 && (
                      <div className="apply-code">
                        {cart.couponCodes.map((code) => (
                          <p key={code}>
                            {code}
                            <button
                              type="button"
                              className="delete"
                              onClick={() => handleRemoveCoupon(code)}
                              disabled={couponLoading}
                              aria-label={`${COPY.removeCoupon} ${code}`}
                            >
                              ×
                            </button>
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="promotion-form">
                      <div>
                        <fieldset>
                          <legend>{COPY.couponLegend}</legend>
                        </fieldset>
                        <div className="form-group">
                          <input
                            type="text"
                            name="coupon_code"
                            className="input-text"
                            id="coupon_code"
                            value={couponInput}
                            placeholder={COPY.couponPlaceholder}
                            onChange={(e) => {
                              setCouponInput(e.target.value);
                              setCouponError("");
                            }}
                            disabled={couponLoading}
                          />
                          <button
                            type="button"
                            className="button"
                            name="apply_coupon"
                            value={COPY.couponApply}
                            disabled={couponLoading || !couponInput.trim()}
                            onClick={(e) => handleApplyCoupon(e)}
                          >
                            {couponLoading ? COPY.couponApplying : COPY.couponApply}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="total-summary summary">
                    <div className="summary--items">
                      <div className="summary--items-item">
                        <p>{COPY.total}</p>
                      </div>
                      <div className="summary--items-item text-right">
                        <p className="total-price">
                          <strong>{formatVnd(cart.totals.totalAmount)}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
