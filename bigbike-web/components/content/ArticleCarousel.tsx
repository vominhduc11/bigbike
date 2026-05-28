"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import type { Article } from "@/lib/contracts/public";
import { ArticleCard } from "@/components/content/ArticleCard";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { cn } from "@/lib/utils";

type Props = { articles: Article[] };

// Carousel arrow button — transparent glyph, hidden on touch / mobile.
const CAR_BTN =
  "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[3.125rem] font-light leading-none text-foreground shadow-none transition-[background,box-shadow] hover:text-brand pointer-coarse:hidden max-md:hidden";

export function ArticleCarousel({ articles }: Props) {
  const t = useTranslations("Blog");
  const swiperRef = useRef<SwiperType | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  if (articles.length === 0) return null;

  return (
    <div className={cn("relative", isLocked && "[&_.swiper-wrapper]:justify-center")}>
      {!isLocked && (
        <button
          className={cn(CAR_BTN, "-left-5 min-[1440px]:-left-[60px]")}
          onClick={() => swiperRef.current?.slidePrev()}
          aria-label={t("carouselPrev")}
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
          pagination={{ el: ".bb-article-pagination", clickable: true }}
          breakpoints={{
            [BB_BREAKPOINTS.xs]: { slidesPerView: 1.05, slidesPerGroup: 1, spaceBetween: 16 },
            [BB_BREAKPOINTS.sm]: { slidesPerView: 2, slidesPerGroup: 2, spaceBetween: 22 },
            [BB_BREAKPOINTS.lg]: { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 24 },
            [BB_BREAKPOINTS.xxxl]: { slidesPerView: 4, slidesPerGroup: 4, spaceBetween: 28 },
            [BB_BREAKPOINTS.xxxxl]: { slidesPerView: 5, slidesPerGroup: 5, spaceBetween: 32 },
          }}
        >
          {articles.map((a) => (
            <SwiperSlide key={a.id} className="h-auto w-auto min-w-0 [scroll-snap-align:start]">
              <ArticleCard article={a} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {!isLocked && (
        <button
          className={cn(CAR_BTN, "-right-5 min-[1440px]:-right-[60px]")}
          onClick={() => swiperRef.current?.slideNext()}
          aria-label={t("carouselNext")}
        >
          ›
        </button>
      )}

      {!isLocked && <div className="bb-article-pagination" aria-hidden="true" />}
    </div>
  );
}
