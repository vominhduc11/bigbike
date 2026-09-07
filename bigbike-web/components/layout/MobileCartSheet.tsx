"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, LoaderCircle, ShoppingCart, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/MediaImage";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { trackRemoveFromCart } from "@/lib/analytics";
import {
  useCartQuery,
  useCartMutationPending,
  useRemoveCartItem,
  useUpdateCartItem,
} from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toCheckoutPath, toProductListPath } from "@/lib/utils/routes";
import type { CartItem } from "@/lib/contracts/commerce";
import type { Locale } from "@/i18n/locale";
import { useHeaderUi } from "./HeaderUiContext";

const secondaryAction =
  "min-h-11 rounded-none px-4 py-2 text-[var(--bb-text-inverse)] hover:bg-[var(--bb-bg-surface-dark)] hover:not-disabled:scale-100";

export function MobileCartSheet() {
  const t = useTranslations("CartMini");
  const tCart = useTranslations("CartPage");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const { isPanelOpen, closePanel } = useHeaderUi();
  const open = isPanelOpen("cart");
  const { data: cart, error: cartError, isFetching, isLoading, refetch } = useCartQuery();
  const updateItem = useUpdateCartItem();
  const cartMutationPending = useCartMutationPending();
  const removeItem = useRemoveCartItem();
  const [errorMessage, setErrorMessage] = useState("");
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (open) closePanel({ restoreFocus: false });
  }, [pathname, open, closePanel]);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) closePanel({ restoreFocus: false });
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open, closePanel]);

  async function setQuantity(item: CartItem, quantity: number) {
    if (quantity < 1 || mutationLock.current || cartMutationPending) return;
    mutationLock.current = true;
    setBusyItemId(item.id);
    setErrorMessage("");
    try {
      await updateItem.mutateAsync({ itemId: item.id, quantity });
    } catch {
      setErrorMessage(t("updateFailed"));
    } finally {
      mutationLock.current = false;
      setBusyItemId(null);
    }
  }

  async function removeLine(item: CartItem) {
    if (mutationLock.current || cartMutationPending) return;
    mutationLock.current = true;
    setBusyItemId(item.id);
    setErrorMessage("");
    try {
      await removeItem.mutateAsync(item.id);
      trackRemoveFromCart(item);
    } catch {
      setErrorMessage(t("removeFailed"));
    } finally {
      mutationLock.current = false;
      setBusyItemId(null);
    }
  }

  async function retryLoad() {
    const result = await refetch();
    if (!result.error) setErrorMessage("");
  }

  const items = cart?.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const loading = isLoading || (isFetching && !cart);
  const busy = busyItemId !== null || cartMutationPending;
  const unavailable = items.some((item) => !item.available);
  const error = errorMessage || (cartError ? t("loadFailed") : "");
  const checkoutDisabled = busy || isFetching || unavailable || Boolean(error);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closePanel();
      }}
    >
      <SheetContent
        side="bottom"
        className="z-[var(--bb-mobile-panel-z)] flex max-h-[85dvh] flex-col gap-0 border-[var(--bb-mobile-shell-border)] bg-[var(--bb-mobile-shell-bg)] p-0 text-[var(--bb-text-inverse)] md:hidden [&>button]:right-2 [&>button]:top-2 [&>button]:text-[var(--bb-text-inverse)]"
      >
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--bb-mobile-shell-border)] px-4 py-4 pr-16">
          <SheetTitle className="font-body text-a3-section uppercase text-[var(--bb-text-inverse)]">
            {t("heading")}
          </SheetTitle>
          {!loading && cart ? (
            <span className="font-body text-a5-meta text-[var(--bb-text-inverse-secondary)]">
              {t("itemCount", { count: itemCount })}
            </span>
          ) : null}
          <SheetDescription className="sr-only">{t("description")}</SheetDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {error ? (
            <div
              className="my-3 border border-[var(--bb-state-warning-border)] bg-[var(--bb-state-warning-bg)] p-3 text-a4-content text-[var(--bb-text-inverse)]"
              role="alert"
            >
              <p className="m-0">{error}</p>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 min-h-11 rounded-none border-current px-3 py-2 text-inherit hover:bg-transparent"
                disabled={isFetching || busy}
                onClick={() => void retryLoad()}
              >
                {isFetching ? t("loading") : t("retry")}
              </Button>
            </div>
          ) : null}
          {loading ? (
            <div className="divide-y divide-[var(--bb-mobile-shell-border)]" role="status">
              <span className="sr-only">{t("loading")}</span>
              {[0, 1].map((i) => (
                <div key={i} aria-hidden="true" className="flex gap-3 py-4">
                  <div className="h-18 w-18 shrink-0 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                  <div className="min-w-0 flex-1 py-1">
                    <div className="h-4 w-4/5 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                    <div className="mt-2 h-3 w-2/5 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                    <div className="mt-3 h-4 w-1/2 animate-pulse bg-[var(--bb-mobile-shell-border-strong)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : cart && items.length === 0 ? (
            <div className="grid justify-items-center gap-3 px-3 py-8 text-center">
              <ShoppingCart size={32} className="text-[var(--bb-text-inverse-muted)]" aria-hidden />
              <p className="m-0 font-body text-a3-section font-semibold">{t("empty")}</p>
              <p className="m-0 text-a4-content text-[var(--bb-text-inverse-secondary)]">
                {t("emptyCta")}
              </p>
              <Button asChild className="mt-1 rounded-none px-5 py-3">
                <Link
                  href={toProductListPath(locale)}
                  onClick={() => closePanel({ restoreFocus: false })}
                >
                  {t("shopNow")}
                </Link>
              </Button>
            </div>
          ) : (
            <div
              className="divide-y divide-[var(--bb-mobile-shell-border)]"
              role="list"
              aria-busy={busy}
            >
              {items.map((item) => (
                <article
                  key={item.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 py-4"
                  role="listitem"
                >
                  <div className="flex h-18 w-18 items-center justify-center overflow-hidden bg-background text-foreground">
                    {item.image?.url ? (
                      <MediaImage
                        image={item.image}
                        altFallback={item.productName}
                        width={96}
                        height={96}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="font-body text-a3-section font-semibold">
                        {item.productName.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="relative min-w-0 pr-11">
                    <h3 className="m-0 line-clamp-2 break-words font-body text-a4-content font-semibold leading-title">
                      {item.productName}
                    </h3>
                    {item.variantName ? (
                      <p className="mb-0 mt-1 break-words font-body text-a5-meta text-[var(--bb-text-inverse-secondary)]">
                        {item.variantName}
                      </p>
                    ) : null}
                    {!item.available ? (
                      <p className="mb-0 mt-2 text-a4-content text-brand-on-dark">
                        {t("unavailableLine")}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        secondaryAction,
                        "absolute -right-2 -top-2 h-11 w-11 px-0 text-[var(--bb-text-inverse-muted)]",
                      )}
                      onClick={() => void removeLine(item)}
                      disabled={busy}
                      aria-label={t("removeAria", { name: item.productName })}
                    >
                      <Trash2 size={18} aria-hidden />
                    </Button>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
                    <QuantityStepper
                      variant="mini"
                      value={item.quantity}
                      onDecrease={() => void setQuantity(item, item.quantity - 1)}
                      onIncrease={() => void setQuantity(item, item.quantity + 1)}
                      disabled={busy || !item.available}
                      decreaseDisabled={item.quantity <= 1}
                      decreaseLabel={t("decreaseAria", { name: item.productName })}
                      increaseLabel={t("increaseAria", { name: item.productName })}
                      inputLabel={t("quantityAria", { name: item.productName })}
                    />
                    <strong className="ml-auto whitespace-nowrap font-body text-a4-content tabular-nums text-brand-on-dark">
                      {formatVnd(item.lineTotal)}
                    </strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 ? (
          <div className="shrink-0 border-t border-[var(--bb-mobile-shell-border)] bg-[var(--bb-mobile-shell-surface-2)] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-body text-a4-content">{tCart("total")}</span>
              <strong className="ml-auto whitespace-nowrap font-body text-a2-page tabular-nums">
                {formatVnd(cart?.totals.totalAmount ?? 0)}
              </strong>
            </div>
            <p className="mb-3 mt-1 flex items-center gap-2 font-body text-a5-meta text-[var(--bb-text-inverse-secondary)]">
              <Truck size={16} className="shrink-0" aria-hidden />
              {tCart("shippingPending")}
            </p>
            {unavailable ? (
              <p className="mb-3 mt-0 text-a4-content text-brand-on-dark" role="alert">
                {t("unavailableAlert")}
              </p>
            ) : null}
            {checkoutDisabled ? (
              <Button className="min-h-13 w-full rounded-none px-3 py-3" disabled>
                {busy || isFetching ? (
                  <LoaderCircle size={18} className="shrink-0 animate-spin" aria-hidden />
                ) : null}
                <span role={busy || isFetching ? "status" : undefined}>
                  {busy ? t("updating") : t("checkout")}
                </span>
              </Button>
            ) : (
              <Button asChild className="min-h-13 w-full rounded-none px-3 py-3">
                <Link
                  href={toCheckoutPath(locale)}
                  onClick={() => closePanel({ restoreFocus: false })}
                >
                  {t("checkout")}
                  <ArrowRight size={18} className="shrink-0" aria-hidden />
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              className={cn(secondaryAction, "mt-1 w-full underline underline-offset-4")}
            >
              <Link href={toCartPath(locale)} onClick={() => closePanel({ restoreFocus: false })}>
                {t("viewCart")}
              </Link>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
