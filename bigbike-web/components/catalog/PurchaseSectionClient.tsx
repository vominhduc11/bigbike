"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ProductGallery } from "./ProductGallery";
import { PricingPanel } from "./PricingPanel";
import { StockStatus } from "./StockStatus";
import type { PricingData } from "./PricingPanel";
import type { StockData } from "./StockStatus";
import { VariantSelector } from "./VariantSelector";
import { ProductDeliveryInfo } from "./ProductDeliveryInfo";
import { useCart } from "@/lib/cart-context";
import { CompareButton } from "./CompareButton";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { toCheckoutPath } from "@/lib/utils/routes";
import {
  collectAttributeNames,
  findColorPreviewVariant,
  findMatchingVariant,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ImageAsset, ProductPrice, ProductVariant, VideoAsset } from "@/lib/contracts/public";

// Instagram has no public link-share endpoint — the icon links to the shop
// profile (parity with the legacy WP product page social row).
const SHOP_INSTAGRAM_URL = "https://www.instagram.com/bigbike.vn/";

/** Normalize a Zalo setting value (raw phone or full URL) into an openable link. */
function toZaloHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://zalo.me/${digits}` : value;
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
  /** Primary category id — drives the "same category" rule of the comparison feature. */
  categoryId: string;
  /** Product code shown in the brand/SKU row above the title. */
  sku?: string;
  shortDescription: string | null | undefined;
  initialRating: number | null;
  initialRatingCount: number | null;
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  /** All product videos — shown as a carousel below the gallery. */
  videos?: VideoAsset[];
  /** Shop Zalo link (raw phone or URL) from system settings — drives the consult button. */
  zaloUrl?: string;
  /** Shop hotline from system settings — drives the phone consult button. */
  hotline?: string;
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
  categoryId,
  categoryName,
  sku,
  shortDescription,
  initialRating,
  initialRatingCount,
  mainImage,
  gallery,
  videos,
  zaloUrl,
  hotline,
  fallbackPrice,
  fallbackStockState,
  fallbackVariants,
  canonicalUrl,
}: PurchaseSectionClientProps) {
  const { addToCart } = useCart();
  const router = useRouter();
  const t = useTranslations("Product.buyBox");

  // Track the customer's progressively-built attribute selection. Empty
  // map = no attributes picked yet. Drives:
  //   - selectedVariant (full match → required for purchase)
  //   - previewVariant  (color-only match → drives gallery preview; Size
  //                       and other attributes never swap the image strip)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
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

  // Sale percent for the gallery corner badge — snapshot first, else derive
  // from the ISR-cached fallback price.
  const galleryDiscount = useMemo(() => {
    const fromSnapshot = effectivePricing?.discountPercent ?? 0;
    if (fromSnapshot > 0) return Math.round(fromSnapshot);
    const compare = fallbackPrice?.compareAtPrice ?? 0;
    const current =
      fallbackPrice?.salePrice && fallbackPrice.salePrice > 0
        ? fallbackPrice.salePrice
        : (fallbackPrice?.retailPrice ?? 0);
    if (compare > current && compare > 0 && current > 0) {
      return Math.round(((compare - current) / compare) * 100);
    }
    return 0;
  }, [effectivePricing, fallbackPrice]);

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

  // Single phone/Zalo consult CTA below the buy buttons — hotline wins.
  const contact = (() => {
    if (hotline && hotline.trim()) {
      return {
        href: `tel:${hotline.replace(/[^\d+]/g, "")}`,
        label: t("callHotline", { phone: hotline.trim() }),
        external: false,
      };
    }
    if (zaloUrl && zaloUrl.trim()) {
      return { href: toZaloHref(zaloUrl), label: t("zaloAdvice"), external: true };
    }
    return null;
  })();

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
        err instanceof Error ? err.message : t("addToCartFailed"),
      );
    } finally {
      setAddLoading(false);
    }
  }

  async function handleBuyNow() {
    setBuyLoading(true);
    setAddError("");
    try {
      await addToCart(productId, quantity, selectedVariant?.id || undefined);
      // Straight to checkout — keep the loading state so the button stays
      // disabled through the navigation.
      router.push(toCheckoutPath());
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("buyNowFailed"));
      setBuyLoading(false);
    }
  }

  const busy = addLoading || buyLoading;
  const showRating = typeof initialRating === "number" && initialRating > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Left column: Gallery (driven only by Color) + an optional featured
          video below it. Falls back to the product-level gallery when no
          color is picked. */}
      <div className="flex min-w-0 flex-col gap-3">
        <ProductGallery
          mainImage={mainImage}
          gallery={gallery}
          altFallback={productName}
          variantImage={previewVariant?.image ?? null}
          variantGallery={previewVariant?.gallery ?? undefined}
          variantKey={previewVariant?.id ?? null}
          discountBadge={galleryDiscount}
          videos={videos}
        />
      </div>

      {/* Right: Info + Purchase controls */}
      <div className="flex min-w-0 flex-col gap-5">
        {/* Brand · SKU · title · subtitle · rating */}
        <div>
          {(brandName || sku) && (
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {brandName && (
                <span className="font-cta text-sm font-bold uppercase tracking-wider text-brand">
                  {brandName}
                </span>
              )}
              {brandName && sku && (
                <span className="h-1 w-1 shrink-0 rounded-full bg-border" aria-hidden="true" />
              )}
              {sku && (
                <span className="text-sm text-muted-foreground">{t("skuLabel", { sku })}</span>
              )}
            </div>
          )}
          <h1 className="font-display text-[clamp(1.5rem,4vw,2.25rem)] font-semibold uppercase leading-[1.15] tracking-tight text-foreground">
            {productName}
          </h1>
          {shortDescription && (
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {shortDescription}
            </p>
          )}
          {showRating && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span
                className="flex items-center gap-0.5 text-brand"
                aria-label={`${initialRating.toFixed(1)} sao`}
              >
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
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </span>
              <span className="text-sm font-bold text-foreground">
                {initialRating.toFixed(1)}
              </span>
              {typeof initialRatingCount === "number" && initialRatingCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {t("ratingCount", { count: initialRatingCount })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price card */}
        <div className="border border-border bg-muted/40 p-5">
          <PricingPanel
            data={effectivePricing}
            fallback={fallbackPrice}
            isLoading={snapshotLoading && !fallbackPrice}
          />
        </div>

        {/* "Please pick variant" prompt — only when product has variants the user
            hasn't fully picked AND product is not actually sold out. */}
        {requiresVariantSelection && effectiveStockState !== "OUT_OF_STOCK" && (
          <div
            className="border border-brand/30 bg-accent px-3.5 py-2.5 text-sm font-semibold text-brand"
            role="status"
          >
            {t("pickVariantHint")}
          </div>
        )}

        {/* Variant chip selectors — wrapper zeroes the last group's margin so
            the flex-gap rhythm stays even. */}
        {hasVariants && (
          <div className="[&>div:last-child]:mb-0">
            <VariantSelector
              variants={variants}
              selectedOptions={selectedOptions}
              onSelectOption={handleSelectOption}
              isLoading={snapshotLoading && !fallbackVariants.length}
            />
          </div>
        )}

        {/* Stock line + quantity + purchase CTAs */}
        <div className="flex flex-col gap-3">
          <StockStatus
            variant="inline"
            data={effectiveStockData}
            fallbackState={fallbackStockState}
            isLoading={snapshotLoading && !fallbackStockState}
          />

          <div className="flex flex-wrap items-stretch gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={effectiveStockData?.quantity ?? undefined}
              ariaLabel={t("quantityLabel")}
            />
            <Button
              type="button"
              variant="dark"
              onClick={handleAddToCart}
              disabled={busy || !isAvailable}
              className="min-w-[180px] flex-1"
            >
              {addLoading
                ? t("adding")
                : requiresVariantSelection
                  ? t("pickVariantCta")
                  : isAvailable
                    ? t("addToCart")
                    : t("soldOut")}
            </Button>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleBuyNow}
            disabled={busy || !isAvailable}
            className="w-full"
          >
            {buyLoading ? t("buyNowProcessing") : t("buyNow")}
          </Button>

          {contact && (
            <a
              href={contact.href}
              {...(contact.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="flex min-h-[44px] items-center justify-center gap-2 border-2 border-border px-4 py-3 font-cta text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-brand hover:text-brand"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {contact.label}
            </a>
          )}

          {addError && (
            <p className="bb-error-text mt-1" role="alert">
              {addError}
            </p>
          )}
        </div>

        {/* Add this product to the comparison list (browser-local, max 3, same category). */}
        <CompareButton
          variant="full"
          product={{
            id: productId,
            slug: productSlug,
            name: productName,
            imageUrl: mainImage?.url ?? null,
            price:
              (effectivePricing?.salePrice && effectivePricing.salePrice > 0
                ? effectivePricing.salePrice
                : effectivePricing?.retailPrice) ??
              (fallbackPrice?.salePrice && fallbackPrice.salePrice > 0
                ? fallbackPrice.salePrice
                : fallbackPrice?.retailPrice) ??
              null,
            categoryId,
            categoryName,
          }}
        />

        {/* Social share — Facebook / Twitter / Instagram / Skype (parity with
            the legacy WP single-product social row). */}
        <div className="bb-pdp-share">
          <span className="bb-pdp-share-label">{t("shareLabel")}</span>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-pdp-share-btn"
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
            className="bb-pdp-share-btn"
            aria-label={t("shareTwitter")}
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
            aria-label={t("shareInstagram")}
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
            aria-label={t("shareSkype")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 1 8.66 15.02 6 6 0 0 1-8.34 8.3A10 10 0 1 1 12 2Zm.2 16.6c2.86 0 4.62-1.4 4.62-3.62 0-1.43-.68-2.94-3.5-3.57l-1.6-.36c-.6-.14-1.3-.33-1.3-.9 0-.63.55-1.06 1.55-1.06 2.02 0 1.83 1.38 2.84 1.38.53 0 .99-.31.99-.85 0-1.25-2-2.2-3.67-2.2-1.82 0-3.76.78-3.76 2.84 0 1 .35 2.05 2.32 2.54l2.16.54c.65.16 1.22.44 1.22 1.05 0 .6-.6 1.18-1.7 1.18-2.19 0-1.89-1.68-3.07-1.68-.53 0-.92.37-.92.9 0 1.03 1.25 2.74 3.99 2.74Z" />
            </svg>
          </a>
        </div>

        {/* Delivery / warranty / return trust grid. */}
        <ProductDeliveryInfo />
      </div>

      {/* Mobile sticky purchase bar — keeps the primary CTA reachable while the
          customer scrolls through a long PDP (specs, description, reviews).
          Hidden on desktop where the in-flow CTA stays visible beside the gallery.
          Right padding clears the floating chat button. */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-[var(--bb-z-overlay)] flex items-center gap-2 border-t border-border bg-white px-4 py-2.5 pr-20 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-4px_14px_rgba(0,0,0,0.1)]">
        <Button
          type="button"
          variant="dark"
          onClick={handleAddToCart}
          disabled={busy || !isAvailable}
          className="flex-1"
        >
          {addLoading
            ? t("adding")
            : requiresVariantSelection
              ? t("pickVariantShort")
              : isAvailable
                ? t("addToCartShort")
                : t("soldOut")}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleBuyNow}
          disabled={busy || !isAvailable}
          className="flex-1"
        >
          {buyLoading ? "Đang xử lý..." : "Mua ngay"}
        </Button>
      </div>
    </>
  );
}
