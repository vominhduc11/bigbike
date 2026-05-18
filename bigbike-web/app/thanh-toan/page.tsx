"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { checkoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd, paymentMethodLabel } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function pickSetting(
  settings: { settingKey: string; settingValue: string }[] | undefined,
  keys: string[],
): string {
  if (!settings) return "";
  for (const key of keys) {
    const v = settings.find((s) => s.settingKey === key)?.settingValue?.trim();
    if (v) return v;
  }
  return "";
}

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

function formatAddressLine(a: {
  addressLine1?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
}): string {
  return [a.addressLine1, a.ward, a.district, a.province].filter(Boolean).join(", ");
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
  const router = useRouter();
  const { refreshCount } = useCart();

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
  // Card-detail form for the "Visa / Master Card / JCB" (ALEPAY) option. Display-only
  // for visual parity with the design — see BUSINESS_RULES PAY_RULE_003. This data is
  // NEVER added to the checkout payload or transmitted to the server.
  const [cardForm, setCardForm] = useState({ holder: "", number: "", expiry: "", cvv: "" });
  // Order-summary collapse — toggleable on mobile only; desktop is always expanded.
  const [summaryOpen, setSummaryOpen] = useState(true);
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
    resolver: zodResolver(checkoutAddressSchema),
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
        setStep1Error("Vui lòng chọn một địa chỉ giao hàng.");
        return;
      }
      if (!selectedAddress.phone) {
        setStep1Error("Địa chỉ đã chọn chưa có số điện thoại. Vui lòng chọn địa chỉ khác hoặc nhập địa chỉ mới.");
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
      setSubmitError("Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi đặt hàng.");
      return;
    }
    if (!step1Done) {
      setSubmitError("Vui lòng hoàn tất thông tin giao hàng.");
      return;
    }
    if (!paymentMethod) {
      setSubmitError("Vui lòng chọn phương thức thanh toán.");
      return;
    }
    if (!shippingMethodId) {
      setSubmitError("Phương thức vận chuyển không khả dụng. Vui lòng thử lại.");
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
          Không tải được giỏ hàng. <Link href={toCartPath()} className="bb-link">Quay lại giỏ hàng</Link>
        </p>
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
                Thanh toán
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
                  Thông tin giao hàng
                </h2>
                {activeStep !== 1 && step1Done && (
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue hover:text-brand"
                  >
                    <Pencil className="w-4 h-4" aria-hidden /> Chỉnh sửa
                  </button>
                )}
              </div>

              {activeStep === 1 ? (
                <div className="px-6 pb-[22px]">
                  {hasAddressBook && (
                    <div className="flex flex-col gap-2.5 mb-4">
                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
                        <input
                          type="radio"
                          name="addressMode"
                          checked={addressMode === "book"}
                          onChange={() => setAddressMode("book")}
                          className="accent-brand m-0"
                        />
                        Sổ địa chỉ
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
                                  <span>{formatAddressLine(addr) || "Chưa có địa chỉ"}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
                        <input
                          type="radio"
                          name="addressMode"
                          checked={addressMode === "new"}
                          onChange={() => setAddressMode("new")}
                          className="accent-brand m-0"
                        />
                        Giao đến địa chỉ khác
                      </label>
                    </div>
                  )}

                  {addressMode === "new" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Họ và tên {reqMark}</label>
                        <Input
                          placeholder="Vui lòng nhập họ và tên..."
                          aria-invalid={!!addressErrors.fullName}
                          {...register("fullName")}
                        />
                        {addressErrors.fullName && (
                          <p className="text-sm text-destructive m-0">{addressErrors.fullName.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className={labelCls}>Số điện thoại {reqMark}</label>
                        <Input
                          type="tel"
                          inputMode="tel"
                          maxLength={12}
                          placeholder="Vui lòng nhập số điện thoại..."
                          aria-invalid={!!addressErrors.phone}
                          {...register("phone")}
                        />
                        {addressErrors.phone && (
                          <p className="text-sm text-destructive m-0">{addressErrors.phone.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 col-span-full">
                        <label className={labelCls}>Email</label>
                        <Input
                          type="email"
                          placeholder="Vui lòng nhập email..."
                          aria-invalid={!!addressErrors.email}
                          {...register("email")}
                        />
                        {addressErrors.email && (
                          <p className="text-sm text-destructive m-0">{addressErrors.email.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 col-span-full">
                        <label className={labelCls}>Địa chỉ nhận hàng {reqMark}</label>
                        <Input
                          placeholder="Vui lòng nhập địa chỉ nhận hàng..."
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
                      Tiếp tục
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-6 pb-[18px] text-sm text-muted-foreground">
                  <b className="text-foreground">{resolvedAddress.fullName}</b>
                  {resolvedAddress.phone ? ` · ${resolvedAddress.phone}` : ""}
                  <br />
                  {formatAddressLine(resolvedAddress)}
                </div>
              )}
            </div>

            {/* ── Step 2: Payment info ───────────────────────────────── */}
            <div className="bg-card border border-border border-t-0">
              <div className="flex items-center py-[18px] px-6">
                <h2 className="m-0 font-display font-semibold text-base uppercase text-foreground flex items-center gap-3 tracking-[0.04em]">
                  <StepBadge n={2} state={activeStep === 2 ? "active" : step1Done ? "todo" : "todo"} />
                  Thông tin thanh toán
                </h2>
              </div>

              {activeStep === 2 && (
                <div className="px-6 pb-[22px]">
                  {optionsLoading ? (
                    <p className="text-muted-foreground text-sm m-0">Đang tải phương thức thanh toán...</p>
                  ) : checkoutOptions?.paymentMethods.length ? (
                    <div className="flex flex-col">
                      {checkoutOptions.paymentMethods.map((method) => {
                        const code = method.code.toUpperCase();
                        const checked = paymentMethod === method.code;
                        return (
                          <div key={method.code}>
                            <label className="flex items-center gap-3 py-3 cursor-pointer border-b border-border last:border-b-0">
                              <input
                                type="radio"
                                name="paymentMethod"
                                value={method.code}
                                checked={checked}
                                onChange={() => setPaymentMethod(method.code)}
                                className="accent-brand m-0"
                              />
                              <b className="flex-1 text-sm text-foreground font-semibold">{method.title}</b>
                            </label>

                            {checked && code === "ALEPAY" && (
                              <div className="my-2 ml-7 grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                                {/* Display-only card form (PAY_RULE_003) — card data is
                                    held in local state and never sent to the server. */}
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                  <label className={labelCls}>Tên in trên thẻ {reqMark}</label>
                                  <Input
                                    placeholder="Vui lòng nhập tên chủ thẻ..."
                                    value={cardForm.holder}
                                    onChange={(e) => setCardForm((f) => ({ ...f, holder: e.target.value }))}
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                  <label className={labelCls}>Số thẻ {reqMark}</label>
                                  <Input
                                    inputMode="numeric"
                                    placeholder="Vui lòng nhập số thẻ..."
                                    value={cardForm.number}
                                    onChange={(e) =>
                                      setCardForm((f) => ({
                                        ...f,
                                        number: e.target.value
                                          .replace(/[^\d]/g, "")
                                          .slice(0, 19)
                                          .replace(/(\d{4})(?=\d)/g, "$1 "),
                                      }))
                                    }
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className={labelCls}>Ngày hết hạn {reqMark}</label>
                                  <Input
                                    inputMode="numeric"
                                    placeholder="MM/YY"
                                    maxLength={5}
                                    value={cardForm.expiry}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                                      setCardForm((f) => ({
                                        ...f,
                                        expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits,
                                      }));
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className={labelCls}>CVV {reqMark}</label>
                                  <Input
                                    inputMode="numeric"
                                    placeholder="•••"
                                    maxLength={4}
                                    value={cardForm.cvv}
                                    onChange={(e) =>
                                      setCardForm((f) => ({ ...f, cvv: e.target.value.replace(/[^\d]/g, "").slice(0, 4) }))
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            {checked && code === "BACS" && (
                              <div className="my-2 ml-7 bg-[var(--bb-color-gray-50)] border border-border p-4">
                                <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                                  Thông tin tài khoản
                                </p>
                                {bankHolder || bankNumber || bankName ? (
                                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                    {bankHolder && <span>Chủ tài khoản: <b className="text-foreground">{bankHolder}</b></span>}
                                    {bankNumber && <span>Số tài khoản: <b className="text-foreground">{bankNumber}</b></span>}
                                    {bankName && <span>Ngân hàng: <b className="text-foreground">{bankName}</b>{bankBranch ? ` — chi nhánh ${bankBranch}` : ""}</span>}
                                    <span>Nội dung chuyển khoản: <b className="text-foreground">Tên khách hàng + Mã đơn hàng</b></span>
                                  </div>
                                ) : (
                                  <p className="m-0 text-sm text-muted-foreground">
                                    Thông tin tài khoản sẽ được gửi kèm email xác nhận sau khi đặt hàng.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-brand text-sm m-0">
                      Phương thức thanh toán tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.
                    </p>
                  )}

                  {belowMinOrder && minOrderAmount && (
                    <p className="text-sm text-brand mt-3 m-0">
                      Đơn hàng chưa đạt giá trị tối thiểu {formatVnd(minOrderAmount)} cho phương thức vận chuyển.
                      Vui lòng mua thêm.
                    </p>
                  )}

                  {priceChanges.length > 0 && pendingOrderNav && (
                    <div className="bg-[var(--bb-color-gray-50)] border border-border p-[14px_18px] mt-3 text-sm text-foreground">
                      <p className="font-semibold mb-1.5 m-0">
                        Giá một số sản phẩm đã giảm khi đặt hàng — bạn được áp dụng giá mới:
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
                        Xem xác nhận đặt hàng
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
                      ‹ Quay lại
                    </button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={placeOrder}
                      disabled={submitting || cartLoading || !cart?.items.length || belowMinOrder}
                    >
                      {submitting ? "Đang đặt hàng..." : "Đặt hàng"}
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
                  Thông tin đơn đặt hàng
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
                  Hoá đơn
                </p>
                <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                  <span>Tạm tính:</span>
                  <b className="text-foreground font-bold">{formatVnd(cartSubtotal)}</b>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                  <span>Phí giao hàng:</span>
                  {effectiveShippingCost > 0 ? (
                    <b className="text-foreground font-bold">{formatVnd(effectiveShippingCost)}</b>
                  ) : (
                    <span className="italic">Miễn phí</span>
                  )}
                </div>
                {cart && cart.totals.discountAmount > 0 && (
                  <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                    <span>Khuyến mãi:</span>
                    <b className="text-blue font-bold">−{formatVnd(cart.totals.discountAmount)}</b>
                  </div>
                )}
              </div>

              <div className="bg-[var(--bb-color-gray-50)] border-y border-border py-[14px] px-5 flex items-baseline justify-between gap-3">
                <span className="font-display uppercase font-semibold text-foreground tracking-[0.04em] text-sm">
                  Tổng tạm tính:
                </span>
                <b className="font-display text-22 text-brand font-bold tracking-[0.01em]">{formatVnd(grandTotal)}</b>
              </div>

              {step1Done && (
                <div className="py-[14px] px-5 border-b border-border">
                  <p className="m-0 mb-2 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                    Thông tin giao hàng
                  </p>
                  <b className="block text-sm text-foreground">{resolvedAddress.fullName || "—"}</b>
                  <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                    {resolvedAddress.phone && <span>{resolvedAddress.phone}</span>}
                    {resolvedAddress.email && <span>{resolvedAddress.email}</span>}
                    <span>{formatAddressLine(resolvedAddress)}</span>
                  </div>
                </div>
              )}

              {step1Done && paymentMethod && (
                <div className="py-[14px] px-5">
                  <p className="m-0 mb-1 font-display font-semibold text-sm uppercase text-foreground tracking-[0.04em]">
                    Thông tin thanh toán
                  </p>
                  <p className="m-0 text-sm text-muted-foreground">{paymentMethodLabel(paymentMethod)}</p>
                </div>
              )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky action bar — total + step CTA. Hidden on desktop where the
          step cards keep their own inline buttons. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border lg:hidden">
        <div className="bb-container py-3 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground leading-none">Tổng</span>
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
