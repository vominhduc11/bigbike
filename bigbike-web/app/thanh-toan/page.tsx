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
  CartItem,
  CustomerAddress,
  PaymentMethodOption,
  PriceChange,
  ShippingMethodOption,
} from "@/lib/contracts/commerce";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer } from "@/lib/analytics";
import { formatAddress, formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getVietnamRegion } from "@/lib/utils/vn-region";

function toGtmCartItems(items: CartItem[]) {
  return items.map((item) => ({
    item_id: item.productId ?? item.sku ?? item.id,
    item_name: item.productName,
    price: item.unitPrice,
    quantity: item.quantity,
    currency: "VND",
  }));
}

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

function CheckoutStepTitle({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="check-out-step-title">
      <h2>
        <span>
          <b>{step}</b>
        </span>
        {children}
      </h2>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="bb-checkout-field-error">{message}</p>;
}

export default function CheckoutPage() {
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
    return (
      <div className="bb-container cart-table bb-checkout-page">
        <p className="woocommerce-info">{t("loading")}</p>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="bb-container cart-table bb-checkout-page">
        <div className="woocommerce-error" role="alert">
          {t("loadCartFailed")} <Link href={toCartPath()}>{t("backToCart")}</Link>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="bb-container cart-table bb-checkout-page">
        <div className="cart-empty woocommerce-info" role="status">
          {tCart("emptyHeading")}
        </div>
        <p className="return-to-shop">
          <Button asChild variant="primary" className="button wc-backward">
            <Link href={toCartPath()}>{t("viewCart")}</Link>
          </Button>
        </p>
      </div>
    );
  }

  const reqMark = (
    <abbr className="required" title={t("required")}>
      *
    </abbr>
  );

  return (
    <div className="bb-container cart-table bb-checkout-page">
      <div className="check-out-title">
        <h1>{t("title")}</h1>
      </div>

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
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="button"
                onClick={() => router.push(toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey))}
              >
                {t("viewOrderConfirmation")}
              </Button>
            </div>
          )}
        </div>

        <div className="bb-checkout-content-row">
          <div className="bb-checkout-content-main check-out-form">
            <section className="check-out-step woocommerce-billing-fields">
              <CheckoutStepTitle step={1}>{t("step1Title")}</CheckoutStepTitle>

              <div className="bb-checkout-fields-grid">
                <div className="form-group form-row form-row-first">
                  <label htmlFor="billing_full_name">
                    {t("fullName")} {reqMark}
                  </label>
                  <Input
                    id="billing_full_name"
                    className="form-control"
                    placeholder={t("fullNamePlaceholder")}
                    autoComplete="name"
                    aria-invalid={!!addressErrors.fullName}
                    {...register("fullName")}
                  />
                  <FieldError message={addressErrors.fullName?.message} />
                </div>

                <div className="form-group form-row form-row-last">
                  <label htmlFor="billing_phone">
                    {t("phone")} {reqMark}
                  </label>
                  <Input
                    id="billing_phone"
                    className="form-control"
                    type="tel"
                    inputMode="tel"
                    maxLength={12}
                    placeholder={t("phonePlaceholder")}
                    autoComplete="tel"
                    aria-invalid={!!addressErrors.phone}
                    {...register("phone")}
                  />
                  <FieldError message={addressErrors.phone?.message} />
                </div>

                <div className="form-group form-row form-row-wide">
                  <label htmlFor="billing_email">{t("email")}</label>
                  <Input
                    id="billing_email"
                    className="form-control"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    autoComplete="email"
                    aria-invalid={!!addressErrors.email}
                    {...register("email")}
                  />
                  <FieldError message={addressErrors.email?.message} />
                </div>

                <div className="form-group form-row form-row-wide">
                  <label htmlFor="billing_address_1">
                    {t("address")} {reqMark}
                  </label>
                  <Input
                    id="billing_address_1"
                    className="form-control"
                    placeholder={t("addressPlaceholder")}
                    autoComplete="address-line1"
                    aria-invalid={!!addressErrors.addressLine1}
                    {...register("addressLine1")}
                  />
                  <FieldError message={addressErrors.addressLine1?.message} />
                </div>

                <div className="form-row form-row-wide bb-checkout-address-grid">
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
                    labelClassName="bb-checkout-label"
                    selectContentClassName="bb-checkout-select-content"
                  />
                </div>
                {(addressErrors.province || addressErrors.district) && (
                  <p className="bb-checkout-field-error form-row form-row-wide">
                    {addressErrors.province?.message ?? addressErrors.district?.message}
                  </p>
                )}
              </div>

              <div className="form-group form-row form-row-wide bb-order-comments">
                <label htmlFor="order_comments">
                  {t("noteLabel")} <span className="optional">{t("noteOptional")}</span>
                </label>
                <Textarea
                  id="order_comments"
                  className="form-control"
                  placeholder={t("notePlaceholder")}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  maxLength={1000}
                  rows={4}
                />
              </div>
            </section>

            <section className="check-out-step woocommerce-shipping-fields">
              <CheckoutStepTitle step={2}>{t("step2Title")}</CheckoutStepTitle>

              <div className="bb-checkout-method-block">
                <h3>{t("shippingMethodSectionTitle")}</h3>
                {optionsLoading ? (
                  <p className="woocommerce-info">{t("paymentLoading")}</p>
                ) : shippingMethods.length > 0 ? (
                  <RadioGroup value={shippingMethodId} onValueChange={setShippingMethodId} className="bb-checkout-radio-list">
                    {shippingMethods.map((method) => {
                      const disabled = isZoneMismatch(method, userRegion);
                      const cost = effectiveMethodCost(method, cartSubtotal);
                      return (
                        <label
                          key={method.id}
                          className={cn("bb-checkout-radio-row", disabled && "is-disabled")}
                          htmlFor={`shipping_method_${method.id}`}
                        >
                          <RadioGroupItem
                            value={method.id}
                            id={`shipping_method_${method.id}`}
                            disabled={disabled}
                          />
                          <span className="bb-checkout-radio-label">{method.title}</span>
                          <span className="bb-checkout-radio-price">
                            {cost > 0 ? formatVnd(cost) : t("shippingMethodFree")}
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <p className="woocommerce-info">{t("errorShippingUnavailable")}</p>
                )}
              </div>

              <div id="payment" className="woocommerce-checkout-payment bb-checkout-payment">
                {optionsLoading ? (
                  <p className="woocommerce-info">{t("paymentLoading")}</p>
                ) : paymentMethods.length > 0 ? (
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} asChild>
                    <ul className="wc_payment_methods payment_methods methods">
                      {paymentMethods.map((method) => {
                        const code = normalizeMethodCode(method.code);
                        const checked = paymentMethod === method.code;
                        const description = paymentDescription(method.code);
                        return (
                          <li key={method.code} className={`wc_payment_method payment_method_${code.toLowerCase()}`}>
                            <label htmlFor={`payment_method_${method.code}`} className="bb-checkout-payment-label">
                              <RadioGroupItem value={method.code} id={`payment_method_${method.code}`} />
                              <span>{paymentLabel(method)}</span>
                            </label>
                            {checked && description && (
                              <div className={`payment_box payment_method_${code.toLowerCase()}`}>
                                <p>{description}</p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </RadioGroup>
                ) : (
                  <p className="woocommerce-error">{t("paymentNone")}</p>
                )}

                <div className="form-submit place-order">
                  <Button
                    type="submit"
                    variant="primary"
                    className="button alt"
                    disabled={submitting || cartLoading || !cart.items.length || belowMinOrder || selectedShippingZoneMismatch}
                  >
                    {submitting ? t("placingOrder") : t("placeOrder")}
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <aside className="bb-checkout-content-side">
            <div className="checkout-summary">
              <div className="checkout-summary-title">
                <h3>{t("summaryTitle")}</h3>
              </div>

              <div id="order_review" className="woocommerce-checkout-review-order">
                <table className="shop_table woocommerce-checkout-review-order-table">
                  <thead>
                    <tr>
                      <th className="product-name">{t("orderProducts")}</th>
                      <th className="product-total">{t("orderSubtotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr key={item.id} className="cart_item">
                        <td className="product-name">
                          {item.productName}
                          {item.variantName ? ` - ${item.variantName}` : ""}
                          <strong className="product-quantity"> x {item.quantity}</strong>
                        </td>
                        <td className="product-total">{formatVnd(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="cart-subtotal">
                      <th>{t("summarySubtotal")}</th>
                      <td>{formatVnd(cartSubtotal)}</td>
                    </tr>
                    <tr className="shipping">
                      <th>{t("summaryShipping")}</th>
                      <td>
                        {selectedShipping ? (
                          <>
                            <span>{selectedShipping.title}</span>
                            <span className="shipping-method-description">
                              {effectiveShippingCost > 0 ? formatVnd(effectiveShippingCost) : t("summaryShippingFree")}
                            </span>
                          </>
                        ) : (
                          <span>{t("errorShippingUnavailable")}</span>
                        )}
                      </td>
                    </tr>
                    {cart.totals.discountAmount > 0 && (
                      <tr className="cart-discount">
                        <th>{t("summaryDiscount")}</th>
                        <td className="discount">-{formatVnd(cart.totals.discountAmount)}</td>
                      </tr>
                    )}
                    <tr className="order-total">
                      <th>{t("summaryTotal")}</th>
                      <td>
                        <strong>{formatVnd(grandTotal)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <div className="summary total-summary">
                  <div className="summary--items">
                    <p>{t("summaryTotal")}</p>
                    <p className="total-price">{formatVnd(grandTotal)}</p>
                  </div>
                </div>

                {paymentMethod && (
                  <div className="bb-checkout-summary-payment">
                    <p>{t("summaryPaymentInfo")}</p>
                    <strong>{paymentLabel(paymentMethod)}</strong>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
