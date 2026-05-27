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
  if (width >= 900) return 3;
  if (width >= 600) return 2;
  return 1;
}

function PlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 text-white transition-transform duration-300 group-hover:scale-[1.03]"
    >
      <svg
        className="ml-1 h-10 w-10 shrink-0 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] max-[575px]:h-9 max-[575px]:w-9"
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
      <div className="relative mx-auto w-full max-w-[360px] overflow-hidden bg-brand aspect-[4/5] md:max-w-none md:aspect-[9/16]">
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 600px) calc(100vw - 30px), (max-width: 900px) 45vw, (max-width: 1200px) 32vw, 240px"
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
      <div className="min-h-[104px] bg-black px-5 py-7 max-[767px]:min-h-[76px] max-[767px]:px-4 max-[767px]:py-4">
        <p className="m-0 overflow-hidden normal-case font-display text-[18px] font-semibold leading-[1.5] text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] max-[767px]:text-[16px] max-[767px]:leading-[1.35]">
          {title}
        </p>
      </div>
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
      {/* Close button — outside the video frame, top-right of overlay */}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Đóng video"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
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

      {/* Prev/Next — outside the video frame, flanking the card */}
      {videos.length > 1 && (
        <>
          <button
            type="button"
            onClick={onPrev}
            aria-label="Video trước"
            style={{
              position: "fixed",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 9999,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
              outline: "none",
            }}
            className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2 hover:bg-[rgba(0,0,0,0.85)]"
          >
            <svg className="h-6 w-4 shrink-0" viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 L4 22 L22 42" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Video tiếp theo"
            style={{
              position: "fixed",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 9999,
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(0,0,0,0.45)",
              outline: "none",
            }}
            className="focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2 hover:bg-[rgba(0,0,0,0.85)]"
          >
            <svg className="h-6 w-4 shrink-0" viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 2 L23 22 L5 42" />
            </svg>
          </button>
        </>
      )}

      {/* Video card — clicks here do NOT close modal */}
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
          <div className="px-5 py-4">
            <p className="m-0 font-display text-[18px] font-semibold text-white">{title}</p>
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

  return (
    <>
      <div className="relative">
        <div className="overflow-hidden">
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
            spaceBetween={0}
            breakpoints={{
              600: { slidesPerView: 2, spaceBetween: 16 },
              900: { slidesPerView: 3, spaceBetween: 16 },
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
        {canScroll && (
          <>
            <button
              type="button"
              className="absolute left-[-98px] top-1/2 z-[4] flex h-[50px] w-[50px] -translate-y-1/2 appearance-none items-center justify-center border-0 bg-transparent p-0 text-white shadow-none transition-opacity duration-150 hover:opacity-80 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-4 max-[1399px]:left-3 max-[767px]:hidden"
              onClick={() => swiperRef.current?.slidePrev()}
              aria-label="Video trước"
            >
              <svg
                className="h-[44px] w-[28px] shrink-0"
                viewBox="0 0 27 44"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 2 L4 22 L22 42" />
              </svg>
            </button>
            <button
              type="button"
              className="absolute right-[-98px] top-1/2 z-[4] flex h-[50px] w-[50px] -translate-y-1/2 appearance-none items-center justify-center border-0 bg-transparent p-0 text-white shadow-none transition-opacity duration-150 hover:opacity-80 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-4 max-[1399px]:right-3 max-[767px]:hidden"
              onClick={() => swiperRef.current?.slideNext()}
              aria-label="Video tiếp"
            >
              <svg
                className="h-[44px] w-[28px] shrink-0"
                viewBox="0 0 27 44"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 2 L23 22 L5 42" />
              </svg>
            </button>
          </>
        )}
      </div>

      {canScroll && dotCount > 1 && (
        <div className="mt-[30px] flex items-center justify-center gap-[6px] max-[767px]:mt-5" aria-label="Chuyển slide video">
          {paginationDots.map((idx) => {
            const isSelected = idx === activeDotIndex;

            return (
              <button
                key={idx}
                type="button"
                className="flex h-[var(--bb-touch-target)] min-w-[20px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
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
                    width: isSelected ? 24 : 12,
                    height: 12,
                    borderRadius: 9999,
                    flexShrink: 0,
                    backgroundColor: isSelected ? "var(--bb-action-primary)" : "#ffffff",
                    transition: "width 300ms ease, background-color 300ms ease",
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
