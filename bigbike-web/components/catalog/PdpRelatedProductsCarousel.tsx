"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import type { Product } from "@/lib/contracts/public";

type PdpRelatedProductsCarouselProps = {
  products: Product[];
  kicker: string;
  heading: string;
};

function getColumns(width: number) {
  if (width >= 767) return 4;
  if (width >= 420) return 2;
  return 1;
}

export function PdpRelatedProductsCarousel({
  products,
  kicker,
  heading,
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
    <section className="product-list pt-80 pb-40 bb-wp-related">
      <div className="container">
        <div className="block-title text-center mb-40">
          <p className="sub-title">{kicker}</p>
          <h3>{heading}</h3>
        </div>

        <div className="product product-slide product-related-bigbike">
          {products.length > columns && (
            <>
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
            </>
          )}

          <div className="swiper-container">
            <div className="swiper-wrapper bb-wp-related-track" style={trackStyle}>
              {products.map((product) => (
                <div className="swiper-slide" key={product.id}>
                  <ProductCard product={product} variant="featured" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
