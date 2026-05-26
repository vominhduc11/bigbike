"use client";

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import Image from "next/image";
import { X } from "lucide-react";
import type { HomeVideo } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type Props = { videos: HomeVideo[] };

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 animate-in fade-in-0 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative bg-black shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ width: "min(420px, calc(100vw - 32px), calc((90vh - 80px) * 9 / 16))" }}
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
          {videos.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-[var(--bb-focus-outline)]"
                onClick={onPrev}
                aria-label="Video trước"
              >
                <svg
                  className="h-6 w-4 shrink-0"
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
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-[var(--bb-focus-outline)]"
                onClick={onNext}
                aria-label="Video tiếp theo"
              >
                <svg
                  className="h-6 w-4 shrink-0"
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
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/90 focus-visible:outline-[var(--bb-focus-outline)]"
          onClick={onClose}
          aria-label="Đóng video"
        >
          <X className="h-5 w-5" />
        </button>
        {title && (
          <div className="px-5 py-4">
            <p className="m-0 font-display text-[18px] font-semibold text-white">{title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function HomeVideoCarousel({ videos }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  if (videos.length === 0) return null;

  const showControls = videos.length > 1;
  const loopEnabled = false;

  const handlePrev = () =>
    setActiveIndex((i) => (i !== null ? (i - 1 + videos.length) % videos.length : null));
  const handleNext = () =>
    setActiveIndex((i) => (i !== null ? (i + 1) % videos.length : null));

  return (
    <>
      <div className="relative">
        <div className="overflow-hidden">
          <Swiper
            onSwiper={(s) => {
              swiperRef.current = s;
              setSelectedIndex(s.realIndex);
            }}
            onSlideChange={(s) => {
              setSelectedIndex(s.realIndex);
            }}
            loop={loopEnabled}
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
                <VideoCard video={video} onPlay={() => setActiveIndex(idx)} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
        {showControls && (
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

      {showControls && videos.length > 1 && (
        <div className="mt-[30px] flex items-center justify-center gap-[10px] max-[767px]:mt-5" aria-label="Chuyển slide video">
          {videos.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className="flex h-[var(--bb-touch-target)] w-5 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
              onClick={() => {
                if (loopEnabled) swiperRef.current?.slideToLoop(idx);
                else swiperRef.current?.slideTo(idx);
              }}
              aria-label={`Đến slide ${idx + 1}`}
              aria-current={idx === selectedIndex ? "true" : undefined}
            >
              <span
                className={cn(
                  "block h-[10px] w-[10px] rounded-full bg-white transition-[width,background-color] duration-300",
                  idx === selectedIndex && "w-5 bg-brand",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {activeIndex !== null && (
        <VideoModal
          videos={videos}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </>
  );
}
