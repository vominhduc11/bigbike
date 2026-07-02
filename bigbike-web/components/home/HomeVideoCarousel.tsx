"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import type { HomeVideo } from "@/lib/contracts/public";
import { ArrowButton } from "./video-carousel/ArrowButton";
import { VideoCard } from "./video-carousel/VideoCard";

// Only mounted when a video is clicked (activeIndex !== null below) — dynamic import
// keeps its code out of the initial homepage bundle instead of loading it upfront.
const VideoModal = dynamic(
  () => import("./video-carousel/VideoModal").then((mod) => mod.VideoModal),
  { ssr: false },
);

// surface: nền nơi đặt carousel. "dark" (mặc định, trang chủ) → mũi tên/chấm trắng;
// "light" (trang chi tiết sản phẩm nền trắng) → mũi tên/chấm tối để không bị tàng hình.
// compact: khung hẹp (rail PDP max-w 1140) → tối đa 5 cột thay vì 7, để khi số video vượt
// số cột thì mũi tên bật đúng (carousel tính cột theo bề rộng màn hình, không theo khung chứa).
type Props = { videos: HomeVideo[]; surface?: "dark" | "light"; compact?: boolean };

// Cấu hình số cột + khoá bề rộng pre-init khớp nhau. "home" trải full-width (2→7 cột);
// "compact" cho khung hẹp PDP (1→2→3→4→5 cột). Class pre-init phải là chuỗi tĩnh để Tailwind sinh ra.
const COLUMN_PRESET = {
  home: {
    preInit:
      "min-[480px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/2 md:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/3 lg:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/4 xl:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/5 min-[1920px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/6 min-[2560px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/7",
    breakpoints: {
      480: { slidesPerView: 2, spaceBetween: 12 },
      768: { slidesPerView: 3, spaceBetween: 14 },
      1024: { slidesPerView: 4, spaceBetween: 16 },
      1280: { slidesPerView: 5, spaceBetween: 16 },
      1920: { slidesPerView: 6, spaceBetween: 20 },
      2560: { slidesPerView: 7, spaceBetween: 24 },
    },
  },
  compact: {
    preInit:
      "min-[480px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/2 md:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/4 lg:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/5",
    breakpoints: {
      480: { slidesPerView: 2, spaceBetween: 10 },
      768: { slidesPerView: 4, spaceBetween: 12 },
      1024: { slidesPerView: 5, spaceBetween: 14 },
    },
  },
};

export function HomeVideoCarousel({ videos, surface = "dark", compact = false }: Props) {
  const tA = useTranslations("A11y");
  const arrowTone = surface === "light" ? "light" : "dark";
  const cols = compact ? COLUMN_PRESET.compact : COLUMN_PRESET.home;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [canScroll, setCanScroll] = useState(videos.length > 1);
  // Chỉ hiện mũi tên từ 1024px (desktop) trở lên — tablet (768–1023) và mobile không có.
  // Dùng JS thay cho class responsive Tailwind để không phụ thuộc việc class có được sinh ra.
  const [isDesktop, setIsDesktop] = useState(true);
  // Số dots & dot active lấy TRỰC TIẾP từ Swiper (snapGrid = các vị trí cuộn thật),
  // nên luôn khớp số lần cuộn thực tế thay vì tự tính theo window (vốn lệch với container).
  const [snapCount, setSnapCount] = useState(0);
  const [snapIndex, setSnapIndex] = useState(0);
  const swiperRef = useRef<SwiperType | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Mũi tên chỉ phụ thuộc desktop width, không liên quan layout slide.
  const syncViewportState = useCallback(() => {
    const width = typeof window === "undefined" ? 0 : window.innerWidth;
    setIsDesktop(width >= 1024);
  }, []);

  // Đồng bộ dots theo trạng thái thật của Swiper.
  const updateSnap = useCallback((swiper?: SwiperType | null) => {
    const s = swiper ?? swiperRef.current;
    if (!s) return;
    const count = s.snapGrid?.length ?? 0;
    setSnapCount(count);
    setSnapIndex(s.snapIndex ?? 0);
    setCanScroll(count > 1);
  }, []);

  useEffect(() => {
    syncViewportState();

    const handleResize = () => {
      syncViewportState();
      updateSnap();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [syncViewportState, updateSnap]);

  const handleOpen = useCallback((idx: number) => {
    triggerRef.current = document.activeElement as HTMLElement;
    setActiveIndex(idx);
  }, []);

  const handleClose = useCallback(() => {
    setActiveIndex(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  const handlePrev = useCallback(() =>
    setActiveIndex((i) => (i !== null ? (i - 1 + videos.length) % videos.length : null)),
  [videos.length]);
  const handleNext = useCallback(() =>
    setActiveIndex((i) => (i !== null ? (i + 1) % videos.length : null)),
  [videos.length]);

  if (videos.length === 0) return null;

  // dotCount = số vị trí cuộn thật của Swiper (snapGrid.length); active = snap hiện tại.
  const dotCount = canScroll ? snapCount : 0;
  const activeDotIndex = Math.min(snapIndex, Math.max(0, snapCount - 1));
  const paginationDots = Array.from({ length: dotCount }, (_, idx) => idx);

  // Mũi tên chỉ hiện trên desktop (>=1024px) qua `isDesktop`; tablet/mobile ẩn, ưu tiên swipe.
  // Khung gọn (PDP): video vừa đủ chỗ (canScroll=false) → ẩn hẳn mũi tên.
  // Khung full (trang chủ): giữ mũi tên hiện mờ (disabled) thay vì biến mất.
  const showArrows = isDesktop && (canScroll || !compact);

  return (
    <>
      {/* Layout: arrows đặt tuyệt đối ngoài hai mép carousel (đẩy ra lề bằng inline style) */}
      <div style={{ position: "relative" }}>
        {/* Prev arrow — desktop; khung gọn ẩn khi không cuộn được, khung full hiện mờ */}
        {showArrows && (
          <div style={{ position: "absolute", top: "50%", left: -72, transform: "translateY(-50%)", zIndex: 2 }}>
            <ArrowButton
              direction="prev"
              onClick={() => swiperRef.current?.slidePrev()}
              label={tA("videoPrev")}
              disabled={!canScroll}
              tone={arrowTone}
            />
          </div>
        )}

        <div className="min-w-0 overflow-hidden">
          <Swiper
            // PRE-INIT GUARD: mobile (<480) là 1 ô full nên đúng sẵn; từ 480px trở lên
            // slidesPerView>1, mà trước khi `.swiper-initialized` được thêm mỗi slide
            // width:100% → 1 video phình full rồi nhảy thành lưới. Khoá bề rộng khớp
            // breakpoint của preset (home: 2→7 cột / compact: 2→4 cột) tới khi init.
            className={cols.preInit}
            onSwiper={(s) => {
              swiperRef.current = s;
              syncViewportState();
              updateSnap(s);
            }}
            onSnapIndexChange={(s) => {
              setSnapIndex(s.snapIndex ?? 0);
            }}
            onBreakpoint={(s) => {
              updateSnap(s);
            }}
            onResize={(s) => {
              updateSnap(s);
            }}
            loop={false}
            speed={1000}
            slidesPerView={1}
            spaceBetween={12}
            breakpoints={cols.breakpoints}
          >
            {videos.map((video, idx) => (
              <SwiperSlide key={video.id} className="h-auto" suppressHydrationWarning>
                <VideoCard video={video} onPlay={() => handleOpen(idx)} compact={compact} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Next arrow — desktop; khung gọn ẩn khi không cuộn được, khung full hiện mờ */}
        {showArrows && (
          <div style={{ position: "absolute", top: "50%", right: -72, transform: "translateY(-50%)", zIndex: 2 }}>
            <ArrowButton
              direction="next"
              onClick={() => swiperRef.current?.slideNext()}
              label={tA("videoNext")}
              disabled={!canScroll}
              tone={arrowTone}
            />
          </div>
        )}
      </div>

      {/* Dots: hiện khi canScroll và có ≥2 dots */}
      {canScroll && dotCount > 1 && (
        <div
          className="mt-4 flex items-center justify-center gap-[6px] min-[600px]:mt-5 min-[900px]:mt-6"
          aria-label={tA("videoSlide")}
        >
          {paginationDots.map((idx) => {
            const isSelected = idx === activeDotIndex;
            return (
              <button
                key={idx}
                type="button"
                className="flex h-[44px] min-w-[24px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
                onClick={() => {
                  swiperRef.current?.slideTo(idx);
                }}
                aria-label={tA("videoGroup", { index: idx + 1 })}
                aria-current={isSelected ? "true" : undefined}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    width: isSelected ? 24 : 10,
                    height: 10,
                    borderRadius: 9999,
                    flexShrink: 0,
                    backgroundColor: isSelected
                      ? "var(--bb-action-primary)"
                      : surface === "light"
                        ? "rgba(0,0,0,0.2)"
                        : "rgba(255,255,255,0.85)",
                    transition: "width 280ms ease, background-color 280ms ease",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {activeIndex !== null && (
        <VideoModal
          videos={videos}
          activeIndex={activeIndex}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </>
  );
}
