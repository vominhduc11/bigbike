"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchCart, submitCheckout } from "@/lib/api/client-api";
import type { Cart, CheckoutAddress } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";

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

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCart()
      .then((c) => { setCart(c); setCartLoading(false); })
      .catch(() => setCartLoading(false));
  }, []);

  function setField<K extends keyof CheckoutAddress>(key: K, value: string) {
    setAddress((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart?.items.length) {
      setError("Gio hang trong. Vui long them san pham truoc khi dat hang.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const order = await submitCheckout({
        billingAddress: address,
        paymentMethod,
        customerNote: customerNote.trim() || undefined,
      });
      router.push(toOrderConfirmPath(order.orderNumber));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header style={{ marginBottom: "var(--bb-space-6)" }}>
          <p className="bb-kicker">Commerce</p>
          <h1>Dat hang</h1>
        </header>

        <div className="bb-checkout-layout">
          <form onSubmit={handleSubmit} className="bb-checkout-form">
            {error && (
              <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
                {error}
              </p>
            )}

            <div className="bb-card" style={{ padding: "var(--bb-space-5)", marginBottom: "var(--bb-space-4)" }}>
              <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>
                Thong tin nhan hang
              </h2>
              <div className="bb-form-grid">
                <label className="bb-form-label">
                  Ho ten
                  <input
                    className="bb-input"
                    required
                    placeholder="Nguyen Van A"
                    value={address.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                  />
                </label>
                <label className="bb-form-label">
                  So dien thoai
                  <input
                    className="bb-input"
                    required
                    type="tel"
                    placeholder="0901234567"
                    value={address.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </label>
                <label className="bb-form-label">
                  Email
                  <input
                    className="bb-input"
                    type="email"
                    placeholder="email@example.com"
                    value={address.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </label>
                <label className="bb-form-label">
                  Tinh / Thanh pho
                  <input
                    className="bb-input"
                    required
                    placeholder="Ho Chi Minh"
                    value={address.province}
                    onChange={(e) => setField("province", e.target.value)}
                  />
                </label>
                <label className="bb-form-label">
                  Quan / Huyen
                  <input
                    className="bb-input"
                    placeholder="Quan 1"
                    value={address.district}
                    onChange={(e) => setField("district", e.target.value)}
                  />
                </label>
                <label className="bb-form-label">
                  Phuong / Xa
                  <input
                    className="bb-input"
                    placeholder="Phuong Ben Nghe"
                    value={address.ward}
                    onChange={(e) => setField("ward", e.target.value)}
                  />
                </label>
                <label className="bb-form-label" style={{ gridColumn: "1 / -1" }}>
                  Dia chi cu the
                  <input
                    className="bb-input"
                    required
                    placeholder="So nha, ten duong..."
                    value={address.addressLine1}
                    onChange={(e) => setField("addressLine1", e.target.value)}
                  />
                </label>
                <label className="bb-form-label" style={{ gridColumn: "1 / -1" }}>
                  Ghi chu don hang
                  <textarea
                    className="bb-input"
                    style={{ minHeight: "80px", padding: "var(--bb-space-3) var(--bb-space-4)", resize: "vertical" }}
                    placeholder="Yeu cau rieng cho don hang..."
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="bb-card" style={{ padding: "var(--bb-space-5)", marginBottom: "var(--bb-space-4)" }}>
              <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>
                Phuong thuc thanh toan
              </h2>
              <label className="bb-payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="COD"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                />
                <span>
                  <strong>Thu tien khi giao hang (COD)</strong>
                  <span style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-sm)", display: "block" }}>
                    Thanh toan bang tien mat khi nhan hang
                  </span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="bb-button bb-button-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={submitting || cartLoading}
            >
              {submitting ? "Dang dat hang..." : "Xac nhan dat hang"}
            </button>
          </form>

          <aside>
            <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
              <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>
                Don hang cua ban
              </h2>
              {cartLoading ? (
                <p style={{ color: "var(--bb-text-muted)" }}>Dang tai...</p>
              ) : !cart || cart.items.length === 0 ? (
                <div>
                  <p style={{ color: "var(--bb-text-muted)", marginBottom: "var(--bb-space-3)" }}>
                    Gio hang trong.
                  </p>
                  <a href={toCartPath()} className="bb-link">
                    Quay lai gio hang
                  </a>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: "var(--bb-space-4)", display: "grid", gap: "var(--bb-space-3)" }}>
                    {cart.items.map((item) => (
                      <div
                        key={item.id}
                        style={{ display: "flex", justifyContent: "space-between", gap: "var(--bb-space-3)" }}
                      >
                        <span style={{ flex: 1 }}>
                          {item.productName}
                          {item.variantName && (
                            <span style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-xs)" }}>
                              {" "}({item.variantName})
                            </span>
                          )}
                          <span style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-xs)", display: "block" }}>
                            x{item.quantity}
                          </span>
                        </span>
                        <span style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                          {formatVnd(item.lineTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bb-summary-rows">
                    <div className="bb-summary-row">
                      <span>Tam tinh</span>
                      <span>{formatVnd(cart.totals.subtotalAmount)}</span>
                    </div>
                    {cart.totals.discountAmount > 0 && (
                      <div className="bb-summary-row">
                        <span>Giam gia</span>
                        <span style={{ color: "var(--bb-state-success)" }}>
                          −{formatVnd(cart.totals.discountAmount)}
                        </span>
                      </div>
                    )}
                    <div className="bb-summary-row bb-summary-total">
                      <span>Tong cong</span>
                      <span>{formatVnd(cart.totals.totalAmount)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
