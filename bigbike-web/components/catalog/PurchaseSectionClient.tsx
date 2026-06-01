"use client";

import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ProductGallery } from "./ProductGallery";
import { PricingPanel } from "./PricingPanel";
import { StockStatus } from "./StockStatus";
import { QuickBuyModal } from "./QuickBuyModal";
import { QuickBuySuccessModal } from "./QuickBuySuccessModal";
import type { PricingData } from "./PricingPanel";
import type { StockData } from "./StockStatus";
import { VariantSelector } from "./VariantSelector";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import {
  collectAttributeNames,
  findColorPreviewVariant,
  findMatchingVariant,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ImageAsset, ProductPrice, ProductVariant, VideoAsset } from "@/lib/contracts/public";

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
  categoryId: string;
  sku?: string;
  shortDescription: string | null | undefined;
  initialRating: number | null;
  initialRatingCount: number | null;
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  videos?: VideoAsset[];
  zaloUrl?: string;
  hotline?: string;
  instagramUrl?: string;
  fallbackPrice: ProductPrice | null | undefined;
  fallbackStockState: string;
  fallbackVariants: ProductVariant[];
  shortDescriptionHtml?: string;
  canonicalUrl: string;
};

function RatingRow({
  rating,
  count,
}: {
  rating: number | null;
  count: number | null;
}) {
  const t = useTranslations("Product.buyBox");
  // Only show a rating when it's backed by real reviews. Previously this
  // fabricated 5★/125 reviews for products with none — fake data that also
  // leaked into the schema.org AggregateRating microdata.
  const hasReviews =
    typeof rating === "number" && rating > 0 && typeof count === "number" && count > 0;

  if (!hasReviews) {
    return (
      <div className="rating rating--empty">
        <span
          className="rating-star"
          style={{ "--rating-fill": "0%" } as CSSProperties}
          aria-hidden="true"
        />
        <p>{t("noReviews")}</p>
      </div>
    );
  }

  const displayValue = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
  const fillPct = `${Math.min(100, Math.max(0, (rating / 5) * 100))}%`;

  return (
    <div
      className="rating"
      itemProp="aggregateRating"
      itemScope
      itemType="https://schema.org/AggregateRating"
    >
      <span
        className="rating-star"
        style={{ "--rating-fill": fillPct } as CSSProperties}
        aria-label={`${displayValue}/5`}
      />
      <meta itemProp="bestRating" content="5" />
      <p>
        <span itemProp="ratingValue">{displayValue}</span>
        <span aria-hidden="true">★</span>{" "}
        <span className="rating-count">
          (<span itemProp="reviewCount">{count}</span> {t("reviewsWord")})
        </span>
      </p>
    </div>
  );
}

function WpQuantitySelector({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number | null;
  label: string;
}) {
  const normalizedMax = max && max > 0 ? max : undefined;

  function commit(next: number) {
    const clamped = Math.max(1, Math.min(normalizedMax ?? next, next));
    onChange(Number.isFinite(clamped) ? clamped : 1);
  }

  return (
    <div className="quantity-group">
      <div className="quantity">
        <label className="sr-only" htmlFor="bb-wp-pdp-qty">
          {label}
        </label>
        <input
          id="bb-wp-pdp-qty"
          type="number"
          min={1}
          max={normalizedMax}
          value={value}
          onChange={(event) => commit(Number.parseInt(event.target.value, 10))}
          inputMode="numeric"
        />
      </div>
      <div className="button">
        <button type="button" className="minus js-plus" onClick={() => commit(value + 1)}>
          <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="plus js-minus" onClick={() => commit(value - 1)}>
          <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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
  shortDescriptionHtml,
  canonicalUrl,
  instagramUrl,
}: PurchaseSectionClientProps) {
  const { addToCart } = useCart();
  const t = useTranslations("Product.buyBox");

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ orderNumber: string; orderKey: string; paymentMethod: string } | null>(null);
  const [addError, setAddError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: productName, url: canonicalUrl });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context) — silently ignore.
    }
  }, [productName, canonicalUrl]);

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

  const variants = snapshot?.variants ?? fallbackVariants;
  const hasVariants = variants.length > 0;
  const attributeNames = useMemo(() => collectAttributeNames(variants), [variants]);

  const selectedVariant = useMemo<ProductVariant | null>(() => {
    if (!hasVariants || attributeNames.size === 0) return null;
    const allPicked = Array.from(attributeNames).every(
      (n) => (selectedOptions[n] ?? "").trim() !== "",
    );
    if (!allPicked) return null;
    return findMatchingVariant(variants, selectedOptions, { requireAll: true });
  }, [variants, hasVariants, attributeNames, selectedOptions]);

  const previewVariant = useMemo<ProductVariant | null>(() => {
    return findColorPreviewVariant(variants, selectedOptions);
  }, [variants, selectedOptions]);

  const requiresVariantSelection = hasVariants && !selectedVariant;
  const effectivePricing: PricingData | null = snapshot?.pricing ?? null;
  const effectiveStockState =
    selectedVariant?.stockState ?? snapshot?.stock?.stockState ?? fallbackStockState;
  const effectiveStockData: StockData | null = selectedVariant
    ? {
        stockState: selectedVariant.stockState,
        label: "",
        forceOutOfStock: snapshot?.stock?.forceOutOfStock ?? false,
        quantity: selectedVariant.stockQuantity ?? null,
      }
    : (snapshot?.stock ?? null);

  const isAvailable =
    !requiresVariantSelection &&
    (selectedVariant?.isAvailable ?? !hasVariants) &&
    effectiveStockState !== "OUT_OF_STOCK" &&
    !snapshot?.stock?.forceOutOfStock;

  const handleSelectOption = useCallback(
    (attributeName: string, value: string) => {
      setSelectedOptions((prev) => {
        const current = prev[attributeName] ?? "";
        if (normalizeValue(current) === normalizeValue(value)) {
          const next = { ...prev };
          delete next[attributeName];
          return next;
        }
        return { ...prev, [attributeName]: value };
      });
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
      setAddError(err instanceof Error ? err.message : t("addToCartFailed"));
    } finally {
      setAddLoading(false);
    }
  }

  const busy = addLoading;
  // Whole product is sold out when forced out of stock, when every variant is
  // out of stock, or when the resolved (product- or selected-variant-level)
  // stock state is OUT_OF_STOCK. Keyed off stockState, not `isAvailable` — the
  // latter only means the variant combination exists, not that it's in stock.
  const allVariantsOut =
    hasVariants && variants.every((v) => v.stockState === "OUT_OF_STOCK");
  const soldOut =
    Boolean(snapshot?.stock?.forceOutOfStock) ||
    allVariantsOut ||
    (!requiresVariantSelection && effectiveStockState === "OUT_OF_STOCK");
  const addToCartLabel = addLoading
    ? t("adding")
    : soldOut
      ? t("soldOut")
      : t("addToCart");

  return (
    <>
      <div className="bb-wp-pdp-gallery-col">
        <ProductGallery
          mainImage={mainImage}
          gallery={gallery}
          altFallback={productName}
          variantImage={previewVariant?.image ?? null}
          variantGallery={previewVariant?.gallery ?? undefined}
          variantKey={previewVariant?.id ?? null}
        />
      </div>

      <div className="bb-wp-pdp-info-col product-information">
        <div className="title">
          <h1>{productName}</h1>
        </div>

        <div className="bb-wp-summary-row">
          <div className="bb-wp-price-rating-col">
            <PricingPanel
              data={effectivePricing}
              fallback={fallbackPrice}
              isLoading={snapshotLoading && !fallbackPrice}
            />
            <RatingRow rating={initialRating} count={initialRatingCount} />
          </div>
          <div className="bb-wp-status-col status">
            <p>
              <StockStatus
                variant="badge"
                data={effectiveStockData}
                fallbackState={fallbackStockState}
                isLoading={snapshotLoading && !fallbackStockState}
              />
            </p>
          </div>
        </div>

        {(shortDescriptionHtml || shortDescription) && (
          <div className="desc wyswyg">
            <div
              className="woocommerce-product-details__short-description"
              dangerouslySetInnerHTML={{ __html: shortDescriptionHtml || shortDescription || "" }}
            />
          </div>
        )}

        {hasVariants && (
          <div className="size">
            <VariantSelector
              variants={variants}
              selectedOptions={selectedOptions}
              onSelectOption={handleSelectOption}
              isLoading={snapshotLoading && !fallbackVariants.length}
            />
          </div>
        )}

        <div className="bb-wp-add-cart-wrap">
          {/* When sold out, drop the quantity stepper + "Mua ngay" — they're
              non-actionable. The sold-out state is carried by the badge plus
              the (kept) add button label and the note below. */}
          {!soldOut && (
            <div className="bb-wp-quantity-row">
              <WpQuantitySelector
                value={quantity}
                onChange={setQuantity}
                max={effectiveStockData?.quantity}
                label={t("quantityLabel")}
              />
            </div>
          )}

          <div className="bb-wp-buttons-row">
            <div className="add-to-cart">
              {/* Kept mounted even when sold out: MobileStickyPurchaseBar
                  mirrors this button's disabled/data-soldout state. */}
              <button
                type="button"
                className={cn(
                  "single_add_to_cart_button button alt btn js-add-to-cart-btn",
                  !isAvailable && "disabled wc-variation-selection-needed",
                )}
                onClick={handleAddToCart}
                disabled={busy || !isAvailable}
                data-soldout={soldOut ? "true" : undefined}
              >
                {addToCartLabel}
              </button>
            </div>
            {!soldOut && (
              <div className="add-to-cart quick-add-to-cart">
                <button
                  type="button"
                  className={cn(
                    "btn single_add_to_cart_button button btn-quick-buy js-quickby",
                    !isAvailable && "disabled",
                  )}
                  disabled={!isAvailable}
                  onClick={() => setQuickBuyOpen(true)}
                >
                  {t("buyNow")}
                </button>
              </div>
            )}
          </div>

          {soldOut && (
            <p className="mt-3 text-sm text-muted-foreground">{t("outOfStockNote")}</p>
          )}

          <QuickBuyModal
            open={quickBuyOpen}
            onClose={() => setQuickBuyOpen(false)}
            productId={productId}
            productName={productName}
            selectedVariantId={selectedVariant?.id ?? null}
            variantLabel={selectedVariant?.name ?? null}
            unitPrice={
              (snapshot?.pricing?.salePrice ?? snapshot?.pricing?.retailPrice) ??
              (fallbackPrice?.salePrice ?? fallbackPrice?.retailPrice) ??
              null
            }
            onSuccess={(order) => {
              setQuickBuyOpen(false);
              setSuccessOrder(order);
            }}
          />
          <QuickBuySuccessModal
            order={successOrder}
            onClose={() => setSuccessOrder(null)}
          />

          {addError && (
            <p className="bb-error-text bb-wp-cart-error" role="alert">
              {addError}
            </p>
          )}
        </div>

        <div className="social text-left">
          <p>{t("shareLabel")}</p>
          <button
            type="button"
            className="bb-wp-share-btn"
            onClick={handleShare}
            aria-label={t("shareNative")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
              <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
            </svg>
          </button>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("shareFacebook")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M9.2 14V8.5h1.85l.28-2.15H9.2V5c0-.62.17-1.04 1.06-1.04h1.13V2.05A15.4 15.4 0 0 0 9.84 2C8.2 2 7.08 3 7.08 4.84V6.35H5.22V8.5h1.86V14H9.2Z" />
            </svg>
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(productName)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("shareTwitter")}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M12.6 1.5h2.45l-5.35 6.12L16 14.5h-4.93l-3.86-5.05-4.42 5.05H.34l5.72-6.54L0 1.5h5.05l3.49 4.61L12.6 1.5Zm-.86 11.52h1.36L4.32 2.9H2.86l8.88 10.12Z" />
            </svg>
          </a>
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("shareInstagram")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
          ) : null}
          {shareCopied && (
            <span className="ml-2 text-sm font-medium text-brand" role="status">
              {t("shareCopied")}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
