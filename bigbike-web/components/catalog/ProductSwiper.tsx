"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import type { Product } from "@/lib/contracts/public";
import { WpProductSwipeItem } from "@/components/wp/WpProductSwipeItem";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { cn } from "@/lib/utils";

type Props = {
  products: Product[];
  /** Số sản phẩm tối đa trên 1 hàng ở desktop lớn (mặc định theo chuẩn trang chủ). */
  className?: string;
};

// Mũi tên carousel — chevron đen lớn trong rãnh hai bên (chuẩn .product-slide của
// theme WP), ẩn trên mobile/touch. Không đổi màu hover (giữ đen như trang chủ).
const ARROW_BTN =
  "absolute top-1/2 z-10 flex h-16 w-16 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground shadow-none transition-opacity hover:opacity-60 pointer-coarse:hidden max-md:hidden [&>svg]:h-12 [&>svg]:w-12 min-[1440px]:[&>svg]:h-[3.25rem] min-[1440px]:[&>svg]:w-[3.25rem]";

/**
 * Carousel sản phẩm dùng chung — chuẩn lấy từ "SẢN PHẨM NỔI BẬT" ở trang chủ:
 * thẻ {@link WpProductSwipeItem} (ảnh + tên đậm + giá + sao + overlay giỏ hàng),
 * mũi tên trong rãnh + chấm phân trang. Dựng bằng swiper/react để chạy độc lập
 * ở mọi trang (không lệ thuộc script Swiper legacy chỉ chạy ở trang chủ).
 *
 * Bọc trong `.product` để kích hoạt CSS thẻ WP (`.product .product--item-*`).
 * Không dùng `.product-slide` để tránh layout swiper WP cũ.
 *
 * Caller tự cung cấp tiêu đề (block-title) bên ngoài — component này chỉ là dải trượt.
 */
export function ProductSwiper({ products, className }: Props) {
  const t = useTranslations("Common");
  const swiperRef = useRef<SwiperType | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  if (products.length === 0) return null;

  return (
    <div className={cn("product relative", className)}>
      {!isLocked && (
        <button
          type="button"
          className={cn(ARROW_BTN, "-left-5 min-[1440px]:-left-[60px]")}
          onClick={() => swiperRef.current?.slidePrev()}
          aria-label={t("scrollPrev")}
        >
          <ChevronLeft strokeWidth={1.5} />
        </button>
      )}

      <div className="w-full overflow-hidden">
        <Swiper
          modules={[Pagination]}
          onSwiper={(s) => {
            swiperRef.current = s;
            setIsLocked(s.isLocked);
          }}
          onBeforeInit={(s) => {
            if (s.params.pagination && typeof s.params.pagination !== "boolean") {
              s.params.pagination.el = paginationRef.current;
            }
          }}
          onBreakpoint={(s) => setIsLocked(s.isLocked)}
          speed={700}
          slidesPerView={2}
          slidesPerGroup={2}
          spaceBetween={20}
          watchOverflow
          pagination={{ clickable: true }}
          breakpoints={{
            [BB_BREAKPOINTS.md]: { slidesPerView: 4, slidesPerGroup: 4, spaceBetween: 30 },
            [BB_BREAKPOINTS.xxl]: { slidesPerView: 5, slidesPerGroup: 5, spaceBetween: 30 },
            [BB_BREAKPOINTS.xxxxl]: { slidesPerView: 6, slidesPerGroup: 6, spaceBetween: 30 },
          }}
        >
          {products.map((p) => (
            <SwiperSlide key={p.id} className="h-auto">
              <WpProductSwipeItem product={p} wrapperClassName="" />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {!isLocked && (
        <button
          type="button"
          className={cn(ARROW_BTN, "-right-5 min-[1440px]:-right-[60px]")}
          onClick={() => swiperRef.current?.slideNext()}
          aria-label={t("scrollNext")}
        >
          <ChevronRight strokeWidth={1.5} />
        </button>
      )}

      <div
        ref={paginationRef}
        className="flex justify-center gap-[5px] mt-[40px] [&_.swiper-pagination-lock]:hidden"
        aria-hidden="true"
      />
    </div>
  );
}
