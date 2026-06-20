"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Cart } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath } from "@/lib/utils/routes";

// Cột phải giỏ hàng: tổng tiền + mã giảm giá + nút thanh toán. Port .summary /
// .cart_totals / .promotion-form / .total-summary của theme WP.
export function CartSummary({
  cart,
  hasUnavailable,
  couponInput,
  setCouponInput,
  setCouponError,
  couponLoading,
  onApplyCoupon,
  onRemoveCoupon,
}: {
  cart: Cart;
  hasUnavailable: boolean;
  couponInput: string;
  setCouponInput: (value: string) => void;
  setCouponError: (value: string) => void;
  couponLoading: boolean;
  onApplyCoupon: (e: React.SyntheticEvent) => void;
  onRemoveCoupon: (code: string) => void;
}) {
  const t = useTranslations("CartWp");
  return (
    <div className="col-md-4">
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

          <div className="wc-proceed-to-checkout">
            {hasUnavailable ? (
              <span
                className="checkout-button button alt wc-forward opacity-50 pointer-events-none"
                aria-disabled="true"
              >
                {t("checkoutSubmit")}
              </span>
            ) : (
              <Link className="checkout-button button alt wc-forward" href={toCheckoutPath()}>
                {t("checkoutSubmit")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="promotion">
        {cart.couponCodes && cart.couponCodes.length > 0 && (
          <div className="apply-code">
            {cart.couponCodes.map((code) => (
              <p key={code}>
                {code}{" "}
                <span className="delete">
                  <button
                    type="button"
                    onClick={() => onRemoveCoupon(code)}
                    disabled={couponLoading}
                    aria-label={`${t("removeCoupon")} ${code}`}
                  >
                    ×
                  </button>
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="promotion-form">
          <form onSubmit={onApplyCoupon}>
            <fieldset>
              <legend>{t("couponLegend")}</legend>
            </fieldset>
            <div className="form-group">
              <input
                type="text"
                name="coupon_code"
                id="coupon_code"
                value={couponInput}
                placeholder={t("couponPlaceholder")}
                onChange={(e) => {
                  setCouponInput(e.target.value);
                  setCouponError("");
                }}
                disabled={couponLoading}
              />
              <button
                type="submit"
                name="apply_coupon"
                disabled={couponLoading || !couponInput.trim()}
              >
                {couponLoading ? t("couponApplying") : t("couponApply")}
              </button>
            </div>
          </form>
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
    </div>
  );
}
