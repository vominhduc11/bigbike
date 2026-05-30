"use client";

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
  const value = rating && rating > 0 ? rating : 5;
  const reviewCount = count && count > 0 ? count : 125;
  const displayValue = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <div
      className="rating"
      itemProp="aggregateRating"
      itemScope
      itemType="https://schema.org/AggregateRating"
    >
      <div className="rating-star" data-rating={displayValue} aria-label={`${displayValue} sao`} />
      <br />
      <p>
        Đánh giá: <span itemProp="ratingValue">{displayValue}/</span>
        <span itemProp="reviewCount">{reviewCount}</span>
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
          <div className="bb-wp-quantity-row">
            <WpQuantitySelector
              value={quantity}
              onChange={setQuantity}
              max={effectiveStockData?.quantity}
              label={t("quantityLabel")}
            />
          </div>

          <div className="bb-wp-buttons-row">
            <div className="add-to-cart">
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
          </div>

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
          <p>share</p>
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
              <path d="M14.4 4.1v.4c0 4.3-3.3 9.3-9.3 9.3-1.8 0-3.5-.5-4.9-1.5h.8c1.5 0 2.9-.5 4-1.4-1.4 0-2.5-.9-2.9-2.2.2 0 .4.1.7.1.3 0 .6 0 .8-.1C2.2 8.4 1.1 7.2 1.1 5.8c.4.2.9.4 1.4.4C1.7 5.6 1.1 4.6 1.1 3.5c0-.6.2-1.2.5-1.7 1.6 2 4 3.3 6.7 3.4-.1-.2-.1-.5-.1-.8 0-1.8 1.5-3.3 3.3-3.3.9 0 1.8.4 2.4 1 .7-.1 1.3-.4 1.9-.7-.2.7-.7 1.3-1.3 1.7.6-.1 1.1-.2 1.6-.4-.4.5-1 1-1.7 1.4Z" />
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
          <a
            href={`https://web.skype.com/share?url=${encodeURIComponent(canonicalUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("shareSkype")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 1 8.66 15.02 6 6 0 0 1-8.34 8.3A10 10 0 1 1 12 2Zm.2 16.6c2.86 0 4.62-1.4 4.62-3.62 0-1.43-.68-2.94-3.5-3.57l-1.6-.36c-.6-.14-1.3-.33-1.3-.9 0-.63.55-1.06 1.55-1.06 2.02 0 1.83 1.38 2.84 1.38.53 0 .99-.31.99-.85 0-1.25-2-2.2-3.67-2.2-1.82 0-3.76.78-3.76 2.84 0 1 .35 2.05 2.32 2.54l2.16.54c.65.16 1.22.44 1.22 1.05 0 .6-.6 1.18-1.7 1.18-2.19 0-1.89-1.68-3.07-1.68-.53 0-.92.37-.92.9 0 1.03 1.25 2.74 3.99 2.74Z" />
            </svg>
          </a>
        </div>
      </div>
    </>
  );
}
