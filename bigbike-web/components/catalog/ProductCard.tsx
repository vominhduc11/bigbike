import Link from "next/link";
import Image from "next/image";
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

function mapStockState(state: Product["stockState"]) {
  switch (state) {
    case "IN_STOCK":     return { label: "Còn hàng",      className: "bb-stock-in" };
    case "LOW_STOCK":    return { label: "Sắp hết hàng",  className: "bb-stock-low" };
    case "OUT_OF_STOCK": return { label: "Hết hàng",      className: "bb-stock-out" };
    default:             return { label: "Đang cập nhật", className: "bb-stock-out" };
  }
}

export function ProductCard({ product, variant = "compact" }: ProductCardProps) {
  const name = safeText(product.name, "Sản phẩm đang cập nhật");
  const href = toProductPath(product.slug);
  const { current, compare, isSale, discountPercent } = computePricing(product);
  const { label: stockLabel, className: stockClass } = mapStockState(product.stockState);

  // --- featured variant (carousel sản phẩm nổi bật) ---
  if (variant === "featured") {
    const ratingValue = product.rating != null && product.rating > 0 ? product.rating : null;
    return (
      <article className="bb-fp-item">
        <div className="bb-fp-thumb">
          <Link href={href} aria-label={`Xem ${name}`} className="bb-fp-thumb-link">
            <MediaImage image={product.image} altFallback={name} width={480} height={480} />
          </Link>
          {discountPercent != null && discountPercent > 0 && (
            <div className="bb-fp-sale">
              <p>{discountPercent}%</p>
            </div>
          )}
          <div className="bb-fp-cart">
            <Link href={href}>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              XEM SẢN PHẨM
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
                <p className="bb-fp-price-current">Liên hệ</p>
              )}
            </div>
          </div>
          {ratingValue != null && (
            <div className="bb-fp-rating">
              <RatingStars value={ratingValue} />
            </div>
          )}
        </div>
      </article>
    );
  }

  // --- tile variant: homepage "Sản phẩm nổi bật" — nhãn danh mục + tên + nút "Mua ngay", ảnh bên phải ---
  // Bám bản thiết kế trang chủ + WP content-product-featured-item.php.
  if (variant === "tile") {
    const src = resolveMediaUrl(product.image?.url?.trim());
    const categoryName = product.category?.name ?? "";
    return (
      <div className="group relative flex min-h-[200px] flex-col justify-center overflow-hidden bg-muted p-6">
        {src && (
          <div className="pointer-events-none absolute bottom-0 right-0 h-[82%] w-[44%]">
            <Image
              src={src}
              alt={safeText(product.image?.alt, name)}
              fill
              className="object-contain object-[right_bottom] transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 600px) 44vw, 18vw"
            />
          </div>
        )}
        <div className="pointer-events-none max-w-[60%]">
          {categoryName && (
            <p className="m-0 mb-1.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {categoryName}
            </p>
          )}
          <h3 className="m-0 line-clamp-3 font-display text-lg font-semibold uppercase leading-tight text-foreground transition-colors group-hover:text-brand">
            {name}
          </h3>
          <span className="mt-3.5 inline-flex items-center gap-1.5 bg-brand px-4 py-2 font-display text-xs font-medium uppercase tracking-[0.1em] text-white transition-colors group-hover:bg-brand-hover">
            Xem sản phẩm
            <span aria-hidden="true" className="text-sm leading-none">›</span>
          </span>
        </div>
        <Link href={href} aria-label={`Xem ${name}`} className="absolute inset-0 z-[1]" />
      </div>
    );
  }

  // --- compact variant (trang listing / tìm kiếm / yêu thích, mặc định) ---
  const brandName = safeText(product.brand?.name, "BigBike");
  return (
    <article className="bb-product-card">
      <Link
        href={href}
        className="bb-product-card-link"
        aria-label={`Xem ${name}`}
        tabIndex={0}
      />
      <div className="bb-product-image">
        {isSale && (
          <span className="bb-product-tag">
            {discountPercent != null && discountPercent > 0 ? `-${discountPercent}%` : "Sale"}
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
            <b>Liên hệ</b>
          )}
        </div>
        <span className={`bb-stock-badge ${stockClass}`}>{stockLabel}</span>
      </div>
    </article>
  );
}
