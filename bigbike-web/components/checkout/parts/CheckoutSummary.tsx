import { useTranslations } from "next-intl";
import { formatVnd } from "@/lib/utils/format";
import type { Cart } from "@/lib/contracts/commerce";
import { TrustMini } from "./atoms";
import { MediaImage } from "@/components/ui/MediaImage";

export function CheckoutSummary({
  cart,
  cartSubtotal,
  grandTotal,
  contactAddress,
}: {
  cart: Cart;
  cartSubtotal: number;
  grandTotal: number;
  submitting: boolean;
  cartLoading: boolean;
  contactAddress?: string;
}) {
  const t = useTranslations("Checkout");

  return (
    <section className="border border-border bg-background p-6">
      <h2 className="mb-6 font-cta text-a2-page font-semibold uppercase">{t("summaryTitle")}</h2>

      <div>
        {cart.items.map((item) => (
          <div key={item.id} className="flex gap-4 border-b border-border py-4 first:pt-0">
            <div className="flex h-18 w-18 shrink-0 items-center justify-center bg-secondary">
              {item.image?.url ? (
                <MediaImage image={item.image} altFallback={item.productName} width={72} height={72} className="h-full w-full object-contain" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-9 h-9 fill-border">
                  <path d="M21 6.5C21 4.01 18.99 2 16.5 2h-9C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22h9c2.49 0 4.5-2.01 4.5-4.5v-11z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-semibold uppercase">{item.productName}</p>
              <p className="mb-0 mt-1 font-cta text-b5-label font-semibold uppercase text-muted-foreground">
                {item.variantName ? `${item.variantName}. ` : ""}{t("qtyAbbrev")}: {item.quantity}
              </p>
              <p className="mb-0 mt-2 font-semibold text-brand">{formatVnd(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        {/* Chỉ hiện "Tạm tính" + "Khuyến mãi" khi có giảm giá */}
        <div className="flex justify-between gap-4 border-b border-border py-3">
          <span>{t("summarySubtotal")}</span>
          <span>{formatVnd(cartSubtotal)}</span>
        </div>

        {cart.totals.discountAmount > 0 && (
          <div className="flex justify-between gap-4 border-b border-border py-3">
            <span>{t("summaryDiscount")}</span>
            <span className="text-brand font-semibold">-{formatVnd(cart.totals.discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between gap-4 border-b border-border py-3">
          <span>{t("summaryShipping")}</span>
          <span className="text-state-success-text font-bold uppercase">{t("shippingFree")}</span>
        </div>

        <div className="flex items-baseline justify-between gap-4 py-5">
          <strong className="font-cta text-a3-section uppercase">{t("summaryTotal")}</strong>
          <strong className="font-cta text-a1-title text-brand">{formatVnd(grandTotal)}</strong>
        </div>
      </div>

      <TrustMini address={contactAddress} />
    </section>
  );
}
