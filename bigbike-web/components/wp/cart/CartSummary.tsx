"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Cart } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath } from "@/lib/utils/routes";

// Cột phải giỏ hàng: tổng tiền + nút thanh toán. Port .summary /
// .cart_totals / .total-summary của theme WP.
export function CartSummary({
  cart,
  hasUnavailable,
}: {
  cart: Cart;
  hasUnavailable: boolean;
}) {
  const t = useTranslations("CartWp");
  return (
    <div className="col-md-4">
      <div className="cart-summary-card">
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

      <div className="cart-checkout-action">
        {hasUnavailable ? (
          <span className="checkout-button" aria-disabled="true">
            {t("checkoutSubmit")}
          </span>
        ) : (
          <Link className="checkout-button" href={toCheckoutPath()}>
            {t("checkoutSubmit")}
          </Link>
        )}
      </div>
      </div>
    </div>
  );
}
