"use client";

import { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import type { Product } from "@/lib/contracts/public";
import { WpFeaturedProductCard } from "@/components/home/WpFeaturedProductCard";

type Props = { products: Product[] };

export function FeaturedProductsCarousel({ products }: Props) {
  const swiperRef = useRef<SwiperType | null>(null);

  if (products.length === 0) return null;

  return (
    <div className="wp-prod-carousel-wrap">
      <button
        className="wp-car-btn wp-car-prev"
        onClick={() => swiperRef.current?.slidePrev()}
        aria-label="Cuộn trái"
      >
        ‹
      </button>

      <div className="wp-prod-carousel-viewport">
        <Swiper
          modules={[Navigation, Pagination]}
          onSwiper={(s) => {
            swiperRef.current = s;
          }}
          speed={700}
          slidesPerView={1}
          slidesPerGroup={1}
          spaceBetween={0}
          pagination={{ el: ".wp-fp-pagination", clickable: true }}
          breakpoints={{
            320: { slidesPerView: 1, slidesPerGroup: 1, spaceBetween: 0 },
            380: { slidesPerView: 2, slidesPerGroup: 2, spaceBetween: 20 },
            767: { slidesPerView: 4, slidesPerGroup: 4, spaceBetween: 30 },
          }}
        >
          {products.map((p) => (
            <SwiperSlide key={p.id} className="wp-prod-carousel-item">
              <WpFeaturedProductCard product={p} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <button
        className="wp-car-btn wp-car-next"
        onClick={() => swiperRef.current?.slideNext()}
        aria-label="Cuộn phải"
      >
        ›
      </button>

      <div className="wp-fp-pagination" aria-hidden="true" />
    </div>
  );
}
