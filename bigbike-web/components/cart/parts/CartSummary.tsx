"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { Cart } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { Button } from "@/components/ui/button";

// Cột phải giỏ hàng: tổng tiền + nút thanh toán. Port .summary /
// .cart_totals / .total-summary của theme WP.
export function CartSummary({
  cart,
  hasUnavailable,
}: {
  cart: Cart;
  hasUnavailable: boolean;
}) {
  const t = useTranslations("CartPage");
  const locale = useLocale() as Locale;
  return (
    <aside className="md:col-span-4">
      <div className="border border-border bg-background p-6 md:sticky md:top-[96px]">
          <h2 className="mb-6 font-cta text-3xl font-semibold uppercase">{t("totalsHeading")}</h2>

          <div className="flex justify-between gap-4 border-b border-border py-4">
            <span>{t("subtotal")}</span>
            <strong>{formatVnd(cart.totals.subtotalAmount)}</strong>
          </div>

          {cart.totals.discountAmount > 0 && (
            <div className="flex justify-between gap-4 border-b border-border py-4">
              <span>{t("discount")}</span>
              <strong className="text-brand">-{formatVnd(cart.totals.discountAmount)}</strong>
            </div>
          )}

          {cart.totals.shippingAmount > 0 ? (
            <div className="flex justify-between gap-4 border-b border-border py-4">
              <span>{t("shipping")}</span>
              <strong>{formatVnd(cart.totals.shippingAmount)}</strong>
            </div>
          ) : (
            <div className="border-b border-border py-4">
              <p className="m-0 text-caption italic leading-snug text-muted-foreground">{t("shippingPending")}</p>
            </div>
          )}

        <div className="flex items-baseline justify-between gap-4 py-6">
          <strong className="font-cta text-xl uppercase">{t("total")}</strong>
          <strong className="font-cta text-3xl text-brand">{formatVnd(cart.totals.totalAmount)}</strong>
        </div>

        {hasUnavailable ? (
          <Button className="h-[52px] w-full rounded-none" disabled>{t("checkoutSubmit")}</Button>
        ) : (
          <Button asChild className="h-[52px] w-full rounded-none">
            <Link href={toCheckoutPath(locale)}>{t("checkoutSubmit")}</Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
