"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { applyCoupon, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath, toProductListPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { CartSkeleton } from "@/components/ui/Skeletons";
import { ErrorState } from "@/components/ui/ErrorState";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="bb-cart-item-thumb">
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={144} height={144} />
      ) : (
        <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

export default function CartPage() {
  const t = useTranslations("Cart");
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

  if (!cart) {
    return (
      <div className="bb-cart-page bb-container">
        <ErrorState
          title={t("loadFailedTitle")}
          message={error || t("loadFailedMessage")}
          retryHref="/gio-hang/"
        />
      </div>
    );
  }

  const hasItems = cart && cart.items.length > 0;
  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <div className="bb-cart-page bb-container">
      {error && <p className="bb-error-text">{error}</p>}

        <div className="bb-cart-grid">
          <div className="bb-cart-main">
            {!hasItems ? (
              <div className="bb-cart-empty">
                <b>{t("emptyHeading")}</b>
                <p>{t("emptyDescription")}</p>
                <Button asChild variant="primary">
                  <Link href={toProductListPath()}>{t("viewProducts")}</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="bb-cart-avalable">
                  <h3>
                    {t("yourCartWithCount")} <span><b>{String(itemCount).padStart(2, "0")}</b></span>
                  </h3>
                </div>

                <div className="bb-cart-table">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className={`bb-cart-row${mutating[item.id] ? " opacity-50" : ""}`}
                    >
                      <div className="bb-cart-row-thumb">
                        <CartItemThumb item={item} />
                      </div>

                      <div className="bb-cart-row-info">
                        <h3>{item.productName}</h3>
                        {item.variantName && <p className="bb-cart-row-meta">{item.variantName}</p>}
                        <p className="bb-cart-row-price">
                          <b>
                            {item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
                          </b>
                        </p>
                      </div>

                      <div className="bb-cart-row-qty">
                        <QuantityStepper
                          value={item.quantity}
                          onChange={(qty) => handleQuantityChange(item.id, qty)}
                          min={1}
                          disabled={mutating[item.id]}
                          ariaLabel={t("rowQuantityAria", { productName: item.productName })}
                        />
                      </div>

                      <div className="bb-cart-row-action">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="bb-cart-row-remove"
                          onClick={() => handleRemove(item.id)}
                          disabled={mutating[item.id]}
                          aria-label={t("removeItemAria")}
                        >
                          <svg width="15" height="15" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
                            <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {hasItems && <aside className="bb-cart-side">
            <div className="bb-cart-summary">
              <div className="bb-cart-summary-row">
                <p>{t("summarySubtotal")}</p>
                <p><b>{cart ? formatVnd(cart.totals.subtotalAmount) : "0"}</b></p>
              </div>
              {cart && cart.totals.discountAmount > 0 && (
                <div className="bb-cart-summary-row">
                  <p>{t("summaryDiscount")}</p>
                  <p className="discount"><b>-{formatVnd(cart.totals.discountAmount)}</b></p>
                </div>
              )}
              <div className="bb-cart-summary-row">
                <p>{t("summaryShipping")}</p>
                <p><b>{formatVnd(cart.totals.shippingAmount)}</b></p>
              </div>
            </div>

            <div className="bb-cart-promotion">
              {cart?.couponCodes && cart.couponCodes.length > 0 && (
                <div className="bb-cart-applied-codes">
                  {cart.couponCodes.map((code) => (
                    <div key={code} className="bb-cart-applied-code">
                      <span className="bb-cart-applied-label">{code}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="bb-cart-applied-remove"
                        onClick={() => handleRemoveCoupon(code)}
                        disabled={couponLoading}
                        aria-label={t("removeCouponAria")}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
                        </svg>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <form className="bb-cart-promo-form" onSubmit={handleApplyCoupon}>
                <label htmlFor="cart-coupon-input" className="bb-cart-promo-label">
                  {t("couponLabel")}
                </label>
                <div className="bb-cart-promo-group">
                  <Input
                    id="cart-coupon-input"
                    type="text"
                    placeholder={t("couponPlaceholder")}
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value); setCouponError(""); }}
                    disabled={couponLoading}
                  />
                  <Button type="submit" variant="primary" disabled={couponLoading || !couponInput.trim()}>
                    {couponLoading ? t("couponApplying") : t("couponApply")}
                  </Button>
                </div>
                {couponError && <p className="bb-cart-coupon-error">{couponError}</p>}
              </form>
            </div>

            <div className="bb-cart-total-summary">
              <div className="bb-cart-summary-row">
                <p>{t("summaryTotal")}</p>
                <p className="bb-cart-total-price">
                  <b>{cart ? formatVnd(cart.totals.totalAmount) : "0"}</b>
                </p>
              </div>
            </div>
          </aside>}

          {hasItems && (
            <div className="bb-cart-checkout-row">
              <Link href={toProductListPath()} className="bb-cart-continue">
                <span aria-hidden="true">‹</span> {t("continueShoppingButton")}
              </Link>
              <Button asChild variant="primary" className="bb-cart-checkout-btn">
                <Link href={toCheckoutPath()}>{t("checkoutButton")}</Link>
              </Button>
            </div>
          )}
        </div>

      {hasItems && (
        <div className="bb-cart-mobile-bar">
          <div className="bb-cart-mobile-bar-total">
            <span>{t("summaryTotal")}</span>
            <b>{formatVnd(cart.totals.totalAmount)}</b>
          </div>
          <Button asChild variant="primary" className="bb-cart-mobile-bar-btn">
            <Link href={toCheckoutPath()}>{t("checkoutButton")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
