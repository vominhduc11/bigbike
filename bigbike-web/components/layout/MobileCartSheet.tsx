"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShoppingCart, Trash2 } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";
import type { CartItem } from "@/lib/contracts/commerce";
import { useCartQuery, useRemoveCartItem, useUpdateCartItem } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toCheckoutPath, toProductListPath } from "@/lib/utils/routes";
import { useHeaderUi } from "./HeaderUiContext";

// Dark-shell micro label (GIỎ HÀNG / TỔNG TẠM TÍNH / line SKU)
const microLabel =
  "m-0 font-cta text-ui-10 font-semibold uppercase tracking-normal text-[var(--bb-text-inverse-muted)]";
// Shared CTA button chrome (empty link / primary / secondary)
const ctaBtn =
  "inline-flex min-h-11 items-center justify-center px-4 font-cta text-ui-13 font-semibold uppercase tracking-normal no-underline";
const ctaBtnFilled = "border border-[var(--bb-brand-primary)] bg-brand text-[var(--bb-text-inverse)]";
const qtyBtn =
  "inline-flex h-11 w-11 items-center justify-center border-0 bg-transparent cursor-pointer disabled:cursor-not-allowed disabled:opacity-45";
const lineMeta = "mt-1 text-ui-12 leading-[1.25]";

function CartSheetThumb({ item }: { item: CartItem }) {
  return (
    <div className="relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden bg-[var(--bb-bg-surface)] text-[var(--bb-text-primary)] [&_img]:h-full [&_img]:w-full [&_img]:object-contain">
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={96} height={96} />
      ) : (
        <span className="bb-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

export function MobileCartSheet() {
  const t = useTranslations("CartMini");
  const { isPanelOpen, openPanel, closePanel } = useHeaderUi();
  const { refreshCount } = useCart();
  const open = isPanelOpen("cart");
  const {
    data: cart,
    error: cartError,
    isFetching,
    isLoading,
    refetch,
  } = useCartQuery();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    void refetch();
  }, [open, refetch]);

  async function setQuantity(item: CartItem, quantity: number) {
    if (quantity < 1 || updateItem.isPending || removeItem.isPending) return;
    setErrorMessage("");

    try {
      await updateItem.mutateAsync({ itemId: item.id, quantity });
      refreshCount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("updateFailed"));
    }
  }

  async function removeLine(item: CartItem) {
    if (updateItem.isPending || removeItem.isPending) return;
    setErrorMessage("");

    try {
      await removeItem.mutateAsync(item.id);
      refreshCount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("removeFailed"));
    }
  }

  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const loading = isLoading || (open && isFetching && !cart);
  const queryError = cartError instanceof Error ? cartError.message : "";
  const unavailable = items.some((item) => !item.available);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setErrorMessage("");
          openPanel("cart");
        } else {
          closePanel();
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="md:hidden flex flex-col gap-0 p-0 text-[var(--bb-text-inverse)] bg-[var(--bb-mobile-shell-bg)] border-[var(--bb-mobile-shell-border)] z-[var(--bb-mobile-panel-z)] max-h-[min(84dvh,calc(100dvh_-_max(24px,env(safe-area-inset-top))))] [&>button]:top-[11px] [&>button]:right-[10px] [&>button]:h-11 [&>button]:w-11 [&>button]:text-[var(--bb-text-inverse)]"
      >
        <div className="mx-auto mt-2 h-1 w-9 flex-none bg-[var(--bb-mobile-shell-border-strong)]" aria-hidden="true" />
        <div className="px-[14px] pt-3 pb-2 border-b border-[var(--bb-mobile-shell-border)]">
          <div>
            <p className={microLabel}>{t("heading")}</p>
            <SheetTitle className="text-[var(--bb-text-inverse)]">
              {itemCount > 0 ? t("itemCount", { count: itemCount }) : t("empty")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("description")}
            </SheetDescription>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-[18px] py-[14px] [-webkit-overflow-scrolling:touch]">
          {loading ? (
            <div className="grid gap-[10px]" role="status">
              <span className="sr-only">{t("loading")}</span>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="flex gap-3 border border-[var(--bb-mobile-shell-border)] bg-[var(--bb-mobile-shell-surface)] p-[10px]"
                >
                  <div className="h-[72px] w-[72px] flex-none animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                  <div className="min-w-0 flex-1 py-1">
                    <div className="h-3 w-3/5 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                    <div className="mt-2 h-3 w-2/5 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                    <div className="mt-3 h-7 w-24 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : queryError || errorMessage ? (
            <div
              className="py-11 px-[18px] text-center text-[var(--bb-text-inverse)] border border-[var(--bb-border-brand)] bg-[color-mix(in_srgb,var(--bb-brand-primary)_12%,transparent)]"
              role="alert"
            >
              {errorMessage || queryError}
            </div>
          ) : items.length === 0 ? (
            <div className="grid justify-items-center pt-9 px-3 pb-[42px] text-center text-[var(--bb-text-inverse-muted)]">
              <span
                className="inline-flex h-16 w-16 items-center justify-center mb-[14px] border border-[var(--bb-mobile-shell-border)] bg-[var(--bb-mobile-shell-surface)] text-[var(--bb-text-inverse-muted)]"
                aria-hidden="true"
              >
                <ShoppingCart size={28} />
              </span>
              <p className="mt-[6px] mb-4">{t("emptyCta")}</p>
              <Link href={toProductListPath()} onClick={closePanel} className={cn(ctaBtn, ctaBtnFilled, "mt-[2px]")}>
                {t("shopNow")}
              </Link>
            </div>
          ) : (
            <div className="grid gap-[10px]" role="list">
              {items.map((item) => {
                const mutating = updateItem.isPending || removeItem.isPending;
                return (
                  <article
                    key={item.id}
                    className="relative flex gap-3 border border-[var(--bb-mobile-shell-border)] bg-[var(--bb-mobile-shell-surface)] p-[10px]"
                    role="listitem"
                  >
                    <CartSheetThumb item={item} />
                    <div className="min-w-0 flex-1">
                      <p className={microLabel}>{item.sku || "BIGBIKE"}</p>
                      <h3 className="mt-[2px] mr-7 line-clamp-2 font-cta text-ui-13 font-medium leading-[1.2] text-[var(--bb-text-inverse)]">
                        {item.productName}
                      </h3>
                      {item.variantName ? (
                        <p className={cn(lineMeta, "capitalize text-[var(--bb-text-inverse-muted)]")}>{item.variantName}</p>
                      ) : null}
                      {!item.available ? (
                        <p className={cn(lineMeta, "text-brand-on-dark")}>{t("unavailableLine")}</p>
                      ) : null}
                      <div className="flex items-center justify-between gap-[10px] mt-2">
                        <div className="inline-flex border border-[var(--bb-mobile-shell-border-strong)]" aria-label={t("quantityAria", { name: item.productName })}>
                          <button
                            type="button"
                            className={cn(qtyBtn, "text-[var(--bb-text-inverse)]")}
                            onClick={() => setQuantity(item, item.quantity - 1)}
                            disabled={mutating || item.quantity <= 1 || !item.available}
                            aria-label={t("decreaseAria", { name: item.productName })}
                          >
                            -
                          </button>
                          <span className="inline-flex min-w-[30px] items-center justify-center text-[var(--bb-text-inverse)] text-ui-13">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className={cn(qtyBtn, "text-[var(--bb-text-inverse)]")}
                            onClick={() => setQuantity(item, item.quantity + 1)}
                            disabled={mutating || !item.available}
                            aria-label={t("increaseAria", { name: item.productName })}
                          >
                            +
                          </button>
                        </div>
                        <strong className="text-brand-on-dark font-body text-ui-14">{formatVnd(item.lineTotal)}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={cn(qtyBtn, "absolute top-[6px] right-[6px] text-[var(--bb-text-inverse-muted)]")}
                      onClick={() => removeLine(item)}
                      disabled={mutating}
                      aria-label={t("removeAria", { name: item.productName })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <div className="flex-none pt-3 px-[18px] pb-[max(16px,env(safe-area-inset-bottom))] border-t border-[var(--bb-mobile-shell-border)] bg-[var(--bb-mobile-shell-surface-2)]">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <span className={microLabel}>{t("subtotal")}</span>
              <strong className="text-[var(--bb-text-inverse)] font-body text-ui-22">
                {formatVnd(cart?.totals.totalAmount ?? 0)}
              </strong>
            </div>
            {unavailable ? (
              <p
                className="mt-[-2px] mb-3 border border-[var(--bb-state-warning-border)] bg-[var(--bb-state-warning-bg)] px-3 py-[10px] text-[var(--bb-state-warning-text)] text-ui-13 leading-[1.35]"
                role="alert"
              >
                {t("unavailableAlert")}
              </p>
            ) : null}
            <div className={cn("grid gap-2", unavailable ? "grid-cols-2" : "grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]")}>
              <Link
                href={toCartPath()}
                className={cn(ctaBtn, "border border-[var(--bb-mobile-shell-border-strong)] text-[var(--bb-text-inverse)]")}
                onClick={closePanel}
              >
                {t("viewCart")}
              </Link>
              {unavailable ? (
                <span
                  className={cn(
                    ctaBtn,
                    "cursor-not-allowed border border-[var(--bb-mobile-shell-border-strong)] bg-[var(--bb-mobile-shell-surface)] text-[var(--bb-text-inverse-muted)]",
                  )}
                  aria-disabled="true"
                >
                  {t("checkout")}
                </span>
              ) : (
                <Link href={toCheckoutPath()} className={cn(ctaBtn, ctaBtnFilled)} onClick={closePanel}>
                  {t("checkout")}
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
