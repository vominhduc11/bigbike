"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { applyCoupon, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart, CartItem } from "@/lib/contracts/commerce";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toProductListPath, toCheckoutPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Nội dung giỏ hàng — port 1:1 markup từ woocommerce/cart/cart.php + cart-totals.php
 * (class .cart-avalable / .table--items / .summary / .promotion-form / .total-summary).
 * Giữ NGUYÊN toàn bộ data/logic thật của bigbike-web (fetchCart, update/remove item,
 * apply/remove coupon, GTM view_cart) — chỉ reskin sang theme WP. WP gốc submit form
 * cho mọi thao tác; bản React drive trực tiếp nên các nút +/- và xoá cập nhật ngay.
 */

function cartToDrafts(cart: Cart): Record<string, number> {
  return Object.fromEntries(cart.items.map((item) => [item.id, item.quantity]));
}

/* Icon xoá — SVG inline y hệt WP (woocommerce/cart/cart.php a.remove). */
function RemoveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="15" fill="red" aria-hidden="true">
      <path d="M160 400C160 408.8 152.8 416 144 416C135.2 416 128 408.8 128 400V192C128 183.2 135.2 176 144 176C152.8 176 160 183.2 160 192V400zM240 400C240 408.8 232.8 416 224 416C215.2 416 208 408.8 208 400V192C208 183.2 215.2 176 224 176C232.8 176 240 183.2 240 192V400zM320 400C320 408.8 312.8 416 304 416C295.2 416 288 408.8 288 400V192C288 183.2 295.2 176 304 176C312.8 176 320 183.2 320 192V400zM317.5 24.94L354.2 80H424C437.3 80 448 90.75 448 104C448 117.3 437.3 128 424 128H416V432C416 476.2 380.2 512 336 512H112C67.82 512 32 476.2 32 432V128H24C10.75 128 0 117.3 0 104C0 90.75 10.75 80 24 80H93.82L130.5 24.94C140.9 9.357 158.4 0 177.1 0H270.9C289.6 0 307.1 9.358 317.5 24.94H317.5zM151.5 80H296.5L277.5 51.56C276 49.34 273.5 48 270.9 48H177.1C174.5 48 171.1 49.34 170.5 51.56L151.5 80zM80 432C80 449.7 94.33 464 112 464H336C353.7 464 368 449.7 368 432V128H80V432z" />
    </svg>
  );
}

function CartItemRow({
  item,
  draftQuantity,
  isMutating,
  onStep,
  onDraft,
  onBlur,
  onRemove,
}: {
  item: CartItem;
  draftQuantity: number;
  isMutating: boolean;
  onStep: (id: string, dir: 1 | -1) => void;
  onDraft: (id: string, qty: number) => void;
  onBlur: (id: string, serverQty: number) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("CartWp");
  return (
    <div className={`table--items row${isMutating ? " opacity-50" : ""}`} role="listitem">
      <div className="table--items-item col thumbnail">
        {item.image?.url ? (
          <MediaImage image={item.image} altFallback={item.productName} width={130} height={130} />
        ) : (
          <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
        )}
      </div>

      <div className="table--items-item col cart-information">
        <h3>{item.productName}</h3>
        {item.variantName ? <p>{item.variantName}</p> : null}
        <p className="price">
          <b>
            {item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}
          </b>
        </p>
        {!item.available && <p className="backorder_notification">{t("backorderNotice")}</p>}
      </div>

      <div className="table--items-item col quantity">
        {/* Thứ tự chuẩn UX: [-] [ô số] [+] — giảm bên trái, tăng bên phải. */}
        <div className="quantity-form js-quantity-wrap">
          <button
            type="button"
            className="minus js-minus"
            onClick={() => onStep(item.id, -1)}
            disabled={isMutating || !item.available || draftQuantity <= 1}
            aria-label={t("decreaseQtyAria", { name: item.productName })}
          >
            -
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="quantity-input"
            value={draftQuantity}
            onChange={(e) => onDraft(item.id, Number(e.target.value))}
            onBlur={() => onBlur(item.id, item.quantity)}
            disabled={isMutating || !item.available}
            aria-label={t("quantityAria", { name: item.productName })}
          />
          <button
            type="button"
            className="plus js-plus"
            onClick={() => onStep(item.id, 1)}
            disabled={isMutating || !item.available}
            aria-label={t("increaseQtyAria", { name: item.productName })}
          >
            +
          </button>
        </div>
      </div>

      <div className="table--items-item col action">
        <div className="delete text-right">
          <button
            type="button"
            className="remove"
            onClick={() => onRemove(item.id)}
            disabled={isMutating}
            aria-label={t("removeItem")}
          >
            <RemoveIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export function WpCartClient() {
  const t = useTranslations("CartWp");
  const [cart, setCart] = useState<Cart | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
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

  const handleQuantityStep = useCallback(
    async (itemId: string, direction: 1 | -1) => {
      const current = quantityDrafts[itemId] ?? 1;
      const nextQty = Math.max(1, current + direction);
      setQuantityDrafts((p) => ({ ...p, [itemId]: nextQty }));
      setItemMutating(itemId, true);
      setError("");
      try {
        const updated = await updateCartItem(itemId, nextQty);
        syncCart(updated);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setItemMutating(itemId, false);
      }
    },
    [quantityDrafts, setItemMutating, syncCart],
  );

  const handleQuantityBlur = useCallback(
    async (itemId: string, currentServerQty: number) => {
      const nextQty = quantityDrafts[itemId] ?? currentServerQty;
      if (nextQty === currentServerQty) return;
      setItemMutating(itemId, true);
      setError("");
      try {
        const updated = await updateCartItem(itemId, nextQty);
        syncCart(updated);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setItemMutating(itemId, false);
      }
    },
    [quantityDrafts, setItemMutating, syncCart],
  );

  const handleRemove = useCallback(
    async (itemId: string) => {
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
    },
    [setItemMutating, syncCart],
  );

  const handleApplyCoupon = useCallback(
    async (e: React.SyntheticEvent) => {
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
    },
    [couponInput, syncCart],
  );

  const handleRemoveCoupon = useCallback(
    async (code: string) => {
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
    },
    [syncCart],
  );

  const continueHref = toProductListPath();

  if (loading) {
    return (
      <div className="row" aria-busy="true" aria-label={t("loadingAria")}>
        <div className="col-md-8">
          <Skeleton className="mb-30 h-8 w-48" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-4 border-b border-[#cecece] py-[30px]">
              <Skeleton className="h-[110px] w-[110px] shrink-0" />
              <div className="flex-1 space-y-3 pt-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <Skeleton className="h-9 w-[120px]" />
            </div>
          ))}
        </div>
        <div className="col-md-4">
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <>
        <div className="woocommerce-notices-wrapper">
          <div className="woocommerce-error" role="alert">
            {error || t("loadFailed")}
          </div>
        </div>
        <p className="return-to-shop">
          <Link className="button wc-backward" href={continueHref}>
            {t("returnToShop")}
          </Link>
        </p>
      </>
    );
  }

  const hasItems = cart.items.length > 0;
  const hasUnavailable = cart.items.some((i) => !i.available);
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  if (!hasItems) {
    return (
      <>
        {error && (
          <div className="woocommerce-notices-wrapper">
            <div className="woocommerce-error" role="alert">
              {error}
            </div>
          </div>
        )}
        <p className="cart-empty woocommerce-info" role="status">
          {t("emptyMessage")}
        </p>
        <p className="return-to-shop">
          <Link className="button wc-backward" href={continueHref}>
            {t("returnToShop")}
          </Link>
        </p>
      </>
    );
  }

  return (
    <div className="woocommerce-cart-form">
      {(error || couponError) && (
        <div className="woocommerce-notices-wrapper">
          {error && (
            <div className="woocommerce-error" role="alert">
              {error}
            </div>
          )}
          {couponError && (
            <div className="woocommerce-error" role="alert">
              {couponError}
            </div>
          )}
        </div>
      )}

      <div className="row">
        <div className="col-md-8">
          <div className="cart-avalable">
            <h3>
              {t("cartHeading")}{" "}
              <span>
                <b>{itemCount}</b>
              </span>
            </h3>
          </div>

          <div className="table" role="list">
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                draftQuantity={quantityDrafts[item.id] ?? item.quantity}
                isMutating={Boolean(mutating[item.id])}
                onStep={handleQuantityStep}
                onDraft={handleQuantityDraft}
                onBlur={handleQuantityBlur}
                onRemove={handleRemove}
              />
            ))}
          </div>

          <div className="check-out">
            <div className="row align-items-center">
              <div className="col">
                <Link className="btn btn-continue-shopping" href={continueHref}>
                  <ChevronLeft size={16} strokeWidth={2} className="inline-block align-middle" aria-hidden="true" />{" "}
                  {t("continueShopping")}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="summary">
            <div className="cart_totals">
              <h2>{t("totalsHeading")}</h2>

              <div className="summary--items row">
                <div className="summary--items-item col">
                  <p>{t("subtotal")}</p>
                </div>
                <div className="summary--items-item col text-right">
                  <p>
                    <b>{formatVnd(cart.totals.subtotalAmount)}</b>
                  </p>
                </div>
              </div>

              {cart.totals.discountAmount > 0 && (
                <div className="summary--items row cart-discount">
                  <div className="summary--items-item col">
                    <p>{t("discount")}</p>
                  </div>
                  <div className="summary--items-item col text-right">
                    <p className="discount">
                      <b>-{formatVnd(cart.totals.discountAmount)}</b>
                    </p>
                  </div>
                </div>
              )}

              {cart.totals.shippingAmount > 0 ? (
                <div className="summary--items row">
                  <div className="summary--items-item col">
                    <p>{t("shipping")}</p>
                  </div>
                  <div className="summary--items-item col text-right">
                    <p>
                      <b>{formatVnd(cart.totals.shippingAmount)}</b>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="summary--items row">
                  <div className="summary--items-item col">
                    <p className="text-12 italic leading-snug">{t("shippingPending")}</p>
                  </div>
                </div>
              )}

              <div className="wc-proceed-to-checkout">
                {hasUnavailable ? (
                  <span
                    className="checkout-button button alt wc-forward opacity-50 pointer-events-none"
                    aria-disabled="true"
                  >
                    {t("checkoutSubmit")}
                  </span>
                ) : (
                  <Link className="checkout-button button alt wc-forward" href={toCheckoutPath()}>
                    {t("checkoutSubmit")}
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
                    {code}{" "}
                    <span className="delete">
                      <button
                        type="button"
                        onClick={() => handleRemoveCoupon(code)}
                        disabled={couponLoading}
                        aria-label={`${t("removeCoupon")} ${code}`}
                      >
                        ×
                      </button>
                    </span>
                  </p>
                ))}
              </div>
            )}

            <div className="promotion-form">
              <form onSubmit={handleApplyCoupon}>
                <fieldset>
                  <legend>{t("couponLegend")}</legend>
                </fieldset>
                <div className="form-group">
                  <input
                    type="text"
                    name="coupon_code"
                    id="coupon_code"
                    value={couponInput}
                    placeholder={t("couponPlaceholder")}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      setCouponError("");
                    }}
                    disabled={couponLoading}
                  />
                  <button
                    type="submit"
                    name="apply_coupon"
                    disabled={couponLoading || !couponInput.trim()}
                  >
                    {couponLoading ? t("couponApplying") : t("couponApply")}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="total-summary summary">
            <div className="summary--items row">
              <div className="summary--items-item col">
                <p>{t("total")}</p>
              </div>
              <div className="summary--items-item col text-right">
                <p className="total-price">{formatVnd(cart.totals.totalAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
