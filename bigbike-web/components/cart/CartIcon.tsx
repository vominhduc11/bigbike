"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { fetchCart } from "@/lib/api/client-api";
import type { Cart } from "@/lib/contracts/commerce";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toCheckoutPath } from "@/lib/utils/routes";

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 240;

export function CartIcon() {
  const { cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const loadCart = useCallback(() => {
    if (loading || cart) return;
    setLoading(true);
    fetchCart()
      .then(setCart)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loading, cart]);

  // Re-fetch when cartCount changes (item added/removed elsewhere)
  useEffect(() => {
    if (open && cartCount != null) {
      setLoading(true);
      fetchCart()
        .then(setCart)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartCount]);

  function handleEnter() {
    clearTimers();
    openTimer.current = setTimeout(() => {
      setOpen(true);
      loadCart();
    }, HOVER_OPEN_DELAY);
  }

  function handleLeave() {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
  }

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div
      className="wp-cart-icon-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <Link href={toCartPath()} className="bb-cart-icon-link" aria-label="Giỏ hàng">
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
        <span className="bb-cart-badge">
          {cartCount == null ? 0 : cartCount > 99 ? "99+" : cartCount}
        </span>
      </Link>

      {open && (
        <div className="wp-mini-cart-popover" role="dialog" aria-label="Giỏ hàng nhanh">
          <div className="wp-mini-cart-arrow" aria-hidden="true" />
          <div className="wp-mini-cart-head">
            <h3>GIỎ HÀNG</h3>
            <span className="wp-mini-cart-count">{cartCount ?? 0} sản phẩm</span>
          </div>

          {loading && !cart ? (
            <div className="wp-mini-cart-loading">Đang tải...</div>
          ) : !cart || cart.items.length === 0 ? (
            <div className="wp-mini-cart-empty">
              <p>Giỏ hàng trống</p>
              <Link href="/san-pham/" className="wp-mini-cart-shop">
                Xem sản phẩm
              </Link>
            </div>
          ) : (
            <>
              <div className="wp-mini-cart-list">
                {cart.items.slice(0, 4).map((item) => (
                  <div key={item.id} className="wp-mini-cart-item">
                    <div className="wp-mini-cart-thumb">
                      {item.image?.url ? (
                        <MediaImage image={item.image} altFallback={item.productName} width={56} height={56} />
                      ) : (
                        <span>{item.productName.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="wp-mini-cart-info">
                      <p className="wp-mini-cart-name">{item.productName}</p>
                      {item.variantName && (
                        <p className="wp-mini-cart-variant">{item.variantName}</p>
                      )}
                      <p className="wp-mini-cart-qty">
                        {item.quantity} × {formatVnd(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
                {cart.items.length > 4 && (
                  <p className="wp-mini-cart-more">
                    + {cart.items.length - 4} sản phẩm khác
                  </p>
                )}
              </div>

              <div className="wp-mini-cart-total">
                <span>Tổng:</span>
                <b>{formatVnd(cart.totals.totalAmount)}</b>
              </div>

              <div className="wp-mini-cart-actions">
                <Link href={toCartPath()} className="wp-mini-cart-btn-secondary">
                  XEM GIỎ HÀNG
                </Link>
                <Link href={toCheckoutPath()} className="wp-mini-cart-btn-primary">
                  THANH TOÁN
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
