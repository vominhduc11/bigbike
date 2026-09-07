"use client";

import Link from "@/i18n/StorefrontLink";
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
  checkoutBlocked = false,
  isUpdating = false,
}: {
  cart: Cart;
  hasUnavailable: boolean;
  checkoutBlocked?: boolean;
  isUpdating?: boolean;
}) {
  const t = useTranslations("CartPage");
  const locale = useLocale() as Locale;
  const checkoutClassName = "min-h-13 w-full rounded-none px-3 py-3 text-primary-foreground!";
  const disabled = hasUnavailable || checkoutBlocked;
  const checkoutLabel = isUpdating ? t("updating") : t("checkoutSubmit");
  return (
    <>
      <aside className="min-w-0 lg:col-span-4">
        <div className="border border-border bg-background p-6 lg:sticky lg:top-24">
          <h2 className="mb-6 font-body text-a3-section font-semibold">{t("totalsHeading")}</h2>

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
              <p className="m-0 text-a5-meta italic leading-snug text-muted-foreground">
                {t("shippingPending")}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-4 py-6">
            <strong className="font-body text-a3-section">{t("total")}</strong>
            <strong className="font-body text-a2-page text-brand">
              {formatVnd(cart.totals.totalAmount)}
            </strong>
          </div>

          <div className="hidden md:block">
            {disabled ? (
              <Button className={checkoutClassName} disabled>
                {checkoutLabel}
              </Button>
            ) : (
              <Button asChild className={checkoutClassName}>
                <Link href={toCheckoutPath(locale)}>{t("checkoutSubmit")}</Link>
              </Button>
            )}
          </div>
        </div>
      </aside>

      <div
        data-cart-mobile-checkout
        className="fixed inset-x-0 bottom-0 z-[var(--bb-z-bottom-nav)] border-t border-border bg-background shadow-[0_-8px_20px_rgba(0,0,0,0.12)] md:hidden"
      >
        <div className="grid gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 font-cta text-b5-label font-semibold uppercase text-muted-foreground">
              {t("total")}
            </p>
            <strong className="block whitespace-nowrap font-body text-a3-section text-brand">
              {formatVnd(cart.totals.totalAmount)}
            </strong>
          </div>
          {disabled ? (
            <Button className={checkoutClassName} disabled>
              {checkoutLabel}
            </Button>
          ) : (
            <Button asChild className={checkoutClassName}>
              <Link href={toCheckoutPath(locale)}>{t("checkoutSubmit")}</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
