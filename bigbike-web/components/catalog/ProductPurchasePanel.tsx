"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchCheckoutOptions, submitQuickBuy } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import type { CheckoutAddress, CheckoutOptions, QuickBuyPayload } from "@/lib/contracts/commerce";
import type { ImageAsset, Product, ProductVariant } from "@/lib/contracts/public";
import { formatVnd, safeText, stockStateLabel } from "@/lib/utils/format";
import { toOrderConfirmPath } from "@/lib/utils/routes";

type ProductPurchasePanelProps = {
  product: Product;
  onVariantImageChange?: (image: ImageAsset | null) => void;
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

const FEATURES = [
  "Hàng chính hãng 100%",
  "Bảo hành theo chính sách hãng",
  "Thanh toán COD hoặc chuyển khoản",
  "Giao toàn quốc",
];

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="wp-pdp-feat-icon">
      <circle cx="7" cy="7" r="6" />
      <path d="M4.5 7l2 2 3-3" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function ProductPurchasePanel({ product, onVariantImageChange }: ProductPurchasePanelProps) {
  const router = useRouter();
  const { addToCart } = useCart();
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

  // Notify gallery when selected variant changes (so gallery can switch to variant image)
  useEffect(() => {
    if (!onVariantImageChange) return;
    const variant = variants.find((v) => v.id === selectedVariantId) ?? null;
    onVariantImageChange(variant?.image ?? null);
  }, [selectedVariantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close drawer on ESC
  useEffect(() => {
    if (!quickBuyOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setQuickBuyOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickBuyOpen]);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
  const pricing = selectedVariant?.price ?? product.price;
  const retail = pricing?.retailPrice ?? 0;
  const sale = pricing?.salePrice && pricing.salePrice > 0 ? pricing.salePrice : null;
  const compare = pricing?.compareAtPrice && pricing.compareAtPrice > 0 ? pricing.compareAtPrice : null;
  const current = sale ?? retail;
  const optionGroups = buildVariantOptionGroups(variants);
  const selectedOptions = getVariantSelection(selectedVariant);
  const selectedAvailability = selectedVariant?.isAvailable ?? variants.length === 0;
  const stockState = selectedVariant?.stockState ?? product.stockState;

  async function handleAddToCart() {
    setAddToCartLoading(true);
    setAddToCartError("");
    try {
      await addToCart(product.id, quantity, selectedVariantId || undefined);
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
      {/* Price + Stock — same row */}
      {(() => {
        const available = selectedVariant
          ? selectedAvailability
          : (stockState !== "OUT_OF_STOCK" && stockState !== "CONTACT_FOR_STOCK");
        return (
          <div className="wp-pdp-price-row">
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
            <div className="wp-stock-wrap">
              <span className={`wp-stock-badge ${stockBadgeClass(stockState)}`}>
                {available ? stockStateLabel(stockState) : "Hết hàng"}
              </span>
            </div>
          </div>
        );
      })()}

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

      {/* Variant select fallback */}
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
          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Giảm">−</button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n > 0) setQuantity(n);
            }}
          />
          <button type="button" onClick={() => setQuantity((q) => q + 1)} aria-label="Tăng">+</button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="wp-pdp-actions">
        {stockState === "CONTACT_FOR_STOCK" ? (
          <Link href="/lien-he/" className="wp-btn-primary">Liên hệ tư vấn</Link>
        ) : (
          <button
            type="button"
            className="wp-btn-primary"
            onClick={handleAddToCart}
            disabled={addToCartLoading || !selectedAvailability}
          >
            {addToCartLoading ? "Đang thêm..." : selectedAvailability ? "Thêm vào giỏ" : "Tạm hết hàng"}
          </button>
        )}
        <button
          type="button"
          className="wp-btn-secondary"
          onClick={() => setQuickBuyOpen(true)}
          disabled={!selectedAvailability || stockState === "CONTACT_FOR_STOCK"}
        >
          Mua ngay
        </button>
      </div>

      {addToCartError && <p className="wp-error-text wp-pdp-error">{addToCartError}</p>}

      {/* Trust features */}
      <div className="wp-pdp-features">
        {FEATURES.map((feat) => (
          <div key={feat} className="wp-pdp-feat">
            <IconCheck />
            {feat}
          </div>
        ))}
      </div>

      {/* Quick-buy drawer */}
      {quickBuyOpen && (
        <>
          <div className="wp-qb-backdrop" onClick={() => setQuickBuyOpen(false)} aria-hidden="true" />
          <div className="wp-qb-drawer" role="dialog" aria-label="Mua ngay" aria-modal="true">
            <div className="wp-qb-header">
              <h3>Mua ngay</h3>
              <button type="button" className="wp-qb-close" aria-label="Đóng" onClick={() => setQuickBuyOpen(false)}>
                <IconClose />
              </button>
            </div>

            <div className="wp-qb-body">
              {checkoutOptionsError && <p className="wp-error-text">{checkoutOptionsError}</p>}
              <form onSubmit={handleQuickBuySubmit} id="qb-form" className="wp-quick-buy-form">
                <div className="wp-form-grid">
                  <div className="wp-field">
                    <label>Họ tên <span className="req">*</span></label>
                    <input className="wp-input" required value={address.fullName} onChange={(e) => updateAddressField("fullName", e.target.value)} />
                  </div>
                  <div className="wp-field">
                    <label>Số điện thoại <span className="req">*</span></label>
                    <input className="wp-input" required type="tel" inputMode="numeric" pattern="0[3-9][0-9]{8}" maxLength={10} value={address.phone} onChange={(e) => updateAddressField("phone", e.target.value)} />
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
                    <textarea className="wp-input wp-textarea-resize" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
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

                {quickBuyError && <p className="wp-error-text">{quickBuyError}</p>}
                {quickBuySuccess && <p className="wp-success-text">{quickBuySuccess}</p>}
              </form>
            </div>

            <div className="wp-qb-footer">
              <button
                type="submit"
                form="qb-form"
                className="wp-btn-primary"
                disabled={quickBuyLoading || !paymentMethod || !shippingMethodId || !selectedAvailability}
              >
                {quickBuyLoading ? "Đang tạo đơn hàng..." : "Xác nhận mua ngay"}
              </button>
            </div>
          </div>
        </>
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
