"use client";
import { useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/contracts/public";
import { RatingStars } from "@/components/ui/RatingStars";
import { formatVnd, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";

type Props = { products: Product[] };

export function FeaturedProductsCarousel({ products }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".wp-prod-card");
    const step = card ? card.offsetWidth + 16 : 240;
    el.scrollBy({ left: dir * step * 2, behavior: "smooth" });
  }, []);

  if (products.length === 0) return null;

  return (
    <div className="wp-prod-carousel-wrap">
      <button
        className="wp-car-btn wp-car-prev"
        onClick={() => scroll(-1)}
        aria-label="Cuộn trái"
      >
        ‹
      </button>

      <div className="wp-prod-carousel" ref={trackRef}>
        {products.map((p) => {
          const name = safeText(p.name, "Sản phẩm");
          const src = resolveMediaUrl(p.image?.url?.trim());
          const retail = p.price?.retailPrice ?? 0;
          const sale =
            p.price?.salePrice && p.price.salePrice > 0 ? p.price.salePrice : null;
          const compare =
            p.price?.compareAtPrice && p.price.compareAtPrice > 0
              ? p.price.compareAtPrice
              : null;
          const hasSale =
            (sale !== null && sale < retail) ||
            (compare !== null && compare > retail);
          const displayPrice = sale ?? retail;
          const displayCompare =
            compare && compare > displayPrice ? compare : null;

          return (
            <Link key={p.id} href={toProductPath(p.slug)} className="wp-prod-card">
              <div className="wp-prod-img-wrap">
                {src ? (
                  <Image
                    src={src}
                    alt={safeText(p.image?.alt, name)}
                    fill
                    className="wp-prod-img"
                    unoptimized
                    sizes="(max-width: 600px) 50vw, 20vw"
                  />
                ) : (
                  <div className="wp-prod-img-fallback" aria-hidden="true" />
                )}
                {hasSale && <span className="wp-prod-sale-tag">SALE</span>}
                <span className="wp-prod-cart-bar">THÊM VÀO GIỎ HÀNG</span>
              </div>
              <div className="wp-prod-info">
                <p className="wp-prod-name">{name}</p>
                <div className="wp-prod-price-row">
                  <span className="wp-prod-price">{formatVnd(displayPrice)}</span>
                  {displayCompare !== null && (
                    <span className="wp-prod-compare">{formatVnd(displayCompare)}</span>
                  )}
                </div>
                <div className="wp-prod-stars">
                  <RatingStars value={p.rating ?? 4.5} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <button
        className="wp-car-btn wp-car-next"
        onClick={() => scroll(1)}
        aria-label="Cuộn phải"
      >
        ›
      </button>
    </div>
  );
}
