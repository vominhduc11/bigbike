import Link from "next/link";
import type { Product } from "@/lib/contracts/public";
import { formatVnd, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { RatingStars } from "@/components/ui/RatingStars";

type Props = { product: Product };

export function WpFeaturedProductCard({ product }: Props) {
  const name = safeText(product.name, "Sản phẩm đang cập nhật");
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
  const reference = compare ?? retail;
  const discountPercent =
    sale && reference > sale
      ? Math.round(((reference - sale) / reference) * 100)
      : compare && compare > current
        ? Math.round(((compare - current) / compare) * 100)
        : null;
  const ratingValue = product.rating != null && product.rating > 0 ? product.rating : 4.5;
  const href = toProductPath(product.slug);

  return (
    <article className="wp-fp-item">
      <div className="wp-fp-thumb">
        <Link href={href} aria-label={`Xem ${name}`} className="wp-fp-thumb-link">
          <MediaImage image={product.image} altFallback={name} width={480} height={480} />
        </Link>
        {discountPercent != null && discountPercent > 0 && (
          <div className="wp-fp-sale">
            <p>{discountPercent}%</p>
          </div>
        )}
        <div className="wp-fp-cart">
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
      <div className="wp-fp-desc">
        <div className="wp-fp-inside">
          <p className="wp-fp-title">
            <Link href={href}>{name}</Link>
          </p>
          <div className="wp-fp-price">
            {product.price ? (
              <>
                <p className="wp-fp-price-current">{formatVnd(current)}</p>
                {compare && compare > current && (
                  <p className="wp-fp-price-old">{formatVnd(compare)}</p>
                )}
              </>
            ) : (
              <p className="wp-fp-price-current">Liên hệ</p>
            )}
          </div>
        </div>
        <div className="wp-fp-rating">
          <RatingStars value={ratingValue} />
        </div>
      </div>
    </article>
  );
}
