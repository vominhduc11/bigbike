"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck, CreditCard, Check, Pencil, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import {
  useCartQuery,
  useCheckoutOptions,
  useProfile,
  useAddresses,
  usePublicSettings,
} from "@/lib/query/hooks";
import type { CartItem, CustomerAddress, PriceChange } from "@/lib/contracts/commerce";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer } from "@/lib/analytics";
import { formatAddress, formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { pickSetting } from "@/lib/utils/settings";
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

function pickDefaultAddress(addresses: CustomerAddress[]): CustomerAddress | null {
  if (!addresses.length) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}

type StepState = "active" | "done" | "todo";

// Red rotated-square step badge, matching the BigBike checkout mockup.
function StepBadge({ n, state }: { n: number; state: StepState }) {
  const bg = state === "active" ? "bg-brand" : state === "done" ? "bg-foreground" : "bg-muted";
  const fg = state === "todo" ? "text-muted-foreground" : "text-white";
  return (
    <span className={`inline-flex w-7 h-7 rotate-45 items-center justify-center ${bg} flex-shrink-0`}>
      <b className={`-rotate-45 font-bold text-sm ${fg}`}>{n}</b>
    </span>
  );
}

export default function CheckoutPage() {
  const t = useTranslations("Checkout");
  const tValidation = useTranslations("Checkout.validation");
  const tPayment = useTranslations("Checkout.paymentMethod");
  const tCart = useTranslations("Cart");
  const router = useRouter();
  const { refreshCount } = useCart();

  // Locale-aware payment method label (falls back to the backend's translated title when available).
  function paymentLabel(code: string | null | undefined) {
    const upper = (code ?? "").trim().toUpperCase();
    if (upper === "") return tPayment("EMPTY");
    if (upper === "COD" || upper === "BACS") return tPayment(upper);
    return tPayment("UNKNOWN", { method: code ?? "" });
  }

  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [step1Done, setStep1Done] = useState(false);
  const [addressMode, setAddressMode] = useState<"book" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [pendingOrderNav, setPendingOrderNav] = useState<{ orderNumber: string; orderKey: string } | null>(null);
  const [gtmFired, setGtmFired] = useState(false);
  // Order-summary collapse — toggleable on mobile only; desktop is always expanded.
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [customerNote, setCustomerNote] = useState("");
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const hasPrefilledRef = useRef(false);

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const { data: checkoutOptions, isLoading: optionsLoading } = useCheckoutOptions();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();
  const { data: settings } = usePublicSettings();

  const {
    register,
    trigger,
    watch,
    setValue,
    formState: { errors: addressErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema(tValidation)),
    defaultValues: { country: "VN" },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const formAddress = watch();

  // Prefill payment + shipping defaults once options load.
  useEffect(() => {
    if (!checkoutOptions) return;
    setPaymentMethod((prev) => prev || checkoutOptions.paymentMethods[0]?.code || "");
    setShippingMethodId((prev) => prev || checkoutOptions.shippingMethods[0]?.id || "");
  }, [checkoutOptions]);

  // Fire GTM begin_checkout once cart is loaded.
  useEffect(() => {
    if (!cart || gtmFired) return;
    pushDataLayer("begin_checkout", {
      currency: cart.currency ?? "VND",
      value: cart.totals.totalAmount,
      items: toGtmCartItems(cart.items),
    });
    setGtmFired(true);
  }, [cart, gtmFired]);

  // Prefill from account once profile + addresses have loaded — runs only once.
  useEffect(() => {
    if (hasPrefilledRef.current) return;
    if (!profile) return;
    if (addresses === undefined) return;
    hasPrefilledRef.current = true;

    const addr = pickDefaultAddress(addresses);
    if (addr) {
      setAddressMode("book");
      setSelectedAddressId(addr.id);
    } else {
      setAddressMode("new");
      if (profile.displayName) setValue("fullName", profile.displayName);
      if (profile.phone) setValue("phone", profile.phone);
      if (profile.email) setValue("email", profile.email);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, addresses]);

  const hasAddressBook = !!profile && !!addresses && addresses.length > 0;
  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  );

  // Unified shipping address used for both the order payload and the summary.
  const resolvedAddress = useMemo(() => {
    if (addressMode === "book" && selectedAddress) {
      return {
        fullName: selectedAddress.fullName ?? "",
        phone: selectedAddress.phone ?? "",
        email: profile?.email ?? "",
        country: selectedAddress.country || "VN",
        province: selectedAddress.province ?? "",
        district: selectedAddress.district ?? "",
        ward: selectedAddress.ward ?? "",
        addressLine1: selectedAddress.addressLine1 ?? "",
      };
    }
    return {
      fullName: formAddress.fullName ?? "",
      phone: formAddress.phone ?? "",
      email: formAddress.email ?? "",
      country: formAddress.country || "VN",
      province: formAddress.province ?? "",
      district: formAddress.district ?? "",
      ward: formAddress.ward ?? "",
      addressLine1: formAddress.addressLine1 ?? "",
    };
  }, [addressMode, selectedAddress, formAddress, profile]);

  const selectedShipping = checkoutOptions?.shippingMethods.find((m) => m.id === shippingMethodId);
  const cartSubtotal = cart?.totals.subtotalAmount ?? 0;
  const cartTotal = cart?.totals.totalAmount ?? 0;
  const freeShippingThreshold = selectedShipping?.freeShippingThreshold ?? null;
  const minOrderAmount = selectedShipping?.minOrderAmount ?? null;
  const qualifiesForFreeShipping =
    freeShippingThreshold !== null && freeShippingThreshold !== undefined && freeShippingThreshold > 0
      ? cartSubtotal >= freeShippingThreshold
      : false;
  const effectiveShippingCost = qualifiesForFreeShipping ? 0 : (selectedShipping?.cost ?? 0);
  const grandTotal = cartTotal + effectiveShippingCost;
  const belowMinOrder =
    minOrderAmount !== null && minOrderAmount !== undefined && minOrderAmount > 0
      ? cartSubtotal < minOrderAmount
      : false;

  // Bank-transfer account info, shown inline when BACS is selected.
  const bankName = pickSetting(settings, ["bank_name"]);
  const bankNumber = pickSetting(settings, ["bank_account_number", "bank_number"]);
  const bankHolder = pickSetting(settings, ["bank_account_holder", "bank_holder"]);
  const bankBranch = pickSetting(settings, ["bank_branch"]);

  async function handleStep1Continue() {
    setStep1Error("");
    if (addressMode === "book") {
      if (!selectedAddress) {
        setStep1Error(t("step1MissingAddress"));
        return;
      }
      if (!selectedAddress.phone) {
        setStep1Error(t("step1MissingPhone"));
        return;
      }
    } else {
      const valid = await trigger();
      if (!valid) return;
    }
    setStep1Done(true);
    setActiveStep(2);
  }

  async function placeOrder() {
    if (!cart?.items.length) {
      setSubmitError(t("errorEmptyCart"));
      return;
    }
    if (!step1Done) {
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
    if (paymentMethod === "BACS" && !resolvedAddress.email?.trim()) {
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
            email: resolvedAddress.email || "",
            country: resolvedAddress.country,
            province: resolvedAddress.province,
            district: resolvedAddress.district,
            ward: resolvedAddress.ward || "",
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

  if (cartLoading && optionsLoading && !cart) {
    return <CheckoutSkeleton />;
  }

  if (cartError) {
    return (
      <div className="bb-container py-8">
        <p className="text-brand text-sm mb-4 m-0">
          {t("loadCartFailed")} <Link href={toCartPath()} className="bb-link">{t("backToCart")}</Link>
        </p>
      </div>
    );
  }

  if (cart && cart.items.length === 0) {
    return (
      <div className="bb-container py-12 flex flex-col items-center gap-5 text-center">
        <p className="m-0 font-display text-lg font-semibold uppercase text-foreground tracking-[0.04em]">
          {tCart("emptyHeading")}
        </p>
        <p className="m-0 text-sm text-muted-foreground">{tCart("emptyDescription")}</p>
        <Button asChild variant="primary">
          <Link href={toCartPath()}>{t("viewCart")}</Link>
        </Button>
      </div>
    );
  }

  const labelCls = "text-sm font-semibold tracking-[0.04em] text-foreground";
  const reqMark = <span className="text-brand ml-[3px]">*</span>;

  return (
    <>
      {/* Extra bottom padding on mobile so the sticky action bar never covers content. */}
      <div className="bb-container py-6 pb-[60px] max-lg:pb-[96px]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-[30px] items-start">
          {/* LEFT: stepped checkout */}
          <div className="min-w-0">
            {/* Title bar with step icons */}
            <div className="bg-card border border-border py-[14px] px-6 flex items-center justify-between">
              <h1 className="m-0 font-display font-semibold text-xl uppercase text-foreground tracking-[0.04em]">
                {t("title")}
              </h1>
              <div className="flex items-center gap-2">
                <Truck className={`w-6 h-6 ${activeStep === 1 ? "text-brand" : "text-muted-foreground"}`} aria-hidden />
                <span className="text-muted-foreground" aria-hidden>›</span>
                <CreditCard className={`w-6 h-6 ${activeStep === 2 ? "text-brand" : "text-muted-foreground"}`} aria-hidden />
              </div>
            </div>

            {/* ── Step 1: Shipping info ───────────────────────────────── */}
            <div className="bg-card border border-border border-t-0">
              <div className="flex items-center justify-between py-[18px] px-6">
                <h2 className="m-0 font-display font-semibold text-base uppercase text-foreground flex items-center gap-3 tracking-[0.04em]">
                  <StepBadge n={1} state={activeStep === 1 ? "active" : "done"} />
                  {t("step1Title")}
                </h2>
                {activeStep !== 1 && step1Done && (
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue hover:text-brand"
                  >
                    <Pencil className="w-4 h-4" aria-hidden /> {t("edit")}
                  </button>
                )}
              </div>

              {activeStep === 1 ? (
                <div className="px-6 pb-[22px]">
                  {hasAddressBook && (
                    <div className="mb-4">
                      <RadioGroup
                        value={addressMode}
                        onValueChange={(v) => setAddressMode(v as "book" | "new")}
                        className="gap-2.5"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
                          <RadioGroupItem value="book" id="addr-book" />
                          <span>{t("addressBook")}</span>
                        </label>
                        {addressMode === "book" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px] pl-[26px]">
                            {addresses!.map((addr) => {
                              const active = addr.id === selectedAddressId;
                              return (
                                <button
                                  type="button"
                                  key={addr.id}
                                  onClick={() => setSelectedAddressId(addr.id)}
                                  className={`text-left bg-white border p-4 transition-colors ${active ? "border-brand" : "border-border hover:border-[var(--bb-brand-primary-border)]"}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <b className="font-semibold text-foreground text-sm">{addr.fullName ?? "—"}</b>
                                    <span
                                      className={`inline-flex w-[18px] h-[18px] rounded-full items-center justify-center flex-shrink-0 ${active ? "bg-brand text-white" : "border border-border"}`}
                                    >
                                      {active && <Check className="w-3 h-3" aria-hidden />}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                                    {addr.phone && <span>{addr.phone}</span>}
                                    {(addr.email ?? profile?.email) && <span>{addr.email ?? profile?.email}</span>}
                                    <span>{formatAddress([addr.addressLine1, addr.ward, addr.district, addr.province]) || t("addressMissing")}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
                          <RadioGroupItem value="new" id="addr-new" />
                          <span>{t("newAddress")}</span>
                        </label>
                      </RadioGroup>
                    </div>
                  )}

                  {addressMode === "new" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>{t("fullName")} {reqMark}</label>
                        <Input
                          placeholder={t("fullNamePlaceholder")}
                          aria-invalid={!!addressErrors.fullName}
                          {...register("fullName")}
                        />
                        {addressErrors.fullName && (
                          <p className="text-sm text-destructive m-0">{addressErrors.fullName.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>{t("phone")} {reqMark}</label>
                        <Input
                          type="tel"
                          inputMode="tel"
                          maxLength={12}
                          placeholder={t("phonePlaceholder")}
                          aria-invalid={!!addressErrors.phone}
                          {...register("phone")}
                        />
                        {addressErrors.phone && (
                          <p className="text-sm text-destructive m-0">{addressErrors.phone.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 col-span-full">
                        <label className={labelCls}>{t("email")}</label>
                        <Input
                          type="email"
                          placeholder={t("emailPlaceholder")}
                          aria-invalid={!!addressErrors.email}
                          {...register("email")}
                        />
                        {addressErrors.email && (
                          <p className="text-sm text-destructive m-0">{addressErrors.email.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 col-span-full">
                        <label className={labelCls}>{t("address")} {reqMark}</label>
                        <Input
                          placeholder={t("addressPlaceholder")}
                          aria-invalid={!!addressErrors.addressLine1}
                          {...register("addressLine1")}
                        />
                        {addressErrors.addressLine1 && (
                          <p className="text-sm text-destructive m-0">{addressErrors.addressLine1.message}</p>
                        )}
                      </div>

                      <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
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
                          labelClassName={labelCls}
                        />
                      </div>
                      {(addressErrors.province || addressErrors.district) && (
                        <p className="text-sm text-destructive col-span-full m-0">
                          {addressErrors.province?.message ?? addressErrors.district?.message}
                        </p>
                      )}
                    </div>
                  )}

                  {step1Error && <p className="text-brand text-sm mt-3 m-0">{step1Error}</p>}

                  <div className="flex justify-end mt-5">
                    <Button type="button" variant="primary" onClick={handleStep1Continue}>
                      {t("continue")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-6 pb-[18px] text-sm text-muted-foreground">
                  <b className="text-foreground">{resolvedAddress.fullName}</b>
                  {resolvedAddress.phone ? ` · ${resolvedAddress.phone}` : ""}
                  <br />
                  {formatAddress([resolvedAddress.addressLine1, resolvedAddress.ward, resolvedAddress.district, resolvedAddress.province])}
                </div>
              )}
            </div>

            {/* ── Step 2: Payment info ───────────────────────────────── */}
            <div className="bg-card border border-border border-t-0">
              <div className="flex items-center py-[18px] px-6">
                <h2 className="m-0 font-display font-semibold text-base uppercase text-foreground flex items-center gap-3 tracking-[0.04em]">
                  <StepBadge n={2} state={activeStep === 2 ? "active" : step1Done ? "todo" : "todo"} />
                  {t("step2Title")}
                </h2>
              </div>

              {activeStep === 2 && (
                <div className="px-6 pb-[22px]">
                  {/* ── Shipping method picker ─── */}
                  {optionsLoading ? null : (() => {
                    const methods = checkoutOptions?.shippingMethods ?? [];
                    if (methods.length === 0) return null;
                    const userRegion = step1Done ? getVietnamRegion(resolvedAddress.province) : null;
                    if (methods.length === 1) {
                      const m = methods[0];
                      const cost = (m.freeShippingThreshold != null && m.freeShippingThreshold > 0 && cartSubtotal >= m.freeShippingThreshold)
                        ? 0
                        : m.cost;
                      return (
                        <div className="mb-5">
                          <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                            {t("shippingMethodSectionTitle")}
                          </p>
                          <p className="m-0 text-sm text-foreground">
                            {m.title} — <span className="italic text-muted-foreground">{cost > 0 ? formatVnd(cost) : t("shippingMethodFree")}</span>
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="mb-5">
                        <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                          {t("shippingMethodSectionTitle")}
                        </p>
                        <RadioGroup
                          value={shippingMethodId}
                          onValueChange={setShippingMethodId}
                          className="gap-0"
                        >
                          {methods.map((m) => {
                            const cost = (m.freeShippingThreshold != null && m.freeShippingThreshold > 0 && cartSubtotal >= m.freeShippingThreshold)
                              ? 0
                              : m.cost;
                            const zoneMismatch =
                              m.zoneRegionCode != null &&
                              userRegion !== null &&
                              userRegion !== m.zoneRegionCode;
                            const radio = (
                              <label
                                className={cn(
                                  "flex items-center gap-3 py-3 cursor-pointer border-b border-border last:border-b-0",
                                  zoneMismatch && "opacity-50 cursor-not-allowed",
                                )}
                              >
                                <RadioGroupItem
                                  value={m.id}
                                  id={`sm-${m.id}`}
                                  disabled={zoneMismatch}
                                />
                                <span className="flex-1 text-sm text-foreground font-semibold">
                                  {m.title}
                                </span>
                                <span className="text-sm text-muted-foreground italic">
                                  {cost > 0 ? formatVnd(cost) : t("shippingMethodFree")}
                                </span>
                              </label>
                            );
                            return (
                              <div key={m.id}>
                                {zoneMismatch ? (
                                  <BBTooltip content={t("shippingZoneMismatch")}>
                                    {radio}
                                  </BBTooltip>
                                ) : radio}
                              </div>
                            );
                          })}
                        </RadioGroup>
                      </div>
                    );
                  })()}

                  {/* ── Payment method picker ─── */}
                  {optionsLoading ? (
                    <p className="text-muted-foreground text-sm m-0">{t("paymentLoading")}</p>
                  ) : checkoutOptions?.paymentMethods.length ? (
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                      className="gap-0"
                    >
                      {checkoutOptions.paymentMethods.map((method) => {
                        const code = method.code.toUpperCase();
                        const checked = paymentMethod === method.code;
                        return (
                          <div key={method.code}>
                            <label className="flex items-center gap-3 py-3 cursor-pointer border-b border-border last:border-b-0">
                              <RadioGroupItem value={method.code} id={`pm-${method.code}`} />
                              <b className="flex-1 text-sm text-foreground font-semibold">{method.title}</b>
                            </label>

                            {checked && code === "BACS" && (
                              <div className="my-2 ml-7 bg-[var(--bb-color-gray-50)] border border-border p-4">
                                <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                                  {t("bankInfoTitle")}
                                </p>
                                {bankHolder || bankNumber || bankName ? (
                                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                    {bankHolder && <span>{t("bankHolder")} <b className="text-foreground">{bankHolder}</b></span>}
                                    {bankNumber && <span>{t("bankNumber")} <b className="text-foreground">{bankNumber}</b></span>}
                                    {bankName && <span>{t("bankName")} <b className="text-foreground">{bankName}</b>{bankBranch ? t("bankBranchSuffix", { branch: bankBranch }) : ""}</span>}
                                    <span>{t("bankTransferNote")} <b className="text-foreground">{t("bankTransferNoteValue")}</b></span>
                                  </div>
                                ) : (
                                  <p className="m-0 text-sm text-muted-foreground">
                                    {t("bankInfoFallback")}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </RadioGroup>
                  ) : (
                    <p className="text-brand text-sm m-0">
                      {t("paymentNone")}
                    </p>
                  )}

                  {/* ── Order note ─── */}
                  <div className="flex flex-col gap-1.5 mt-5">
                    <label className={labelCls}>{t("noteLabel")}</label>
                    <Textarea
                      placeholder={t("notePlaceholder")}
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {belowMinOrder && minOrderAmount && (
                    <p className="text-sm text-brand mt-3 m-0">
                      {t("belowMinOrder", { amount: formatVnd(minOrderAmount) })}
                    </p>
                  )}

                  {priceChanges.length > 0 && pendingOrderNav && (
                    <div className="bg-[var(--bb-color-gray-50)] border border-border p-[14px_18px] mt-3 text-sm text-foreground">
                      <p className="font-semibold mb-1.5 m-0">
                        {t("priceChanged")}
                      </p>
                      <ul className="m-0 mb-2 ml-4">
                        {priceChanges.map((pc, i) => (
                          <li key={i}>
                            {pc.productName}: {formatVnd(pc.oldPrice)} → {formatVnd(pc.newPrice)}
                          </li>
                        ))}
                      </ul>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey))}
                      >
                        {t("viewOrderConfirmation")}
                      </Button>
                    </div>
                  )}

                  {submitError && <p className="text-brand text-sm mt-3 m-0">{submitError}</p>}

                  <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="font-display font-semibold text-sm tracking-[0.04em] uppercase text-foreground hover:text-brand"
                    >
                      {t("back")}
                    </button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={placeOrder}
                      disabled={submitting || cartLoading || !cart?.items.length || belowMinOrder}
                    >
                      {submitting ? t("placingOrder") : t("placeOrder")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: order summary (sticky) */}
          <aside>
            <div className="bg-card border border-border self-start overflow-hidden sticky top-[calc(var(--bb-header-height)+20px)] max-[992px]:static">
              <button
                type="button"
                onClick={() => setSummaryOpen((v) => !v)}
                aria-expanded={summaryOpen}
                className="w-full bg-[var(--bb-color-gray-50)] py-[14px] px-5 border-b border-border flex items-center justify-between gap-3 lg:cursor-default"
              >
                <h3 className="m-0 font-display font-semibold text-base uppercase text-foreground tracking-[0.04em]">
                  {t("summaryTitle")}
                </h3>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform lg:hidden",
                    summaryOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {/* Body collapses on mobile; always expanded on desktop (lg:block). */}
              <div className={cn(summaryOpen ? "block" : "hidden", "lg:block")}>
              <div className="py-[14px] px-5">
                <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                  {t("summaryInvoice")}
                </p>
                <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                  <span>{t("summarySubtotal")}</span>
                  <b className="text-foreground font-bold">{formatVnd(cartSubtotal)}</b>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                  <span>{t("summaryShipping")}</span>
                  {effectiveShippingCost > 0 ? (
                    <b className="text-foreground font-bold">{formatVnd(effectiveShippingCost)}</b>
                  ) : (
                    <span className="italic">{t("summaryShippingFree")}</span>
                  )}
                </div>
                {cart && cart.totals.discountAmount > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                    <span>{t("summaryDiscount")}</span>
                    <b className="text-blue font-bold">−{formatVnd(cart.totals.discountAmount)}</b>
                  </div>
                )}
              </div>

              <div className="bg-[var(--bb-color-gray-50)] border-y border-border py-[14px] px-5 flex items-baseline justify-between gap-3">
                <span className="font-display uppercase font-semibold text-foreground tracking-[0.04em] text-sm">
                  {t("summaryTotal")}
                </span>
                <b className="font-display text-22 text-brand font-bold tracking-[0.01em]">{formatVnd(grandTotal)}</b>
              </div>

              {step1Done && (
                <div className="py-[14px] px-5 border-b border-border">
                  <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                    {t("summaryShippingInfo")}
                  </p>
                  <b className="block text-sm text-foreground">{resolvedAddress.fullName || "—"}</b>
                  <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                    {resolvedAddress.phone && <span>{resolvedAddress.phone}</span>}
                    {resolvedAddress.email && <span>{resolvedAddress.email}</span>}
                    <span>{formatAddress([resolvedAddress.addressLine1, resolvedAddress.ward, resolvedAddress.district, resolvedAddress.province])}</span>
                  </div>
                </div>
              )}

              {step1Done && paymentMethod && (
                <div className="py-[14px] px-5">
                  <p className="m-0 mb-1 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                    {t("summaryPaymentInfo")}
                  </p>
                  <p className="m-0 text-sm text-muted-foreground">{paymentLabel(paymentMethod)}</p>
                </div>
              )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky action bar — total + step CTA. Hidden on desktop where the
          step cards keep their own inline buttons. Right padding clears the
          floating chat button so it never covers the CTA. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border lg:hidden">
        <div className="bb-container py-3 pr-20 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground leading-none">{t("totalLabel")}</span>
            <b className="font-display text-lg text-brand font-bold tracking-[0.01em]">{formatVnd(grandTotal)}</b>
          </div>
          {activeStep === 1 ? (
            <Button type="button" variant="primary" onClick={handleStep1Continue}>
              Tiếp tục
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={placeOrder}
              disabled={submitting || cartLoading || !cart?.items.length || belowMinOrder}
            >
              {submitting ? "Đang đặt hàng..." : "Đặt hàng"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
