"use client";

import Link from "@/i18n/StorefrontLink";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCartQuery,
  useCartMutationPending,
  useRemoveCartItem,
  useUpdateCartItem,
} from "@/lib/query/hooks";
import { trackRemoveFromCart, trackViewCart } from "@/lib/analytics";
import { toProductListPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import type { Cart } from "@/lib/contracts/commerce";
import { Button } from "@/components/ui/button";
import { cartToDrafts } from "./parts/helpers";
import { CartItemRow } from "./parts/CartItemRow";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";
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
  const cartMutationPending = useCartMutationPending();
  const removeItem = useRemoveCartItem();
  const cart = cartQuery.data ?? null;
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, number>>({});
  const [syncedCart, setSyncedCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const mutationLock = useRef(false);
  const busy = Object.values(mutating).some(Boolean) || cartMutationPending;
  const displayError = error || (cartQuery.error ? t("loadFailed") : "");

  // A refreshed cart can keep its ID while quantities change in another view.
  // Synchronize drafts only when the server-confirmed snapshot changes.
  if (cart && cart !== syncedCart) {
    setSyncedCart(cart);
    setQuantityDrafts(cartToDrafts(cart));
  }

  useEffect(() => {
    if (!cart) return;
    trackViewCart(cart);
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
      if (mutationLock.current || cartMutationPending) return;
      const confirmedQty = cart?.items.find((item) => item.id === itemId)?.quantity ?? 1;
      const current = quantityDrafts[itemId] ?? 1;
      const nextQty = Math.max(1, current + direction);
      mutationLock.current = true;
      setQuantityDrafts((p) => ({ ...p, [itemId]: nextQty }));
      setItemMutating(itemId, true);
      setError("");
      try {
        const updated = await updateItem.mutateAsync({ itemId, quantity: nextQty });
        const serverQty = updated.items.find((i) => i.id === itemId)?.quantity;
        if (serverQty != null && serverQty !== nextQty) {
          setQuantityDrafts((p) => ({ ...p, [itemId]: serverQty }));
        }
      } catch (error) {
        reportStorefrontFailure("add_to_cart", error);
        setQuantityDrafts((p) => ({ ...p, [itemId]: confirmedQty }));
        setError(t("updateFailed"));
      } finally {
        mutationLock.current = false;
        setItemMutating(itemId, false);
      }
    },
    [cart, cartMutationPending, quantityDrafts, setItemMutating, t, updateItem],
  );

  const handleQuantityBlur = useCallback(
    async (itemId: string, currentServerQty: number) => {
      if (mutationLock.current || cartMutationPending) return;
      const nextQty = quantityDrafts[itemId] ?? currentServerQty;
      if (nextQty === currentServerQty) return;
      mutationLock.current = true;
      setItemMutating(itemId, true);
      setError("");
      try {
        const updated = await updateItem.mutateAsync({ itemId, quantity: nextQty });
        const serverQty = updated.items.find((i) => i.id === itemId)?.quantity;
        if (serverQty != null && serverQty !== nextQty) {
          setQuantityDrafts((p) => ({ ...p, [itemId]: serverQty }));
        }
      } catch (error) {
        reportStorefrontFailure("add_to_cart", error);
        setQuantityDrafts((p) => ({ ...p, [itemId]: currentServerQty }));
        setError(t("updateFailed"));
      } finally {
        mutationLock.current = false;
        setItemMutating(itemId, false);
      }
    },
    [cartMutationPending, quantityDrafts, setItemMutating, t, updateItem],
  );

  const handleRemove = useCallback(
    async (itemId: string) => {
      if (mutationLock.current || cartMutationPending) return;
      mutationLock.current = true;
      // Read the line before the mutation: once it is gone from the cart there is nothing
      // left to describe to analytics.
      const removed = cart?.items.find((i) => i.id === itemId);
      setItemMutating(itemId, true);
      setError("");
      try {
        await removeItem.mutateAsync(itemId);
        if (removed) trackRemoveFromCart(removed);
      } catch {
        setError(t("removeFailed"));
      } finally {
        mutationLock.current = false;
        setItemMutating(itemId, false);
      }
    },
    [cart, cartMutationPending, setItemMutating, removeItem, t],
  );

  const continueHref = toProductListPath(locale);
  const hasUnsavedQuantity =
    cart?.items.some((item) => (quantityDrafts[item.id] ?? item.quantity) !== item.quantity) ??
    false;
  const checkoutBlocked =
    busy || cartQuery.isFetching || hasUnsavedQuantity || Boolean(displayError);
  const retryLoad = async () => {
    const result = await cartQuery.refetch();
    if (!result.error) setError("");
  };
  const errorNotice = displayError ? (
    <div className="mb-6 border border-destructive bg-accent p-5 text-destructive" role="alert">
      <p className="m-0">{displayError}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 rounded-none"
        onClick={() => void retryLoad()}
        disabled={busy || cartQuery.isFetching}
      >
        {t("retry")}
      </Button>
    </div>
  ) : null;

  if (cartQuery.isLoading) {
    return <CartSkeleton label={t("loadingAria")} />;
  }

  if (!cart) {
    return (
      <>
        {errorNotice}
        <Button asChild variant="primary" className="mt-6 rounded-none text-primary-foreground!">
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
        {errorNotice}
        <div
          className="grid justify-items-center border border-border bg-secondary px-6 py-14 text-center"
          role="status"
        >
          <span
            className="mb-5 inline-flex h-16 w-16 items-center justify-center border border-border bg-background text-muted-foreground"
            aria-hidden="true"
          >
            <ShoppingCart size={30} strokeWidth={1.5} />
          </span>
          <p className="m-0 font-body text-a2-page font-semibold">{t("emptyMessage")}</p>
          <Button asChild variant="primary" className="mt-6 rounded-none text-primary-foreground!">
            <Link href={continueHref}>{t("returnToShop")}</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <div data-cart-content className="pb-[calc(144px+env(safe-area-inset-bottom))] md:pb-0">
      {errorNotice}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div
            className="divide-y divide-border border-y border-border"
            role="list"
            aria-busy={busy}
          >
            {cart.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                draftQuantity={quantityDrafts[item.id] ?? item.quantity}
                isMutating={busy}
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

        <CartSummary
          cart={cart}
          hasUnavailable={hasUnavailable}
          checkoutBlocked={checkoutBlocked}
          isUpdating={busy}
        />
      </div>
    </div>
  );
}
