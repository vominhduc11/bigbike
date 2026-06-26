import { useTranslations } from "next-intl";
import { formatVnd } from "@/lib/utils/format";
import type { Cart } from "@/lib/contracts/commerce";
import { TrustMini } from "./atoms";

export function CheckoutSummary({
  cart,
  cartSubtotal,
  grandTotal,
}: {
  cart: Cart;
  cartSubtotal: number;
  grandTotal: number;
  submitting: boolean;
  cartLoading: boolean;
}) {
  const t = useTranslations("Checkout");

  return (
    <div className="bb-co-card">
      <p className="bb-co-card-title">{t("summaryTitle")}</p>

      <div>
        {cart.items.map((item) => (
          <div key={item.id} className="summary-item">
            <div className="item-img">
              {item.image?.url ? (
                <span
                  role="img"
                  aria-label={item.productName}
                  className="block h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${item.image.url}")` }}
                />
              ) : (
                <svg viewBox="0 0 24 24" className="w-[36px] h-[36px] fill-gray-300">
                  <path d="M21 6.5C21 4.01 18.99 2 16.5 2h-9C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22h9c2.49 0 4.5-2.01 4.5-4.5v-11z" />
                </svg>
              )}
            </div>
            <div className="item-info">
              <p className="item-name">{item.productName}</p>
              <p className="item-meta">
                {item.variantName ? `${item.variantName} · ` : ""}SL: {item.quantity}
              </p>
              <p className="item-price">{formatVnd(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        {/* Chỉ hiện "Tạm tính" + "Khuyến mãi" khi có giảm giá */}
        <div className="price-row">
          <span>Tạm tính</span>
          <span>{formatVnd(cartSubtotal)}</span>
        </div>

        {cart.totals.discountAmount > 0 && (
          <div className="price-row">
            <span>Khuyến mãi</span>
            <span className="text-brand font-semibold">-{formatVnd(cart.totals.discountAmount)}</span>
          </div>
        )}

        <div className="price-row">
          <span>Phí vận chuyển</span>
          <span className="text-emerald-700 font-bold uppercase">{t("shippingFree")}</span>
        </div>

        <div className="price-row total">
          <span>Tổng cộng</span>
          <span className="amount">{formatVnd(grandTotal)}</span>
        </div>
      </div>

      <TrustMini />
    </div>
  );
}
