"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
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
  variant?: "compact" | "featured" | "tile" | "archive";
  /**
   * Featured variant only — selects between the two render contexts that the
   * legacy `.bb-home-products-parity .bb-fp-*` cascade produced:
   * `home` (homepage carousel) vs `article` (ArticleProducts grid, the base look).
   */
  surface?: "home" | "article";
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
      return "border border-border bg-border text-muted-foreground";
  }
}

export function ProductCard({ product, variant = "compact", surface = "article" }: ProductCardProps) {
  const tProduct = useTranslations("Product");
  const tCommon = useTranslations("Common");
  const name = safeText(product.name, tProduct("nameFallback"));
  const href = toProductPath(product.slug);
  const { retail, sale, current, compare, isSale, discountPercent } = derivePricing(product.price);
  const stockLabel = stockStateLabelWithT(product.stockState, tProduct);
  const stockClass = stockBadgeClassName(product.stockState);

  // Featured variant: two render contexts (matching the legacy bb-fp-* cascade).
  //  - `home`    → homepage carousel inside `.bb-home-products-parity` (tilted sale
  //                badge, left/red inline price, image-zoom on hover, square image
  //                frame at md+, responsive carousel flex-basis /4 → /5 → /6).
  //  - `article` → ArticleProducts grid (base bb-fp-* look: bordered card via
  //                cardChrome, pennant ribbon badge, no image zoom).
  if (variant === "featured") {
    const isHome = surface === "home";
    const featuredCompare =
      compare && compare > current
        ? compare
        : sale && retail > current
          ? retail
          : null;
    const ratingValue = product.rating != null && product.rating > 0 ? product.rating : 4.5;
    const featuredImageSrc = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));

    // Home classes are mobile-first. Flex-basis follows the WP paged tiers so each
    // page fills the track exactly: 1-up <380px, 2-up 380–767px (gap 20 → /2),
    // 4-up ≥768px (gap 30 → /4), then Next-only 5-up ≥1536 / 6-up ≥2560.
    const itemClass = isHome
      ? "group relative mt-0 flex h-full min-w-0 flex-col bg-transparent text-black flex-[0_0_100%] min-[380px]:flex-[0_0_calc((100%_-_20px)_/_2)] md:mt-[30px] md:flex-[0_0_calc((100%_-_90px)_/_4)] 2xl:flex-[0_0_calc((100%_-_120px)_/_5)] min-[2560px]:flex-[0_0_calc((100%_-_150px)_/_6)]"
      : cn("group relative flex h-full flex-col p-5", cardChrome);
    const thumbClass = isHome
      ? "relative m-0 aspect-square overflow-hidden bg-white md:mb-5"
      : "relative mb-4 aspect-square overflow-hidden bg-white";
    const thumbLinkClass = isHome ? "relative block aspect-square md:aspect-auto md:h-full" : "relative block";
    const imgClass = isHome
      ? "block h-full w-full object-contain p-2 transition-transform duration-300 ease-in-out group-hover:scale-105 md:absolute md:inset-0 md:p-0"
      : "h-full w-full object-contain transition-transform duration-300";
    // `text-white` lives on the container (not just the link) because the homepage
    // `.bb-home a { color: inherit }` rule (0,1,1) outranks the link's own `text-white`
    // (0,1,0); the link then inherits white from this container.
    // Home: hover-only slide (WP parity — hidden by default, reveal on hover desktop).
    // Article: hover-slide, plus always-visible on touch (hover:none/coarse).
    const cartClass = cn(
      "absolute bottom-0 left-0 z-[2] w-full bg-black text-center text-white transition-transform duration-300",
      isHome
        ? "translate-y-full group-hover:translate-y-0"
        : "translate-y-full group-hover:translate-y-0 [@media(hover:none)]:translate-y-0 [@media(pointer:coarse)]:translate-y-0",
    );
    const cartLinkClass = isHome
      ? "flex items-center justify-center gap-2.5 py-[15px] font-body text-13 font-semibold uppercase leading-normal text-white"
      : "flex items-center justify-center gap-2.5 py-[15px] font-cta text-base font-semibold uppercase leading-6 text-white";
    const descClass = isHome ? "flex flex-col px-3 pt-2.5 pb-3 md:p-0" : "flex flex-col";
    const insideClass = isHome ? "mt-2.5" : undefined;
    const titleClass = isHome
      ? "m-0 min-h-[34px] font-body text-product-title font-semibold leading-title text-black md:mb-4 md:min-h-12 md:leading-normal"
      : "m-0 font-body text-product-title font-semibold uppercase leading-5 text-foreground";
    // Home (carousel): show the full product name like WP (no line clamp). The
    // article grid keeps the 2-line clamp so its fixed-height cards stay aligned.
    const titleLinkClass = cn(
      "text-foreground no-underline hover:text-brand",
      !isHome && "max-[767px]:line-clamp-2",
    );
    const priceClass = isHome
      ? "mt-1 block text-left font-body text-sm font-semibold text-brand md:mt-0"
      : "mt-2 flex flex-col items-start text-left font-body font-semibold text-foreground";
    const priceCurrentClass = isHome
      ? "mr-5 inline-block text-sm leading-[1.214rem] text-brand"
      : "m-0 font-body text-sm font-semibold leading-6 text-brand";
    const priceOldClass = isHome
      ? "mr-5 inline-block text-sm leading-[1.214rem] text-muted-foreground line-through"
      : "m-0 text-sm leading-[1.214rem] text-muted-foreground line-through";

    return (
      <article className={itemClass}>
        <div className={thumbClass}>
          <Link href={href} className={thumbLinkClass} aria-label={tProduct("viewProductAria", { name })}>
            {featuredImageSrc ? (
              <img src={featuredImageSrc} alt={safeText(product.image?.alt, name)} className={imgClass} loading="lazy" />
            ) : (
              <MediaImage image={product.image} altFallback={name} width={480} height={480} className={imgClass} />
            )}
          </Link>
          {discountPercent != null && discountPercent > 0 && (
            <SaleBadge percent={discountPercent} variant={isHome ? "tilted" : "ribbon"} />
          )}
          <div className={cartClass}>
            <Link href={href} className={cartLinkClass}>
              XEM CHI TIẾT
            </Link>
          </div>
        </div>
        <div className={descClass}>
          <div className={insideClass}>
            <h3 className={titleClass}>
              <Link href={href} className={titleLinkClass}>
                {name}
              </Link>
            </h3>
            <div className={priceClass}>
              {product.price && current > 0 ? (
                <>
                  <span className={priceCurrentClass}>{formatVnd(current)}</span>
                  {featuredCompare && featuredCompare > current ? (
                    <span className={priceOldClass}>{formatVnd(featuredCompare)}</span>
                  ) : null}
                </>
              ) : (
                <span className={priceCurrentClass}>{tProduct("contactForPrice")}</span>
              )}
            </div>
          </div>
          <div className="mt-2">
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
          <h3 className="flex-1 font-body text-h4 font-semibold uppercase leading-display text-foreground">
            {name}
          </h3>
          <span className="mt-6 inline-flex w-fit font-body text-17 font-semibold uppercase leading-none text-brand max-[600px]:mt-4">
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
      <article className="group mt-[30px] text-foreground max-[767px]:m-0 max-[767px]:h-full">
        <div className="relative mb-5 aspect-square overflow-hidden bg-white max-[767px]:m-0">
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
              className="block py-[15px] font-cta text-13 font-semibold uppercase text-white max-[767px]:flex max-[767px]:min-h-10 max-[767px]:items-center max-[767px]:justify-center max-[767px]:px-2"
            >
              {archiveCta}
            </Link>
          </div>
        </div>

        <div>
          <div className="mx-[-5px] mt-2.5 max-[767px]:m-0">
            <div className="px-[5px] max-[767px]:px-2.5 max-[767px]:pb-3">
              <h3 className="mb-2.5 font-body text-product-title font-semibold leading-[1.25] text-foreground max-[767px]:mb-2 max-[767px]:line-clamp-2 max-[767px]:min-h-9 max-[767px]:uppercase">
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

              <div className="mt-2 text-ui-18">
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
        <p className="font-cta text-sm uppercase tracking-normal text-brand">{brandName}</p>
        <h3 className="font-body text-h4 font-semibold leading-5 text-foreground max-[767px]:line-clamp-2">
          {name}
        </h3>
        {product.rating != null && product.rating > 0 && (
          <div className="text-sm tracking-normal">
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


