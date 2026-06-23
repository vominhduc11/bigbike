"use client";

import { useTranslations } from "next-intl";
import { formatVnd } from "@/lib/utils/format";
import type { Cart } from "@/lib/contracts/commerce";

// Cột phải: tóm tắt đơn + nút đặt hàng. Dùng vocabulary summary của theme
// (.checkout-summary / .summary--items …) vì bảng .shop_table mặc định của
// WooCommerce không nằm trong bundle CSS theme. Đơn online không tính phí vận
// chuyển nên tổng = tạm tính - giảm giá.
export function CheckoutSummary({
  cart,
  cartSubtotal,
  grandTotal,
  submitting,
  cartLoading,
}: {
  cart: Cart;
  cartSubtotal: number;
  grandTotal: number;
  submitting: boolean;
  cartLoading: boolean;
}) {
  const t = useTranslations("Checkout");

  return (
    <div className="checkout-summary">
      <div className="checkout-summary-title">
        <h3>{t("summaryTitle")}</h3>
      </div>

      <div id="order_review">
        <div className="table mb-20">
          {cart.items.map((item) => (
            <div key={item.id} className="summary--items flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1">
                {item.productName}
                {item.variantName ? ` - ${item.variantName}` : ""}{" "}
                <strong className="product-quantity whitespace-nowrap">× {item.quantity}</strong>
              </p>
              <p className="shrink-0 whitespace-nowrap text-right font-semibold">
                {formatVnd(item.lineTotal)}
              </p>
            </div>
          ))}
        </div>

        <div className="summary--items row">
          <div className="summary--items-item col">
            <p>{t("summarySubtotal")}</p>
          </div>
          <div className="summary--items-item col text-right">
            <p>
              <b>{formatVnd(cartSubtotal)}</b>
            </p>
          </div>
        </div>

        {cart.totals.discountAmount > 0 && (
          <div className="summary--items row">
            <div className="summary--items-item col">
              <p>{t("summaryDiscount")}</p>
            </div>
            <div className="summary--items-item col text-right">
              <p className="discount">
                <b>-{formatVnd(cart.totals.discountAmount)}</b>
              </p>
            </div>
          </div>
        )}

        <div className="total-summary summary">
          <div className="summary--items row">
            <div className="summary--items-item col">
              <p>{t("summaryTotal")}</p>
            </div>
            <div className="summary--items-item col text-right">
              <p className="total-price">
                <b>{formatVnd(grandTotal)}</b>
              </p>
            </div>
          </div>
        </div>

        <div className="form-submit" style={{ marginTop: 20 }}>
          <button
            type="submit"
            disabled={submitting || cartLoading || !cart.items.length}
          >
            {submitting ? t("placingOrder") : t("placeOrder")}
          </button>
        </div>
      </div>
    </div>
  );
}
