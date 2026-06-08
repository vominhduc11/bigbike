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
import { formatAddress, formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { Container } from "@/components/layout/Container";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getVietnamRegion } from "@/lib/utils/vn-region";

const coStepCard =
  "border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-surface)] px-3.5 py-4 md:px-6 md:py-6";
const coGrid = "grid grid-cols-1 gap-3";
const coSectionH3 =
  "m-0 mb-3 font-body text-ui-16 font-semibold uppercase leading-[1.2]";
const coRadioRow =
  "flex min-h-11 items-center gap-2.5 border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-surface)] px-3 py-2.5";
const coCardRaised =
  "mt-3.5 border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-surface-raised)] p-3";

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
    <div className="mb-6">
      <h2 className="m-0 flex items-center gap-2.5 font-body text-ui-18 font-semibold uppercase leading-[1.15]">
        <span className="inline-flex h-5 w-5 shrink-0 rotate-45 items-center justify-center bg-brand text-[var(--bb-text-inverse)] [box-shadow:var(--bb-shadow-md)]">
          <b className="-rotate-45 font-cta text-ui-12 font-semibold leading-none">{step}</b>
        </span>
        {children}
      </h2>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="m-0 mt-1 text-sm text-brand">{message}</p>;
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
      <Container className="cart-table bb-checkout-page">
        <p className="woocommerce-info">{t("loading")}</p>
      </Container>
    );
  }

  if (cartError) {
    return (
      <Container className="cart-table bb-checkout-page">
        <div className="woocommerce-error" role="alert">
          {t("loadCartFailed")} <Link href={toCartPath()}>{t("backToCart")}</Link>
        </div>
      </Container>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Container className="cart-table bb-checkout-page">
        <div className="cart-empty woocommerce-info" role="status">
          {tCart("emptyHeading")}
        </div>
        <p className="return-to-shop">
          <Button asChild variant="primary" className="button wc-backward">
            <Link href={toCartPath()}>{t("viewCart")}</Link>
          </Button>
        </p>
      </Container>
    );
  }

  const reqMark = (
    <abbr className="required" title={t("required")}>
      *
    </abbr>
  );

  return (
    <Container className="cart-table bb-checkout-page">
      <div className="check-out-title mb-5 border-b border-[var(--bb-border-subtle)] pb-4">
        <h1 className="m-0 font-body text-h1 font-semibold uppercase leading-[1.08]">{t("title")}</h1>
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:items-start md:gap-8">
          <div className="min-w-0">
            <section className={cn(coStepCard, "mb-6")}>
              <CheckoutStepTitle step={1}>{t("step1Title")}</CheckoutStepTitle>

              <div className={coGrid}>
                <div className="min-w-0">
                  <label htmlFor="billing_full_name">
                    {t("fullName")} {reqMark}
                  </label>
                  <Input
                    id="billing_full_name"
                    placeholder={t("fullNamePlaceholder")}
                    autoComplete="name"
                    aria-invalid={!!addressErrors.fullName}
                    {...register("fullName")}
                  />
                  <FieldError message={addressErrors.fullName?.message} />
                </div>

                <div className="min-w-0">
                  <label htmlFor="billing_phone">
                    {t("phone")} {reqMark}
                  </label>
                  <Input
                    id="billing_phone"
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

                <div className="min-w-0">
                  <label htmlFor="billing_email">{t("email")}</label>
                  <Input
                    id="billing_email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    autoComplete="email"
                    aria-invalid={!!addressErrors.email}
                    {...register("email")}
                  />
                  <FieldError message={addressErrors.email?.message} />
                </div>

                <div className="min-w-0">
                  <label htmlFor="billing_address_1">
                    {t("address")} {reqMark}
                  </label>
                  <Input
                    id="billing_address_1"
                    placeholder={t("addressPlaceholder")}
                    autoComplete="address-line1"
                    aria-invalid={!!addressErrors.addressLine1}
                    {...register("addressLine1")}
                  />
                  <FieldError message={addressErrors.addressLine1?.message} />
                </div>

                <div className={coGrid}>
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
                  <p className="min-w-0">
                    {addressErrors.province?.message ?? addressErrors.district?.message}
                  </p>
                )}
              </div>

              <div className="mt-3.5 min-w-0">
                <label htmlFor="order_comments">
                  {t("noteLabel")} <span className="optional">{t("noteOptional")}</span>
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
            </section>

            <section className={cn(coStepCard, "mb-6")}>
              <CheckoutStepTitle step={2}>{t("step2Title")}</CheckoutStepTitle>

              <div className="mt-3.5 grid grid-cols-1 gap-3 border-t border-[var(--bb-border-subtle)] pt-3.5">
                <h3 className={coSectionH3}>{t("shippingMethodSectionTitle")}</h3>
                {optionsLoading ? (
                  <p className="woocommerce-info">{t("paymentLoading")}</p>
                ) : shippingMethods.length > 0 ? (
                  <RadioGroup value={shippingMethodId} onValueChange={setShippingMethodId} className={coGrid}>
                    {shippingMethods.map((method) => {
                      const disabled = isZoneMismatch(method, userRegion);
                      const cost = effectiveMethodCost(method, cartSubtotal);
                      return (
                        <label
                          key={method.id}
                          className={cn(coRadioRow, disabled && "opacity-50")}
                          htmlFor={`shipping_method_${method.id}`}
                        >
                          <RadioGroupItem
                            value={method.id}
                            id={`shipping_method_${method.id}`}
                            disabled={disabled}
                          />
                          <span className="min-w-0 flex-1 font-semibold">{method.title}</span>
                          <span className="whitespace-nowrap font-cta font-semibold text-brand">
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

              <div id="payment" className="mt-3.5 border-t border-[var(--bb-border-subtle)] pt-3.5">
                {optionsLoading ? (
                  <p className="woocommerce-info">{t("paymentLoading")}</p>
                ) : paymentMethods.length > 0 ? (
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} asChild>
                    <ul className="gap-2.5">
                      {paymentMethods.map((method) => {
                        const checked = paymentMethod === method.code;
                        const description = paymentDescription(method.code);
                        return (
                          <li key={method.code}>
                            <label htmlFor={`payment_method_${method.code}`} className={coRadioRow}>
                              <RadioGroupItem value={method.code} id={`payment_method_${method.code}`} />
                              <span>{paymentLabel(method)}</span>
                            </label>
                            {checked && description && (
                              <div className="border border-t-0 border-[var(--bb-border-subtle)] bg-[var(--bb-bg-surface-raised)] p-3 text-ui-14 leading-[1.5]">
                                <p className="m-0">{description}</p>
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

                <div className="mt-3.5">
                  <Button
                    type="submit"
                    variant="primary"
                    className="!min-h-[52px] w-full font-cta text-ui-14 font-semibold uppercase tracking-normal"
                    disabled={submitting || cartLoading || !cart.items.length || belowMinOrder || selectedShippingZoneMismatch}
                  >
                    {submitting ? t("placingOrder") : t("placeOrder")}
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <aside className="min-w-0 md:sticky md:top-[calc(var(--bb-header-stack)+16px)]">
            <div className={coStepCard}>
              <div className="checkout-summary-title">
                <h3 className={coSectionH3}>{t("summaryTitle")}</h3>
              </div>

              <div id="order_review">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="product-name text-left">{t("orderProducts")}</th>
                      <th className="product-total whitespace-nowrap text-right">{t("orderSubtotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.items.map((item) => (
                      <tr key={item.id} className="cart_item">
                        <td className="product-name break-words text-left">
                          {item.productName}
                          {item.variantName ? ` - ${item.variantName}` : ""}
                          <strong className="product-quantity"> x {item.quantity}</strong>
                        </td>
                        <td className="product-total whitespace-nowrap text-right align-top">{formatVnd(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="cart-subtotal">
                      <th className="text-left">{t("summarySubtotal")}</th>
                      <td className="whitespace-nowrap text-right">{formatVnd(cartSubtotal)}</td>
                    </tr>
                    <tr className="shipping">
                      <th className="text-left">{t("summaryShipping")}</th>
                      <td className="text-right">
                        {selectedShipping ? (
                          <>
                            <span>{selectedShipping.title}</span>
                            <span className="shipping-method-description block whitespace-nowrap">
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
                        <th className="text-left">{t("summaryDiscount")}</th>
                        <td className="discount whitespace-nowrap text-right">-{formatVnd(cart.totals.discountAmount)}</td>
                      </tr>
                    )}
                    <tr className="order-total">
                      <th className="text-left">{t("summaryTotal")}</th>
                      <td className="whitespace-nowrap text-right">
                        <strong>{formatVnd(grandTotal)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <div className={coCardRaised}>
                  <div>
                    <p>{t("summaryTotal")}</p>
                    <p>{formatVnd(grandTotal)}</p>
                  </div>
                </div>

                {paymentMethod && (
                  <div className={coCardRaised}>
                    <p className="m-0">{t("summaryPaymentInfo")}</p>
                    <strong className="m-0">{paymentLabel(paymentMethod)}</strong>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </form>
    </Container>
  );
}
