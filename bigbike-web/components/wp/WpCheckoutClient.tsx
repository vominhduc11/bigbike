"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toProductListPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import {
  CheckoutConfirmRow,
  CodPaymentBlock,
  ZaloSupportBlock,
} from "./checkout/atoms";
import { CheckoutAddressFields } from "./checkout/CheckoutAddressFields";
import { CheckoutSummary } from "./checkout/CheckoutSummary";
import { useCheckout } from "./checkout/useCheckout";

/**
 * Nội dung trang Thanh toán — được nâng cấp theo Mockup 1 (tiêu chuẩn UI/UX cao cấp).
 * GIỮ NGUYÊN toàn bộ hook useCheckout + logic thật của bigbike-web.
 */
export function WpCheckoutClient() {
  const t = useTranslations("Checkout");
  const tCart = useTranslations("Cart");
  const locale = useLocale() as Locale;
  const [confirmedChecked, setConfirmedChecked] = useState(false);

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
      <div className="woocommerce-error" role="alert">
        {t("loadCartFailed")} <Link href={toCartPath(locale)}>{t("backToCart")}</Link>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-10 text-center" role="status">
        <p className="cart-empty woocommerce-info">{tCart("emptyHeading")}</p>
        <p className="mb-6 text-muted-foreground">{t("emptyDescription")}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href={toProductListPath(locale)}
            className="inline-flex items-center justify-center bg-brand! px-7 py-3 font-cta text-ui-18 max-md:text-ui-16 uppercase text-white! transition-opacity hover:opacity-90"
          >
            {t("continueShopping")}
          </Link>
          <Link
            href={toCartPath(locale)}
            className="font-cta uppercase underline text-muted-foreground! hover:text-foreground!"
          >
            {t("viewCart")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="checkout woocommerce-checkout" onSubmit={handleSubmit} noValidate>
      <div className="woocommerce-notices-wrapper">
        {submitError && (
          <div className="woocommerce-error" role="alert">
            {submitError}
          </div>
        )}
        {priceChanges.length > 0 && pendingOrderNav && (
          <div className="woocommerce-message" role="status">
            <p>{t("priceChanged")}</p>
            <ul>
              {priceChanges.map((pc, i) => (
                <li key={`${pc.productName}-${i}`}>
                  {pc.productName}: {formatVnd(pc.oldPrice)} - {formatVnd(pc.newPrice)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="button"
              onClick={confirmPendingOrder}
            >
              {t("viewOrderConfirmation")}
            </button>
          </div>
        )}
      </div>

      <div className="bb-co-grid">
        {/* ===== CỘT TRÁI: FORM ===== */}
        <div className="space-y-4">
          
          {/* Card 1: Thông tin nhận hàng */}
          <div className="bb-co-card">
            <p className="bb-co-card-title">{t("step1Title")}</p>

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

              <div className="bb-co-field">
                <label htmlFor="order_comments">
                  {t("noteLabel")} <span className="optional">{t("noteOptional")}</span>
                </label>
                <textarea
                  id="order_comments"
                  className="form-control"
                  placeholder={t("notePlaceholder")}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  maxLength={1000}
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Địa chỉ giao hàng khác (nếu cần) */}
          <div className="bb-co-card">
            <div className="form-group mb-0">
              <label className="inline-flex! cursor-pointer items-center gap-2 font-bold select-none text-ui-15">
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
                <h3 className="mb-4 font-cta text-ui-18 max-md:text-ui-16 font-semibold uppercase">{t("shippingAddressTitle")}</h3>
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
          </div>

          {/* Card 2: Phương thức thanh toán */}
          <div className="bb-co-card">
            <p className="bb-co-card-title">{t("paymentMethodTitle")}</p>
            
            <CodPaymentBlock />

            <CheckoutConfirmRow
              checked={confirmedChecked}
              onCheckedChange={setConfirmedChecked}
            />

            <button
              type="submit"
              className="bb-co-btn-order"
              disabled={submitting || cartLoading || !cart.items.length || !confirmedChecked}
            >
              {submitting ? t("placingOrder") : "ĐẶT HÀNG — SHOP SẼ GỌI XÁC NHẬN"}
            </button>
            <p className="bb-co-btn-sub">
              Shop xác nhận trong 1–2 giờ làm việc · Hotline: 0906902404
            </p>
          </div>

        </div>

        {/* ===== CỘT PHẢI: TÓM TẮT ĐƠN HÀNG ===== */}
        <div className="space-y-4 md:sticky md:top-[96px] md:self-start">
          <CheckoutSummary
            cart={cart}
            cartSubtotal={cartSubtotal}
            grandTotal={grandTotal}
            submitting={submitting}
            cartLoading={cartLoading}
          />
          <ZaloSupportBlock />
        </div>
      </div>
    </form>
  );
}
