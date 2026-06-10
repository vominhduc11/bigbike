"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn, generateId } from "@/lib/utils";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import { useAddresses, useCartQuery, useCheckoutOptions, useProfile } from "@/lib/query/hooks";
import type {
  CustomerAddress,
  PaymentMethodOption,
  PriceChange,
  ShippingMethodOption,
} from "@/lib/contracts/commerce";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { getVietnamRegion } from "@/lib/utils/vn-region";

/**
 * Nội dung trang Thanh toán — port markup từ woocommerce/checkout/form-checkout.php
 * + review-order.php + payment.php (class .check-out-title / .check-out-form /
 * .check-out-step / .checkout-summary / .summary--items / .form-group / .form-submit).
 * GIỮ NGUYÊN 100% logic/data thật của bigbike-web: react-hook-form + zod validation,
 * shipping/payment options, zone matching, min-order, price-change, GTM begin_checkout,
 * prefill từ profile/address. Cột phải dùng vocabulary summary của theme (đúng phần
 * thiết kế tác giả theme để sẵn trong form-checkout.php) vì bảng .shop_table mặc định
 * của WooCommerce không nằm trong bundle CSS theme.
 */

function pickDefaultAddress(addresses: CustomerAddress[] | undefined): CustomerAddress | null {
  if (!addresses?.length) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}

function normalizeMethodCode(code: string | null | undefined) {
  return (code ?? "").trim().toUpperCase();
}

function effectiveMethodCost(method: ShippingMethodOption | undefined, cartSubtotal: number) {
  if (!method) return 0;
  const threshold = method.freeShippingThreshold ?? null;
  return threshold !== null && threshold > 0 && cartSubtotal >= threshold ? 0 : method.cost;
}

function isZoneMismatch(method: ShippingMethodOption, userRegion: "MB" | "MT" | "MN" | null) {
  return !!method.zoneRegionCode && !!userRegion && method.zoneRegionCode !== userRegion;
}

/* .check-out-step-title h3 <span><b>n</b></span> — huy hiệu số bước hình thoi đỏ WP. */
function CheckoutStepTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="check-out-step-title">
      <h3>
        <span>
          <b>{step}</b>
        </span>{" "}
        {children}
      </h3>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="m-0 mt-1 text-sm text-brand">{message}</p>;
}

export function WpCheckoutClient() {
  const t = useTranslations("Checkout");
  const tValidation = useTranslations("Checkout.validation");
  const tPayment = useTranslations("Checkout.paymentMethod");
  const tPaymentDescription = useTranslations("Checkout.paymentDescription");
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
  const idempotencyKey = useRef<string>(generateId());
  const hasPrefilledRef = useRef(false);

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const { data: checkoutOptions, isLoading: optionsLoading } = useCheckoutOptions();
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

  const cartSubtotal = cart?.totals.subtotalAmount ?? 0;
  const cartTotal = cart?.totals.totalAmount ?? 0;
  const shippingMethods = checkoutOptions?.shippingMethods ?? [];
  const paymentMethods = checkoutOptions?.paymentMethods ?? [];
  const selectedShipping = shippingMethods.find((m) => m.id === shippingMethodId);
  const effectiveShippingCost = effectiveMethodCost(selectedShipping, cartSubtotal);
  const grandTotal = cartTotal + effectiveShippingCost;
  const minOrderAmount = selectedShipping?.minOrderAmount ?? null;
  const belowMinOrder = minOrderAmount !== null && minOrderAmount > 0 ? cartSubtotal < minOrderAmount : false;
  const userRegion = getVietnamRegion(resolvedAddress.province);
  const selectedShippingZoneMismatch = selectedShipping ? isZoneMismatch(selectedShipping, userRegion) : false;

  function paymentLabel(method: PaymentMethodOption | string | null | undefined) {
    const code = typeof method === "string" ? method : method?.code;
    const upper = normalizeMethodCode(code);
    if (upper === "") return tPayment("EMPTY");
    if (upper === "COD" || upper === "BACS") return tPayment(upper);
    return typeof method === "string" ? tPayment("UNKNOWN", { method }) : (method?.title ?? "");
  }

  function paymentDescription(code: string) {
    const upper = normalizeMethodCode(code);
    if (upper === "COD" || upper === "BACS") return tPaymentDescription(upper);
    return "";
  }

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

  const reqMark = <span className="required">*</span>;

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
                <div className="col-md-6">
                  <div className="form-group">
                    <label htmlFor="billing_full_name">
                      {t("fullName")} {reqMark}
                    </label>
                    <input
                      id="billing_full_name"
                      className="form-control"
                      placeholder={t("fullNamePlaceholder")}
                      autoComplete="name"
                      aria-invalid={!!addressErrors.fullName}
                      {...register("fullName")}
                    />
                    <FieldError message={addressErrors.fullName?.message} />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group">
                    <label htmlFor="billing_phone">
                      {t("phone")} {reqMark}
                    </label>
                    <input
                      id="billing_phone"
                      type="tel"
                      inputMode="tel"
                      maxLength={12}
                      className="form-control"
                      placeholder={t("phonePlaceholder")}
                      autoComplete="tel"
                      aria-invalid={!!addressErrors.phone}
                      {...register("phone")}
                    />
                    <FieldError message={addressErrors.phone?.message} />
                  </div>
                </div>

                <div className="col-md-12">
                  <div className="form-group">
                    <label htmlFor="billing_email">{t("email")}</label>
                    <input
                      id="billing_email"
                      type="email"
                      className="form-control"
                      placeholder={t("emailPlaceholder")}
                      autoComplete="email"
                      aria-invalid={!!addressErrors.email}
                      {...register("email")}
                    />
                    <FieldError message={addressErrors.email?.message} />
                  </div>
                </div>

                <div className="col-md-12">
                  <div className="form-group">
                    <label htmlFor="billing_address_1">
                      {t("address")} {reqMark}
                    </label>
                    <input
                      id="billing_address_1"
                      className="form-control"
                      placeholder={t("addressPlaceholder")}
                      autoComplete="address-line1"
                      aria-invalid={!!addressErrors.addressLine1}
                      {...register("addressLine1")}
                    />
                    <FieldError message={addressErrors.addressLine1?.message} />
                  </div>
                </div>

                <div className="col-md-12">
                  <VnAddressFields
                    value={{
                      province: formAddress.province ?? "",
                      district: formAddress.district ?? "",
                      ward: formAddress.ward ?? "",
                    }}
                    onChange={(field, val) =>
                      setValue(field as keyof CheckoutAddressFormValues, val, { shouldValidate: true })
                    }
                    required
                  />
                  {(addressErrors.province || addressErrors.district) && (
                    <FieldError message={addressErrors.province?.message ?? addressErrors.district?.message} />
                  )}
                </div>

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
          </div>
        </div>

        {/* ===== Cột phải: thông tin đơn đặt hàng ===== */}
        <div className="col-md-4">
          <div className="checkout-summary">
            <div className="checkout-summary-title">
              <h3>{t("summaryTitle")}</h3>
            </div>

            <div id="order_review">
              <div className="table mb-20">
                {cart.items.map((item) => (
                  <div key={item.id} className="summary--items row">
                    <div className="summary--items-item col">
                      <p>
                        {item.productName}
                        {item.variantName ? ` - ${item.variantName}` : ""}{" "}
                        <strong className="product-quantity">× {item.quantity}</strong>
                      </p>
                    </div>
                    <div className="summary--items-item col text-right">
                      <p>{formatVnd(item.lineTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="summary--items row">
                <div className="summary--items-item col">
                  <p>{t("summarySubtotal")}</p>
                </div>
                <div className="summary--items-item col text-right">
                  <p>
                    <b>{formatVnd(cartSubtotal)}</b>
                  </p>
                </div>
              </div>

              {/* Phương thức vận chuyển */}
              <div className="form-group mb-20">
                <label>{t("shippingMethodSectionTitle")}</label>
                {optionsLoading ? (
                  <p className="woocommerce-info">{t("paymentLoading")}</p>
                ) : shippingMethods.length > 0 ? (
                  shippingMethods.map((method) => {
                    const disabled = isZoneMismatch(method, userRegion);
                    const cost = effectiveMethodCost(method, cartSubtotal);
                    const checked = shippingMethodId === method.id;
                    return (
                      <div
                        key={method.id}
                        className={cn("form-group form-radio", disabled && "opacity-50")}
                        style={{ marginBottom: 12 }}
                      >
                        <input
                          type="radio"
                          name="shipping_method_select"
                          id={`shipping_method_${method.id}`}
                          value={method.id}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => setShippingMethodId(method.id)}
                        />
                        <label htmlFor={`shipping_method_${method.id}`}>
                          {method.title}{" "}
                          <b className="text-brand">{cost > 0 ? formatVnd(cost) : t("shippingMethodFree")}</b>
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="woocommerce-info">{t("errorShippingUnavailable")}</p>
                )}
              </div>

              <div className="summary--items row">
                <div className="summary--items-item col">
                  <p>{t("summaryShipping")}</p>
                </div>
                <div className="summary--items-item col text-right">
                  <p>
                    <b>
                      {selectedShipping
                        ? effectiveShippingCost > 0
                          ? formatVnd(effectiveShippingCost)
                          : t("summaryShippingFree")
                        : "—"}
                    </b>
                  </p>
                </div>
              </div>

              {cart.totals.discountAmount > 0 && (
                <div className="summary--items row">
                  <div className="summary--items-item col">
                    <p>{t("summaryDiscount")}</p>
                  </div>
                  <div className="summary--items-item col text-right">
                    <p className="discount">
                      <b>-{formatVnd(cart.totals.discountAmount)}</b>
                    </p>
                  </div>
                </div>
              )}

              <div className="total-summary summary">
                <div className="summary--items row">
                  <div className="summary--items-item col">
                    <p>{t("summaryTotal")}</p>
                  </div>
                  <div className="summary--items-item col text-right">
                    <p className="total-price">
                      <b>{formatVnd(grandTotal)}</b>
                    </p>
                  </div>
                </div>
              </div>

              {/* Phương thức thanh toán */}
              <div id="payment" className="form-group" style={{ marginTop: 20 }}>
                <label>{t("step2Title")}</label>
                {optionsLoading ? (
                  <p className="woocommerce-info">{t("paymentLoading")}</p>
                ) : paymentMethods.length > 0 ? (
                  paymentMethods.map((method) => {
                    const checked = paymentMethod === method.code;
                    const description = paymentDescription(method.code);
                    return (
                      <div key={method.code} style={{ marginBottom: 12 }}>
                        <div className="form-group form-radio" style={{ margin: 0 }}>
                          <input
                            type="radio"
                            name="payment_method_select"
                            id={`payment_method_${method.code}`}
                            value={method.code}
                            checked={checked}
                            onChange={() => setPaymentMethod(method.code)}
                          />
                          <label htmlFor={`payment_method_${method.code}`}>{paymentLabel(method)}</label>
                        </div>
                        {checked && description && (
                          <p className="m-0 mt-2 text-ui-14 leading-[1.5] text-[var(--bb-text-secondary)]">
                            {description}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="woocommerce-error">{t("paymentNone")}</p>
                )}
              </div>

              <div className="form-submit" style={{ marginTop: 20 }}>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    cartLoading ||
                    !cart.items.length ||
                    belowMinOrder ||
                    selectedShippingZoneMismatch
                  }
                >
                  {submitting ? t("placingOrder") : t("placeOrder")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
