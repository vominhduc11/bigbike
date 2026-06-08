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
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
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

// Shared red add-to-cart / buy-now CTA (mobile swaps body→cta font + uppercase).
// Full-bleed brand CTA. Routed through <Button> (variant primary): the trailing
// overrides (px-0 + scale-100 + normal-case + h/w) neutralise the variant's base
// padding/hover-scale/uppercase so the WP-parity look is preserved 1:1.
const ADD_BTN =
  "w-full h-[52px] px-0 border-none rounded-none bg-brand text-white font-body text-ui-16 font-semibold !leading-[52px] normal-case hover:not-disabled:scale-100 disabled:cursor-not-allowed disabled:bg-[var(--bb-color-gray-450)] disabled:opacity-70 max-md:min-h-[52px] max-md:font-cta max-md:text-ui-14 max-md:uppercase max-md:tracking-normal";

// Share icon links + native-share button (1em icons, brand on hover).
const SOCIAL_LINK =
  "inline-flex items-center justify-center mr-[30px] p-0 border-none bg-transparent text-muted-foreground text-ui-24 no-underline align-middle cursor-pointer hover:text-brand [&_svg]:w-[1em] [&_svg]:h-[1em]";

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
      <div className="mt-2 text-black text-ui-14">
        <span
          className="inline-block text-rating-star text-ui-18 tracking-normal before:content-['★★★★★']"
          aria-hidden="true"
        />
        <p className="m-0 mt-1 text-black text-ui-14 !leading-[1.4]">{t("noReviews")}</p>
      </div>
    );
  }

  const displayValue = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <div
      className="mt-2 text-black text-ui-14"
      itemProp="aggregateRating"
      itemScope
      itemType="https://schema.org/AggregateRating"
    >
      <span
        className="inline-block text-rating-star text-ui-18 tracking-normal before:content-['★★★★★']"
        aria-label={`${displayValue}/5`}
      />
      <meta itemProp="bestRating" content="5" />
      <p className="m-0 mt-1 text-black text-ui-14 !leading-[1.4]">
        <span itemProp="ratingValue">{displayValue}</span>
        <span aria-hidden="true">★</span>{" "}
        <span className="rating-count">
          (<span itemProp="reviewCount">{count}</span> {t("reviewsWord")})
        </span>
      </p>
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
  videos,
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
  // Sold-out products don't render this button (see the buy area below), so the
  // label only ever covers the in-stock adding / idle states.
  const addToCartLabel = addLoading ? t("adding") : t("addToCart");

  return (
    <>
      <div className="bb-wp-pdp-gallery-col min-w-0 max-[1024px]:order-1 max-[1024px]:w-full">
        <ProductGallery
          mainImage={mainImage}
          gallery={gallery}
          videos={videos}
          altFallback={productName}
          variantImage={previewVariant?.image ?? null}
          variantGallery={previewVariant?.gallery ?? undefined}
          variantKey={previewVariant?.id ?? null}
        />
      </div>

      <div className="bb-wp-pdp-info-col product-information min-w-0 max-[1024px]:order-2 max-[1024px]:w-full">
        <div className="mb-5 max-md:mb-3">
          <h1 className="m-0 font-[family-name:var(--bb-font-display)] text-ui-30 max-[1024px]:text-ui-26 max-md:text-ui-24 font-semibold !leading-[3.75rem] max-[1024px]:!leading-[1.25] max-md:!leading-[1.12] tracking-normal normal-case max-md:uppercase text-black">
            {productName}
          </h1>
        </div>

        <div className="flex flex-wrap mx-[-15px] max-md:mx-0 max-md:gap-3">
          <div className="flex-[0_0_41.666667%] max-[1024px]:flex-[0_0_100%] max-w-[41.666667%] max-[1024px]:max-w-full px-[15px] max-md:px-0">
            <PricingPanel
              data={effectivePricing}
              fallback={fallbackPrice}
              isLoading={snapshotLoading && !fallbackPrice}
            />
            <RatingRow rating={initialRating} count={initialRatingCount} />
          </div>
          <div className="flex justify-end max-[1024px]:justify-start flex-[0_0_58.333333%] max-[1024px]:flex-[0_0_100%] max-w-[58.333333%] max-[1024px]:max-w-full px-[15px] max-md:px-0 text-right max-[1024px]:text-left max-[1024px]:mt-3 max-md:mt-0">
            <p className="relative isolate w-full max-w-[190px] max-md:max-w-[170px] h-[42px] max-md:h-[38px] m-0 ml-auto max-[1024px]:ml-0 border-none bg-transparent text-center font-cta font-semibold uppercase text-white after:content-[''] after:absolute after:inset-0 after:-z-10 after:bg-black after:[transform:skewX(-20deg)] has-[.bb-pdp-stock-badge--out]:after:bg-brand">
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
          <div className="size mt-[15px]">
            <VariantSelector
              variants={variants}
              selectedOptions={selectedOptions}
              onSelectOption={handleSelectOption}
              isLoading={snapshotLoading && !fallbackVariants.length}
            />
          </div>
        )}

        <div className="mt-[30px] max-md:mt-5">
          {soldOut ? (
            /* Out-of-stock state is announced once by the status badge next to
               the price. Here we drop the buy controls entirely and show only a
               short guidance note — no duplicate "hết hàng" CTA. Omitting
               .bb-wp-buttons-row also keeps the mobile sticky add-to-cart bar
               hidden (it keys off that row), since there's nothing to add. */
            <div className="flex items-center gap-2.5 border border-border border-l-2 border-l-brand bg-muted/40 px-4 py-3.5">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="shrink-0 text-brand"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12.5" />
                <line x1="12" y1="16" x2="12" y2="16" />
              </svg>
              <p className="m-0 text-sm text-muted-foreground">{t("outOfStockNote")}</p>
            </div>
          ) : (
            <>
              <div className="w-[41.666667%] max-[1024px]:w-full min-w-[190px] max-md:min-w-0">
                <QuantityStepper
                  value={quantity}
                  onChange={setQuantity}
                  max={
                    effectiveStockData?.quantity && effectiveStockData.quantity > 0
                      ? effectiveStockData.quantity
                      : undefined
                  }
                  ariaLabel={t("quantityLabel")}
                />
              </div>

              {/* bb-wp-buttons-row kept: MobileStickyPurchaseBar observes it to
                  know when to reveal the mobile sticky bar. */}
              <div className="bb-wp-buttons-row grid grid-cols-2 max-[1024px]:grid-cols-1 gap-[30px] max-[1024px]:gap-5 max-md:gap-2.5 mt-5 max-md:mt-3">
                <div>
                  {/* js-add-to-cart-btn: the sticky bar mirrors this button's
                      disabled state (e.g. "select a variant first"). */}
                  <Button
                    type="button"
                    variant="primary"
                    className={cn("js-add-to-cart-btn", ADD_BTN)}
                    onClick={handleAddToCart}
                    disabled={busy || !isAvailable}
                  >
                    {addToCartLabel}
                  </Button>
                </div>
                <div>
                  {/* js-buy-now-btn: the sticky bar mirrors this button's
                      disabled state and click behaviour. */}
                  <Button
                    type="button"
                    variant="primary"
                    className={cn("js-buy-now-btn", ADD_BTN)}
                    disabled={!isAvailable}
                    onClick={() => setQuickBuyOpen(true)}
                  >
                    {t("buyNow")}
                  </Button>
                </div>
              </div>
            </>
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
            <p className="mt-2.5 text-sm text-brand" role="alert">
              {addError}
            </p>
          )}
        </div>

        <div className="mt-[30px] max-md:mt-[22px] flex flex-wrap items-center">
          <p className="m-0 mr-[30px] text-black text-ui-24 font-semibold lowercase">
            {t("shareLabel")}
          </p>
          <button
            type="button"
            className={SOCIAL_LINK}
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
            className={SOCIAL_LINK}
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
            className={SOCIAL_LINK}
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
              className={SOCIAL_LINK}
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
