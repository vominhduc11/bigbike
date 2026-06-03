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
    // `bb-wp-related-track` + `swiper-slide` are KEPT as the carousel mechanism
    // (custom-prop calc transform + mobile scroll-snap); decoration is inline.
    <section className="mx-auto max-w-[1140px] px-[15px] mt-20 mb-10 max-md:mt-9 max-md:px-[var(--bb-mobile-page-x)] min-[1536px]:max-w-[1360px] min-[1920px]:max-w-[1600px] min-[2560px]:max-w-[2240px]">
      <div className="mb-10 text-center">
        <p className="m-0 text-black font-[family-name:var(--bb-font-display)] text-ui-35 font-semibold leading-[4.286rem] tracking-[0] uppercase max-md:text-2xl max-md:leading-[1.25]">
          {kicker}
        </p>
        <p className="m-0 text-muted-foreground font-body text-sm font-semibold leading-none uppercase">{heading}</p>
      </div>

      <div className="row">
        <div className="product-list pb-40">
          <div className="w-full">
            <div className="relative">
              <button
                type="button"
                className="absolute top-[35%] right-[-42px] z-[2] w-9 h-9 border-none bg-transparent text-black cursor-pointer max-[1025px]:right-[-8px] max-[1024px]:hidden"
                aria-label="Sản phẩm tiếp"
                onClick={() => setIndex(Math.min(maxIndex, safeIndex + 1))}
              >
                <CarouselArrow dir="next" />
              </button>
              <button
                type="button"
                className="absolute top-[35%] left-[-42px] z-[2] w-9 h-9 border-none bg-transparent text-black cursor-pointer max-[1025px]:left-[-8px] max-[1024px]:hidden"
                aria-label="Sản phẩm trước"
                onClick={() => setIndex(Math.max(0, safeIndex - 1))}
              >
                <CarouselArrow dir="prev" />
              </button>

              <div className="overflow-hidden">
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
