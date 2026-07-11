"use client";

import Link from "next/link";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCartQuery, useRemoveCartItem, useUpdateCartItem } from "@/lib/query/hooks";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { toProductListPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";
import { cartToDrafts } from "./parts/helpers";
import { CartItemRow } from "./parts/CartItemRow";
import { CartSummary } from "./parts/CartSummary";
import { CartSkeleton } from "./parts/CartSkeleton";

/**
 * Nội dung giỏ hàng — port 1:1 markup từ woocommerce/cart/cart.php + cart-totals.php
 * (class .cart-avalable / .table--items / .summary / .total-summary).
 * Đọc/ghi qua useCartQuery/useUpdateCartItem/useRemoveCartItem (lib/query/hooks) —
 * cache React Query dùng chung với badge giỏ hàng ở header (HeaderCartCount qua
 * lib/cart-context) và trang thanh toán, nên sửa/xoá ở đây cập nhật badge ngay,
 * không cần fetch riêng. Bản gốc submit form cho mọi thao tác; bản React drive
 * trực tiếp nên các nút +/- và xoá cập nhật ngay.
 */
export function CartClient() {
  const t = useTranslations("CartPage");
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
        <div className="border border-destructive bg-accent p-5 text-destructive" role="alert">
          {error || (cartQuery.error instanceof Error ? cartQuery.error.message : t("loadFailed"))}
        </div>
        <Button asChild variant="primary" className="mt-6 rounded-none">
          <Link href={continueHref}>{t("returnToShop")}</Link>
        </Button>
      </>
    );
  }

  const hasItems = cart.items.length > 0;
  const hasUnavailable = cart.items.some((i) => !i.available);

  if (!hasItems) {
    return (
      <>
        {error && (
          <div className="border border-destructive bg-accent p-5 text-destructive" role="alert">
            {error}
          </div>
        )}
        <div className="grid justify-items-center border border-border bg-secondary px-6 py-14 text-center" role="status">
          <span
            className="mb-5 inline-flex h-16 w-16 items-center justify-center border border-border bg-background text-muted-foreground"
            aria-hidden="true"
          >
            <ShoppingCart size={30} strokeWidth={1.5} />
          </span>
          <p className="m-0 font-cta text-a2-page font-semibold uppercase">{t("emptyMessage")}</p>
          <Button asChild variant="primary" className="mt-6 rounded-none">
            <Link href={continueHref}>{t("returnToShop")}</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <div
      data-cart-content
      /* Mobile: footer ẩn (FooterMobileGate) + thanh tổng tiền dính đáy
         (data-cart-mobile-checkout ≈ nút 52px + py-3 12px + border 1px +
         max(12px,safe) ≈ 65px + safe). Chừa theo "vùng an toàn" đáy máy + 12px
         thở để thanh không che nội dung trên iPhone tai thỏ. */
      className="[padding-bottom:calc(64px+max(12px,env(safe-area-inset-bottom))+12px)] md:pb-0"
    >
      {error && (
        <div className="mb-6 border border-destructive bg-accent p-5 text-destructive" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-12">
        <div className="min-w-0 md:col-span-8">
          <div className="divide-y divide-border border-y border-border" role="list">
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

          <Button asChild variant="outline" className="mt-6 rounded-none">
            <Link href={continueHref}>
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              {t("continueShopping")}
            </Link>
          </Button>
        </div>

        <CartSummary cart={cart} hasUnavailable={hasUnavailable} />
      </div>
    </div>
  );
}
