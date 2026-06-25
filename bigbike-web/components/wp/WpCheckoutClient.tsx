"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toProductListPath } from "@/lib/utils/routes";
import { CheckoutStepTitle } from "./checkout/atoms";
import { CheckoutAddressFields } from "./checkout/CheckoutAddressFields";
import { CheckoutSummary } from "./checkout/CheckoutSummary";
import { useCheckout } from "./checkout/useCheckout";

/**
 * Nội dung trang Thanh toán — port markup từ woocommerce/checkout/form-checkout.php
 * + review-order.php + payment.php (class .check-out-title / .check-out-form /
 * .check-out-step / .checkout-summary / .summary--items / .form-group / .form-submit).
 * GIỮ NGUYÊN logic/data thật của bigbike-web (xem hook useCheckout): react-hook-form +
 * zod validation, price-change, GTM begin_checkout, prefill từ profile/address. Đơn online
 * không tính phí vận chuyển. Cột phải (CheckoutSummary) dùng vocabulary summary của theme
 * vì bảng .shop_table mặc định của WooCommerce không nằm trong bundle CSS theme.
 */
export function WpCheckoutClient() {
  const t = useTranslations("Checkout");
  const tCart = useTranslations("Cart");

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
    return <p className="woocommerce-info">{t("loading")}</p>;
  }

  if (cartError) {
    return (
      <div className="woocommerce-error" role="alert">
        {t("loadCartFailed")} <Link href={toCartPath()}>{t("backToCart")}</Link>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="py-10 text-center" role="status">
        <p className="cart-empty woocommerce-info">{tCart("emptyHeading")}</p>
        <p className="mb-6 text-muted-foreground">{t("emptyDescription")}</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* `!` để thắng rule WP unlayered `a{color:#007bff}` vốn nhuộm xanh mọi link. */}
          <Link
            href={toProductListPath()}
            className="inline-flex items-center justify-center bg-brand! px-7 py-3 font-cta text-ui-18 max-md:text-ui-16 uppercase text-white! transition-opacity hover:opacity-90"
          >
            {t("continueShopping")}
          </Link>
          <Link
            href={toCartPath()}
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

      <div className="row">
        {/* ===== Cột trái: thông tin giao hàng ===== */}
        <div className="col-md-8">
          <div className="check-out-title">
            <h3>{t("title")}</h3>
          </div>

          <div className="check-out-form">
            <div className="check-out-step">
              <CheckoutStepTitle>{t("step1Title")}</CheckoutStepTitle>

              <div className="row">
                <CheckoutAddressFields
                  idPrefix="billing"
                  autoCompletePrefix=""
                  register={register}
                  errors={addressErrors}
                  includeEmail
                  vnValue={{
                    province: formAddress.province ?? "",
                    district: formAddress.district ?? "",
                    ward: formAddress.ward ?? "",
                  }}
                  onVnChange={(field, val) => setValue(field, val, { shouldValidate: true })}
                />

                <div className="col-md-12">
                  <div className="form-group">
                    <label htmlFor="order_comments">
                      {t("noteLabel")} <span className="optional">{t("noteOptional")}</span>
                    </label>
                    <textarea
                      id="order_comments"
                      className="form-control"
                      style={{ height: "auto", padding: "12px 20px" }}
                      placeholder={t("notePlaceholder")}
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      maxLength={1000}
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="check-out-step">
              <div className="form-group" style={{ marginBottom: shipToDifferent ? 16 : 0 }}>
                <label className="inline-flex! cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={shipToDifferent}
                    onCheckedChange={(checked) => setShipToDifferent(checked === true)}
                  />
                  {t("shipToDifferent")}
                </label>
              </div>

              {shipToDifferent && (
                <>
                  <h3 className="mb-3 mt-1 font-cta text-ui-18 max-md:text-ui-16 font-semibold uppercase">{t("shippingAddressTitle")}</h3>
                  <div className="row">
                    <CheckoutAddressFields
                      idPrefix="shipping"
                      autoCompletePrefix="shipping "
                      register={registerShip}
                      errors={shipErrors}
                      includeEmail={false}
                      vnValue={{
                        province: formShip.province ?? "",
                        district: formShip.district ?? "",
                        ward: formShip.ward ?? "",
                      }}
                      onVnChange={(field, val) => setValueShip(field, val, { shouldValidate: true })}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ===== Cột phải: thông tin đơn đặt hàng (dính khi cuộn ở desktop) ===== */}
        <div className="col-md-4 md:sticky md:top-[96px] md:self-start">
          <CheckoutSummary
            cart={cart}
            cartSubtotal={cartSubtotal}
            grandTotal={grandTotal}
            submitting={submitting}
            cartLoading={cartLoading}
          />
        </div>
      </div>
    </form>
  );
}
