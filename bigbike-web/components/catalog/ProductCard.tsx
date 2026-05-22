"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
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
  variant?: "compact" | "featured" | "tile";
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
  const { current, compare, isSale, discountPercent } = computePricing(product);
  const { label: stockLabel, className: stockClass } = mapStockState(product.stockState, stockLabels);

  // --- featured variant (carousel sản phẩm nổi bật) ---
  if (variant === "featured") {
    const ratingValue = product.rating != null && product.rating > 0 ? product.rating : 4.5;
    return (
      <article className="bb-fp-item">
        <div className="bb-fp-thumb">
          <Link href={href} aria-label={tProduct("viewProductAria", { name })} className="bb-fp-thumb-link">
            <MediaImage image={product.image} altFallback={name} width={480} height={480} />
          </Link>
          {discountPercent != null && discountPercent > 0 && (
            <div className="bb-fp-sale">
              <p>{discountPercent}%</p>
            </div>
          )}
          <div className="bb-fp-cart">
            <Link href={href}>
              <ShoppingCart size={16} strokeWidth={2} aria-hidden="true" />
              {tProduct("cardAddBar.addToCart")}
            </Link>
          </div>
        </div>
        <div className="bb-fp-desc">
          <div className="bb-fp-inside">
            <p className="bb-fp-title">
              <Link href={href}>{name}</Link>
            </p>
            <div className="bb-fp-price">
              {product.price ? (
                <>
                  <p className="bb-fp-price-current">{formatVnd(current)}</p>
                  {compare && compare > current && (
                    <p className="bb-fp-price-old">{formatVnd(compare)}</p>
                  )}
                </>
              ) : (
                <p className="bb-fp-price-current">{tProduct("contactForPrice")}</p>
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

  // --- tile variant: homepage "Sản phẩm nổi bật" — nhãn danh mục + tên + nút "Mua ngay", ảnh bên phải ---
  // Bám bản thiết kế trang chủ + WP content-product-featured-item.php.
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

  // --- compact variant (trang listing / tìm kiếm / yêu thích, mặc định) ---
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
