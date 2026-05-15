"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import { useCartQuery, useCheckoutOptions, useProfile, useAddresses } from "@/lib/query/hooks";
import type { CartItem, CustomerAddress, PriceChange } from "@/lib/contracts/commerce";
import { checkoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const PAY_LOGO_STYLE: Record<string, string> = {
  COD: "bg-[#222] text-white border border-white/20",
  BACS: "bg-[#005ba4] text-white",
  MOMO: "bg-[#a50064] text-white",
  VNPAY: "bg-[#005ba4] text-white",
};

const PAYMENT_DESC: Record<string, string> = {
  COD: "Thanh toán khi nhận hàng — kiểm tra hàng rồi mới trả tiền.",
  BACS: "Chuyển khoản ngân hàng — thông tin TK gửi qua email sau khi đặt hàng.",
};

function MiniRadioStackSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="grid gap-[10px]" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bb-skel" style={{ height: 56, borderRadius: "var(--bb-radius-sm)", width: "100%" }} />
      ))}
    </div>
  );
}

function MiniSummarySkeleton() {
  return (
    <div aria-busy="true" className="bb-skel-stack">
      {[0, 1].map((i) => (
        <div key={i} className="bb-skel-row">
          <span className="bb-skel" style={{ width: 56, height: 56, borderRadius: "var(--bb-radius-sm)" }} />
          <div className="bb-skel-col" style={{ flex: 1 }}>
            <span className="bb-skel bb-skel--text bb-skel-w-50" />
            <span className="bb-skel bb-skel--text bb-skel-w-80" />
          </div>
        </div>
      ))}
      <span className="bb-skel bb-skel--text bb-skel-w-100" />
      <span className="bb-skel bb-skel--text bb-skel-w-100" />
      <span className="bb-skel bb-skel--title bb-skel-w-60" style={{ height: "1.4em" }} />
    </div>
  );
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

function MiniCartThumb({ item }: { item: CartItem }) {
  return (
    <div className="relative w-14 h-14 bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
      <span className="bb-round absolute -top-1.5 -right-1.5 bg-brand text-white min-w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center px-1.5">{item.quantity}</span>
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={112} height={112} />
      ) : (
        <span className="font-display text-xs text-white/20 uppercase">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

function pickDefaultAddress(addresses: CustomerAddress[]): CustomerAddress | null {
  if (!addresses.length) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}

export default function CheckoutPage() {
  const router = useRouter();
  const { refreshCount } = useCart();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [pendingOrderNav, setPendingOrderNav] = useState<{ orderNumber: string; orderKey: string } | null>(null);
  const [gtmFired, setGtmFired] = useState(false);
  const [prefilledFromAccount, setPrefilledFromAccount] = useState(false);
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const hasPrefilledRef = useRef(false);

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const { data: checkoutOptions, isLoading: optionsLoading } = useCheckoutOptions();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();

  // Prefill payment/shipping defaults when options load
  useEffect(() => {
    if (!checkoutOptions) return;
    setPaymentMethod((prev) => prev || checkoutOptions.paymentMethods[0]?.code || "");
    setShippingMethodId((prev) => prev || checkoutOptions.shippingMethods[0]?.id || "");
  }, [checkoutOptions]);

  // Fire GTM begin_checkout once cart is loaded
  useEffect(() => {
    if (!cart || gtmFired) return;
    pushDataLayer("begin_checkout", {
      currency: cart.currency ?? "VND",
      value: cart.totals.totalAmount,
      items: toGtmCartItems(cart.items),
    });
    setGtmFired(true);
  }, [cart, gtmFired]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: addressErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(checkoutAddressSchema),
    defaultValues: { country: "VN" },
  });

  const address = watch();

  // Prefill form from profile/address when logged in — runs once, never overwrites user edits
  useEffect(() => {
    if (hasPrefilledRef.current) return;
    if (!profile) return;
    // Wait for addresses to finish loading before locking prefill
    if (addresses === undefined) return;

    hasPrefilledRef.current = true;

    const fillIfEmpty = (field: keyof CheckoutAddressFormValues, value: string | null | undefined) => {
      if (!value) return;
      const current = address[field];
      if (!current) setValue(field, value, { shouldValidate: false, shouldDirty: false });
    };

    const addr = pickDefaultAddress(addresses);

    if (addr) {
      fillIfEmpty("fullName", addr.fullName);
      fillIfEmpty("phone", addr.phone);
      fillIfEmpty("email", profile.email);
      fillIfEmpty("province", addr.province);
      fillIfEmpty("district", addr.district);
      fillIfEmpty("ward", addr.ward);
      fillIfEmpty("addressLine1", addr.addressLine1);
    } else {
      fillIfEmpty("fullName", profile.displayName);
      fillIfEmpty("phone", profile.phone);
      fillIfEmpty("email", profile.email);
    }

    setPrefilledFromAccount(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, addresses]);

  async function placeOrder() {
    if (!cart?.items.length) {
      setSubmitError("Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi đặt hàng.");
      return;
    }
    if (!paymentMethod) {
      setSubmitError("Vui lòng chọn phương thức thanh toán.");
      return;
    }
    if (!shippingMethodId) {
      setSubmitError("Vui lòng chọn phương thức vận chuyển.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const order = await submitCheckout({
        billingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          email: address.email || "",
          country: address.country,
          province: address.province,
          district: address.district,
          ward: address.ward || "",
          addressLine1: address.addressLine1,
        },
        shippingMethodId: shippingMethodId || null,
        paymentMethod,
        customerNote: customerNote.trim() || undefined,
      }, idempotencyKey.current);
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

  if (cartLoading && optionsLoading && !cart) {
    return <CheckoutSkeleton />;
  }

  if (cartError) {
    return (
      <div className="bb-container py-8">
        <p className="text-brand text-sm mb-4 m-0">Không tải được giỏ hàng. <Link href={toCartPath()} className="bb-link">Quay lại giỏ hàng</Link></p>
      </div>
    );
  }

  return (
    <>
      <div className="bb-container py-4 text-muted-foreground flex flex-wrap items-center [&_a]:text-muted-foreground [&_a]:font-semibold [&_a]:no-underline [&_a:hover]:text-brand">
        <Link href="/">Trang chủ</Link>
        <span className="text-brand mx-[10px]">/</span>
        <Link href={toCartPath()}>Giỏ hàng</Link>
        <span className="text-brand mx-[10px]">/</span>
        <span>Thanh toán</span>
      </div>

      <div className="bb-container py-6 pb-[60px]">
        <div className="py-3 pb-6">
          <h1 className="font-display font-semibold text-3xl uppercase text-foreground m-0 tracking-[0.01em]">Thanh toán</h1>
        </div>

        <form
          name="checkout"
          onSubmit={handleSubmit(placeOrder)}
          noValidate
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-[30px] items-start">
            {/* LEFT: customer details + payment + shipping */}
            <div className="min-w-0">
              <div className="bg-[var(--bb-color-gray-50)] border border-border py-[14px] px-5">
                <h3 className="m-0 font-display font-semibold text-[18px] uppercase text-foreground tracking-[0.04em]">THANH TOÁN</h3>
              </div>

              {/* Step 1: Shipping info */}
              <div className="bg-card border border-border border-t-0 py-[22px] px-6">
                <div className="mb-4">
                  <h3 className="m-0 font-display font-semibold text-[16px] uppercase text-foreground flex items-center gap-3 tracking-[0.04em]">
                    <span className="bb-round inline-flex items-center justify-center w-[30px] h-[30px] bg-brand text-white rounded-full"><b className="font-bold text-[15px]">1</b></span>
                    Thông tin giao hàng
                  </h3>
                </div>

                {prefilledFromAccount && (
                  <p className="text-xs text-muted-foreground bg-[var(--bb-color-gray-50)] border border-border px-3 py-2 mb-4 leading-[1.5]">
                    Đã điền thông tin từ tài khoản của bạn. Bạn vẫn có thể chỉnh sửa trước khi đặt hàng.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">
                      Họ và tên <span className="text-brand ml-[3px]">*</span>
                    </label>
                    <Input
                      placeholder="Nguyễn Văn A"
                      aria-invalid={!!addressErrors.fullName}
                      {...register("fullName")}
                    />
                    {addressErrors.fullName && (
                      <p className="text-sm text-destructive">{addressErrors.fullName.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">
                      Số điện thoại <span className="text-brand ml-[3px]">*</span>
                    </label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      maxLength={12}
                      placeholder="0901234567"
                      aria-invalid={!!addressErrors.phone}
                      {...register("phone")}
                    />
                    {addressErrors.phone && (
                      <p className="text-sm text-destructive">{addressErrors.phone.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-full">
                    <label className="text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      aria-invalid={!!addressErrors.email}
                      {...register("email")}
                    />
                    {addressErrors.email && (
                      <p className="text-sm text-destructive">{addressErrors.email.message}</p>
                    )}
                  </div>

                  <VnAddressFields
                    value={{
                      province: address.province ?? "",
                      district: address.district ?? "",
                      ward: address.ward ?? "",
                    }}
                    onChange={(field, val) => setValue(field as keyof CheckoutAddressFormValues, val, { shouldValidate: true })}
                    required
                  />
                  {(addressErrors.province || addressErrors.district) && (
                    <p className="text-sm text-destructive col-span-full">
                      {addressErrors.province?.message ?? addressErrors.district?.message}
                    </p>
                  )}

                  <div className="flex flex-col gap-1.5 col-span-full">
                    <label className="text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">
                      Địa chỉ chi tiết <span className="text-brand ml-[3px]">*</span>
                    </label>
                    <Input
                      placeholder="Số nhà, tên đường..."
                      aria-invalid={!!addressErrors.addressLine1}
                      {...register("addressLine1")}
                    />
                    {addressErrors.addressLine1 && (
                      <p className="text-sm text-destructive">{addressErrors.addressLine1.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-full">
                    <label className="text-xs font-semibold tracking-[0.06em] uppercase text-muted-foreground">
                      Ghi chú đơn hàng (tuỳ chọn)
                    </label>
                    <Textarea
                      className="min-h-[80px] resize-y"
                      placeholder="Ví dụ: gọi trước khi giao 15 phút..."
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Payment method */}
              <div className="bg-card border border-border border-t-0 py-[22px] px-6">
                <div className="mb-4">
                  <h3 className="m-0 font-display font-semibold text-[16px] uppercase text-foreground flex items-center gap-3 tracking-[0.04em]">
                    <span className="bb-round inline-flex items-center justify-center w-[30px] h-[30px] bg-brand text-white rounded-full"><b className="font-bold text-[15px]">2</b></span>
                    Phương thức thanh toán
                  </h3>
                </div>
                {optionsLoading ? (
                  <MiniRadioStackSkeleton rows={3} />
                ) : checkoutOptions?.paymentMethods.length ? (
                  <div className="grid gap-[10px]">
                    {checkoutOptions.paymentMethods.map((method) => (
                      <label
                        key={method.code}
                        className={`flex items-center gap-[14px] py-[14px] px-4 bg-white border cursor-pointer transition-all duration-[140ms] ${paymentMethod === method.code ? "border-brand bg-brand/[0.04]" : "border-[var(--bb-border-default)] hover:border-[var(--bb-brand-primary-border)]"}`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.code}
                          checked={paymentMethod === method.code}
                          onChange={() => setPaymentMethod(method.code)}
                          className="accent-brand m-0"
                        />
                        <span className={`w-[42px] h-7 flex items-center justify-center font-bold text-xs tracking-[0.06em] ${PAY_LOGO_STYLE[method.code.toUpperCase()] ?? "bg-white text-black"}`}>
                          {method.code.toUpperCase()}
                        </span>
                        <div className="flex-1">
                          <b className="block text-sm text-foreground tracking-[0.02em] mb-[2px] font-bold uppercase">{method.title}</b>
                          {PAYMENT_DESC[method.code.toUpperCase()] && (
                            <span className="text-[11px] text-muted-foreground tracking-[0.02em]">{PAYMENT_DESC[method.code.toUpperCase()]}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-brand text-sm mb-4 m-0">
                    Phương thức thanh toán tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.
                  </p>
                )}
              </div>

              {/* Step 3: Shipping method */}
              <div className="bg-card border border-border border-t-0 py-[22px] px-6 mb-[18px]">
                <div className="mb-4">
                  <h3 className="m-0 font-display font-semibold text-[16px] uppercase text-foreground flex items-center gap-3 tracking-[0.04em]">
                    <span className="bb-round inline-flex items-center justify-center w-[30px] h-[30px] bg-brand text-white rounded-full"><b className="font-bold text-[15px]">3</b></span>
                    Phương thức vận chuyển
                  </h3>
                </div>
                {optionsLoading ? (
                  <MiniRadioStackSkeleton rows={2} />
                ) : checkoutOptions?.shippingMethods.length ? (
                  <div className="grid gap-[10px]">
                    {checkoutOptions.shippingMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center gap-[14px] py-[14px] px-4 bg-white border cursor-pointer transition-all duration-[140ms] ${shippingMethodId === method.id ? "border-brand bg-brand/[0.04]" : "border-[var(--bb-border-default)] hover:border-[var(--bb-brand-primary-border)]"}`}
                      >
                        <input
                          type="radio"
                          name="shippingMethod"
                          value={method.id}
                          checked={shippingMethodId === method.id}
                          onChange={() => setShippingMethodId(method.id)}
                          className="accent-brand m-0"
                        />
                        <div className="flex-1">
                          <b className="block text-sm text-foreground tracking-[0.02em] mb-[2px] font-bold uppercase">{method.title}</b>
                        </div>
                        <div className={`font-display text-brand tracking-[0.01em] ${method.cost === 0 ? "text-[12px] tracking-[0.12em] uppercase" : "text-[16px]"}`}>
                          {method.cost === 0 ? "MIỄN PHÍ" : formatVnd(method.cost)}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-brand text-sm mb-4 m-0">
                    Phương thức giao hàng tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.
                  </p>
                )}
              </div>

              <div className="my-3 mb-[18px] py-3 px-4 bg-[var(--bb-color-gray-50)] border border-border text-sm text-muted-foreground leading-[1.6] [&_a]:text-brand [&_a]:underline">
                Bằng việc đặt hàng, bạn đồng ý với{" "}
                <Link href="/chinh-sach/dieu-khoan/">Điều khoản dịch vụ</Link>
                {" "}và{" "}
                <Link href="/chinh-sach/doi-tra/">Chính sách đổi trả</Link>
                {" "}của BigBike.
              </div>

              {priceChanges.length > 0 && pendingOrderNav && (
                <div className="bg-[var(--bb-color-gray-50)] border border-border p-[14px_18px] mb-3 text-sm text-foreground">
                  <p className="font-semibold mb-1.5 m-0">
                    Giá một số sản phẩm đã giảm khi đặt hàng — bạn được áp dụng giá mới:
                  </p>
                  <ul className="m-0 mb-2 ml-4 text-[0.9em]">
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

              {submitError && <p className="text-brand text-sm mb-4 m-0">{submitError}</p>}

              <div className="flex items-center justify-between gap-[14px] mt-[18px] px-1 flex-wrap max-sm:gap-[10px]">
                <Link
                  href={toCartPath()}
                  className="font-display font-semibold text-sm tracking-[0.06em] uppercase no-underline text-foreground inline-flex items-center gap-1.5 transition-colors duration-300 hover:text-brand"
                >
                  <span aria-hidden="true">‹</span> QUAY LẠI GIỎ HÀNG
                </Link>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || cartLoading || !cart?.items.length || belowMinOrder}
                >
                  {submitting
                    ? "ĐANG ĐẶT HÀNG..."
                    : cart
                      ? `ĐẶT HÀNG · ${formatVnd(grandTotal)}`
                      : "ĐẶT HÀNG"}
                </Button>
              </div>
            </div>

            {/* RIGHT: order review (sticky) */}
            <aside className="flex flex-col gap-5">
              <div className="bg-card border border-border self-start overflow-hidden sticky top-[calc(var(--bb-header-height)+20px)] max-[992px]:static">
                <div className="bg-[var(--bb-color-gray-50)] py-[14px] px-5 border-b border-border">
                  <h3 className="m-0 font-display font-semibold text-[16px] uppercase text-foreground tracking-[0.04em]">Thông tin đơn đặt hàng</h3>
                </div>

                {cartLoading ? (
                  <div className="p-5"><MiniSummarySkeleton /></div>
                ) : !cart || cart.items.length === 0 ? (
                  <div className="p-5">
                    <p className="mb-3 m-0 text-muted-foreground text-sm">Giỏ hàng trống.</p>
                    <Link href={toCartPath()} className="bb-link">Quay lại giỏ hàng</Link>
                  </div>
                ) : (
                  <>
                    <div className="py-3 px-5 pb-1 max-h-[320px] overflow-y-auto">
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex gap-3 py-2.5 border-b border-border last:border-b-0 last:pb-[14px] last:mb-1">
                          <MiniCartThumb item={item} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground m-0 mb-[2px] leading-[1.3]">{item.productName}</p>
                            {item.variantName && <p className="text-[11px] text-muted-foreground m-0">{item.variantName}</p>}
                          </div>
                          <span className="text-sm font-bold text-foreground self-center whitespace-nowrap">{formatVnd(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="py-3 px-5 border-t border-border">
                      <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                        <p className="m-0">Tạm tính:</p>
                        <p className="m-0"><b className="text-foreground font-bold">{formatVnd(cart.totals.subtotalAmount)}</b></p>
                      </div>
                      {cart.couponCodes && cart.couponCodes.length > 0 && (
                        <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                          <p className="m-0">Mã giảm giá:</p>
                          <p className="m-0"><b className="text-foreground font-bold">{cart.couponCodes.join(", ")}</b></p>
                        </div>
                      )}
                      {cart.totals.discountAmount > 0 && (
                        <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                          <p className="m-0">Giảm giá:</p>
                          <p className="m-0"><b className="text-brand font-bold">−{formatVnd(cart.totals.discountAmount)}</b></p>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-muted-foreground">
                        <p className="m-0">Phí vận chuyển:</p>
                        <p className="m-0">
                          {effectiveShippingCost > 0
                            ? <b className="text-foreground font-bold">{formatVnd(effectiveShippingCost)}</b>
                            : <span className="text-xs text-muted-foreground italic">Miễn phí</span>}
                        </p>
                      </div>
                      {qualifiesForFreeShipping && freeShippingThreshold && (selectedShipping?.cost ?? 0) > 0 && (
                        <p className="text-[11px] text-muted-foreground m-0 mt-1 italic">
                          Đơn từ {formatVnd(freeShippingThreshold)} được miễn phí giao hàng.
                        </p>
                      )}
                      {belowMinOrder && minOrderAmount && (
                        <p className="text-[11px] text-brand m-0 mt-1">
                          Phương thức vận chuyển này yêu cầu đơn tối thiểu {formatVnd(minOrderAmount)}. Vui lòng mua thêm hoặc chọn phương thức khác.
                        </p>
                      )}
                    </div>

                    <div className="bg-[var(--bb-color-gray-50)] border-t border-border py-[14px] px-5">
                      <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                        <p className="m-0 font-display uppercase font-semibold text-foreground tracking-[0.04em] text-[14px]">Tổng:</p>
                        <p className="m-0">
                          <b className="font-display text-[22px] text-brand font-bold tracking-[0.01em]">
                            {formatVnd(grandTotal)}
                          </b>
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        </form>
      </div>
    </>
  );
}

