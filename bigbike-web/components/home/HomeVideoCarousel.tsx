"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { HomeVideo } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

type Props = { videos: HomeVideo[] };

function PlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 text-white transition-transform duration-300 group-hover:scale-[1.03]"
    >
      <svg
        className="ml-1 h-10 w-10 shrink-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] max-[599px]:h-9 max-[599px]:w-9"
        viewBox="0 0 14 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="1,1 1,15 13,8" />
      </svg>
    </span>
  );
}

function VideoCard({ video, onPlay }: { video: HomeVideo; onPlay: () => void }) {
  const tA = useTranslations("A11y");
  const title = safeText(video.title, "Video");

  const thumbUrls: string[] = [];
  const custom = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (custom) thumbUrls.push(custom);
  if (video.youtubeId) {
    thumbUrls.push(`https://img.youtube.com/vi/${video.youtubeId}/0.jpg`);
    thumbUrls.push(`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`);
  } else if (video.autoThumbnailUrl) {
    thumbUrls.push(video.autoThumbnailUrl);
  }

  const [thumbIdx, setThumbIdx] = useState(0);
  const thumbSrc = thumbIdx < thumbUrls.length ? thumbUrls[thumbIdx] : null;

  return (
    <button
      type="button"
      className="group block w-full cursor-pointer appearance-none bg-transparent p-0 text-left"
      onClick={onPlay}
      aria-label={tA("watchVideo", { title })}
    >
      {/* Thumbnail — 9:16 aspect ratio, max-height cap ở tablet để tránh card quá cao */}
      <div className="relative w-full overflow-hidden bg-brand [aspect-ratio:9/16] max-[479px]:[max-height:72vw] min-[480px]:max-[1199px]:[max-height:260px]">
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            // !h-full thắng rule WP của trang chủ `body img{height:auto!important}`
            // (wp-theme-home.css) — nếu không ảnh fill bị ép height:auto và sụp xuống.
            className="!h-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 479px) calc(100vw - 30px), (max-width: 767px) 48vw, (max-width: 1199px) 32vw, 240px"
            onError={() => setThumbIdx((prev) => prev + 1)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-brand" aria-hidden="true">
            <span className="font-body text-h3 font-bold uppercase tracking-display text-white/80">
              BIGBIKE
            </span>
          </div>
        )}
        <PlayIcon />
      </div>
      {/* Footer title — compact ở mobile; từ tablet trở lên reserve 2 dòng (min-h)
          để mọi card cao bằng nhau, và to/đậm hơn trên desktop lớn cho dễ đọc */}
      <div className="bg-black px-3 py-3 min-[600px]:px-4 min-[600px]:py-4">
        <p className="m-0 overflow-hidden normal-case font-body text-caption font-semibold leading-title text-white line-clamp-2 min-[600px]:min-h-[2.9em]">
          {title}
        </p>
      </div>
    </button>
  );
}

function ArrowButton({
  direction,
  onClick,
  label,
  disabled = false,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      // Inline style để thắng CSS WP/Bootstrap cũ ghi đè <button> trên trang chủ.
      // Không khung nền: chỉ mũi tên trắng to, dùng drop-shadow để nổi trên mọi nền
      // (giống nút Play trên thumbnail video).
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 76,
        height: 76,
        flexShrink: 0,
        padding: 0,
        background: "transparent",
        border: "none",
        color: "#fff",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        outline: "none",
        filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))",
      }}
      className="transition-transform duration-150 hover:!scale-110 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
    >
      {direction === "prev"
        ? <ChevronLeft aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0 }} strokeWidth={2} />
        : <ChevronRight aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0 }} strokeWidth={2} />
      }
    </button>
  );
}

function VideoModal({
  videos,
  activeIndex,
  onClose,
  onPrev,
  onNext,
}: {
  videos: HomeVideo[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const tA = useTranslations("A11y");
  const video = videos[activeIndex];
  const title = safeText(video.title, "Video");
  const embedSrc = video.embedUrl ??
    (video.youtubeId
      ? `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`
      : null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        onPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        onNext();
        return;
      }
      // Focus trap — giữ Tab/Shift+Tab quay vòng trong modal, không lọt ra page sau lưng
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el.tagName === "IFRAME");
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  // Trên mobile: prev/next nhỏ hơn và đặt ở bottom overlay, tránh đè video
  const navSize = isMobile ? 40 : 48;
  const navBottom = isMobile ? 20 : undefined;
  const navTop = isMobile ? undefined : "50%";
  const navTransform = isMobile ? undefined : "translateY(-50%)";

  const modal = (
    <div
      ref={dialogRef}
      className="fixed inset-0 flex items-center justify-center animate-in fade-in-0 duration-200"
      style={{
        zIndex: 2147483647,
        isolation: "isolate",
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-bb-video-modal="true"
    >
      {/* Close — top-right, luôn dễ bấm */}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={tA("videoClose")}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: 0,
          background: "rgba(0,0,0,0.72)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          outline: "none",
        }}
        className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev/Next — trên mobile đặt bottom center, trên desktop flanking bên cạnh */}
      {videos.length > 1 && (
        <>
          <button
            type="button"
            onClick={onPrev}
            aria-label={tA("videoPrev")}
            style={{
              position: "fixed",
              left: isMobile ? "calc(50% - 56px)" : 12,
              bottom: navBottom,
              top: navTop,
              transform: navTransform,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: navSize,
              height: navSize,
              borderRadius: 0,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
              outline: "none",
            }}
            className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
          >
            <ChevronLeft aria-hidden="true" style={{ width: 20, height: 20, flexShrink: 0 }} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={tA("videoNext")}
            style={{
              position: "fixed",
              right: isMobile ? "calc(50% - 56px)" : 12,
              bottom: navBottom,
              top: navTop,
              transform: navTransform,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: navSize,
              height: navSize,
              borderRadius: 0,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
              outline: "none",
            }}
            className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
          >
            <ChevronRight aria-hidden="true" style={{ width: 20, height: 20, flexShrink: 0 }} strokeWidth={2} />
          </button>
        </>
      )}

      {/* Video card */}
      <div
        className="relative bg-black shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ width: "min(420px, calc(100vw - 32px), calc((85vh - 60px) * 9 / 16))" }}
      >
        <div className="relative w-full [aspect-ratio:9/16]">
          {embedSrc ? (
            <iframe
              src={embedSrc}
              className="absolute inset-0 h-full w-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              title={title}
            />
          ) : null}
        </div>
        {title && (
          <div className="px-4 py-3">
            <p className="m-0 font-body text-body font-semibold text-white">{title}</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function HomeVideoCarousel({ videos }: Props) {
  const tA = useTranslations("A11y");
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
  // Khi không đủ video để cuộn (canScroll=false) thì nút hiện mờ (disabled) thay vì biến mất.

  return (
    <>
      {/* Layout: arrows đặt tuyệt đối ngoài hai mép carousel (đẩy ra lề bằng inline style) */}
      <div style={{ position: "relative" }}>
        {/* Prev arrow — render từ 768px (qua isDesktop); disabled khi không đủ video để cuộn */}
        {isDesktop && (
          <div style={{ position: "absolute", top: "50%", left: -72, transform: "translateY(-50%)", zIndex: 2 }}>
            <ArrowButton
              direction="prev"
              onClick={() => swiperRef.current?.slidePrev()}
              label={tA("videoPrev")}
              disabled={!canScroll}
            />
          </div>
        )}

        <div className="min-w-0 overflow-hidden">
          <Swiper
            // PRE-INIT GUARD: mobile (<480) là 1 ô full nên đúng sẵn; từ 480px trở lên
            // slidesPerView>1, mà trước khi `.swiper-initialized` được thêm mỗi slide
            // width:100% → 1 video phình full rồi nhảy thành lưới. Khoá bề rộng khớp
            // breakpoint (480:2 / md:3 / lg:4 / xl:5 / 1920:6 / 2560:7) tới khi init.
            className="min-[480px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/2 md:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/3 lg:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/4 xl:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/5 min-[1920px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/6 min-[2560px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/7"
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
            breakpoints={{
              480:  { slidesPerView: 2, spaceBetween: 12 },
              768:  { slidesPerView: 3, spaceBetween: 14 },
              1024: { slidesPerView: 4, spaceBetween: 16 },
              1280: { slidesPerView: 5, spaceBetween: 16 },
              1920: { slidesPerView: 6, spaceBetween: 20 },
              2560: { slidesPerView: 7, spaceBetween: 24 },
            }}
          >
            {videos.map((video, idx) => (
              <SwiperSlide key={video.id} className="h-auto" suppressHydrationWarning>
                <VideoCard video={video} onPlay={() => handleOpen(idx)} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Next arrow — render từ 768px (qua isDesktop); disabled khi không đủ video để cuộn */}
        {isDesktop && (
          <div style={{ position: "absolute", top: "50%", right: -72, transform: "translateY(-50%)", zIndex: 2 }}>
            <ArrowButton
              direction="next"
              onClick={() => swiperRef.current?.slideNext()}
              label={tA("videoNext")}
              disabled={!canScroll}
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
                    backgroundColor: isSelected ? "var(--bb-action-primary)" : "rgba(255,255,255,0.85)",
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
