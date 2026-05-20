"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart-context";
import { fetchCart } from "@/lib/api/client-api";
import type { Cart } from "@/lib/contracts/commerce";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toCheckoutPath } from "@/lib/utils/routes";

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 240;
const CLOSE_ANIMATION_MS = 200;

export function CartIcon() {
  const t = useTranslations("Cart");
  const { cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const lastLoadedCartCount = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (closeAnimTimer.current) clearTimeout(closeAnimTimer.current);
  }, []);

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

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimer.current = setTimeout(() => {
      setClosing(false);
      setOpen(true);
      loadCart();
    }, HOVER_OPEN_DELAY);
  }, [clearTimers, loadCart]);

  function handleHoverEnter() {
    // Touch-only devices không có hover thật — bỏ qua để tránh popover bật/tắt do
    // emulated mouse event khi tap; tap vào icon vẫn điều hướng sang /cart như cũ.
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) {
      return;
    }
    scheduleOpen();
  }

  function handleFocusEnter() {
    scheduleOpen();
  }

  function handleLeave() {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setClosing(true);
      closeAnimTimer.current = setTimeout(() => {
        setOpen(false);
        setClosing(false);
      }, CLOSE_ANIMATION_MS);
    }, HOVER_CLOSE_DELAY);
  }

  useEffect(() => clearTimers, [clearTimers]);

  const badgeCount = cartCount ?? 0;
  const showBadge = badgeCount > 0;

  return (
    <div
      className="bb-cart-icon-wrap"
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleLeave}
      onFocus={handleFocusEnter}
      onBlur={handleLeave}
    >
      <Link href={toCartPath()} className="bb-cart-icon-link" aria-label={t("iconAria")}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {showBadge && (
          <span className="bb-cart-badge">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>

      {open && (
        <div
          className="bb-mini-cart-popover"
          data-state={closing ? "closing" : "open"}
          role="dialog"
          aria-label={t("miniAria")}
        >
          <div className="bb-mini-cart-arrow" aria-hidden="true" />
          <div className="bb-mini-cart-head">
            <h3>{t("miniHeading")}</h3>
            <span className="bb-mini-cart-count">{t("miniItemCount", { count: cartCount ?? 0 })}</span>
          </div>

          {loading && !cart ? (
            <div className="bb-mini-cart-loading">{t("miniLoading")}</div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="bb-mini-cart-empty">
              <p>{t("miniEmpty")}</p>
              <Link href="/san-pham/" className="bb-mini-cart-shop">
                {t("viewProducts")}
              </Link>
            </div>
          ) : (
            <>
              <div className="bb-mini-cart-list">
                {cart.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="bb-mini-cart-item">
                    <div className="bb-mini-cart-thumb">
                      {item.image?.url ? (
                        <MediaImage image={item.image} altFallback={item.productName} width={56} height={56} />
                      ) : (
                        <span>{item.productName.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="bb-mini-cart-info">
                      <p className="bb-mini-cart-name">{item.productName}</p>
                      {item.variantName && (
                        <p className="bb-mini-cart-variant">{item.variantName}</p>
                      )}
                      <p className="bb-mini-cart-qty">
                        {item.quantity} × {formatVnd(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
                {cart.items.length > 4 && (
                  <p className="bb-mini-cart-more">
                    {t("miniMore", { count: cart.items.length - 4 })}
                  </p>
                )}
              </div>

              <div className="bb-mini-cart-total">
                <span>{t("miniTotal")}</span>
                <b>{formatVnd(cart.totals.totalAmount)}</b>
              </div>

              <div className="bb-mini-cart-actions">
                <Link href={toCartPath()} className="bb-mini-cart-btn-secondary">
                  {t("miniViewCart")}
                </Link>
                <Link href={toCheckoutPath()} className="bb-mini-cart-btn-primary">
                  {t("checkoutButton")}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
