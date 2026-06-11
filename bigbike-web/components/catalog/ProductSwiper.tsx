"use client";

import { useId, useRef, useState } from "react";
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
  // Gắn vùng chấm bằng selector (giống ArticleCarousel — luôn bind được kể cả khi
  // tải thẳng ở desktop), không dùng ref + onBeforeInit vốn chập chờn lúc init.
  // useId đảm bảo nhiều ProductSwiper trên cùng trang không tranh nhau một vùng chấm.
  const paginationId = `bb-pswiper-pag-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
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
          onBreakpoint={(s) => setIsLocked(s.isLocked)}
          speed={700}
          slidesPerView={2}
          slidesPerGroup={2}
          spaceBetween={20}
          watchOverflow
          pagination={{ el: `#${paginationId}`, clickable: true }}
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

      {/* Chấm phân trang chuẩn design-system (đồng bộ .bb-article-pagination):
          xám 10px khi thường, đỏ kéo dài 20px khi active. Swiper mặc định cho chấm
          nhỏ active màu xanh — phải áp lại token brand để khớp các carousel khác.
          Ẩn cả cụm khi không đủ sản phẩm để lướt (isLocked) — giống mũi tên. */}
      {!isLocked && (
        <div
          id={paginationId}
          className="flex justify-center mt-[40px] [&_.swiper-pagination-bullet]:my-0 [&_.swiper-pagination-bullet]:mx-[5px] [&_.swiper-pagination-bullet]:h-[10px] [&_.swiper-pagination-bullet]:w-[10px] [&_.swiper-pagination-bullet]:!rounded-full [&_.swiper-pagination-bullet]:bg-border-default [&_.swiper-pagination-bullet]:opacity-100 [&_.swiper-pagination-bullet]:[transition:all_0.3s_ease] [&_.swiper-pagination-bullet-active]:!w-[20px] [&_.swiper-pagination-bullet-active]:!rounded-[20px] [&_.swiper-pagination-bullet-active]:!bg-brand"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
