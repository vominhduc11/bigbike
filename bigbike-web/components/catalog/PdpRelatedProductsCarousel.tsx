"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import type { Product } from "@/lib/contracts/public";

type PdpRelatedProductsCarouselProps = {
  products: Product[];
  kicker?: string;
  heading?: string;
};

function getColumns(width: number) {
  if (width >= 767) return 4;
  if (width >= 420) return 2;
  return 1;
}

export function PdpRelatedProductsCarousel({
  products,
  kicker = "SẢN PHẨM LIÊN QUAN",
  heading = "Sản phẩm tương tự",
}: PdpRelatedProductsCarouselProps) {
  const [columns, setColumns] = useState(4);
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, products.length - columns);
  const safeIndex = Math.min(index, maxIndex);

  useEffect(() => {
    const update = () => setColumns(getColumns(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="swiper-button-prev swiper-button"
                aria-label="Sản phẩm trước"
                onClick={() => setIndex(Math.max(0, safeIndex - 1))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
