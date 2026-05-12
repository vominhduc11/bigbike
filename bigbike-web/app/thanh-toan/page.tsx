"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import { useCartQuery, useCheckoutOptions } from "@/lib/query/hooks";
import type { CartItem, PriceChange } from "@/lib/contracts/commerce";
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
        <span>Thanh toán</span>
      </div>

      <div className="wp-checkout-page bb-container">
        <div className="wp-cart-title-row">
          <h1>Thanh toán</h1>
        </div>

        <form
          name="checkout"
          className="wp-checkout-form-1page"
          onSubmit={handleSubmit(placeOrder)}
          noValidate
        >
          <div className="wp-cart-grid">
            {/* LEFT: customer details + payment + shipping */}
            <div className="wp-cart-main">
              <div className="wp-checkout-title-bar">
                <h3>THANH TOÁN</h3>
              </div>

              <div className="wp-checkout-step-block">
                <div className="wp-checkout-step-title">
                  <h3><span><b>1</b></span> Thông tin giao hàng</h3>
                </div>

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
                    <label>Ghi chú đơn hàng (tuỳ chọn)</label>
                    <textarea
                      className="wp-input wp-textarea-resize"
                      style={{ minHeight: 80, fontFamily: "inherit" }}
                      placeholder="Ví dụ: gọi trước khi giao 15 phút..."
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="wp-checkout-step-block">
                <div className="wp-checkout-step-title">
                  <h3><span><b>2</b></span> Phương thức thanh toán</h3>
                </div>
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

              <div className="wp-checkout-step-block">
                <div className="wp-checkout-step-title">
                  <h3><span><b>3</b></span> Phương thức vận chuyển</h3>
                </div>
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

              <div className="wp-terms-notice">
                Bằng việc đặt hàng, bạn đồng ý với{" "}
                <Link href="/chinh-sach/dieu-khoan/">Điều khoản dịch vụ</Link>
                {" "}và{" "}
                <Link href="/chinh-sach/doi-tra/">Chính sách đổi trả</Link>
                {" "}của BigBike.
              </div>

              {priceChanges.length > 0 && pendingOrderNav && (
                <div className="wp-alert-warning" style={{ marginBottom: 12 }}>
                  <p style={{ fontWeight: 600, marginBottom: 6 }}>
                    ⚠️ Giá một số sản phẩm đã thay đổi khi đặt hàng:
                  </p>
                  <ul style={{ margin: "0 0 8px 16px", fontSize: "0.9em" }}>
                    {priceChanges.map((pc, i) => (
                      <li key={i}>
                        {pc.productName}: {formatVnd(pc.oldPrice)} → {formatVnd(pc.newPrice)}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="wp-btn-primary wp-btn-sm"
                    onClick={() => router.push(toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey))}
                  >
                    Xem xác nhận đặt hàng
                  </button>
                </div>
              )}

              {submitError && <p className="wp-error-text">{submitError}</p>}

              <div className="wp-checkout-1page-actions">
                <Link href={toCartPath()} className="wp-cart-continue">
                  <span aria-hidden="true">‹</span> QUAY LẠI GIỎ HÀNG
                </Link>
                <button
                  type="submit"
                  className="wp-cart-checkout-btn"
                  disabled={submitting || cartLoading || !cart?.items.length}
                >
                  {submitting
                    ? "ĐANG ĐẶT HÀNG..."
                    : cart
                      ? `ĐẶT HÀNG · ${formatVnd(cart.totals.totalAmount + (selectedShipping?.cost ?? 0))}`
                      : "ĐẶT HÀNG"}
                </button>
              </div>
            </div>

            {/* RIGHT: order review (sticky) */}
            <aside className="wp-cart-side">
              <div className="wp-checkout-summary-card">
                <div className="wp-checkout-summary-title">
                  <h3>Thông tin đơn đặt hàng</h3>
                </div>

                {cartLoading ? (
                  <MiniSummarySkeleton />
                ) : !cart || cart.items.length === 0 ? (
                  <>
                    <p style={{ marginBottom: 12, color: "var(--bb-text-muted)" }}>Giỏ hàng trống.</p>
                    <Link href={toCartPath()} className="bb-link">Quay lại giỏ hàng</Link>
                  </>
                ) : (
                  <>
                    <div className="wp-checkout-mini-list">
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

                    <div className="wp-cart-summary" style={{ padding: 0, border: "none", marginTop: 12 }}>
                      <div className="wp-cart-summary-row">
                        <p>Tạm tính:</p>
                        <p><b>{formatVnd(cart.totals.subtotalAmount)}</b></p>
                      </div>
                      {cart.couponCodes && cart.couponCodes.length > 0 && (
                        <div className="wp-cart-summary-row">
                          <p>Mã giảm giá:</p>
                          <p><b>{cart.couponCodes.join(", ")}</b></p>
                        </div>
                      )}
                      {cart.totals.discountAmount > 0 && (
                        <div className="wp-cart-summary-row discount">
                          <p>Giảm giá:</p>
                          <p className="discount"><b>−{formatVnd(cart.totals.discountAmount)}</b></p>
                        </div>
                      )}
                      <div className="wp-cart-summary-row">
                        <p>Phí vận chuyển:</p>
                        <p>
                          {selectedShipping && selectedShipping.cost > 0
                            ? <b>{formatVnd(selectedShipping.cost)}</b>
                            : <span className="wp-cart-ship-note">Miễn phí</span>}
                        </p>
                      </div>
                    </div>

                    <div className="wp-cart-total-summary" style={{ marginTop: 12 }}>
                      <div className="wp-cart-summary-row">
                        <p>Tổng:</p>
                        <p className="wp-cart-total-price">
                          <b>{formatVnd(cart.totals.totalAmount + (selectedShipping?.cost ?? 0))}</b>
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
