import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/contracts/public";
import { formatVnd, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { ProductCardAddBar } from "@/components/catalog/ProductCardAddBar";
import { WishlistButton } from "@/components/catalog/WishlistButton";
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
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
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

  // --- tile variant (grid sản phẩm trang chủ, text trái / ảnh phải) ---
  if (variant === "tile") {
    const src = resolveMediaUrl(product.image?.url?.trim());
    const brandName = product.brand?.name ?? "";
    const categoryName = product.category?.name ?? "";
    return (
      <Link href={href} className="bb-tile-3">
        <div className="relative z-[1]">
          {brandName && <p className="bb-tile-3-brand">{brandName}</p>}
          {categoryName && <p className="bb-tile-3-cat">{categoryName}</p>}
          <h3 className="bb-tile-3-name">{name}</h3>
          {product.rating != null && product.rating > 0 && (
            <div className="bb-tile-3-rating">
              <RatingStars value={product.rating} />
              {product.ratingCount != null && product.ratingCount > 0 && (
                <span className="bb-tile-3-rating-count">({product.ratingCount})</span>
              )}
            </div>
          )}
          <div className="bb-tile-3-price">
            {product.price ? (
              <>
                <b className="bb-tile-3-price-current">{formatVnd(current)}</b>
                {isSale && compare && compare > current && (
                  <s className="bb-tile-3-price-compare">{formatVnd(compare)}</s>
                )}
              </>
            ) : (
              <b className="bb-tile-3-price-current">Liên hệ</b>
            )}
          </div>
          <span className={`bb-tile-3-stock ${stockClass}`}>{stockLabel}</span>
          <span className="bb-tile-3-cta">Xem sản phẩm</span>
        </div>
        {src && (
          <div className="bb-tile-3-img-wrap">
            <Image
              src={src}
              alt={safeText(product.image?.alt, name)}
              fill
              className="bb-tile-3-img"
              sizes="(max-width: 600px) 100vw, 33vw"
            />
          </div>
        )}
      </Link>
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
        {isSale && <span className="bb-product-tag">Sale</span>}
        <WishlistButton productId={product.id} />
        <MediaImage image={product.image} altFallback={name} width={480} height={480} />
        <ProductCardAddBar
          productId={product.id}
          hasVariants={!!product.variants?.length}
          slug={product.slug}
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
