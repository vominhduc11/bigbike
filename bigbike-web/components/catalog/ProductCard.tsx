"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Product } from "@/lib/contracts/public";
import { formatVnd, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { ProductCardAddBar } from "@/components/catalog/ProductCardAddBar";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { CompareButton } from "@/components/catalog/CompareButton";
import { RatingStars } from "@/components/ui/RatingStars";

type ProductCardProps = {
  product: Product;
  variant?: "compact" | "featured" | "tile" | "archive" | "related";
};

function computePricing(product: Product) {
  const retail = product.price?.retailPrice ?? 0;
  const sale =
    product.price?.salePrice && product.price.salePrice > 0
      ? product.price.salePrice
      : null;
  const compare =
    product.price?.compareAtPrice && product.price.compareAtPrice > 0
      ? product.price.compareAtPrice
      : null;
  const current = sale ?? retail;
  const isSale = Boolean((sale && sale < retail) || (compare && compare > current));
  const reference = compare ?? retail;
  const discountPercent =
    sale && reference > sale
      ? Math.round(((reference - sale) / reference) * 100)
      : compare && compare > current
        ? Math.round(((compare - current) / compare) * 100)
        : null;
  return { retail, sale, compare, current, isSale, discountPercent };
}

type StockLabels = {
  IN_STOCK: string;
  LOW_STOCK: string;
  OUT_OF_STOCK: string;
  UNKNOWN: string;
};

function mapStockState(state: Product["stockState"], labels: StockLabels) {
  switch (state) {
    case "IN_STOCK":     return { label: labels.IN_STOCK,     className: "bb-stock-in" };
    case "LOW_STOCK":    return { label: labels.LOW_STOCK,    className: "bb-stock-low" };
    case "OUT_OF_STOCK": return { label: labels.OUT_OF_STOCK, className: "bb-stock-out" };
    default:             return { label: labels.UNKNOWN,      className: "bb-stock-out" };
  }
}

function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("/wp-content/") ? `https://bigbike.vn${src}` : src;
}

export function ProductCard({ product, variant = "compact" }: ProductCardProps) {
  const tProduct = useTranslations("Product");
  const tCommon = useTranslations("Common");
  const stockLabels: StockLabels = {
    IN_STOCK: tProduct("stockState.IN_STOCK"),
    LOW_STOCK: tProduct("stockState.LOW_STOCK"),
    OUT_OF_STOCK: tProduct("stockState.OUT_OF_STOCK"),
    UNKNOWN: tProduct("stockState.UNKNOWN"),
  };
  const name = safeText(product.name, tProduct("nameFallback"));
  const href = toProductPath(product.slug);
  const { retail, sale, current, compare, isSale, discountPercent } = computePricing(product);
  const { label: stockLabel, className: stockClass } = mapStockState(product.stockState, stockLabels);

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
              <i className="fal fa-shopping-cart" aria-hidden="true" />
              THÊM VÀO GIỎ HÀNG
            </Link>
          </div>
        </div>
        <div className="bb-fp-desc">
          <div className="bb-fp-inside">
            <p className="bb-fp-title">
              <Link href={href}>{name}</Link>
            </p>
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

  // Related variant: PDP related products, matching WP product--item classes.
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
      <article className="product--item">
        <div className="product--item-thumbnail">
          <Link href={href} aria-label={tProduct("viewProductAria", { name })}>
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
            <div className="product--item-sale">
              <p>{discountPercent}%</p>
            </div>
          )}
          <div className="product--item-cart">
            <Link href={href}>
              <i className="fal fa-shopping-cart" aria-hidden="true" />
              THÊM VÀO GIỎ HÀNG
            </Link>
          </div>
        </div>
        <div className="product--item-desc">
          <div className="product--item-inside row">
            <div className="col-md-12">
              <p className="product--item-title">
                <Link href={href}>{name}</Link>
              </p>
            </div>
            <div className="col-md-12">
              <div className="product--item-price">
                {product.price && current > 0 ? (
                  <>
                    <p>{formatVnd(current)}</p>
                    {featuredCompare && featuredCompare > current ? (
                      <p className="old">{formatVnd(featuredCompare)}</p>
                    ) : null}
                  </>
                ) : (
                  <p>{tProduct("contactForPrice")}</p>
                )}
              </div>
            </div>
          </div>
          <div className="rating">
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
      <article className="group relative min-h-[374px] overflow-hidden border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-brand hover:shadow-[var(--bb-shadow-product)]">
        <Link
          href={href}
          aria-label={tProduct("viewProductAria", { name })}
          className="absolute inset-0 z-[2]"
        />
        <div className="relative z-[1] flex h-full flex-col px-10 pt-10 pb-8 pr-[40%] max-[900px]:px-8 max-[900px]:pt-8 max-[900px]:pr-[38%] max-[600px]:min-h-[320px] max-[600px]:px-6 max-[600px]:pt-6 max-[600px]:pr-[36%]">
          <h3 className="font-heading text-[18px] font-semibold uppercase leading-[1.08] text-foreground">
            {name}
          </h3>
          <span className="mt-14 inline-flex w-fit font-heading text-[17px] font-semibold uppercase leading-none text-brand max-[600px]:mt-10">
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
      <article className="product--item bb-archive-product">
        <div className="product--item-thumbnail bb-archive-product-thumb">
          <Link href={href} aria-label={tProduct("viewProductAria", { name })}>
            <Image
              src={imageSrc}
              alt={safeText(product.image?.alt, name)}
              width={product.image?.width ?? 480}
              height={product.image?.height ?? 480}
              className="bb-archive-product-img"
            />
          </Link>

          {discountPercent != null && discountPercent > 0 && (
            <div className="product--item-sale bb-archive-product-sale">
              <p>{discountPercent}%</p>
            </div>
          )}

          <div className="product--item-cart bb-archive-product-cart">
            <Link href={href}>{archiveCta}</Link>
          </div>
        </div>

        <div className="product--item-desc bb-archive-product-desc">
          <div className="product--item-inside row bb-archive-product-inside">
            <div className="col-md-12 bb-archive-product-info">
              <p className="product--item-title bb-archive-product-title">
                <Link href={href}>{name}</Link>
              </p>

              {product.price && current > 0 ? (
                <div className="product--item-price bb-archive-product-price">
                  <p>{formatVnd(current)}</p>
                  {archiveCompare && archiveCompare > current ? (
                    <p className="old">{formatVnd(archiveCompare)}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="rating bb-archive-rating">
                <RatingStars value={ratingValue} />
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }
  const brandName = safeText(product.brand?.name, "BigBike");
  return (
    <article className="bb-product-card">
      <Link
        href={href}
        className="bb-product-card-link"
        aria-label={tProduct("viewProductAria", { name })}
        tabIndex={0}
      />
      <div className="bb-product-image">
        {isSale && (
          <span className="bb-product-tag">
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
        <MediaImage image={product.image} altFallback={name} width={480} height={480} />
        <ProductCardAddBar
          productId={product.id}
          hasVariants={!!product.variants?.length}
          slug={product.slug}
          stockState={product.stockState}
        />
      </div>
      <div className="bb-product-body">
        <p className="bb-product-brand">{brandName}</p>
        <h3 className="bb-product-name">{name}</h3>
        {product.rating != null && product.rating > 0 && (
          <div className="bb-product-rating">
            <RatingStars value={product.rating} />
          </div>
        )}
        <div className="bb-product-price">
          {product.price ? (
            <>
              <b>{formatVnd(current)}</b>
              {compare && compare > current ? <s>{formatVnd(compare)}</s> : null}
            </>
          ) : (
            <b>{tProduct("contactForPrice")}</b>
          )}
        </div>
        <span className={`bb-stock-badge ${stockClass}`}>{stockLabel}</span>
      </div>
    </article>
  );
}


