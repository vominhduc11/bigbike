"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { Textarea } from "@/components/ui/textarea";
import { formatVnd, telHref } from "@/lib/utils/format";
import { toCartPath, toProductListPath } from "@/lib/utils/routes";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { listPublicSettings } from "@/lib/api/public-api";
import type { PublicSiteSetting } from "@/lib/contracts/public";
import { pickSetting } from "@/lib/utils/settings";
import {
  CheckoutConfirmRow,
  CodPaymentBlock,
  ZaloSupportBlock,
} from "./parts/atoms";
import { CheckoutAddressFields } from "./parts/CheckoutAddressFields";
import { CheckoutSummary } from "./parts/CheckoutSummary";
import { useCheckout } from "./parts/useCheckout";

/**
 * Nội dung trang Thanh toán — được nâng cấp theo Mockup 1 (tiêu chuẩn UI/UX cao cấp).
 * GIỮ NGUYÊN toàn bộ hook useCheckout + logic thật của bigbike-web.
 */
export function CheckoutClient({ settings = [] }: { settings?: PublicSiteSetting[] }) {
  const t = useTranslations("Checkout");
  const tCart = useTranslations("Cart");
  const locale = useLocale() as Locale;
  const [confirmedChecked, setConfirmedChecked] = useState(false);
  const { data: freshSettingsResult } = useQuery({
    queryKey: ["public-settings", locale],
    queryFn: () => listPublicSettings(locale),
    initialData: locale === DEFAULT_LOCALE ? { data: settings, error: null } : undefined,
    staleTime: 5 * 60 * 1000,
  });
  const activeSettings = freshSettingsResult?.data ?? settings;
  const hotline = pickSetting(activeSettings, ["hotline", "phone"]);
  const contactAddress = pickSetting(activeSettings, ["contact_address", "address"]);
  const zaloUrl = pickSetting(activeSettings, ["zalo_url"]);
  const zaloDisplay = pickSetting(activeSettings, ["zalo_display"]);

  const {
    cart,
    cartLoading,
    cartError,
    submitError,
    priceChanges,
    pendingOrderNav,
    handleSubmit,
    confirmPendingOrder,
    register,
    addressErrors,
    formAddress,
    setValue,
    customerNote,
    setCustomerNote,
    shipToDifferent,
    setShipToDifferent,
    registerShip,
    shipErrors,
    formShip,
    setValueShip,
    cartSubtotal,
    grandTotal,
    submitting,
  } = useCheckout();

  if (cartLoading && !cart) {
    // Cùng khung skeleton mà app/dat-hang/loading.tsx dùng cho lần điều hướng đầu —
    // tái dùng ở đây cho lần giỏ hàng còn đang tải phía client (không phải điều hướng).
    return <CheckoutSkeleton />;
  }

  if (cartError) {
    return (
      <div className="border border-destructive bg-accent p-5 text-destructive" role="alert">
        {t("loadCartFailed")} <Link href={toCartPath(locale)} className="font-semibold text-destructive! underline">{t("backToCart")}</Link>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-10 text-center" role="status">
        <p className="font-cta text-a2-page font-semibold uppercase">{tCart("emptyHeading")}</p>
        <p className="mb-6 text-muted-foreground">{t("emptyDescription")}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild className="rounded-none"><Link href={toProductListPath(locale)}>{t("continueShopping")}</Link></Button>
          <Button asChild variant="link"><Link href={toCartPath(locale)}>{t("viewCart")}</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <form data-checkout-form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        {submitError && (
          <div className="border border-destructive bg-accent p-5 text-destructive" role="alert">
            {submitError}
          </div>
        )}
        {priceChanges.length > 0 && pendingOrderNav && (
          <div className="border border-info/30 bg-info/10 p-5" role="status">
            <p className="mt-0 font-semibold">{t("priceChanged")}</p>
            <ul className="mb-4 list-disc pl-6">
              {priceChanges.map((pc, i) => (
                <li key={`${pc.productName}-${i}`}>
                  {pc.productName}: {formatVnd(pc.oldPrice)} - {formatVnd(pc.newPrice)}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="dark"
              className="rounded-none"
              onClick={confirmPendingOrder}
            >
              {t("viewOrderConfirmation")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        {/* ===== CỘT TRÁI: FORM ===== */}
        <div className="space-y-4">
          
          {/* Card 1: Thông tin nhận hàng */}
          <section className="border border-border bg-background p-6">
            <h2 className="mb-6 font-cta text-a2-page font-semibold uppercase">{t("step1Title")}</h2>

            <div className="space-y-4">
              <CheckoutAddressFields
                idPrefix="billing"
                autoCompletePrefix=""
                register={register}
                errors={addressErrors}
                includeEmail
                vnValue={{
                  province: formAddress.province ?? "",
                  ward: formAddress.ward ?? "",
                }}
                onVnChange={(field, val) => setValue(field, val, { shouldValidate: true })}
              />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="order_comments" className="font-body text-a5-meta font-bold text-foreground">
                  {t("noteLabel")} <span className="font-normal text-muted-foreground">{t("noteOptional")}</span>
                </label>
                <Textarea
                  id="order_comments"
                  placeholder={t("notePlaceholder")}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  maxLength={1000}
                  rows={4}
                />
              </div>
            </div>
          </section>

          {/* Địa chỉ giao hàng khác (nếu cần) */}
          <section className="border border-border bg-background p-6">
            <div>
              <label className="inline-flex! cursor-pointer items-center gap-2 font-bold select-none text-a5-meta">
                <Checkbox
                  checked={shipToDifferent}
                  onCheckedChange={(checked) => setShipToDifferent(checked === true)}
                  className="border-black data-[state=checked]:bg-black data-[state=checked]:text-white rounded-none h-5 w-5"
                />
                {t("shipToDifferent")}
              </label>
            </div>

            {shipToDifferent && (
              <div className="mt-6">
                <h3 className="mb-4 font-cta text-a4-content font-semibold uppercase">{t("shippingAddressTitle")}</h3>
                <div className="space-y-4">
                  <CheckoutAddressFields
                    idPrefix="shipping"
                    autoCompletePrefix="shipping "
                    register={registerShip}
                    errors={shipErrors}
                    includeEmail={false}
                    vnValue={{
                      province: formShip.province ?? "",
                      ward: formShip.ward ?? "",
                    }}
                    onVnChange={(field, val) => setValueShip(field, val, { shouldValidate: true })}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Card 2: Phương thức thanh toán */}
          <section className="border border-border bg-background p-6">
            <h2 className="mb-6 font-cta text-a2-page font-semibold uppercase">{t("paymentMethodTitle")}</h2>
            
            <CodPaymentBlock />

            <CheckoutConfirmRow
              checked={confirmedChecked}
              onCheckedChange={setConfirmedChecked}
            />

            <Button
              type="submit"
              className="mt-6 h-auto min-h-14 w-full rounded-none px-5 py-4 text-center"
              disabled={submitting || cartLoading || !cart.items.length || !confirmedChecked}
            >
              {submitting ? t("placingOrder") : t("placeOrderCallConfirm")}
            </Button>
            <p className="mb-0 mt-3 text-center text-a5-meta text-muted-foreground">
              {t("confirmationTiming")}
              {hotline ? (
                <> {t("hotlineLabel")}: <a className="font-semibold text-foreground hover:text-brand" href={telHref(hotline)}>{hotline}</a></>
              ) : null}
            </p>
          </section>

        </div>

        {/* ===== CỘT PHẢI: TÓM TẮT ĐƠN HÀNG ===== */}
        <div className="space-y-4 md:sticky md:top-24 md:self-start">
          <CheckoutSummary
            cart={cart}
            cartSubtotal={cartSubtotal}
            grandTotal={grandTotal}
            submitting={submitting}
            cartLoading={cartLoading}
            contactAddress={contactAddress}
          />
          <ZaloSupportBlock zaloUrl={zaloUrl} zaloDisplay={zaloDisplay} />
        </div>
      </div>
    </form>
  );
}
