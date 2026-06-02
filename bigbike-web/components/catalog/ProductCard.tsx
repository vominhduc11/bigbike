"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/contracts/public";
import {
  formatVnd,
  resolveMediaUrl,
  safeText,
  stockStateLabelWithT,
  toLegacyWpMediaUrl,
} from "@/lib/utils/format";
import { derivePricing } from "@/lib/pricing";
import { toProductPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { ProductCardAddBar } from "@/components/catalog/ProductCardAddBar";
import { SaleBadge } from "@/components/catalog/SaleBadge";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { CompareButton } from "@/components/catalog/CompareButton";
import { RatingStars } from "@/components/ui/RatingStars";
import { cardChrome } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  product: Product;
  variant?: "compact" | "featured" | "tile" | "archive" | "related";
};

/** Stock badge shell shared by all three states (was `.bb-stock-badge`). */
const STOCK_BADGE_BASE = "rounded-none font-body text-sm font-bold leading-3";

/**
 * Per-state stock badge colors. The success/warning surfaces use rgba/hex values
 * that have no Tailwind color utility, so they reference the brand vars directly.
 */
function stockBadgeClassName(state: Product["stockState"]): string {
  switch (state) {
    case "IN_STOCK":
      return "border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] text-state-success-text";
    case "LOW_STOCK":
      return "border border-[var(--bb-state-warning)] bg-[var(--bb-state-warning)] text-black";
    case "OUT_OF_STOCK":
    default:
      return "border border-border bg-border text-[#4a4a4a]";
  }
}

export function ProductCard({ product, variant = "compact" }: ProductCardProps) {
  const tProduct = useTranslations("Product");
  const tCommon = useTranslations("Common");
  const name = safeText(product.name, tProduct("nameFallback"));
  const href = toProductPath(product.slug);
  const { retail, sale, current, compare, isSale, discountPercent } = derivePricing(product.price);
  const stockLabel = stockStateLabelWithT(product.stockState, tProduct);
  const stockClass = stockBadgeClassName(product.stockState);

  // Featured variant: homepage carousel, matching WP #main-product-slide classes.
  if (variant === "featured") {
    const featuredCompare =
      compare && compare > current
        ? compare
        : sale && retail > current
          ? retail
          : null;
    const ratingValue = product.rating != null && product.rating > 0 ? product.rating : 4.5;
    const featuredImageSrc = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));

    return (
      <article className="bb-fp-item">
        <div className="bb-fp-thumb">
          <Link href={href} className="bb-fp-thumb-link" aria-label={tProduct("viewProductAria", { name })}>
            {featuredImageSrc ? (
              <img
                src={featuredImageSrc}
                alt={safeText(product.image?.alt, name)}
                className="swiper-lazy -lazy"
                loading="lazy"
              />
            ) : (
              <MediaImage
                image={product.image}
                altFallback={name}
                width={480}
                height={480}
                className="swiper-lazy -lazy"
              />
            )}
          </Link>
          {discountPercent != null && discountPercent > 0 && (
            <div className="bb-fp-sale">
              <p>{discountPercent}%</p>
            </div>
          )}
          <div className="bb-fp-cart">
            <Link href={href}>
              XEM CHI TIẾT
            </Link>
          </div>
        </div>
        <div className="bb-fp-desc">
          <div className="bb-fp-inside">
            <h3 className="bb-fp-title">
              <Link href={href}>{name}</Link>
            </h3>
            <div className="bb-fp-price">
              {product.price && current > 0 ? (
                <>
                  <span className="bb-fp-price-current">{formatVnd(current)}</span>
                  {featuredCompare && featuredCompare > current ? (
                    <span className="bb-fp-price-old">{formatVnd(featuredCompare)}</span>
                  ) : null}
                </>
              ) : (
                <span className="bb-fp-price-current">{tProduct("contactForPrice")}</span>
              )}
            </div>
          </div>
          <div className="bb-fp-rating">
            <RatingStars value={ratingValue} />
          </div>
        </div>
      </article>
    );
  }

  // Related variant: PDP related products carousel (Tailwind inline).
  if (variant === "related") {
    const featuredCompare =
      compare && compare > current
        ? compare
        : sale && retail > current
          ? retail
          : null;
    const ratingValue = product.rating != null && product.rating > 0 ? product.rating : 4.5;
    const featuredImageSrc = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));

    return (
      <article className="group mt-[30px]">
        <div className="relative mb-5 min-h-[200px] overflow-hidden">
          <Link
            href={href}
            aria-label={tProduct("viewProductAria", { name })}
            className="relative block min-h-[200px]"
          >
            {featuredImageSrc ? (
              <img
                src={featuredImageSrc}
                alt={safeText(product.image?.alt, name)}
                className="swiper-lazy -lazy mx-auto block h-auto w-auto max-w-full transition-transform duration-300 ease-in-out group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <MediaImage
                image={product.image}
                altFallback={name}
                width={480}
                height={480}
                className="swiper-lazy -lazy mx-auto block h-auto w-auto max-w-full transition-transform duration-300 ease-in-out group-hover:scale-105"
              />
            )}
          </Link>
          {discountPercent != null && discountPercent > 0 && (
            <SaleBadge percent={discountPercent} />
          )}
          <div className="absolute bottom-0 left-0 w-full translate-y-full bg-surface-dark text-center transition-transform duration-300 group-hover:translate-y-0">
            <Link
              href={href}
              className="flex items-center justify-center gap-2.5 py-[15px] font-heading text-13 uppercase text-white"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              THÊM VÀO GIỎ HÀNG
            </Link>
          </div>
        </div>
        <div>
          <h3 className="mb-4 mt-2.5 font-heading text-sm font-semibold leading-title">
            <Link href={href} className="text-foreground">
              {name}
            </Link>
          </h3>
          <div className="font-cta text-sm font-semibold text-brand">
            {product.price && current > 0 ? (
              <>
                <span className="mr-5 inline-block leading-title">{formatVnd(current)}</span>
                {featuredCompare && featuredCompare > current ? (
                  <span className="mr-5 inline-block leading-title text-muted-foreground line-through">
                    {formatVnd(featuredCompare)}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="inline-block">{tProduct("contactForPrice")}</span>
            )}
          </div>
          <div className="mt-2 text-sm">
            <RatingStars value={ratingValue} />
          </div>
        </div>
      </article>
    );
  }

  // Tile variant: homepage featured product block.
  // Matches the homepage design and WP content-product-featured-item.php.
  if (variant === "tile") {
    const src = resolveMediaUrl(product.image?.url?.trim());
    return (
      <article className={`group relative min-h-[374px] overflow-hidden ${cardChrome}`}>
        <Link
          href={href}
          aria-label={tProduct("viewProductAria", { name })}
          className="absolute inset-0 z-[2]"
        />
        <div className="relative z-[1] flex h-full flex-col px-10 pt-10 pb-8 pr-[40%] max-[900px]:px-8 max-[900px]:pt-8 max-[900px]:pr-[38%] max-[600px]:min-h-[320px] max-[600px]:px-6 max-[600px]:pt-6 max-[600px]:pr-[36%]">
          <h3 className="font-heading text-h4 font-semibold uppercase leading-display text-foreground">
            {name}
          </h3>
          <span className="mt-14 inline-flex w-fit font-heading text-17 font-semibold uppercase leading-none text-brand max-[600px]:mt-10">
            {tProduct("buyNow").toUpperCase()}
          </span>
        </div>
        {src && (
          <div className="pointer-events-none absolute bottom-3 right-5 h-[58%] w-[46%] max-[900px]:bottom-2 max-[900px]:right-4 max-[900px]:h-[56%] max-[900px]:w-[44%] max-[600px]:right-3 max-[600px]:h-[54%] max-[600px]:w-[42%]">
            <Image
              src={src}
              alt={safeText(product.image?.alt, name)}
              fill
              className="object-contain object-right-bottom"
              sizes="(max-width: 600px) 42vw, (max-width: 900px) 30vw, 18vw"
            />
          </div>
        )}
      </article>
    );
  }

  if (variant === "archive") {
    const imageSrc = resolveMediaUrl(product.image?.url?.trim()) || "/wp/logo-1.png";
    const archiveCompare =
      compare && compare > current
        ? compare
        : sale && retail > current
          ? retail
          : null;
    const ratingValue = product.rating != null && product.rating > 0 ? product.rating : 5;
    const archiveCta =
      product.stockState === "OUT_OF_STOCK"
        ? "Hết hàng"
        : product.variants?.length
          ? "Chọn"
          : "Thêm vào giỏ hàng";

    return (
      <article className="group mt-[30px] text-foreground max-[767px]:m-0 max-[767px]:h-full max-[767px]:border max-[767px]:border-border max-[767px]:bg-card">
        <div className="relative mb-5 aspect-square overflow-hidden bg-white max-[767px]:m-0 max-[767px]:border-b max-[767px]:border-border">
          <Link
            href={href}
            aria-label={tProduct("viewProductAria", { name })}
            className="relative flex h-full items-center justify-center text-center max-[767px]:p-2.5"
          >
            <Image
              src={imageSrc}
              alt={safeText(product.image?.alt, name)}
              width={product.image?.width ?? 480}
              height={product.image?.height ?? 480}
              className="!h-auto max-h-full !w-auto max-w-full object-contain transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
          </Link>

          {discountPercent != null && discountPercent > 0 && (
            <SaleBadge percent={discountPercent} variant="ticket" />
          )}

          <div className="absolute -bottom-[51px] left-0 w-full bg-black text-center transition-all duration-300 group-hover:bottom-0 max-[767px]:bottom-0">
            <Link
              href={href}
              className="block py-[15px] font-cta text-13 font-semibold uppercase text-white max-[767px]:flex max-[767px]:min-h-10 max-[767px]:items-center max-[767px]:justify-center max-[767px]:px-2 max-[767px]:text-11"
            >
              {archiveCta}
            </Link>
          </div>
        </div>

        <div>
          <div className="mx-[-5px] mt-2.5 max-[767px]:m-0">
            <div className="px-[5px] max-[767px]:px-2.5 max-[767px]:pb-3">
              <h3 className="mb-2.5 font-display text-h4 font-semibold leading-[1.25] text-foreground max-[767px]:mb-2 max-[767px]:line-clamp-2 max-[767px]:min-h-9 max-[767px]:font-cta max-[767px]:text-sm max-[767px]:uppercase">
                <Link href={href} className="text-foreground hover:text-brand">
                  {name}
                </Link>
              </h3>

              {product.price && current > 0 ? (
                <div className="text-left font-cta text-sm font-semibold text-brand">
                  <p className="mr-5 inline-block text-sm leading-[1.214rem] text-brand max-[767px]:leading-[1.2]">
                    {formatVnd(current)}
                  </p>
                  {archiveCompare && archiveCompare > current ? (
                    <p className="mr-5 inline-block text-sm leading-[1.214rem] text-muted-foreground line-through max-[767px]:leading-[1.2]">
                      {formatVnd(archiveCompare)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-2 text-[18px] max-[767px]:text-sm">
                <RatingStars value={ratingValue} />
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }
  const brandName = safeText(product.brand?.name, "BigBike");
  const priceCurrentClass = "font-cta text-base font-semibold leading-6 text-brand";
  return (
    <article
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden text-foreground",
        cardChrome,
      )}
    >
      <Link
        href={href}
        className="absolute inset-0 z-[1] focus-visible:[outline:2px_solid_var(--bb-brand-primary)] focus-visible:[outline-offset:-2px]"
        aria-label={tProduct("viewProductAria", { name })}
        tabIndex={0}
      />
      <div className="aspect-square bg-white">
        {isSale && (
          <span className="bg-brand font-cta font-semibold text-white">
            {discountPercent != null && discountPercent > 0 ? `-${discountPercent}%` : tCommon("sale")}
          </span>
        )}
        <WishlistButton productId={product.id} />
        <CompareButton
          product={{
            id: product.id,
            slug: product.slug,
            name,
            imageUrl: product.image?.url ?? null,
            price: current,
            categoryId: product.category.id,
            categoryName: product.category.name,
          }}
          variant="icon"
        />
        <MediaImage
          image={product.image}
          altFallback={name}
          width={480}
          height={480}
          className="h-full w-full object-contain"
        />
        <ProductCardAddBar
          productId={product.id}
          hasVariants={!!product.variants?.length}
          slug={product.slug}
          stockState={product.stockState}
        />
      </div>
      <div className="relative z-[2] flex flex-col gap-1 p-4">
        <p className="font-cta text-sm uppercase tracking-[0.12em] text-brand">{brandName}</p>
        <h3 className="font-display text-h4 font-semibold leading-5 text-foreground max-[767px]:line-clamp-2">
          {name}
        </h3>
        {product.rating != null && product.rating > 0 && (
          <div className="text-sm tracking-[0.1em]">
            <RatingStars value={product.rating} />
          </div>
        )}
        <div className="mt-1.5 flex items-baseline gap-2">
          {product.price ? (
            <>
              <b className={priceCurrentClass}>{formatVnd(current)}</b>
              {compare && compare > current ? (
                <s className="text-muted-foreground line-through">{formatVnd(compare)}</s>
              ) : null}
            </>
          ) : (
            <b className={priceCurrentClass}>{tProduct("contactForPrice")}</b>
          )}
        </div>
        <span className={cn(STOCK_BADGE_BASE, stockClass)}>{stockLabel}</span>
      </div>
    </article>
  );
}


