"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { fetchCart } from "@/lib/api/client-api";
import type { Cart } from "@/lib/contracts/commerce";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toCheckoutPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 240;
// Kept for reference; Radix HoverCard handles exit animation internally.
const CLOSE_ANIMATION_MS = 200; // eslint-disable-line @typescript-eslint/no-unused-vars

export function CartIcon() {
  const t = useTranslations("Cart");
  const { cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadedCartCount = useRef<number | null>(null);

  const refreshCart = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const nextCart = await fetchCart();
      setCart(nextCart);
      lastLoadedCartCount.current = cartCount ?? null;
    } catch {
      // Mini cart is a convenience surface; keep the current state on transient failures.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cartCount]);

  const loadCart = useCallback(() => {
    if (cart && lastLoadedCartCount.current === (cartCount ?? null)) return;
    void refreshCart();
  }, [cart, cartCount, refreshCart]);

  function handleOpenChange(nextOpen: boolean) {
    // Touch-only devices: block hover-triggered opens to prevent popover
    // flashing from emulated mouse events after tap. Focus-path still works
    // via Radix since touch+keyboard users can focus the trigger.
    if (
      nextOpen &&
      typeof window !== "undefined" &&
      !window.matchMedia("(hover: hover)").matches
    ) {
      return;
    }
    setOpen(nextOpen);
    if (nextOpen) loadCart();
  }

  const badgeCount = cartCount ?? 0;
  const showBadge = badgeCount > 0;

  return (
    <HoverCard
      open={open}
      onOpenChange={handleOpenChange}
      openDelay={HOVER_OPEN_DELAY}
      closeDelay={HOVER_CLOSE_DELAY}
    >
      <HoverCardTrigger asChild>
        <Link
          href={toCartPath()}
          className="bb-cart-icon-link relative flex h-full items-center justify-center px-3.5 text-white no-underline transition-colors duration-fast hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
          aria-label={t("iconAria")}
        >
          <ShoppingCart size={22} strokeWidth={1.8} aria-hidden />
          {showBadge && (
            <span className="absolute -top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </Link>
      </HoverCardTrigger>

      <HoverCardContent
        align="end"
        sideOffset={0}
        className="w-80 p-0 rounded-none border border-border bg-card shadow-lg"
        role="dialog"
        aria-label={t("miniAria")}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide">{t("miniHeading")}</h3>
          <span className="text-xs text-muted-foreground">
            {t("miniItemCount", { count: cartCount ?? 0 })}
          </span>
        </div>

        {loading && !cart ? (
          <div className="flex items-center justify-center px-4 py-8 text-sm text-muted-foreground">
            {t("miniLoading")}
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="m-0 text-sm text-muted-foreground">{t("miniEmpty")}</p>
            <Link
              href="/san-pham/"
              className="text-sm font-bold text-brand no-underline hover:underline"
            >
              {t("viewProducts")}
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
              {cart.items.slice(0, 4).map((item) => (
                <div key={item.id} className="flex gap-3 px-4 py-3">
                  <div className="w-14 h-14 shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                    {item.image?.url ? (
                      <MediaImage
                        image={item.image}
                        altFallback={item.productName}
                        width={56}
                        height={56}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {item.productName.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <p className="m-0 text-sm font-medium line-clamp-2 hover:text-brand">
                      {item.productName}
                    </p>
                    {item.variantName && (
                      <p className="m-0 text-xs text-muted-foreground">{item.variantName}</p>
                    )}
                    <p className="m-0 text-xs text-muted-foreground">
                      {item.quantity} × {formatVnd(item.unitPrice)}
                    </p>
                  </div>
                </div>
              ))}
              {cart.items.length > 4 && (
                <p className="m-0 px-4 py-2 text-xs text-muted-foreground text-center">
                  {t("miniMore", { count: cart.items.length - 4 })}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm font-medium">{t("miniTotal")}</span>
              <b className="text-sm font-bold text-brand">{formatVnd(cart.totals.totalAmount)}</b>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <Button asChild variant="outline" className="flex-1 rounded-none border-border">
                <Link href={toCartPath()}>{t("miniViewCart")}</Link>
              </Button>
              <Button
                asChild
                className="flex-1 rounded-none bg-brand hover:bg-brand-hover text-white"
              >
                <Link href={toCheckoutPath()}>{t("checkoutButton")}</Link>
              </Button>
            </div>
          </>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
