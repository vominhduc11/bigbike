"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath } from "@/lib/utils/routes";
import { CheckoutStepTitle } from "./checkout/atoms";
import { CheckoutAddressFields } from "./checkout/CheckoutAddressFields";
import { CheckoutSummary } from "./checkout/CheckoutSummary";
import { useCheckout } from "./checkout/useCheckout";

/**
 * Nội dung trang Thanh toán — port markup từ woocommerce/checkout/form-checkout.php
 * + review-order.php + payment.php (class .check-out-title / .check-out-form /
 * .check-out-step / .checkout-summary / .summary--items / .form-group / .form-submit).
 * GIỮ NGUYÊN 100% logic/data thật của bigbike-web (xem hook useCheckout): react-hook-form +
 * zod validation, shipping/payment options, zone matching, min-order, price-change, GTM
 * begin_checkout, prefill từ profile/address. Cột phải (CheckoutSummary) dùng vocabulary
 * summary của theme vì bảng .shop_table mặc định của WooCommerce không nằm trong bundle CSS theme.
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
    effectiveShippingCost,
    grandTotal,
    selectedShipping,
    shippingMethods,
    shippingMethodId,
    setShippingMethodId,
    paymentMethods,
    paymentMethod,
    setPaymentMethod,
    optionsLoading,
    optionsError,
    refetchOptions,
    userRegion,
    submitting,
    belowMinOrder,
    selectedShippingZoneMismatch,
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
      <>
        <p className="cart-empty woocommerce-info" role="status">
          {tCart("emptyHeading")}
        </p>
        <p className="return-to-shop">
          <Link className="button wc-backward" href={toCartPath()}>
            {t("viewCart")}
          </Link>
        </p>
      </>
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
              <CheckoutStepTitle step={1}>{t("step1Title")}</CheckoutStepTitle>

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
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={shipToDifferent}
                    onChange={(e) => setShipToDifferent(e.target.checked)}
                  />
                  {t("shipToDifferent")}
                </label>
              </div>

              {shipToDifferent && (
                <>
                  <h3 className="mb-3 mt-1 font-cta text-base font-semibold uppercase">{t("shippingAddressTitle")}</h3>
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

        {/* ===== Cột phải: thông tin đơn đặt hàng ===== */}
        <div className="col-md-4">
          <CheckoutSummary
            cart={cart}
            cartSubtotal={cartSubtotal}
            effectiveShippingCost={effectiveShippingCost}
            grandTotal={grandTotal}
            selectedShipping={selectedShipping}
            shippingMethods={shippingMethods}
            shippingMethodId={shippingMethodId}
            setShippingMethodId={setShippingMethodId}
            paymentMethods={paymentMethods}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            optionsLoading={optionsLoading}
            optionsError={optionsError}
            onRetryOptions={() => refetchOptions()}
            userRegion={userRegion}
            submitting={submitting}
            cartLoading={cartLoading}
            belowMinOrder={belowMinOrder}
            selectedShippingZoneMismatch={selectedShippingZoneMismatch}
          />
        </div>
      </div>
    </form>
  );
}
