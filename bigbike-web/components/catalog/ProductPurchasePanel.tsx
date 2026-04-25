"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addCartItem, fetchCheckoutOptions, submitQuickBuy } from "@/lib/api/client-api";
import type { CheckoutAddress, CheckoutOptions, QuickBuyPayload } from "@/lib/contracts/commerce";
import type { Product, ProductVariant } from "@/lib/contracts/public";
import { formatVnd, safeText, stockStateLabel } from "@/lib/utils/format";
import { toCartPath, toOrderConfirmPath } from "@/lib/utils/routes";

type ProductPurchasePanelProps = {
  product: Product;
};

type VariantSelection = Record<string, string>;

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

export function ProductPurchasePanel({ product }: ProductPurchasePanelProps) {
  const router = useRouter();
  const variants = product.variants ?? [];
  const defaultVariantId =
    variants.find((v) => v.isAvailable)?.id ?? variants[0]?.id ?? "";

  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
  const [quantity, setQuantity] = useState(1);
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [addToCartError, setAddToCartError] = useState("");
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [quickBuyLoading, setQuickBuyLoading] = useState(false);
  const [quickBuyError, setQuickBuyError] = useState("");
  const [quickBuySuccess, setQuickBuySuccess] = useState("");
  const [checkoutOptions, setCheckoutOptions] = useState<CheckoutOptions | null>(null);
  const [checkoutOptionsError, setCheckoutOptionsError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [address, setAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [customerNote, setCustomerNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchCheckoutOptions()
      .then((options) => {
        if (cancelled) return;
        setCheckoutOptions(options);
        setPaymentMethod((prev) => prev || options.paymentMethods[0]?.code || "");
        setShippingMethodId((prev) => prev || options.shippingMethods[0]?.id || "");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setCheckoutOptionsError(error.message);
      });
    return () => { cancelled = true; };
  }, []);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const pricing = selectedVariant?.price ?? product.price;
  const retail = pricing?.retailPrice ?? 0;
  const sale = pricing?.salePrice && pricing.salePrice > 0 ? pricing.salePrice : null;
  const compare = pricing?.compareAtPrice && pricing.compareAtPrice > 0 ? pricing.compareAtPrice : null;
  const current = sale ?? retail;
  const optionGroups = buildVariantOptionGroups(variants);
  const selectedOptions = getVariantSelection(selectedVariant);
  const selectedAvailability = selectedVariant?.isAvailable ?? variants.length === 0;

  async function handleAddToCart() {
    setAddToCartLoading(true);
    setAddToCartError("");
    try {
      await addCartItem(product.id, quantity, selectedVariantId || undefined);
      router.push(toCartPath());
    } catch (error) {
      setAddToCartError(error instanceof Error ? error.message : "Không thể thêm vào giỏ hàng.");
    } finally {
      setAddToCartLoading(false);
    }
  }

  async function handleQuickBuySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setQuickBuyLoading(true);
    setQuickBuyError("");
    setQuickBuySuccess("");
    try {
      const payload: QuickBuyPayload = {
        productId: product.id,
        productVariantId: selectedVariantId || null,
        quantity,
        billingAddress: {
          fullName: address.fullName.trim(),
          email: address.email.trim(),
          phone: address.phone.trim(),
          country: address.country.trim() || "VN",
          province: address.province.trim(),
          district: address.district.trim(),
          ward: address.ward.trim(),
          addressLine1: address.addressLine1.trim(),
          addressLine2: address.addressLine2?.trim() || "",
        },
        shippingMethodId: shippingMethodId || null,
        paymentMethod,
        customerNote: customerNote.trim() || undefined,
      };
      const order = await submitQuickBuy(payload);
      setQuickBuySuccess(`Đã tạo đơn #${order.orderNumber}. Đang chuyển hướng...`);
      router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
    } catch (error) {
      setQuickBuyError(error instanceof Error ? error.message : "Không thể mua ngay.");
    } finally {
      setQuickBuyLoading(false);
    }
  }

  function updateAddressField<K extends keyof CheckoutAddress>(key: K, value: string) {
    setAddress((cur) => ({ ...cur, [key]: value }));
  }

  function selectVariantByOptions(nextSelection: VariantSelection) {
    const matched =
      findMatchingVariant(variants, nextSelection, true) ??
      findMatchingVariant(variants, nextSelection, false);
    if (matched) setSelectedVariantId(matched.id);
  }

  return (
    <div>
      {/* Price */}
      <div className="wp-pdp-price">
        {pricing ? (
          <>
            <b>{formatVnd(current)}</b>
            {compare && compare > current ? <s>{formatVnd(compare)}</s> : null}
            {compare && compare > current ? (
              <span className="save">Tiết kiệm {formatVnd(compare - current)}</span>
            ) : null}
          </>
        ) : (
          <b>Liên hệ</b>
        )}
      </div>

      {/* Stock status */}
      {selectedVariant && (
        <div style={{ marginBottom: 18 }}>
          <span className={`wp-stock-badge ${stockBadgeClass(selectedVariant.stockState)}`}>
            {selectedAvailability ? stockStateLabel(selectedVariant.stockState) : "Hết hàng"}
          </span>
        </div>
      )}

      {/* Variant chip groups */}
      {optionGroups.map((group) => {
        const currentValue = selectedOptions[group.name] ?? "";
        return (
          <div key={group.name} className="wp-pdp-opt-group">
            <h6>{group.name}</h6>
            <div className="wp-pdp-chips">
              {group.values.map((value) => {
                const candidateSelection = { ...selectedOptions, [group.name]: value };
                const variantForValue =
                  findMatchingVariant(variants, candidateSelection, true) ??
                  findMatchingVariant(variants, candidateSelection, false);
                const isActive = normalizeValue(currentValue) === normalizeValue(value);
                const isAvailable = Boolean(variantForValue?.isAvailable);
                return (
                  <button
                    key={`${group.name}-${value}`}
                    type="button"
                    className={`wp-pdp-chip${isActive ? " active" : ""}${!isAvailable && !isActive ? " oos" : ""}`}
                    onClick={() => !(!isAvailable && !isActive) && selectVariantByOptions(candidateSelection)}
                    disabled={!isAvailable && !isActive}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Variant select fallback (when no option groups) */}
      {variants.length > 0 && optionGroups.length === 0 && (
        <div className="wp-pdp-opt-group">
          <h6>Biến thể</h6>
          <select
            className="wp-input"
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={!variant.isAvailable}>
                {describeVariant(variant)}{variant.isAvailable ? "" : " — hết hàng"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quantity stepper */}
      <div className="wp-pdp-qty">
        <p className="wp-pdp-qty-label">Số lượng</p>
        <div className="wp-pdp-qty-stepper">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Giảm"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n > 0) setQuantity(n);
            }}
            readOnly
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            aria-label="Tăng"
          >
            +
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="wp-pdp-actions">
        <button
          type="button"
          className="wp-btn-primary"
          onClick={handleAddToCart}
          disabled={addToCartLoading || !selectedAvailability}
        >
          {addToCartLoading ? "Đang thêm..." : selectedAvailability ? "Thêm vào giỏ" : "Tạm hết hàng"}
        </button>
        <button
          type="button"
          className="wp-btn-secondary"
          onClick={() => setQuickBuyOpen((o) => !o)}
        >
          {quickBuyOpen ? "Ẩn" : "Mua ngay"}
        </button>
      </div>

      {addToCartError && (
        <p style={{ color: "var(--bb-brand-primary)", fontSize: 12, marginTop: 8 }}>{addToCartError}</p>
      )}

      {/* Quick buy form */}
      {quickBuyOpen && (
        <form
          onSubmit={handleQuickBuySubmit}
          style={{ marginTop: 18, display: "grid", gap: 12, background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 18 }}
        >
          {checkoutOptionsError && (
            <p style={{ color: "var(--bb-brand-primary)", fontSize: 12 }}>{checkoutOptionsError}</p>
          )}
          <div className="wp-form-grid">
            <div className="wp-field">
              <label>Họ tên <span className="req">*</span></label>
              <input className="wp-input" required value={address.fullName} onChange={(e) => updateAddressField("fullName", e.target.value)} />
            </div>
            <div className="wp-field">
              <label>Số điện thoại <span className="req">*</span></label>
              <input className="wp-input" required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={address.phone} onChange={(e) => updateAddressField("phone", e.target.value)} />
            </div>
            <div className="wp-field">
              <label>Email</label>
              <input className="wp-input" type="email" value={address.email} onChange={(e) => updateAddressField("email", e.target.value)} />
            </div>
            <div className="wp-field">
              <label>Tỉnh / Thành phố</label>
              <input className="wp-input" value={address.province} onChange={(e) => updateAddressField("province", e.target.value)} />
            </div>
            <div className="wp-field">
              <label>Quận / Huyện</label>
              <input className="wp-input" value={address.district} onChange={(e) => updateAddressField("district", e.target.value)} />
            </div>
            <div className="wp-field">
              <label>Phường / Xã</label>
              <input className="wp-input" value={address.ward} onChange={(e) => updateAddressField("ward", e.target.value)} />
            </div>
            <div className="wp-field full">
              <label>Địa chỉ <span className="req">*</span></label>
              <input className="wp-input" required value={address.addressLine1} onChange={(e) => updateAddressField("addressLine1", e.target.value)} />
            </div>
            <div className="wp-field full">
              <label>Ghi chú</label>
              <textarea className="wp-input" style={{ minHeight: 72, resize: "vertical" }} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
            </div>
          </div>

          <div className="wp-field">
            <label>Phương thức thanh toán <span className="req">*</span></label>
            <select className="wp-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
              <option value="" disabled>Chọn phương thức</option>
              {(checkoutOptions?.paymentMethods ?? []).map((m) => (
                <option key={m.code} value={m.code}>{m.title}</option>
              ))}
            </select>
          </div>

          <div className="wp-field">
            <label>Phương thức giao hàng <span className="req">*</span></label>
            <select className="wp-input" value={shippingMethodId} onChange={(e) => setShippingMethodId(e.target.value)} required>
              <option value="" disabled>Chọn phương thức</option>
              {(checkoutOptions?.shippingMethods ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.title} — {formatVnd(m.cost)}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="wp-btn-primary"
            style={{ flex: "none" }}
            disabled={quickBuyLoading || !paymentMethod || !shippingMethodId || !selectedAvailability}
          >
            {quickBuyLoading ? "Đang tạo đơn hàng..." : "Xác nhận mua ngay"}
          </button>

          {quickBuyError && <p style={{ color: "var(--bb-brand-primary)", fontSize: 12 }}>{quickBuyError}</p>}
          {quickBuySuccess && <p style={{ color: "#62bb46", fontSize: 12 }}>{quickBuySuccess}</p>}
        </form>
      )}
    </div>
  );
}

function describeVariant(variant: ProductVariant): string {
  const optionLabels = (variant.options ?? [])
    .map((o) => `${safeText(o.name, "Thuộc tính")}: ${safeText(o.value, "Không rõ")}`)
    .join(" · ");
  return [safeText(variant.name, "Biến thể"), optionLabels].filter(Boolean).join(" · ");
}

function buildVariantOptionGroups(variants: ProductVariant[]): Array<{ name: string; values: string[] }> {
  const groups = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const option of variant.options ?? []) {
      const name = safeText(option.name, "Thuộc tính").trim();
      const value = safeText(option.value, "").trim();
      if (!name || !value) continue;
      if (!groups.has(name)) groups.set(name, new Set());
      groups.get(name)?.add(value);
    }
  }
  return Array.from(groups.entries()).map(([name, values]) => ({ name, values: Array.from(values) }));
}

function getVariantSelection(variant: ProductVariant | null): VariantSelection {
  if (!variant) return {};
  const selection: VariantSelection = {};
  for (const option of variant.options ?? []) {
    const name = safeText(option.name, "Thuộc tính").trim();
    const value = safeText(option.value, "").trim();
    if (name && value) selection[name] = value;
  }
  return selection;
}

function findMatchingVariant(
  variants: ProductVariant[],
  selection: VariantSelection,
  onlyAvailable: boolean,
): ProductVariant | undefined {
  return variants.find((variant) => {
    if (onlyAvailable && !variant.isAvailable) return false;
    return Object.entries(selection).every(([key, value]) => {
      const variantValue = getVariantOptionValue(variant, key);
      return variantValue ? normalizeValue(variantValue) === normalizeValue(value) : false;
    });
  });
}

function getVariantOptionValue(variant: ProductVariant, optionName: string): string | undefined {
  const normalized = normalizeValue(optionName);
  for (const option of variant.options ?? []) {
    if (normalizeValue(option.name) === normalized) return option.value;
  }
  return undefined;
}

function normalizeValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stockBadgeClass(stockState: string): string {
  switch (stockState) {
    case "IN_STOCK": return "wp-stock-in";
    case "LOW_STOCK": return "wp-stock-low";
    case "PREORDER": return "wp-stock-preorder";
    case "OUT_OF_STOCK":
    case "CONTACT_FOR_STOCK":
    default: return "wp-stock-out";
  }
}
