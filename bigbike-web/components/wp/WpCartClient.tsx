"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCartQuery, useRemoveCartItem, useUpdateCartItem } from "@/lib/query/hooks";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { toProductListPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { cartToDrafts } from "./cart/helpers";
import { CartItemRow } from "./cart/CartItemRow";
import { CartSummary } from "./cart/CartSummary";
import { CartSkeleton } from "./cart/CartSkeleton";

/**
 * Nội dung giỏ hàng — port 1:1 markup từ woocommerce/cart/cart.php + cart-totals.php
 * (class .cart-avalable / .table--items / .summary / .total-summary).
 * Đọc/ghi qua useCartQuery/useUpdateCartItem/useRemoveCartItem (lib/query/hooks) —
 * cache React Query dùng chung với badge giỏ hàng ở header (WpCartCount qua
 * lib/cart-context) và trang thanh toán, nên sửa/xoá ở đây cập nhật badge ngay,
 * không cần fetch riêng. WP gốc submit form cho mọi thao tác; bản React drive
 * trực tiếp nên các nút +/- và xoá cập nhật ngay.
 */
export function WpCartClient() {
  const t = useTranslations("CartWp");
  const locale = useLocale() as Locale;
  const cartQuery = useCartQuery();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const cart = cartQuery.data ?? null;
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [syncedCartId, setSyncedCartId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});

  // Seed drafts from the server once per cart load (React's "adjusting state during
  // render" pattern — not an effect, so this can't cascade or clobber an in-progress
  // edit on a refetch triggered by this component's own mutations). Per-item mutations
  // below correct their own draft from the mutation's resolved cart on success.
  if (cart && cart.id !== syncedCartId) {
    setSyncedCartId(cart.id);
    setQuantityDrafts(cartToDrafts(cart));
  }

  useEffect(() => {
    if (!cart) return;
    pushDataLayer("view_cart", {
      currency: cart.currency ?? "VND",
      value: cart.totals.totalAmount,
      items: toGtmCartItems(cart.items),
    });
    // Fire once per cart load (item identity), not on every quantity tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.id]);

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
        const updated = await updateItem.mutateAsync({ itemId, quantity: nextQty });
        const serverQty = updated.items.find((i) => i.id === itemId)?.quantity;
        if (serverQty != null && serverQty !== nextQty) {
          setQuantityDrafts((p) => ({ ...p, [itemId]: serverQty }));
        }
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setItemMutating(itemId, false);
      }
    },
    [quantityDrafts, setItemMutating, updateItem],
  );

  const handleQuantityBlur = useCallback(
    async (itemId: string, currentServerQty: number) => {
      const nextQty = quantityDrafts[itemId] ?? currentServerQty;
      if (nextQty === currentServerQty) return;
      setItemMutating(itemId, true);
      setError("");
      try {
        const updated = await updateItem.mutateAsync({ itemId, quantity: nextQty });
        const serverQty = updated.items.find((i) => i.id === itemId)?.quantity;
        if (serverQty != null && serverQty !== nextQty) {
          setQuantityDrafts((p) => ({ ...p, [itemId]: serverQty }));
        }
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setItemMutating(itemId, false);
      }
    },
    [quantityDrafts, setItemMutating, updateItem],
  );

  const handleRemove = useCallback(
    async (itemId: string) => {
      setItemMutating(itemId, true);
      setError("");
      try {
        await removeItem.mutateAsync(itemId);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setItemMutating(itemId, false);
      }
    },
    [setItemMutating, removeItem],
  );

  const continueHref = toProductListPath(locale);

  if (cartQuery.isLoading) {
    return <CartSkeleton label={t("loadingAria")} />;
  }

  if (!cart) {
    return (
      <>
        <div className="woocommerce-notices-wrapper">
          <div className="woocommerce-error" role="alert">
            {error || (cartQuery.error instanceof Error ? cartQuery.error.message : t("loadFailed"))}
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
      {error && (
        <div className="woocommerce-notices-wrapper">
          <div className="woocommerce-error" role="alert">
            {error}
          </div>
        </div>
      )}

      <div className="row">
        <div className="col-md-8">
          <div className="cart-avalable">
            <h3>{t("cartHeading")}</h3>
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

        <CartSummary cart={cart} hasUnavailable={hasUnavailable} />
      </div>
    </div>
  );
}
