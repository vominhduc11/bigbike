"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductGallery } from "./ProductGallery";
import { PricingPanel } from "./PricingPanel";
import { StockStatus } from "./StockStatus";
import type { PricingData } from "./PricingPanel";
import type { StockData } from "./StockStatus";
import { VariantSelector } from "./VariantSelector";
import { QuickBuyModal } from "./QuickBuyModal";
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

const FEATURES = [
  "Hàng chính hãng 100%",
  "Bảo hành theo chính sách hãng",
  "Thanh toán COD hoặc chuyển khoản",
  "Giao toàn quốc",
];

function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="bb-pdp-feat-icon"
    >
      <circle cx="7" cy="7" r="6" />
      <path d="M4.5 7l2 2 3-3" />
    </svg>
  );
}

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
  brandName,
  categoryName,
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
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);

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
  // add-to-cart / quick-buy.
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
        {/* Static header (ISR-rendered data) */}
        <p className="bb-pdp-info-brand">
          {brandName}
          {categoryName ? ` · ${categoryName}` : ""}
        </p>
        <h1 className="bb-pdp-info-title">{productName}</h1>

        {/* Rating stars — only shown when we have verified reviews (count > 0).
            Avoids showing a seeded/default rating with no actual customer reviews. */}
        {initialRating && initialRating > 0 && (initialRatingCount ?? 0) > 0 ? (
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
            <span>{initialRating.toFixed(1)}/5</span>
            {typeof initialRatingCount === "number" && initialRatingCount > 0 && (
              <span className="bb-pdp-rating-count">({initialRatingCount} đánh giá)</span>
            )}
          </div>
        ) : null}

        {shortDescription && (
          <p className="bb-pdp-short-desc">{shortDescription}</p>
        )}

        {/* Price + Stock — same row (matches original layout) */}
        <div className="bb-pdp-price-row">
          <PricingPanel
            data={effectivePricing}
            fallback={fallbackPrice}
            isLoading={snapshotLoading && !fallbackPrice}
          />
          <div className="bb-stock-wrap">
            <StockStatus
              data={effectiveStockData}
              fallbackState={fallbackStockState}
              isLoading={snapshotLoading && !fallbackStockState}
            />
          </div>
        </div>

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

        {/* Quantity stepper */}
        <div className="bb-pdp-qty">
          <p className="bb-pdp-qty-label">Số lượng</p>
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={effectiveStockData?.quantity ?? undefined}
            ariaLabel="Số lượng sản phẩm"
          />
        </div>

        {/* CTA buttons */}
        <div className="bb-pdp-actions">
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
                ? "Vui lòng chọn biến thể"
                : isAvailable
                  ? "Thêm vào giỏ"
                  : "Tạm hết hàng"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setQuickBuyOpen(true)}
            disabled={!isAvailable}
            className="flex-1"
          >
            {requiresVariantSelection ? "Chọn biến thể trước" : !isAvailable ? "Tạm hết hàng" : "Mua ngay"}
          </Button>
        </div>

        {addError && (
          <p className="bb-error-text bb-pdp-error">{addError}</p>
        )}

        {/* Trust features */}
        <div className="bb-pdp-features">
          {FEATURES.map((feat) => (
            <div key={feat} className="bb-pdp-feat">
              <IconCheck />
              {feat}
            </div>
          ))}
        </div>

        {/* Social share — Facebook + Zalo (mirrors WP single-product layout).
            Reuses .bb-article-share styles already present in globals.css. */}
        <div className="bb-article-share bb-pdp-share">
          <span className="bb-article-share-label">Chia sẻ:</span>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-article-share-btn bb-article-share-fb"
            aria-label="Chia sẻ lên Facebook"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm1.75 3.5h-1c-.41 0-.5.19-.5.63V6h1.5l-.2 1.5H8.25V12h-1.5V7.5H6V6h.75V4.88C6.75 3.62 7.5 3 8.75 3c.58 0 1 .04 1 .04V4.5Z" />
            </svg>
            Facebook
          </a>
          <a
            href={`https://zalo.me/share?url=${encodeURIComponent(canonicalUrl)}&title=${encodeURIComponent(productName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-article-share-btn bb-article-share-zalo"
            aria-label="Chia sẻ qua Zalo"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" />
              <text x="8" y="11.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="currentColor">Z</text>
              <ellipse cx="8" cy="8" rx="5.5" ry="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            Zalo
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(productName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-article-share-btn bb-article-share-twitter"
            aria-label="Chia sẻ trên X (Twitter)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M9.52 6.78 14.94 1h-1.28L8.95 6.02 5.21 1H1l5.7 7.66L1 14.71h1.28l4.99-5.31 3.95 5.31H15L9.52 6.78Zm-1.77 1.88-.58-.78L2.74 1.94h1.97l3.71 4.97.58.77 4.83 6.46h-1.97L7.75 8.66Z" />
            </svg>
            Tweet
          </a>
        </div>
      </div>

      {/* Quick-buy drawer (rendered outside info column for correct stacking) */}
      {quickBuyOpen && (
        <QuickBuyModal
          productId={productId}
          selectedVariantId={selectedVariant?.id ?? ""}
          quantity={quantity}
          productName={productName}
          unitPrice={stickyPrice}
          onClose={() => setQuickBuyOpen(false)}
        />
      )}

      {/* Mobile sticky purchase bar — keeps the primary CTA reachable while the
          customer scrolls through a long PDP (specs, description, reviews).
          Hidden on desktop where the in-flow CTA stays visible beside the gallery.
          Right padding clears the floating chat button. */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-[var(--bb-z-overlay)] flex items-center gap-3 border-t border-border bg-white px-4 py-2.5 pr-20 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-4px_14px_rgba(0,0,0,0.1)]">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground leading-none">Giá</span>
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
