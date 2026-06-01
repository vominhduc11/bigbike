"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CarouselArrow } from "@/components/ui/icons";
import type { Product } from "@/lib/contracts/public";
import { useResponsiveValue } from "@/lib/hooks/useResponsiveValue";

type PdpRelatedProductsCarouselProps = {
  products: Product[];
  kicker?: string;
  heading?: string;
};

function getColumns(width: number) {
  if (width >= 2560) return 5;
  if (width >= 767) return 4;
  if (width >= 420) return 2;
  return 1;
}

export function PdpRelatedProductsCarousel({
  products,
  kicker = "SẢN PHẨM LIÊN QUAN",
  heading = "Sản phẩm tương tự",
}: PdpRelatedProductsCarouselProps) {
  const columns = useResponsiveValue(getColumns, 4);
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, products.length - columns);
  const safeIndex = Math.min(index, maxIndex);

  const trackStyle = useMemo(
    () =>
      ({
        "--bb-wp-related-index": safeIndex,
        "--bb-wp-related-columns": columns,
      }) as CSSProperties,
    [columns, safeIndex],
  );

  if (products.length === 0) return null;

  return (
    <section className="related products bb-wp-related">
      <div className="block-title text-center mb-40">
        <p className="sub-title text-uppercase">{kicker}</p>
        <p className="text-uppercase related_heading">{heading}</p>
      </div>

      <div className="row">
        <div className="product-list pb-40">
          <div className="container">
            <div className="product product-slide product-related-woo">
              <button
                type="button"
                className="swiper-button-next swiper-button"
                aria-label="Sản phẩm tiếp"
                onClick={() => setIndex(Math.min(maxIndex, safeIndex + 1))}
              >
                <CarouselArrow dir="next" />
              </button>
              <button
                type="button"
                className="swiper-button-prev swiper-button"
                aria-label="Sản phẩm trước"
                onClick={() => setIndex(Math.max(0, safeIndex - 1))}
              >
                <CarouselArrow dir="prev" />
              </button>

              <div className="swiper-container">
                <div className="swiper-wrapper bb-wp-related-track" style={trackStyle}>
                  {products.map((product) => (
                    <div className="swiper-slide" key={product.id}>
                      <ProductCard product={product} variant="related" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
