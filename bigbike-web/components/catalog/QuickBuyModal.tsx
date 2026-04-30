"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCheckoutOptions, submitQuickBuy } from "@/lib/api/client-api";
import type { CheckoutAddress, CheckoutOptions } from "@/lib/contracts/commerce";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { formatVnd } from "@/lib/utils/format";
import { toOrderConfirmPath } from "@/lib/utils/routes";

type QuickBuyModalProps = {
  productId: string;
  selectedVariantId: string;
  quantity: number;
  productName: string;
  onClose: () => void;
};

const EMPTY_ADDRESS: CheckoutAddress = {
  fullName: "",
  email: "",
  phone: "",
  country: "VN",
  province: "",
  district: "",
  ward: "",
  addressLine1: "",
  addressLine2: "",
};

function IconClose() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function QuickBuyModal({
  productId,
  selectedVariantId,
  quantity,
  productName,
  onClose,
}: QuickBuyModalProps) {
  const router = useRouter();
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutOptions | null>(null);
  const [checkoutOptionsError, setCheckoutOptionsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchCheckoutOptions()
      .then((opts) => {
        setCheckoutOptions(opts);
        setPaymentMethod((prev) => prev || opts.paymentMethods[0]?.code || "");
        setShippingMethodId((prev) => prev || opts.shippingMethods[0]?.id || "");
      })
      .catch((err: Error) => setCheckoutOptionsError(err.message));
  }, []);

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateAddressField<K extends keyof CheckoutAddress>(
    key: K,
    value: string,
  ) {
    setAddress((cur) => ({ ...cur, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const order = await submitQuickBuy({
        productId,
        productVariantId: selectedVariantId || null,
        quantity,
        billingAddress: {
          fullName: address.fullName.trim(),
          email: address.email.trim(),
          phone: address.phone.trim(),
          country: "VN",
          province: address.province.trim(),
          district: address.district.trim(),
          ward: address.ward.trim(),
          addressLine1: address.addressLine1.trim(),
          addressLine2: address.addressLine2?.trim() || "",
        },
        shippingMethodId: shippingMethodId || null,
        paymentMethod,
        customerNote: customerNote.trim() || undefined,
      });
      setSuccess(`Đã tạo đơn #${order.orderNumber}. Đang chuyển hướng...`);
      router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể mua ngay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="wp-qb-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="wp-qb-drawer" role="dialog" aria-label="Mua ngay" aria-modal="true">
        <div className="wp-qb-header">
          <div>
            <h3>Mua ngay</h3>
            <p className="wp-qb-product-name">{productName}</p>
          </div>
          <button
            type="button"
            className="wp-qb-close"
            aria-label="Đóng"
            onClick={onClose}
          >
            <IconClose />
          </button>
        </div>

        <div className="wp-qb-body">
          {checkoutOptionsError && (
            <p className="wp-error-text">{checkoutOptionsError}</p>
          )}

          <form
            onSubmit={handleSubmit}
            id="qb-form"
            className="wp-quick-buy-form"
          >
            <div className="wp-form-grid">
              <div className="wp-field">
                <label>
                  Họ tên <span className="req">*</span>
                </label>
                <input
                  className="wp-input"
                  required
                  value={address.fullName}
                  onChange={(e) => updateAddressField("fullName", e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="wp-field">
                <label>
                  Số điện thoại <span className="req">*</span>
                </label>
                <input
                  className="wp-input"
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="0[3-9][0-9]{8}"
                  maxLength={10}
                  value={address.phone}
                  onChange={(e) => updateAddressField("phone", e.target.value)}
                  autoComplete="tel"
                />
              </div>

              <div className="wp-field">
                <label>Email</label>
                <input
                  className="wp-input"
                  type="email"
                  value={address.email}
                  onChange={(e) => updateAddressField("email", e.target.value)}
                  autoComplete="email"
                />
              </div>

              {/* Province / District / Ward */}
              <VnAddressFields
                value={{
                  province: address.province,
                  district: address.district,
                  ward: address.ward,
                }}
                onChange={(field, val) => updateAddressField(field, val)}
                required
              />

              <div className="wp-field full">
                <label>
                  Địa chỉ <span className="req">*</span>
                </label>
                <input
                  className="wp-input"
                  required
                  value={address.addressLine1}
                  onChange={(e) =>
                    updateAddressField("addressLine1", e.target.value)
                  }
                  autoComplete="street-address"
                />
              </div>

              <div className="wp-field full">
                <label>Ghi chú</label>
                <textarea
                  className="wp-input wp-textarea-resize"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="wp-field">
              <label>
                Phương thức thanh toán <span className="req">*</span>
              </label>
              <select
                className="wp-input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              >
                <option value="" disabled>
                  Chọn phương thức
                </option>
                {(checkoutOptions?.paymentMethods ?? []).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="wp-field">
              <label>
                Phương thức giao hàng <span className="req">*</span>
              </label>
              <select
                className="wp-input"
                value={shippingMethodId}
                onChange={(e) => setShippingMethodId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Chọn phương thức
                </option>
                {(checkoutOptions?.shippingMethods ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} — {formatVnd(m.cost)}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="wp-error-text">{error}</p>}
            {success && <p className="wp-success-text">{success}</p>}
          </form>
        </div>

        <div className="wp-qb-footer">
          <button
            type="submit"
            form="qb-form"
            className="wp-btn-primary"
            disabled={
              loading || !paymentMethod || !shippingMethodId
            }
          >
            {loading ? "Đang tạo đơn hàng..." : "Xác nhận mua ngay"}
          </button>
        </div>
      </div>
    </>
  );
}
