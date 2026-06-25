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
            <div key={item.id} className="summary--items flex items-start gap-3">
              {item.image?.url && (
                // Ảnh nhỏ sản phẩm: dùng background-image vì theme WP có rule
                // `body img{height:auto!important}` làm vỡ kích thước cố định của <img>.
                <span
                  role="img"
                  aria-label={item.productName}
                  className="block h-12 w-12 shrink-0 border border-border bg-cover bg-center"
                  style={{ backgroundImage: `url("${item.image.url}")` }}
                />
              )}
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

        {/* Chỉ hiện "Tạm tính" + "Khuyến mãi" khi có giảm giá — nếu không, tạm tính
            trùng tổng cộng (đơn online không tính phí ship) nên chỉ hiện 1 dòng. */}
        {cart.totals.discountAmount > 0 && (
          <>
            <div className="summary--items flex items-center justify-between gap-3">
              <p>{t("summarySubtotal")}</p>
              <p className="text-right">
                <b>{formatVnd(cartSubtotal)}</b>
              </p>
            </div>

            <div className="summary--items flex items-center justify-between gap-3">
              <p>{t("summaryDiscount")}</p>
              <p className="discount text-right">
                <b>-{formatVnd(cart.totals.discountAmount)}</b>
              </p>
            </div>
          </>
        )}

        {/* Phí vận chuyển: đơn online miễn phí hoàn toàn cho khách (SHIP_RULE_001). */}
        <div className="summary--items flex items-center justify-between gap-3">
          <p>{t("summaryShipping")}</p>
          <p className="text-right font-semibold uppercase">{t("shippingFree")}</p>
        </div>

        <div className="total-summary summary">
          <div className="summary--items flex items-center justify-between gap-3">
            <p>{t("summaryTotal")}</p>
            <p className="total-price text-right">
              <b>{formatVnd(grandTotal)}</b>
            </p>
          </div>
        </div>

        <div className="form-submit" style={{ marginTop: 20 }}>
          <button
            type="submit"
            className="!text-[19px] !font-bold uppercase"
            disabled={submitting || cartLoading || !cart.items.length}
          >
            {submitting ? t("placingOrder") : t("placeOrder")}
          </button>
        </div>

        {/* Đặt kỳ vọng cho khách: cách thanh toán + cam kết bảo mật, ngay cạnh nút mua. */}
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">{t("paymentNote")}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{t("secureNote")}</p>
      </div>
    </div>
  );
}
