"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/utils/format";
import type { Cart, PaymentMethodOption, ShippingMethodOption } from "@/lib/contracts/commerce";
import { effectiveMethodCost, isZoneMismatch, normalizeMethodCode } from "./helpers";

// Cột phải: tóm tắt đơn + chọn vận chuyển/thanh toán + nút đặt hàng. Dùng
// vocabulary summary của theme (.checkout-summary / .summary--items …) vì bảng
// .shop_table mặc định của WooCommerce không nằm trong bundle CSS theme.
export function CheckoutSummary({
  cart,
  cartSubtotal,
  effectiveShippingCost,
  grandTotal,
  selectedShipping,
  shippingMethods,
  shippingMethodId,
  setShippingMethodId,
  paymentMethods,
  paymentMethod,
  setPaymentMethod,
  optionsLoading,
  optionsError,
  onRetryOptions,
  userRegion,
  submitting,
  cartLoading,
  belowMinOrder,
  selectedShippingZoneMismatch,
}: {
  cart: Cart;
  cartSubtotal: number;
  effectiveShippingCost: number;
  grandTotal: number;
  selectedShipping: ShippingMethodOption | undefined;
  shippingMethods: ShippingMethodOption[];
  shippingMethodId: string;
  setShippingMethodId: (id: string) => void;
  paymentMethods: PaymentMethodOption[];
  paymentMethod: string;
  setPaymentMethod: (code: string) => void;
  optionsLoading: boolean;
  optionsError: boolean;
  onRetryOptions: () => void;
  userRegion: "MB" | "MT" | "MN" | null;
  submitting: boolean;
  cartLoading: boolean;
  belowMinOrder: boolean;
  selectedShippingZoneMismatch: boolean;
}) {
  const t = useTranslations("Checkout");
  const tPayment = useTranslations("Checkout.paymentMethod");
  const tPaymentDescription = useTranslations("Checkout.paymentDescription");

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

  // Lỗi tải phương thức vận chuyển/thanh toán (mạng) — phân biệt với "không có
  // phương thức được cấu hình"; cho khách thử lại tại chỗ thay vì kẹt.
  const optionsErrorNotice = (
    <div className="woocommerce-error" role="alert">
      <p className="m-0">{t("optionsLoadFailed")}</p>
      <button type="button" className="button" style={{ marginTop: 8 }} onClick={onRetryOptions}>
        {t("retry")}
      </button>
    </div>
  );

  return (
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
          ) : optionsError ? (
            optionsErrorNotice
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
                  {disabled && (
                    <p className="m-0 mt-1 text-sm text-[var(--bb-text-secondary)]">
                      {t("shippingZoneMismatchHint")}
                    </p>
                  )}
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
          ) : optionsError ? (
            optionsErrorNotice
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
  );
}
