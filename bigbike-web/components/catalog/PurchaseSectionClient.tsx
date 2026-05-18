"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductGallery } from "./ProductGallery";
import { PricingPanel } from "./PricingPanel";
import { StockStatus } from "./StockStatus";
import type { PricingData } from "./PricingPanel";
import type { StockData } from "./StockStatus";
import { VariantSelector } from "./VariantSelector";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { formatVnd } from "@/lib/utils/format";
import {
  collectAttributeNames,
  findColorPreviewVariant,
  findMatchingVariant,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ImageAsset, ProductPrice, ProductVariant } from "@/lib/contracts/public";

// Instagram has no public link-share endpoint — the icon links to the shop
// profile (parity with the legacy WP product page social row).
const SHOP_INSTAGRAM_URL = "https://www.instagram.com/bigbike.vn/";

type ProductSnapshot = {
  pricing: PricingData;
  stock: StockData;
  variants: ProductVariant[];
};

export type PurchaseSectionClientProps = {
  productId: string;
  productSlug: string;
  productName: string;
  brandName: string;
  categoryName: string;
  shortDescription: string | null | undefined;
  initialRating: number | null;
  initialRatingCount: number | null;
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  fallbackPrice: ProductPrice | null | undefined;
  fallbackStockState: string;
  fallbackVariants: ProductVariant[];
  /**
   * Absolute, canonical URL of this PDP. Passed in from the server layer
   * so the share buttons reuse the SEO-canonical form (avoids leaking
   * preview/staging URLs into shared links).
   */
  canonicalUrl: string;
};

export function PurchaseSectionClient({
  productId,
  productSlug,
  productName,
  shortDescription,
  initialRating,
  initialRatingCount,
  mainImage,
  gallery,
  fallbackPrice,
  fallbackStockState,
  fallbackVariants,
  canonicalUrl,
}: PurchaseSectionClientProps) {
  const { addToCart } = useCart();

  // Track the customer's progressively-built attribute selection. Empty
  // map = no attributes picked yet. Drives:
  //   - selectedVariant (full match → required for purchase)
  //   - previewVariant  (color-only match → drives gallery preview; Size
  //                       and other attributes never swap the image strip)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Dynamic fetch — one round-trip for pricing + stock + variants ──────────

  const { data: snapshot, isLoading: snapshotLoading } =
    useQuery<ProductSnapshot>({
      queryKey: ["product-snapshot", productId],
      queryFn: async () => {
        const res = await fetch(`/api/products/${productSlug}/snapshot/`);
        if (!res.ok) throw new Error("snapshot");
        return res.json() as Promise<ProductSnapshot>;
      },
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: 2,
    });

  // ── Derived state ──────────────────────────────────────────────────────────

  const variants = snapshot?.variants ?? fallbackVariants;
  const hasVariants = variants.length > 0;

  // Set of every attribute name defined across all variants (e.g. {"Color",
  // "Size"}). Used to decide when the customer has picked enough to
  // identify a specific variant.
  const attributeNames = useMemo(() => collectAttributeNames(variants), [variants]);

  // FULL match — the customer has picked every attribute the product
  // defines AND a variant exists with those exact values. Required for
  // add-to-cart.
  const selectedVariant = useMemo<ProductVariant | null>(() => {
    if (!hasVariants || attributeNames.size === 0) return null;
    const allPicked = Array.from(attributeNames).every(
      (n) => (selectedOptions[n] ?? "").trim() !== "",
    );
    if (!allPicked) return null;
    return findMatchingVariant(variants, selectedOptions, { requireAll: true });
  }, [variants, hasVariants, attributeNames, selectedOptions]);

  // COLOR match — first variant satisfying the selected color only. This
  // keeps gallery changes tied to Color; changing Size under the same color
  // must not change the strip.
  const previewVariant = useMemo<ProductVariant | null>(() => {
    return findColorPreviewVariant(variants, selectedOptions);
  }, [variants, selectedOptions]);

  const requiresVariantSelection = hasVariants && !selectedVariant;

  // Price is product-level only — picking a variant must not change the
  // displayed price. Variant-level price columns exist in the schema for
  // legacy reasons but are intentionally ignored.
  const effectivePricing: PricingData | null = snapshot?.pricing ?? null;

  // Current price for the mobile sticky bar — mirrors PricingPanel's rule
  // (sale price wins when present, else retail).
  const stickyPrice = (() => {
    const retail = effectivePricing?.retailPrice ?? fallbackPrice?.retailPrice ?? 0;
    const sale = effectivePricing?.salePrice ?? fallbackPrice?.salePrice ?? null;
    return sale && sale > 0 ? sale : retail;
  })();

  const effectiveStockState =
    selectedVariant?.stockState ?? snapshot?.stock?.stockState ?? fallbackStockState;
  const isAvailable =
    !requiresVariantSelection &&
    (selectedVariant?.isAvailable ?? !hasVariants) &&
    effectiveStockState !== "OUT_OF_STOCK" &&
    !snapshot?.stock?.forceOutOfStock;

  // When a variant is selected, the StockStatus badge should reflect THAT
  // variant's state + on-hand count; otherwise fall back to the product
  // aggregate. Without this swap, picking a LOW_STOCK variant on an
  // IN_STOCK product wouldn't surface scarcity.
  const effectiveStockData: StockData | null = selectedVariant
    ? {
        stockState: selectedVariant.stockState,
        label: "",
        forceOutOfStock: snapshot?.stock?.forceOutOfStock ?? false,
        quantity: selectedVariant.stockQuantity ?? null,
      }
    : (snapshot?.stock ?? null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectOption = useCallback(
    (attributeName: string, value: string) => {
      setSelectedOptions((prev) => {
        // Toggle off if the customer clicks the already-active chip; lets
        // them clear a single attribute without resetting the rest.
        const current = prev[attributeName] ?? "";
        if (normalizeValue(current) === normalizeValue(value)) {
          const next = { ...prev };
          delete next[attributeName];
          return next;
        }
        return { ...prev, [attributeName]: value };
      });
      // Resetting quantity matches the previous "fresh start on variant
      // change" behaviour and prevents 99x of the wrong size landing in
      // the cart after a switch.
      setQuantity(1);
    },
    [],
  );

  async function handleAddToCart() {
    setAddLoading(true);
    setAddError("");
    try {
      await addToCart(productId, quantity, selectedVariant?.id || undefined);
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Không thể thêm vào giỏ hàng.",
      );
    } finally {
      setAddLoading(false);
    }
  }

  const showRating = typeof initialRating === "number" && initialRating > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Left: Gallery — driven only by Color. Falls back to the product-level
          gallery when no color is picked. */}
      <ProductGallery
        mainImage={mainImage}
        gallery={gallery}
        altFallback={productName}
        variantImage={previewVariant?.image ?? null}
        variantGallery={previewVariant?.gallery ?? undefined}
        variantKey={previewVariant?.id ?? null}
      />

      {/* Right: Info + Purchase controls */}
      <div className="bb-pdp-info">
        <h1 className="bb-pdp-info-title">{productName}</h1>

        {/* Price + rating (left) and stock badge (right) — one row. */}
        <div className="bb-pdp-price-row">
          <div className="bb-pdp-price-main">
            <PricingPanel
              data={effectivePricing}
              fallback={fallbackPrice}
              isLoading={snapshotLoading && !fallbackPrice}
            />
            {showRating ? (
              <div className="bb-pdp-rating">
                <span className="stars" aria-label={`${initialRating.toFixed(1)} sao`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <svg
                      key={i}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill={i < Math.round(initialRating) ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="text-brand"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </span>
                {typeof initialRatingCount === "number" && initialRatingCount > 0 && (
                  <span className="bb-pdp-rating-count">({initialRatingCount} đánh giá)</span>
                )}
              </div>
            ) : null}
          </div>
          <div className="bb-stock-wrap">
            <StockStatus
              data={effectiveStockData}
              fallbackState={fallbackStockState}
              isLoading={snapshotLoading && !fallbackStockState}
            />
          </div>
        </div>

        {shortDescription && (
          <p className="bb-pdp-short-desc">{shortDescription}</p>
        )}

        {/* "Please pick variant" prompt — only when product has variants the user
            hasn't fully picked AND product is not actually sold out. */}
        {requiresVariantSelection && effectiveStockState !== "OUT_OF_STOCK" && (
          <div className="bb-pdp-variant-prompt" role="status">
            Vui lòng chọn size/màu sắc để mua hàng:
          </div>
        )}

        {/* Variant chip selectors (fresh data, fallback to ISR while loading) */}
        <VariantSelector
          variants={variants}
          selectedOptions={selectedOptions}
          onSelectOption={handleSelectOption}
          isLoading={snapshotLoading && !fallbackVariants.length}
        />

        {/* Quantity stepper + single add-to-cart button — one row. */}
        <div className="bb-pdp-buy-row">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={effectiveStockData?.quantity ?? undefined}
            ariaLabel="Số lượng sản phẩm"
          />
          <Button
            type="button"
            variant="primary"
            onClick={handleAddToCart}
            disabled={addLoading || !isAvailable}
          >
            {addLoading
              ? "Đang thêm..."
              : requiresVariantSelection
                ? "Vui lòng chọn biến thể"
                : isAvailable
                  ? "Thêm vào giỏ hàng"
                  : "Tạm hết hàng"}
          </Button>
        </div>

        {addError && (
          <p className="bb-error-text bb-pdp-error">{addError}</p>
        )}

        {/* Social share — Facebook / Twitter / Instagram / Skype (parity with
            the legacy WP single-product social row). */}
        <div className="bb-pdp-share">
          <span className="bb-pdp-share-label">Share</span>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-pdp-share-btn"
            aria-label="Chia sẻ lên Facebook"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M9.2 14V8.5h1.85l.28-2.15H9.2V5c0-.62.17-1.04 1.06-1.04h1.13V2.05A15.4 15.4 0 0 0 9.84 2C8.2 2 7.08 3 7.08 4.84V6.35H5.22V8.5h1.86V14H9.2Z" />
            </svg>
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(productName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-pdp-share-btn"
            aria-label="Chia sẻ trên X (Twitter)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M9.52 6.78 14.94 1h-1.28L8.95 6.02 5.21 1H1l5.7 7.66L1 14.71h1.28l4.99-5.31 3.95 5.31H15L9.52 6.78Zm-1.77 1.88-.58-.78L2.74 1.94h1.97l3.71 4.97.58.77 4.83 6.46h-1.97L7.75 8.66Z" />
            </svg>
          </a>
          <a
            href={SHOP_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-pdp-share-btn"
            aria-label="Instagram BigBike"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a
            href={`https://web.skype.com/share?url=${encodeURIComponent(canonicalUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-pdp-share-btn"
            aria-label="Chia sẻ qua Skype"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 1 8.66 15.02 6 6 0 0 1-8.34 8.3A10 10 0 1 1 12 2Zm.2 16.6c2.86 0 4.62-1.4 4.62-3.62 0-1.43-.68-2.94-3.5-3.57l-1.6-.36c-.6-.14-1.3-.33-1.3-.9 0-.63.55-1.06 1.55-1.06 2.02 0 1.83 1.38 2.84 1.38.53 0 .99-.31.99-.85 0-1.25-2-2.2-3.67-2.2-1.82 0-3.76.78-3.76 2.84 0 1 .35 2.05 2.32 2.54l2.16.54c.65.16 1.22.44 1.22 1.05 0 .6-.6 1.18-1.7 1.18-2.19 0-1.89-1.68-3.07-1.68-.53 0-.92.37-.92.9 0 1.03 1.25 2.74 3.99 2.74Z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Mobile sticky purchase bar — keeps the primary CTA reachable while the
          customer scrolls through a long PDP (specs, description, reviews).
          Hidden on desktop where the in-flow CTA stays visible beside the gallery.
          Right padding clears the floating chat button. */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-[var(--bb-z-overlay)] flex items-center gap-3 border-t border-border bg-white px-4 py-2.5 pr-20 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-4px_14px_rgba(0,0,0,0.1)]">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm uppercase tracking-[0.12em] text-muted-foreground leading-none">Giá</span>
          <b className="font-display text-brand text-lg leading-tight">
            {stickyPrice > 0 ? formatVnd(stickyPrice) : "Liên hệ"}
          </b>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleAddToCart}
          disabled={addLoading || !isAvailable}
          className="flex-1"
        >
          {addLoading
            ? "Đang thêm..."
            : requiresVariantSelection
              ? "Chọn biến thể"
              : isAvailable
                ? "Thêm vào giỏ"
                : "Tạm hết hàng"}
        </Button>
      </div>
    </>
  );
}
