"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import Image from "next/image";
import type { HomeVideo } from "@/lib/contracts/public";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { isSafeHomeVideoUrl, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type Props = { videos: HomeVideo[] };

function PlayIcon() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-[3] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/75 bg-black/50 transition-[background,border-color,transform] duration-150 max-[575px]:h-[46px] max-[575px]:w-[46px] group-hover:bg-[rgba(200,0,0,0.72)] group-hover:scale-[1.08]"
    >
      <svg
        className="ml-[3px] h-[22px] w-5 shrink-0 text-white max-[575px]:h-[18px] max-[575px]:w-4"
        viewBox="0 0 14 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="1,1 1,15 13,8" />
      </svg>
    </span>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

function VideoModal({
  video,
  onClose,
  triggerRef,
}: {
  video: HomeVideo;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Move focus into the modal on open; return focus to trigger on close
  useEffect(() => {
    const first = backdropRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const savedTrigger = triggerRef.current;
    return () => { savedTrigger?.focus(); };
  }, [triggerRef]);

  // Focus trap — keep Tab/Shift+Tab inside the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const el = backdropRef.current;
      if (!el) return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Stop video on close by clearing src
  useEffect(() => {
    const iframe = iframeRef.current;
    return () => {
      if (iframe) iframe.src = "";
    };
  }, []);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[var(--bb-z-modal)] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={safeText(video.title, "Video")}
    >
      <div className="relative w-full max-w-[900px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute -top-11 right-0 cursor-pointer border border-white/20 bg-white/10 px-2.5 pb-1.5 pt-1 text-[1.75rem] leading-none text-white opacity-85 transition-[background,opacity] duration-150 hover:bg-[rgba(255,12,9,0.65)] hover:opacity-100 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-3"
          onClick={onClose}
          aria-label="Đóng video"
        >
          ×
        </button>
        {video.embedUrl ? (
          <iframe
            ref={iframeRef}
            className="block w-full [aspect-ratio:16/9] rounded-none bg-black"
            src={video.embedUrl}
            title={safeText(video.title, "Video")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isSafeHomeVideoUrl(video.videoUrl) ? (
          <video
            className="block w-full [aspect-ratio:16/9] rounded-none bg-black"
            src={video.videoUrl}
            controls
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div
            className="flex w-full flex-col items-center justify-center gap-2.5 bg-[radial-gradient(circle_at_50%_35%,rgba(255,12,9,0.3),transparent_42%),linear-gradient(135deg,#1a1a1a,#2a0606)] [aspect-ratio:16/9]"
            aria-hidden="true"
          >
            <span className="font-display text-2xl font-extrabold uppercase tracking-[0.22em] text-white/80">BIGBIKE</span>
          </div>
        )}
        <p className="mt-3.5 text-center font-display text-[0.9375rem] font-semibold uppercase tracking-[0.04em] text-white/85">
          {safeText(video.title, "Video")}
        </p>
      </div>
    </div>
  );
}

function VideoCard({
  video,
  onOpen,
}: {
  video: HomeVideo;
  onOpen: (el: HTMLButtonElement) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const title = safeText(video.title, "Video");

  // Fallback chain: custom thumbnail → maxresdefault (portrait, works for Shorts) → hqdefault → gradient
  const thumbUrls: string[] = [];
  const custom = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (custom) thumbUrls.push(custom);
  if (video.youtubeId) {
    thumbUrls.push(`https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`);
    thumbUrls.push(`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`);
  } else if (video.autoThumbnailUrl) {
    thumbUrls.push(video.autoThumbnailUrl);
  }

  const [thumbIdx, setThumbIdx] = useState(0);
  const thumbSrc = thumbIdx < thumbUrls.length ? thumbUrls[thumbIdx] : null;

  return (
    <button
      ref={btnRef}
      type="button"
      className="group block w-full cursor-pointer border-0 bg-transparent p-0 text-left shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-shadow duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
      onClick={() => { if (btnRef.current) onOpen(btnRef.current); }}
      aria-label={`Xem video: ${title}`}
    >
      <div className="relative w-full overflow-hidden bg-[#1a1a1a] [aspect-ratio:16/10] after:pointer-events-none after:absolute after:inset-0 after:z-[2] after:bg-[rgba(160,0,0,0.18)] after:transition-colors after:duration-300 group-hover:after:bg-[rgba(200,0,0,0.28)]">
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            className="object-cover opacity-[0.88] transition-[transform,opacity] duration-300 group-hover:scale-[1.04] group-hover:opacity-[0.78]"
            sizes="(max-width: 600px) 100vw, (max-width: 767px) 50vw, 33vw"
            onError={() => setThumbIdx((prev) => prev + 1)}
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[radial-gradient(circle_at_50%_35%,rgba(255,12,9,0.3),transparent_42%),linear-gradient(135deg,#1a1a1a,#2a0606)]"
            aria-hidden="true"
          >
            <span className="font-display text-2xl font-extrabold uppercase tracking-[0.22em] text-white/80">BIGBIKE</span>
          </div>
        )}
        <PlayIcon />
      </div>
      <div className="flex min-h-20 items-center justify-center border-t-2 border-t-transparent bg-[#111] px-4 pb-[22px] pt-5 transition-colors duration-300 group-hover:border-t-brand max-[575px]:min-h-16 max-[575px]:px-3 max-[575px]:pb-4 max-[575px]:pt-3.5">
        <p className="m-0 overflow-hidden text-center font-display text-base font-semibold uppercase leading-[1.35] tracking-[0.02em] text-[#e8e8e8] transition-colors duration-300 group-hover:text-brand max-[575px]:text-sm [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {title}
        </p>
      </div>
    </button>
  );
}

export function HomeVideoCarousel({ videos }: Props) {
  const [activeVideo, setActiveVideo] = useState<HomeVideo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  const handleOpen = useCallback((video: HomeVideo, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setActiveVideo(video);
  }, []);

  if (videos.length === 0) return null;

  const showControls = videos.length > 1;
  const loopEnabled = videos.length > 1;

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
              [BB_BREAKPOINTS.sm]: { slidesPerView: 2, spaceBetween: 20 },
              [BB_BREAKPOINTS.md]: { slidesPerView: 3, spaceBetween: 30 },
            }}
          >
            {videos.map((video) => (
              <SwiperSlide
                key={video.id}
                className="h-auto"
                suppressHydrationWarning
              >
                <VideoCard
                  video={video}
                  onOpen={(el) => handleOpen(video, el)}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
        {showControls && (
          <>
            <button
              type="button"
              className="absolute left-[-60px] top-1/2 z-[4] flex h-11 w-11 items-center justify-center border border-white/20 bg-black/55 p-2.5 text-white opacity-85 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-[background,opacity,border-color] duration-150 hover:bg-black/80 hover:opacity-100 hover:border-white/40 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-3 max-[1366px]:left-[-52px] max-[1100px]:left-[-24px] max-[991px]:left-[6px] max-[991px]:h-9 max-[991px]:w-9 max-[991px]:bg-black/65 max-[991px]:p-2 max-[575px]:hidden"
              style={{ transform: "translateY(calc(-50% - 26px))" }}
              onClick={() => swiperRef.current?.slidePrev()}
              aria-label="Video trước"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2 L4 22 L22 42" />
              </svg>
            </button>
            <button
              type="button"
              className="absolute right-[-60px] top-1/2 z-[4] flex h-11 w-11 items-center justify-center border border-white/20 bg-black/55 p-2.5 text-white opacity-85 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-[background,opacity,border-color] duration-150 hover:bg-black/80 hover:opacity-100 hover:border-white/40 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-3 max-[1366px]:right-[-52px] max-[1100px]:right-[-24px] max-[991px]:right-[6px] max-[991px]:h-9 max-[991px]:w-9 max-[991px]:bg-black/65 max-[991px]:p-2 max-[575px]:hidden"
              style={{ transform: "translateY(calc(-50% - 26px))" }}
              onClick={() => swiperRef.current?.slideNext()}
              aria-label="Video tiếp"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 2 L23 22 L5 42" />
              </svg>
            </button>
          </>
        )}
      </div>

      {showControls && videos.length > 1 && (
        <div className="mt-7 flex items-center justify-center gap-2" aria-label="Chuyển slide video">
          {videos.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className="flex h-[var(--bb-touch-target)] w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-2"
              onClick={() => {
                if (loopEnabled) swiperRef.current?.slideToLoop(idx);
                else swiperRef.current?.slideTo(idx);
              }}
              aria-label={`Đến slide ${idx + 1}`}
              aria-current={idx === selectedIndex ? "true" : undefined}
            >
              <span
                className={cn(
                  "block h-2 w-2 rounded-[100px] bg-white/35 transition-[width,background-color] duration-300",
                  idx === selectedIndex && "w-7 bg-brand",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {activeVideo && (
        <VideoModal
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
          triggerRef={triggerRef}
        />
      )}
    </>
  );
}
