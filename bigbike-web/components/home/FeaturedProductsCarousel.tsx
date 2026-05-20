"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { cn } from "@/lib/utils";

type Props = { products: Product[] };

// Carousel arrow button — transparent glyph, hidden on touch / mobile.
const CAR_BTN =
  "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[3.125rem] font-light leading-none text-foreground shadow-none transition-[background,box-shadow] hover:text-brand pointer-coarse:hidden max-md:hidden";

export function FeaturedProductsCarousel({ products }: Props) {
  const t = useTranslations("Common");
  const swiperRef = useRef<SwiperType | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  if (products.length === 0) return null;

  return (
    <div className={cn("relative", isLocked && "[&_.swiper-wrapper]:justify-center")}>
      {!isLocked && (
        <button
          className={cn(CAR_BTN, "-left-5 min-[1440px]:-left-[60px]")}
          onClick={() => swiperRef.current?.slidePrev()}
          aria-label={t("scrollPrev")}
        >
          ‹
        </button>
      )}

      <div className="w-full overflow-hidden">
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
            <SwiperSlide key={p.id} className="h-auto w-auto min-w-0 [scroll-snap-align:start]">
              <ProductCard product={p} variant="featured" />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {!isLocked && (
        <button
          className={cn(CAR_BTN, "-right-5 min-[1440px]:-right-[60px]")}
          onClick={() => swiperRef.current?.slideNext()}
          aria-label={t("scrollNext")}
        >
          ›
        </button>
      )}

      {!isLocked && <div className="bb-fp-pagination" aria-hidden="true" />}
    </div>
  );
}
