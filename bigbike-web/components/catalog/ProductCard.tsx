"use client";

import { useTranslations } from "next-intl";

import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/ui/RatingStars";
import type { Product } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { hasApprovedReviews } from "@/lib/rating";
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
};

export function ProductCard({ product, className, layout = "grid" }: ProductCardProps) {
  const t = useTranslations("Product");
  const { current, retail, isSale, discountPercent } = derivePricing(product.price);
  const imageUrl = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));
  const name = safeText(product.name, "");
  const hasReviews = hasApprovedReviews(product.rating, product.ratingCount);

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
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              loading="lazy"
              width={600}
              height={600}
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/brand/header-mark.png"
              alt={name}
              width={160}
              height={48}
              className="h-auto w-[55%] max-w-40 object-contain opacity-70"
            />
          )}
        </LocalizedLink>

        {isSale && discountPercent ? (
          <div
            data-product-sale
            className="absolute left-0 top-5 flex h-8 w-20 items-center justify-center bg-[url('/brand/product-sale-ticket.svg')] bg-left-top bg-no-repeat"
          >
            <span className="-rotate-[20deg] font-cta text-b3-promo font-semibold leading-7 text-white">
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

      <div className="flex flex-1 flex-col">
        <h3
          className={cn(
            "m-0 font-body text-a4-content font-semibold uppercase",
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

        <div className="mt-3.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-body text-a5-meta font-semibold leading-normal text-brand">
          <span>{formatVndNumber(current)} {"\u20ab"}</span>
          {isSale ? (
            <span data-product-old-price className="text-border-default line-through">
              {formatVndNumber(retail)} {"\u20ab"}
            </span>
          ) : null}
        </div>

        {hasReviews ? (
          <div className="mt-2 text-a4-content">
            <RatingStars value={product.rating} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
