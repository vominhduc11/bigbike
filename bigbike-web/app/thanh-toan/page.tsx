"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import { useCartQuery, useCheckoutOptions } from "@/lib/query/hooks";
import type { CartItem } from "@/lib/contracts/commerce";
import { checkoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";
import { VnAddressFields } from "@/components/ui/VnAddressFields";

function MiniRadioStackSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="wp-radio-stack" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bb-skel" style={{ height: 56, borderRadius: 4, width: "100%" }} />
      ))}
    </div>
  );
}

function MiniSummarySkeleton() {
  return (
    <div aria-busy="true" className="bb-skel-stack">
      {[0, 1].map((i) => (
        <div key={i} className="bb-skel-row">
          <span className="bb-skel" style={{ width: 56, height: 56, borderRadius: 4 }} />
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
    <div className="wp-mini-thumb">
      <span className="qty-badge">{item.quantity}</span>
      {item.image?.url ? (
        <MediaImage image={item.image} altFallback={item.productName} width={112} height={112} />
      ) : (
        <span className="wp-thumb-initials">{item.productName.slice(0, 2)}</span>
      )}
    </div>
  );
}

const PAYMENT_DESC: Record<string, string> = {
  cod: "Thanh toán khi nhận hàng — kiểm tra hàng rồi mới trả tiền.",
  bacs: "Chuyển khoản ngân hàng — thông tin TK gửi qua email sau khi đặt hàng.",
};

const STEPS = [
  { n: 1, label: "Thông tin giao hàng", sub: "Địa chỉ · SĐT · tên" },
  { n: 2, label: "Phương thức thanh toán", sub: "COD · chuyển khoản" },
  { n: 3, label: "Xác nhận đặt hàng", sub: "Kiểm tra & hoàn tất" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { refreshCount } = useCart();
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [gtmFired, setGtmFired] = useState(false);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const { data: checkoutOptions, isLoading: optionsLoading } = useCheckoutOptions();

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

  async function placeOrder() {
    if (!cart?.items.length) {
      setSubmitError("Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi đặt hàng.");
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
      router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
    } catch (err: unknown) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPayment = checkoutOptions?.paymentMethods.find((m) => m.code === paymentMethod);
  const selectedShipping = checkoutOptions?.shippingMethods.find((m) => m.id === shippingMethodId);

  if (cartLoading && optionsLoading && !cart) {
    return <CheckoutSkeleton />;
  }

  if (cartError) {
    return (
      <div className="bb-container" style={{ paddingBlock: "var(--bb-space-8)" }}>
        <p className="wp-error-text">Không tải được giỏ hàng. <Link href={toCartPath()} className="bb-link">Quay lại giỏ hàng</Link></p>
      </div>
    );
  }

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="sep">/</span>
        <Link href={toCartPath()}>Giỏ hàng</Link>
        <span className="sep">/</span>
        <span>Đặt hàng</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Bước {step} / 3 · An toàn &amp; bảo mật</span>
        <h1>Hoàn tất đơn hàng</h1>
      </div>

      <div className="wp-checkout-layout">
        {/* Left: form with stepper */}
        <div>
          {/* Stepper */}
          <div className="wp-stepper">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className={`wp-step${step === s.n ? " active" : ""}${step > s.n ? " done" : ""}`}
                onClick={() => step > s.n && setStep(s.n)}
                style={{ cursor: step > s.n ? "pointer" : "default" }}
              >
                <div className="wp-step-num">
                  {step > s.n ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : s.n}
                </div>
                <div className="wp-step-label">
                  {s.label}
                  <span>{s.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Step 1: Shipping info */}
          {step === 1 && (
            <form
              onSubmit={handleSubmit(() => setStep(2))}
              noValidate
            >
              <div className="wp-checkout-section">
                <h3>
                  Thông tin người nhận
                  <span className="badge">Bắt buộc</span>
                </h3>
                <div className="wp-form-grid">
                  <div className="wp-field">
                    <label>Họ và tên <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.fullName ? " filled" : ""}${addressErrors.fullName ? " wp-input-error" : ""}`}
                      placeholder="Nguyễn Văn A"
                      {...register("fullName")}
                    />
                    {addressErrors.fullName && (
                      <p className="wp-field-error">{addressErrors.fullName.message}</p>
                    )}
                  </div>

                  <div className="wp-field">
                    <label>Số điện thoại <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.phone ? " filled" : ""}${addressErrors.phone ? " wp-input-error" : ""}`}
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0901234567"
                      {...register("phone")}
                    />
                    {addressErrors.phone && (
                      <p className="wp-field-error">{addressErrors.phone.message}</p>
                    )}
                  </div>

                  <div className="wp-field full">
                    <label>Email</label>
                    <input
                      className={`wp-input${address.email ? " filled" : ""}${addressErrors.email ? " wp-input-error" : ""}`}
                      type="email"
                      placeholder="email@example.com"
                      {...register("email")}
                    />
                    {addressErrors.email && (
                      <p className="wp-field-error">{addressErrors.email.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="wp-checkout-section">
                <h3>Địa chỉ giao hàng</h3>
                <div className="wp-form-grid">
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
                    <p className="wp-field-error full">
                      {addressErrors.province?.message ?? addressErrors.district?.message}
                    </p>
                  )}
                  <div className="wp-field full">
                    <label>Địa chỉ chi tiết <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.addressLine1 ? " filled" : ""}${addressErrors.addressLine1 ? " wp-input-error" : ""}`}
                      placeholder="Số nhà, tên đường..."
                      {...register("addressLine1")}
                    />
                    {addressErrors.addressLine1 && (
                      <p className="wp-field-error">{addressErrors.addressLine1.message}</p>
                    )}
                  </div>
                  <div className="wp-field full">
                    <label>Ghi chú cho shipper</label>
                    <textarea
                      className="wp-input wp-textarea-resize"
                      style={{ minHeight: 64, fontFamily: "inherit" }}
                      placeholder="Ví dụ: gọi trước khi giao 15 phút..."
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="wp-checkout-nav">
                <Link href={toCartPath()} className="wp-link-back">← Quay lại giỏ hàng</Link>
                <button type="submit" className="wp-btn-primary wp-btn-wide">
                  Tiếp tục → Thanh toán
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Payment + Shipping */}
          {step === 2 && (
            <>
              <div className="wp-checkout-section">
                <h3>
                  Phương thức thanh toán
                  <span className="badge">02</span>
                </h3>
                {optionsLoading ? (
                  <MiniRadioStackSkeleton rows={3} />
                ) : checkoutOptions?.paymentMethods.length ? (
                  <div className="wp-radio-stack">
                    {checkoutOptions.paymentMethods.map((method) => (
                      <label
                        key={method.code}
                        className={`wp-radio-tile${paymentMethod === method.code ? " active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.code}
                          checked={paymentMethod === method.code}
                          onChange={() => setPaymentMethod(method.code)}
                        />
                        <span className={`pay-logo ${method.code}`}>
                          {method.code.toUpperCase()}
                        </span>
                        <div className="wp-radio-tile-body">
                          <b>{method.title}</b>
                          {PAYMENT_DESC[method.code] && (
                            <span>{PAYMENT_DESC[method.code]}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="wp-error-text">
                    Phương thức thanh toán tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.
                  </p>
                )}
              </div>

              <div className="wp-checkout-section">
                <h3>
                  Phương thức vận chuyển
                  <span className="badge">03</span>
                </h3>
                {optionsLoading ? (
                  <MiniRadioStackSkeleton rows={2} />
                ) : checkoutOptions?.shippingMethods.length ? (
                  <div className="wp-radio-stack">
                    {checkoutOptions.shippingMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`wp-radio-tile${shippingMethodId === method.id ? " active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="shippingMethod"
                          value={method.id}
                          checked={shippingMethodId === method.id}
                          onChange={() => setShippingMethodId(method.id)}
                        />
                        <div className="wp-radio-tile-body">
                          <b>{method.title}</b>
                        </div>
                        <div className={`price${method.cost === 0 ? " free" : ""}`}>
                          {method.cost === 0 ? "MIỄN PHÍ" : formatVnd(method.cost)}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="wp-error-text">
                    Phương thức giao hàng tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.
                  </p>
                )}
              </div>

              <div className="wp-checkout-nav">
                <button type="button" className="wp-link-back" onClick={() => setStep(1)}>
                  ← Quay lại giao hàng
                </button>
                <button
                  type="button"
                  className="wp-btn-primary wp-btn-wide"
                  disabled={!paymentMethod || !shippingMethodId}
                  onClick={() => setStep(3)}
                >
                  Tiếp tục → Xác nhận
                </button>
              </div>
            </>
          )}

          {/* Step 3: Review & confirm */}
          {step === 3 && (
            <>
              <div className="wp-checkout-section">
                <h3>Giao đến</h3>
                <div className="wp-checkout-address">
                  <b>{address.fullName}</b>
                  {" · "}{address.phone}
                  <br />
                  {[address.addressLine1, address.ward, address.district, address.province]
                    .filter(Boolean)
                    .join(", ")}
                </div>
                <button
                  type="button"
                  className="wp-link-back wp-edit-trigger"
                  onClick={() => setStep(1)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>{" "}
                  Chỉnh sửa
                </button>
              </div>

              <div className="wp-checkout-section">
                <h3>Phương thức thanh toán</h3>
                <div className="wp-checkout-pay-row">
                  <span className={`wp-pay-logo ${paymentMethod}`}>
                    {paymentMethod.toUpperCase()}
                  </span>
                  <span>{selectedPayment?.title ?? paymentMethod}</span>
                </div>
                {selectedShipping && (
                  <p className="wp-muted-text wp-edit-trigger">
                    Vận chuyển: {selectedShipping.title}
                    {selectedShipping.cost === 0 ? " — Miễn phí" : ` — ${formatVnd(selectedShipping.cost)}`}
                  </p>
                )}
                <button
                  type="button"
                  className="wp-link-back wp-edit-trigger"
                  onClick={() => setStep(2)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>{" "}
                  Chỉnh sửa
                </button>
              </div>

              {cart && cart.items.length > 0 && (
                <div className="wp-checkout-section">
                  <h3>Sản phẩm ({cart.items.reduce((s, it) => s + it.quantity, 0)})</h3>
                  {cart.items.map((item) => (
                    <div key={item.id} className="wp-mini-item">
                      <MiniCartThumb item={item} />
                      <div className="wp-mini-body">
                        <p className="name">{item.productName}</p>
                        {item.variantName && <p className="variant">{item.variantName}</p>}
                      </div>
                      <span className="wp-mini-price">{formatVnd(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="wp-terms-notice">
                Bằng việc đặt hàng, bạn đồng ý với{" "}
                <Link href="/dieu-khoan-dich-vu">Điều khoản dịch vụ</Link>
                {" "}và{" "}
                <Link href="/chinh-sach-doi-tra">Chính sách đổi trả</Link>
                {" "}của BigBike.
              </div>

              {submitError && <p className="wp-error-text">{submitError}</p>}

              <div className="wp-checkout-nav">
                <button type="button" className="wp-link-back" onClick={() => setStep(2)}>
                  ← Quay lại
                </button>
                <button
                  type="button"
                  className="wp-btn-primary wp-btn-wide"
                  disabled={submitting || cartLoading}
                  onClick={placeOrder}
                >
                  {submitting
                    ? "Đang đặt hàng..."
                    : cart
                      ? `Đặt hàng · ${formatVnd(cart.totals.totalAmount)}`
                      : "Đặt hàng"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: order summary (always visible) */}
        <div className="wp-order-summary">
          <h3>Đơn hàng của bạn</h3>

          {cartLoading ? (
            <MiniSummarySkeleton />
          ) : !cart || cart.items.length === 0 ? (
            <>
              <p className="wp-loading-text" style={{ marginBottom: 12 }}>Giỏ hàng trống.</p>
              <Link href={toCartPath()} className="bb-link">Quay lại giỏ hàng</Link>
            </>
          ) : (
            <>
              {cart.items.map((item) => (
                <div key={item.id} className="wp-mini-item">
                  <MiniCartThumb item={item} />
                  <div className="wp-mini-body">
                    <p className="name">{item.productName}</p>
                    {item.variantName && <p className="variant">{item.variantName}</p>}
                  </div>
                  <span className="wp-mini-price">{formatVnd(item.lineTotal)}</span>
                </div>
              ))}

              <div className="wp-summary-row" style={{ marginTop: 8 }}>
                <span>Tạm tính</span>
                <b>{formatVnd(cart.totals.subtotalAmount)}</b>
              </div>
              {cart.couponCodes && cart.couponCodes.length > 0 && (
                <div className="wp-summary-row" style={{ fontSize: "0.85em", color: "var(--c-success, #16a34a)" }}>
                  <span>Mã giảm giá</span>
                  <b>{cart.couponCodes.join(", ")}</b>
                </div>
              )}
              {cart.totals.discountAmount > 0 && (
                <div className="wp-summary-row discount">
                  <span>Giảm giá</span>
                  <b>−{formatVnd(cart.totals.discountAmount)}</b>
                </div>
              )}
              {selectedShipping && selectedShipping.cost > 0 && (
                <div className="wp-summary-row">
                  <span>Vận chuyển</span>
                  <b>{formatVnd(selectedShipping.cost)}</b>
                </div>
              )}
              <div className="wp-summary-total">
                <span>Tổng thanh toán</span>
                <b>{formatVnd(cart.totals.totalAmount + (selectedShipping?.cost ?? 0))}</b>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
