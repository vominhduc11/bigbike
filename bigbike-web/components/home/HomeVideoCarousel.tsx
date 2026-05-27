"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import Image from "next/image";
import { X } from "lucide-react";
import type { HomeVideo } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";

type Props = { videos: HomeVideo[] };

function getVisibleVideoSlides(width: number): number {
  if (width >= 1200) return 5;
  if (width >= 768) return 3;
  if (width >= 480) return 2;
  return 1;
}

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
      aria-label={`Xem video: ${title}`}
    >
      {/* Thumbnail — 9:16 aspect ratio, max-height cap ở tablet để tránh card quá cao */}
      <div className="relative w-full overflow-hidden bg-brand [aspect-ratio:9/16] max-[479px]:[max-height:72vw] min-[480px]:max-[1199px]:[max-height:260px]">
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 479px) calc(100vw - 30px), (max-width: 767px) 48vw, (max-width: 1199px) 32vw, 240px"
            onError={() => setThumbIdx((prev) => prev + 1)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-brand" aria-hidden="true">
            <span className="font-display text-2xl font-extrabold uppercase tracking-[0.22em] text-white/80">
              BIGBIKE
            </span>
          </div>
        )}
        <PlayIcon />
      </div>
      {/* Footer title — compact ở mobile, đủ rộng trên tablet/desktop */}
      <div className="bg-black px-3 py-3 min-[600px]:px-4 min-[600px]:py-4">
        <p className="m-0 overflow-hidden normal-case font-display text-[13px] font-semibold leading-[1.4] text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] min-[600px]:text-[14px] min-[900px]:text-[15px] min-[900px]:leading-[1.45]">
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
}: {
  direction: "prev" | "next";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        "group flex items-center justify-center appearance-none",
        "w-10 h-10 rounded-full",
        "bg-black/50 border border-white/20 text-white",
        "shadow-[0_2px_12px_rgba(0,0,0,0.45)]",
        "transition-colors duration-150",
        "hover:bg-black/75 hover:border-white/40",
        "focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2",
      ].join(" ")}
    >
      <svg
        style={{ width: 11, height: 20, flexShrink: 0 }}
        viewBox="0 0 27 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === "prev"
          ? <path d="M22 2 L4 22 L22 42" />
          : <path d="M5 2 L23 22 L5 42" />
        }
      </svg>
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
  const video = videos[activeIndex];
  const title = safeText(video.title, "Video");
  const embedSrc = video.embedUrl ??
    (video.youtubeId
      ? `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`
      : null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
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
        aria-label="Đóng video"
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
          borderRadius: 9999,
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
            aria-label="Video trước"
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
              borderRadius: 9999,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
              outline: "none",
            }}
            className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
          >
            <svg style={{ width: 14, height: 22, flexShrink: 0 }} viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 L4 22 L22 42" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Video tiếp theo"
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
              borderRadius: 9999,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
              outline: "none",
            }}
            className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
          >
            <svg style={{ width: 14, height: 22, flexShrink: 0 }} viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 2 L23 22 L5 42" />
            </svg>
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
            <p className="m-0 font-display text-[15px] font-semibold text-white">{title}</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function HomeVideoCarousel({ videos }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [visibleSlides, setVisibleSlides] = useState(1);
  const [canScroll, setCanScroll] = useState(videos.length > 1);
  const swiperRef = useRef<SwiperType | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const syncViewportState = useCallback(
    (_swiper?: SwiperType | null) => {
      const width = typeof window === "undefined" ? 0 : window.innerWidth;
      const nextVisibleSlides = getVisibleVideoSlides(width);
      const nextMaxSlideIndex = Math.max(0, videos.length - nextVisibleSlides);
      setVisibleSlides(nextVisibleSlides);
      setCanScroll(videos.length > nextVisibleSlides);
      setSelectedIndex((prev) => Math.min(prev, nextMaxSlideIndex));
    },
    [videos.length],
  );

  useEffect(() => {
    syncViewportState(swiperRef.current);

    const handleResize = () => syncViewportState(swiperRef.current);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [syncViewportState]);

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

  const maxSlideIndex = Math.max(0, videos.length - visibleSlides);
  const dotCount = canScroll ? maxSlideIndex + 1 : 0;
  const activeDotIndex = Math.min(selectedIndex, maxSlideIndex);
  const paginationDots = Array.from({ length: dotCount }, (_, idx) => idx);

  // Arrows chỉ hiện từ 900px — tablet nhỏ (768-899) ưu tiên swipe
  const showArrows = canScroll;

  return (
    <>
      {/* Layout: arrows ở hai bên container, không đè lên carousel */}
      <div className="flex items-center gap-2 min-[768px]:gap-3 min-[1200px]:gap-4">
        {/* Prev arrow — chỉ render từ 768px, chiếm không gian cố định để không shift layout */}
        <div className="hidden min-[768px]:block shrink-0">
          {showArrows ? (
            <ArrowButton
              direction="prev"
              onClick={() => swiperRef.current?.slidePrev()}
              label="Video trước"
            />
          ) : (
            <div className="w-10" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <Swiper
            onSwiper={(s) => {
              swiperRef.current = s;
              setSelectedIndex(s.realIndex);
              syncViewportState(s);
            }}
            onSlideChange={(s) => {
              setSelectedIndex(s.realIndex);
            }}
            onBreakpoint={(s) => {
              syncViewportState(s);
            }}
            onResize={(s) => {
              syncViewportState(s);
            }}
            loop={false}
            speed={1000}
            slidesPerView={1}
            spaceBetween={12}
            breakpoints={{
              480: { slidesPerView: 2, spaceBetween: 12 },
              768: { slidesPerView: 3, spaceBetween: 14 },
              1200: { slidesPerView: 5, spaceBetween: 16 },
            }}
          >
            {videos.map((video, idx) => (
              <SwiperSlide key={video.id} className="h-auto" suppressHydrationWarning>
                <VideoCard video={video} onPlay={() => handleOpen(idx)} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Next arrow — chỉ render từ 768px */}
        <div className="hidden min-[768px]:block shrink-0">
          {showArrows ? (
            <ArrowButton
              direction="next"
              onClick={() => swiperRef.current?.slideNext()}
              label="Video tiếp"
            />
          ) : (
            <div className="w-10" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Dots: hiện khi canScroll và có ≥2 dots */}
      {canScroll && dotCount > 1 && (
        <div
          className="mt-4 flex items-center justify-center gap-[6px] min-[600px]:mt-5 min-[900px]:mt-6"
          aria-label="Chuyển slide video"
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
                aria-label={`Đến nhóm video ${idx + 1}`}
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
