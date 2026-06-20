"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateId } from "@/lib/utils";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import { useAddresses, useCartQuery, useCheckoutOptions, useProfile } from "@/lib/query/hooks";
import type { PriceChange } from "@/lib/contracts/commerce";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { getVietnamRegion } from "@/lib/utils/vn-region";
import { CheckoutStepTitle } from "./checkout/atoms";
import { CheckoutAddressFields } from "./checkout/CheckoutAddressFields";
import { CheckoutSummary } from "./checkout/CheckoutSummary";
import {
  effectiveMethodCost,
  isZoneMismatch,
  normalizeMethodCode,
  pickDefaultAddress,
} from "./checkout/helpers";

/**
 * Nội dung trang Thanh toán — port markup từ woocommerce/checkout/form-checkout.php
 * + review-order.php + payment.php (class .check-out-title / .check-out-form /
 * .check-out-step / .checkout-summary / .summary--items / .form-group / .form-submit).
 * GIỮ NGUYÊN 100% logic/data thật của bigbike-web: react-hook-form + zod validation,
 * shipping/payment options, zone matching, min-order, price-change, GTM begin_checkout,
 * prefill từ profile/address. Cột phải (CheckoutSummary) dùng vocabulary summary của
 * theme vì bảng .shop_table mặc định của WooCommerce không nằm trong bundle CSS theme.
 */
export function WpCheckoutClient() {
  const t = useTranslations("Checkout");
  const tValidation = useTranslations("Checkout.validation");
  const tCart = useTranslations("Cart");
  const router = useRouter();
  const { refreshCount } = useCart();

  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [pendingOrderNav, setPendingOrderNav] = useState<{ orderNumber: string; orderKey: string } | null>(null);
  const [gtmFired, setGtmFired] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const idempotencyKey = useRef<string>(generateId());
  const hasPrefilledRef = useRef(false);

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const {
    data: checkoutOptions,
    isLoading: optionsLoading,
    isError: optionsError,
    refetch: refetchOptions,
  } = useCheckoutOptions();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();

  const {
    register,
    trigger,
    watch,
    setValue,
    formState: { errors: addressErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema(tValidation)),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      country: "VN",
      province: "",
      district: "",
      ward: "",
      addressLine1: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const formAddress = watch();

  // Form địa chỉ giao riêng — chỉ dùng khi khách chọn "giao tới địa chỉ khác".
  // Backend không validate shippingAddress (chỉ billing), nên ràng buộc nằm ở zod đây.
  const {
    register: registerShip,
    trigger: triggerShip,
    watch: watchShip,
    setValue: setValueShip,
    formState: { errors: shipErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema(tValidation)),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      country: "VN",
      province: "",
      district: "",
      ward: "",
      addressLine1: "",
    },
  });

  const formShip = watchShip();

  useEffect(() => {
    if (!checkoutOptions) return;
    setPaymentMethod((prev) => prev || checkoutOptions.paymentMethods[0]?.code || "");
    setShippingMethodId((prev) => prev || checkoutOptions.shippingMethods[0]?.id || "");
  }, [checkoutOptions]);

  useEffect(() => {
    if (!cart || gtmFired) return;
    pushDataLayer("begin_checkout", {
      currency: cart.currency ?? "VND",
      value: cart.totals.totalAmount,
      items: toGtmCartItems(cart.items),
    });
    setGtmFired(true);
  }, [cart, gtmFired]);

  useEffect(() => {
    if (hasPrefilledRef.current) return;
    if (!profile) return;
    if (addresses === undefined) return;
    hasPrefilledRef.current = true;

    const addr = pickDefaultAddress(addresses);
    if (addr) {
      setValue("fullName", addr.fullName ?? profile.displayName ?? "");
      setValue("phone", addr.phone ?? profile.phone ?? "");
      setValue("email", addr.email ?? profile.email ?? "");
      setValue("province", addr.province ?? "");
      setValue("district", addr.district ?? "");
      setValue("ward", addr.ward ?? "");
      setValue("addressLine1", addr.addressLine1 ?? "");
    } else {
      if (profile.displayName) setValue("fullName", profile.displayName);
      if (profile.phone) setValue("phone", profile.phone);
      if (profile.email) setValue("email", profile.email);
    }
  }, [profile, addresses, setValue]);

  const resolvedAddress = useMemo(
    () => ({
      fullName: formAddress.fullName ?? "",
      phone: formAddress.phone ?? "",
      email: formAddress.email ?? "",
      country: formAddress.country || "VN",
      province: formAddress.province ?? "",
      district: formAddress.district ?? "",
      ward: formAddress.ward ?? "",
      addressLine1: formAddress.addressLine1 ?? "",
    }),
    [formAddress],
  );

  const resolvedShip = useMemo(
    () => ({
      fullName: formShip.fullName ?? "",
      phone: formShip.phone ?? "",
      email: formShip.email ?? "",
      country: formShip.country || "VN",
      province: formShip.province ?? "",
      district: formShip.district ?? "",
      ward: formShip.ward ?? "",
      addressLine1: formShip.addressLine1 ?? "",
    }),
    [formShip],
  );

  const cartSubtotal = cart?.totals.subtotalAmount ?? 0;
  const cartTotal = cart?.totals.totalAmount ?? 0;
  const shippingMethods = checkoutOptions?.shippingMethods ?? [];
  const paymentMethods = checkoutOptions?.paymentMethods ?? [];
  const selectedShipping = shippingMethods.find((m) => m.id === shippingMethodId);
  const effectiveShippingCost = effectiveMethodCost(selectedShipping, cartSubtotal);
  const grandTotal = cartTotal + effectiveShippingCost;
  const minOrderAmount = selectedShipping?.minOrderAmount ?? null;
  const belowMinOrder = minOrderAmount !== null && minOrderAmount > 0 ? cartSubtotal < minOrderAmount : false;
  // Vùng giao tính theo địa chỉ hàng thực sự được gửi tới (shipping nếu có, không thì billing).
  const deliveryProvince = shipToDifferent ? resolvedShip.province : resolvedAddress.province;
  const userRegion = getVietnamRegion(deliveryProvince);
  const selectedShippingZoneMismatch = selectedShipping ? isZoneMismatch(selectedShipping, userRegion) : false;

  async function placeOrder() {
    if (!cart?.items.length) {
      setSubmitError(t("errorEmptyCart"));
      return;
    }

    const validAddress = await trigger();
    if (!validAddress) {
      setSubmitError(t("errorMissingShipping"));
      return;
    }
    if (shipToDifferent) {
      const validShip = await triggerShip();
      if (!validShip) {
        setSubmitError(t("errorMissingShipping"));
        return;
      }
    }
    if (!paymentMethod) {
      setSubmitError(t("errorMissingPayment"));
      return;
    }
    if (!shippingMethodId) {
      setSubmitError(t("errorShippingUnavailable"));
      return;
    }
    if (selectedShippingZoneMismatch) {
      setSubmitError(t("shippingZoneMismatch"));
      return;
    }
    if (belowMinOrder && minOrderAmount) {
      setSubmitError(t("belowMinOrder", { amount: formatVnd(minOrderAmount) }));
      return;
    }
    if (normalizeMethodCode(paymentMethod) === "BACS" && !resolvedAddress.email.trim()) {
      setSubmitError(t("errorEmailRequiredForBacs"));
      return;
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      const order = await submitCheckout(
        {
          billingAddress: {
            fullName: resolvedAddress.fullName,
            phone: resolvedAddress.phone,
            email: resolvedAddress.email,
            country: resolvedAddress.country,
            province: resolvedAddress.province,
            district: resolvedAddress.district,
            ward: resolvedAddress.ward,
            addressLine1: resolvedAddress.addressLine1,
          },
          shippingAddress: shipToDifferent
            ? {
                fullName: resolvedShip.fullName,
                phone: resolvedShip.phone,
                email: resolvedShip.email,
                country: resolvedShip.country,
                province: resolvedShip.province,
                district: resolvedShip.district,
                ward: resolvedShip.ward,
                addressLine1: resolvedShip.addressLine1,
              }
            : undefined,
          shippingMethodId: shippingMethodId || null,
          paymentMethod,
          customerNote: customerNote.trim() || undefined,
        },
        idempotencyKey.current,
      );
      refreshCount();
      if (order.priceChanges && order.priceChanges.length > 0) {
        setPriceChanges(order.priceChanges);
        setPendingOrderNav({ orderNumber: order.orderNumber, orderKey: order.orderKey });
      } else {
        router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    await placeOrder();
  }

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
              onClick={() => router.push(toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey))}
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
