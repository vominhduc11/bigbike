"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";

type Props = { products: Product[] };

export function FeaturedProductsCarousel({ products }: Props) {
  const swiperRef = useRef<SwiperType | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  if (products.length === 0) return null;

  return (
    <div className={`bb-prod-carousel-wrap${isLocked ? " bb-prod-carousel-wrap--locked" : ""}`}>
      {!isLocked && (
        <button
          className="bb-car-btn bb-car-prev"
          onClick={() => swiperRef.current?.slidePrev()}
          aria-label="Cuộn trái"
        >
          ‹
        </button>
      )}

      <div className="bb-prod-carousel-viewport">
        <Swiper
          modules={[Navigation, Pagination]}
          onSwiper={(s) => {
            swiperRef.current = s;
            setIsLocked(s.isLocked);
          }}
          onBreakpoint={(s) => {
            setIsLocked(s.isLocked);
          }}
          speed={700}
          slidesPerView={1}
          slidesPerGroup={1}
          spaceBetween={0}
          watchOverflow
          centeredSlides={false}
          pagination={{ el: ".bb-fp-pagination", clickable: true }}
          breakpoints={{
            [BB_BREAKPOINTS.xs]: { slidesPerView: 1.1, slidesPerGroup: 1, spaceBetween: 12 },
            [BB_BREAKPOINTS.sm]: { slidesPerView: 2, slidesPerGroup: 2, spaceBetween: 20 },
            [BB_BREAKPOINTS.md]: { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 24 },
            [BB_BREAKPOINTS.lg]: { slidesPerView: 4, slidesPerGroup: 4, spaceBetween: 30 },
          }}
        >
          {products.map((p) => (
            <SwiperSlide key={p.id} className="bb-prod-carousel-item">
              <ProductCard product={p} variant="featured" />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {!isLocked && (
        <button
          className="bb-car-btn bb-car-next"
          onClick={() => swiperRef.current?.slideNext()}
          aria-label="Cuộn phải"
        >
          ›
        </button>
      )}

      {!isLocked && <div className="bb-fp-pagination" aria-hidden="true" />}
    </div>
  );
}
