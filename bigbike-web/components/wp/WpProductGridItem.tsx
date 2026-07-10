import Link from "next/link";
import type { Product } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { hasApprovedReviews } from "@/lib/rating";
import { RatingStars } from "@/components/ui/RatingStars";
import { cn } from "@/lib/utils";
import { formatVndNumber, resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";

export function WpProductGridItem({ product, selectLabel }: { product: Product; selectLabel: string }) {
  const { current, retail, isSale, discountPercent } = derivePricing(product.price);
  const img = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));
  const name = safeText(product.name, "");
  const hasReviews = hasApprovedReviews(product.rating, product.ratingCount);

  return (
    <div className="col-md-3 col-6">
      <div className="product--item flex h-full flex-col">
        <div className="product--item-thumbnail">
          <Link
            href={toProductPath(product.slug)}
            className="overflow-hidden"
            style={{
              display: "flex",
              minHeight: 0,
              aspectRatio: "1 / 1",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={name}
                className="swiper-lazy -lazy"
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  padding: 8,
                  transform: "none",
                }}
                width={1}
                height={1}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/wp/logo-1.png"
                alt={name}
                width={160}
                height={48}
                style={{ width: "55%", maxWidth: 160, height: "auto", opacity: 0.7, transform: "none" }}
              />
            )}
          </Link>
          {isSale && discountPercent ? (
            <div className="product--item-sale">
              <p>{discountPercent}%</p>
            </div>
          ) : null}
          <div className="product--item-cart">
            <Link href={toProductPath(product.slug)} style={{ fontFamily: "var(--bb-font-body)" }}>
              {selectLabel.toUpperCase()}
            </Link>
          </div>
        </div>
        <div className="product--item-desc flex flex-1 flex-col">
          <div className="product--item-inside row">
            <div className="col-md-12">
              <p
                className={cn("product--item-title uppercase", "line-clamp-2 min-h-[2.5em] leading-tight")}
                style={{ fontFamily: "var(--bb-font-body)" }}
              >
                <Link href={toProductPath(product.slug)}>{name}</Link>
              </p>
            </div>
            <div className="col-md-12">
              <div className="product--item-price">
                <p>{formatVndNumber(current)} {"\u20ab"}</p>
                {isSale ? <p className="old">{formatVndNumber(retail)} {"\u20ab"}</p> : null}
              </div>
            </div>
          </div>
          <div className="rating">
            {hasReviews ? (
              <span className="text-ui-18">
                <RatingStars value={product.rating} />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
