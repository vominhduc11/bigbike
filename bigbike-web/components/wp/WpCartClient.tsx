"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { applyCoupon, fetchCart, removeCoupon, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart } from "@/lib/contracts/commerce";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { toProductListPath } from "@/lib/utils/routes";
import { cartToDrafts } from "./cart/helpers";
import { CartItemRow } from "./cart/CartItemRow";
import { CartSummary } from "./cart/CartSummary";
import { CartSkeleton } from "./cart/CartSkeleton";

/**
 * Nội dung giỏ hàng — port 1:1 markup từ woocommerce/cart/cart.php + cart-totals.php
 * (class .cart-avalable / .table--items / .summary / .promotion-form / .total-summary).
 * Giữ NGUYÊN toàn bộ data/logic thật của bigbike-web (fetchCart, update/remove item,
 * apply/remove coupon, GTM view_cart) — chỉ reskin sang theme WP. WP gốc submit form
 * cho mọi thao tác; bản React drive trực tiếp nên các nút +/- và xoá cập nhật ngay.
 */
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
    return <CartSkeleton label={t("loadingAria")} />;
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

        <CartSummary
          cart={cart}
          hasUnavailable={hasUnavailable}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          setCouponError={setCouponError}
          couponLoading={couponLoading}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={handleRemoveCoupon}
        />
      </div>
    </div>
  );
}
