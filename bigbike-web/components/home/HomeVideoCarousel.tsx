"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import Image from "next/image";
import type { HomeVideo } from "@/lib/contracts/public";
import { isSafeHomeVideoUrl, resolveMediaUrl, safeText } from "@/lib/utils/format";
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

const FOCUSABLE =
  'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    const first = backdropRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const savedTrigger = triggerRef.current;
    return () => {
      savedTrigger?.focus();
    };
  }, [triggerRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const el = backdropRef.current;
      if (!el) return;
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflowY;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflowY = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflowY = prevHtml;
    };
  }, []);

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
            className="flex w-full flex-col items-center justify-center gap-2.5 bg-brand [aspect-ratio:16/9]"
            aria-hidden="true"
          >
            <span className="font-display text-2xl font-extrabold uppercase tracking-[0.22em] text-white/80">
              BIGBIKE
            </span>
          </div>
        )}
        <p className="mt-3.5 text-center font-display text-15 font-semibold uppercase tracking-[0.04em] text-white/85">
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
      ref={btnRef}
      type="button"
      className="group block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      onClick={() => {
        if (btnRef.current) onOpen(btnRef.current);
      }}
      aria-label={`Xem video: ${title}`}
    >
      <div className="relative w-full overflow-hidden bg-brand [aspect-ratio:370/233]">
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            className="object-cover opacity-70 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 600px) calc(100vw - 30px), (max-width: 767px) 50vw, 370px"
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
      <div className="h-[160px] bg-black px-5 py-7 max-[767px]:px-4">
        <p className="m-0 overflow-hidden normal-case font-display text-17 font-semibold leading-[1.5] text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
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
              600: { slidesPerView: 2, spaceBetween: 20 },
              767: { slidesPerView: 3, spaceBetween: 30 },
            }}
          >
            {videos.map((video) => (
              <SwiperSlide key={video.id} className="h-auto" suppressHydrationWarning>
                <VideoCard video={video} onOpen={(el) => handleOpen(video, el)} />
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
        <div className="mt-[30px] flex items-center justify-center gap-[10px]" aria-label="Chuyển slide video">
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
                  "block h-[10px] w-[10px] rounded-[20px] bg-white transition-[width,background-color] duration-300",
                  idx === selectedIndex && "w-5 bg-brand",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {activeVideo &&
        createPortal(
          <VideoModal
            video={activeVideo}
            onClose={() => setActiveVideo(null)}
            triggerRef={triggerRef}
          />,
          document.body,
        )}
    </>
  );
}
