"use client";

import { useTranslations } from "next-intl";

import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/MediaImage";
import { RatingDisplay } from "@/components/ui/RatingDisplay";
import type { Product } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import {
  formatVndNumber,
  resolveMediaUrl,
  safeText,
  toLegacyWpMediaUrl,
} from "@/lib/utils/format";

type ProductCardProps = {
  product: Product;
  className?: string;
  layout?: "grid" | "carousel";
  /** Exact responsive slot occupied by the image in the caller's grid. */
  imageSizes?: string;
};

const CATALOG_GRID_IMAGE_SIZES =
  "(min-width: 1200px) 195px, (min-width: 768px) 18vw, calc((100vw - 52px) / 2)";
const CAROUSEL_IMAGE_SIZES =
  "(min-width: 1280px) 278px, (min-width: 768px) calc((100vw - 138px) / 4), calc((100vw - 52px) / 2)";

export function ProductCard({ product, className, layout = "grid", imageSizes }: ProductCardProps) {
  const t = useTranslations("Product");
  const { current, retail, isSale, discountPercent } = derivePricing(product.price);
  const imageUrl = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));
  const responsiveImage = imageUrl && product.image
    ? { ...product.image, url: imageUrl }
    : null;
  const name = safeText(product.name, "");
  const resolvedImageSizes = imageSizes ?? (layout === "carousel" ? CAROUSEL_IMAGE_SIZES : CATALOG_GRID_IMAGE_SIZES);

  return (
    <article
      data-product-card
      className={cn("group mt-8 flex h-full min-w-0 flex-col", className)}
    >
      <div
        className="relative mb-5 aspect-square overflow-hidden bg-background"
      >
        <LocalizedLink
          kind="product"
          viSlug={product.slug}
          enSlug={product.slugEn}
          className="flex h-full w-full items-center justify-center overflow-hidden"
        >
          {responsiveImage ? (
            <MediaImage
              image={responsiveImage}
              altFallback={name}
              width={600}
              height={600}
              sizes={resolvedImageSizes}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105"
            />
          ) : (
            <MediaImage
              image={{ url: "/brand/header-mark.png", width: 120, height: 44 }}
              altFallback={name}
              sizes="120px"
              className="h-auto w-[55%] max-w-40 object-contain opacity-70"
            />
          )}
        </LocalizedLink>

        {isSale && discountPercent ? (
          <div
            data-product-sale
            className="absolute left-0 top-5 flex h-8 w-20 items-center justify-center bg-[url('/brand/product-sale-ticket.svg')] bg-left-top bg-no-repeat"
          >
            <span className="-rotate-[20deg] font-cta text-b3-promo font-semibold uppercase leading-7 text-white">
              {discountPercent}%
            </span>
          </div>
        ) : null}

        <Button
          asChild
          variant="dark"
          data-product-card-action
          className="absolute inset-x-0 bottom-0 h-[47px] translate-y-full rounded-none !border-black !bg-black px-4 font-cta text-b4-action !text-white transition-transform duration-300 hover:!border-black hover:!bg-black hover:!text-white hover:not-disabled:scale-100 focus-visible:!text-white group-hover:translate-y-0 group-focus-within:translate-y-0"
        >
          <LocalizedLink kind="product" viSlug={product.slug} enSlug={product.slugEn}>
            {t("cardSelect").toUpperCase()}
          </LocalizedLink>
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <h3
          className={cn(
            "m-0 font-body text-product-card font-semibold",
            layout === "grid"
              ? "line-clamp-2 min-h-10 leading-tight"
              : "h-6 min-h-6 truncate leading-normal",
          )}
        >
          <LocalizedLink
            kind="product"
            viSlug={product.slug}
            enSlug={product.slugEn}
            className="text-foreground! no-underline! hover:text-brand!"
          >
            {name}
          </LocalizedLink>
        </h3>

        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-body text-a5-meta font-semibold leading-normal text-brand">
          <span>{formatVndNumber(current)} {"\u20ab"}</span>
          {isSale ? (
            <span data-product-old-price className="text-border-default line-through">
              {formatVndNumber(retail)} {"\u20ab"}
            </span>
          ) : null}
        </div>

        {(product.ratingCount ?? 0) > 0 ? (
          <div className="font-body text-a5-meta text-muted-foreground">
            <RatingDisplay rating={product.rating} ratingCount={product.ratingCount} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
