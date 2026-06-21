"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ProductGallery } from "./ProductGallery";
import { PricingPanel } from "./PricingPanel";
import { StockStatus } from "./StockStatus";
import { QuickBuyModal } from "./QuickBuyModal";
import { QuickBuySuccessModal } from "./QuickBuySuccessModal";
import type { PricingData } from "./PricingPanel";
import type { StockData } from "./StockStatus";
import { VariantSelector } from "./VariantSelector";
import { RatingRow } from "./purchase-section/RatingRow";
import { ShareRow } from "./purchase-section/ShareRow";
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
import type { GalleryMedia, ImageAsset, ProductPrice, ProductVariant, VideoAsset } from "@/lib/contracts/public";

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
  gallery: GalleryMedia[];
  /** @deprecated V248 — video giờ nằm trong gallery; prop này không còn được ProductGallery dùng. */
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
  "w-full h-[52px] px-0 border-none rounded-none bg-brand text-white font-body text-ui-16 font-semibold !leading-[52px] normal-case hover:not-disabled:scale-100 disabled:cursor-not-allowed disabled:bg-[var(--bb-color-gray-450)] disabled:opacity-70 max-md:min-h-[52px] max-md:font-cta max-md:uppercase max-md:tracking-normal";

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
  const locale = useLocale();

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addLoading, setAddLoading] = useState(false);
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ orderNumber: string; orderKey: string; paymentMethod: string } | null>(null);
  const [addError, setAddError] = useState("");

  const { data: snapshot, isLoading: snapshotLoading } =
    useQuery<ProductSnapshot>({
      // locale trong key → đổi ngôn ngữ refetch lại để tên màu/size đổi theo.
      queryKey: ["product-snapshot", productId, locale],
      queryFn: async () => {
        const res = await fetch(`/api/products/${productSlug}/snapshot/?lang=${locale}`);
        if (!res.ok) throw new Error("snapshot");
        return res.json() as Promise<ProductSnapshot>;
      },
      staleTime: 30 * 1000,
      // Tồn kho có thể đổi (bán online + walk-in POS) khi khách rời tab xem PDP →
      // làm mới khi quay lại để tránh hiển thị "còn hàng" sai. Override global false.
      refetchOnWindowFocus: true,
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
      <div className="bb-wp-pdp-gallery-col min-w-0 max-md:order-1 max-md:w-full">
        <ProductGallery
          mainImage={mainImage}
          gallery={gallery}
          altFallback={productName}
          variantImage={previewVariant?.image ?? null}
          variantGallery={previewVariant?.gallery ?? undefined}
          variantKey={previewVariant?.id ?? null}
        />
      </div>

      <div className="bb-wp-pdp-info-col product-information min-w-0 max-md:order-2 max-md:w-full">
        <div className="mb-5 max-md:mb-3">
          <h1 className="m-0 font-body text-ui-30 font-semibold !leading-[1.25] tracking-normal normal-case max-md:uppercase text-black">
            {productName}
          </h1>
        </div>

        <div className="flex flex-wrap mx-[-15px] max-md:mx-0 max-md:flex-nowrap max-md:items-start max-md:gap-2">
          <div className="flex-[0_0_41.666667%] max-[1024px]:flex-[0_0_100%] max-w-[41.666667%] max-[1024px]:max-w-full px-[15px] max-md:px-0 max-md:flex-auto max-md:max-w-none">
            <PricingPanel
              data={effectivePricing}
              fallback={fallbackPrice}
              isLoading={snapshotLoading && !fallbackPrice}
            />
            <RatingRow rating={initialRating} count={initialRatingCount} />
          </div>
          <div className="flex justify-end max-[1024px]:justify-start max-md:justify-end flex-[0_0_58.333333%] max-[1024px]:flex-[0_0_100%] max-w-[58.333333%] max-[1024px]:max-w-full px-[15px] max-md:px-0 text-right max-[1024px]:text-left max-md:text-right max-[1024px]:mt-3 max-md:mt-0 max-md:flex-none max-md:pr-3">
            <p className="relative isolate flex items-center justify-center w-[190px] h-[42px] m-0 ml-auto max-[1024px]:ml-0 max-md:ml-auto border-none bg-transparent font-cta font-semibold uppercase text-white antialiased after:content-[''] after:absolute after:inset-0 after:-z-10 after:bg-black after:[transform:skewX(-20deg)] has-[.bb-pdp-stock-badge--out]:after:bg-brand">
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
              <p className="m-0 text-caption text-muted-foreground">{t("outOfStockNote")}</p>
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
            <p className="mt-2.5 text-caption text-brand" role="alert">
              {addError}
            </p>
          )}
        </div>

        <ShareRow productName={productName} canonicalUrl={canonicalUrl} instagramUrl={instagramUrl} />
      </div>
    </>
  );
}
