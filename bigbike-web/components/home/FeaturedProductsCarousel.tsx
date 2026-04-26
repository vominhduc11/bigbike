"use client";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback } from "react";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";

type Props = { products: Product[] };

export function FeaturedProductsCarousel({ products }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    slidesToScroll: 2,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (products.length === 0) return null;

  return (
    <div className="wp-prod-carousel-wrap">
      <button
        className="wp-car-btn wp-car-prev"
        onClick={scrollPrev}
        aria-label="Cuộn trái"
      >
        ‹
      </button>

      <div className="wp-prod-carousel-viewport" ref={emblaRef}>
        <div className="wp-prod-carousel">
          {products.map((p) => (
            <div key={p.id} className="wp-prod-carousel-item">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>

      <button
        className="wp-car-btn wp-car-next"
        onClick={scrollNext}
        aria-label="Cuộn phải"
      >
        ›
      </button>
    </div>
  );
}
