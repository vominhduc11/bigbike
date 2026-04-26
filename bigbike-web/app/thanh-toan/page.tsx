"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCart, fetchCheckoutOptions, submitCheckout } from "@/lib/api/client-api";
import type { Cart, CartItem, CheckoutAddress } from "@/lib/contracts/commerce";
import { pushDataLayer } from "@/lib/analytics";
import { formatVnd, isValidVnPhone } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { CheckoutSkeleton } from "@/components/ui/Skeletons";

function MiniRadioStackSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="wp-radio-stack" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bb-skel"
          style={{ height: 56, borderRadius: 4, width: "100%" }}
        />
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

const EMPTY_ADDRESS: CheckoutAddress = {
  fullName: "",
  email: "",
  phone: "",
  country: "VN",
  province: "",
  district: "",
  ward: "",
  addressLine1: "",
};

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
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [checkoutOptions, setCheckoutOptions] = useState<{
    paymentMethods: { code: string; title: string }[];
    shippingMethods: { id: string; code: string; title: string; cost: number }[];
  } | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    Promise.all([fetchCart(), fetchCheckoutOptions()])
      .then(([c, options]) => {
        setCart(c);
        setCheckoutOptions(options);
        setPaymentMethod((prev) => prev || options.paymentMethods[0]?.code || "");
        setShippingMethodId((prev) => prev || options.shippingMethods[0]?.id || "");
        pushDataLayer("begin_checkout", {
          currency: c.currency ?? "VND",
          value: c.totals.totalAmount,
          items: toGtmCartItems(c.items),
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        setCartLoading(false);
        setOptionsLoading(false);
      });
  }, []);

  function setField<K extends keyof CheckoutAddress>(key: K, value: string) {
    setAddress((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit() {
    if (!cart?.items.length) {
      setError("Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi đặt hàng.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const order = await submitCheckout({
        billingAddress: address,
        shippingMethod: shippingMethodId || null,
        paymentMethod,
        notes: customerNote.trim() || undefined,
      });
      router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPayment = checkoutOptions?.paymentMethods.find((m) => m.code === paymentMethod);
  const selectedShipping = checkoutOptions?.shippingMethods.find((m) => m.id === shippingMethodId);

  if (cartLoading && optionsLoading && !cart) {
    return <CheckoutSkeleton />;
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

          {error && <p className="wp-error-text">{error}</p>}

          {/* Step 1: Shipping info */}
          {step === 1 && (
            <>
              <div className="wp-checkout-section">
                <h3>
                  Thông tin người nhận
                  <span className="badge">Bắt buộc</span>
                </h3>
                <div className="wp-form-grid">
                  <div className="wp-field">
                    <label>Họ và tên <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.fullName ? " filled" : ""}`}
                      required
                      placeholder="Nguyễn Văn A"
                      value={address.fullName}
                      onChange={(e) => setField("fullName", e.target.value)}
                    />
                  </div>
                  <div className="wp-field">
                    <label>Số điện thoại <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.phone ? " filled" : ""}${phoneError ? " wp-input-error" : ""}`}
                      required
                      type="tel"
                      inputMode="numeric"
                      pattern="0[3-9][0-9]{8}"
                      maxLength={10}
                      placeholder="0901234567"
                      value={address.phone}
                      onChange={(e) => {
                        setField("phone", e.target.value);
                        if (phoneError) setPhoneError("");
                      }}
                      aria-describedby={phoneError ? "phone-error" : undefined}
                    />
                    {phoneError && (
                      <p id="phone-error" className="wp-field-error">{phoneError}</p>
                    )}
                  </div>
                  <div className="wp-field full">
                    <label>Email</label>
                    <input
                      className={`wp-input${address.email ? " filled" : ""}`}
                      type="email"
                      placeholder="email@example.com"
                      value={address.email}
                      onChange={(e) => setField("email", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="wp-checkout-section">
                <h3>Địa chỉ giao hàng</h3>
                <div className="wp-form-grid">
                  <div className="wp-field">
                    <label>Tỉnh / Thành phố <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.province ? " filled" : ""}`}
                      required
                      placeholder="TP. Hồ Chí Minh"
                      value={address.province}
                      onChange={(e) => setField("province", e.target.value)}
                    />
                  </div>
                  <div className="wp-field">
                    <label>Quận / Huyện</label>
                    <input
                      className={`wp-input${address.district ? " filled" : ""}`}
                      placeholder="Quận 1"
                      value={address.district}
                      onChange={(e) => setField("district", e.target.value)}
                    />
                  </div>
                  <div className="wp-field">
                    <label>Phường / Xã</label>
                    <input
                      className={`wp-input${address.ward ? " filled" : ""}`}
                      placeholder="Phường Bến Nghé"
                      value={address.ward}
                      onChange={(e) => setField("ward", e.target.value)}
                    />
                  </div>
                  <div className="wp-field full">
                    <label>Địa chỉ chi tiết <span className="req">*</span></label>
                    <input
                      className={`wp-input${address.addressLine1 ? " filled" : ""}`}
                      required
                      placeholder="Số nhà, tên đường..."
                      value={address.addressLine1}
                      onChange={(e) => setField("addressLine1", e.target.value)}
                    />
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
                <button
                  type="button"
                  className="wp-btn-primary wp-btn-wide"
                  disabled={!address.fullName || !address.phone || !address.province || !address.addressLine1}
                  onClick={() => {
                    if (!isValidVnPhone(address.phone)) {
                      setPhoneError("Số điện thoại không hợp lệ. Vui lòng nhập số VN 10 chữ số (ví dụ: 0901234567).");
                      return;
                    }
                    setPhoneError("");
                    setStep(2);
                  }}
                >
                  Tiếp tục → Thanh toán
                </button>
              </div>
            </>
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
                  <p className="wp-error-text">Phương thức thanh toán tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
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
                  <p className="wp-error-text">Phương thức giao hàng tạm thời không khả dụng. Vui lòng thử lại hoặc liên hệ hỗ trợ.</p>
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
                  {[address.addressLine1, address.ward, address.district, address.province].filter(Boolean).join(", ")}
                </div>
                <button
                  type="button"
                  className="wp-link-back wp-edit-trigger"
                  onClick={() => setStep(1)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>{" "}Chỉnh sửa
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
                    Vận chuyển: {selectedShipping.title}{selectedShipping.cost === 0 ? " — Miễn phí" : ` — ${formatVnd(selectedShipping.cost)}`}
                  </p>
                )}
                <button
                  type="button"
                  className="wp-link-back wp-edit-trigger"
                  onClick={() => setStep(2)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>{" "}Chỉnh sửa
                </button>
              </div>

              {cart && cart.items.length > 0 && (
                <div className="wp-checkout-section">
                  <h3>
                    Sản phẩm ({cart.items.reduce((s, it) => s + it.quantity, 0)})
                  </h3>
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

              {error && <p className="wp-error-text">{error}</p>}

              <div className="wp-checkout-nav">
                <button type="button" className="wp-link-back" onClick={() => setStep(2)}>
                  ← Quay lại
                </button>
                <button
                  type="button"
                  className="wp-btn-primary wp-btn-wide"
                  disabled={submitting || cartLoading}
                  onClick={handleSubmit}
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

              <div className="wp-summary-row" style={{ marginTop: 8 }} >
                <span>Tạm tính</span>
                <b>{formatVnd(cart.totals.subtotalAmount)}</b>
              </div>
              {cart.totals.discountAmount > 0 && (
                <div className="wp-summary-row discount">
                  <span>Giảm giá</span>
                  <b>−{formatVnd(cart.totals.discountAmount)}</b>
                </div>
              )}
              {cart.totals.shippingAmount > 0 && (
                <div className="wp-summary-row">
                  <span>Vận chuyển</span>
                  <b>{formatVnd(cart.totals.shippingAmount)}</b>
                </div>
              )}
              <div className="wp-summary-total">
                <span>Tổng thanh toán</span>
                <b>{formatVnd(cart.totals.totalAmount)}</b>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
