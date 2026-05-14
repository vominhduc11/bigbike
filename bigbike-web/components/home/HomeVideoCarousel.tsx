"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import Image from "next/image";
import type { HomeVideo } from "@/lib/contracts/public";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { isSafeHomeVideoUrl, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

type Props = { videos: HomeVideo[] };

function PlayIcon() {
  return (
    <span className="bb-video-play-btn-ring" aria-hidden="true">
      <svg
        className="bb-video-play-icon"
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
      className="bb-video-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={safeText(video.title, "Video")}
    >
      <div className="bb-video-modal-inner" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="bb-video-modal-close" onClick={onClose} aria-label="Đóng video">
          ×
        </Button>
        {video.embedUrl ? (
          <iframe
            ref={iframeRef}
            className="bb-video-modal-player"
            src={video.embedUrl}
            title={safeText(video.title, "Video")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isSafeHomeVideoUrl(video.videoUrl) ? (
          <video
            className="bb-video-modal-player"
            src={video.videoUrl}
            controls
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="bb-video-modal-player bb-video-thumb-fallback" aria-hidden="true">
            <span className="bb-video-thumb-fallback-mark">BIGBIKE</span>
          </div>
        )}
        <p className="bb-video-modal-title">{safeText(video.title, "Video")}</p>
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
      className="bb-video-card"
      onClick={() => { if (btnRef.current) onOpen(btnRef.current); }}
      aria-label={`Xem video: ${title}`}
    >
      <div className="bb-video-thumb-wrap">
        {thumbSrc ? (
          <Image
            key={thumbSrc}
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            className="bb-video-thumb"
            sizes="(max-width: 600px) 100vw, (max-width: 767px) 50vw, 33vw"
            onError={() => setThumbIdx((prev) => prev + 1)}
          />
        ) : (
          <div className="bb-video-thumb-fallback" aria-hidden="true">
            <span className="bb-video-thumb-fallback-mark">BIGBIKE</span>
          </div>
        )}
        <PlayIcon />
      </div>
      <div className="bb-video-card-desc">
        <p className="bb-video-card-title">{title}</p>
      </div>
    </button>
  );
}

function HomeVideoCarouselFallback({ videos }: Props) {
  const previewVideos = videos.slice(0, Math.min(videos.length, 3));

  return (
    <div className="bb-video-carousel">
      <div className="bb-video-carousel-vp">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {previewVideos.map((video) => {
            const title = safeText(video.title, "Video");

            return (
              <div key={video.id} className="bb-video-card pointer-events-none">
                <div className="bb-video-thumb-wrap">
                  <div className="bb-video-thumb-fallback">
                    <span className="bb-video-thumb-fallback-mark">BIGBIKE</span>
                  </div>
                  <PlayIcon />
                </div>
                <div className="bb-video-card-desc">
                  <p className="bb-video-card-title">{title}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function HomeVideoCarousel({ videos }: Props) {
  const [activeVideo, setActiveVideo] = useState<HomeVideo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  const handleOpen = useCallback((video: HomeVideo, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setActiveVideo(video);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (videos.length === 0) return null;
  if (!isMounted) return <HomeVideoCarouselFallback videos={videos} />;

  const showControls = videos.length > 1;
  const loopEnabled = videos.length > 1;

  return (
    <>
      <div className="bb-video-carousel">
        <div className="bb-video-carousel-vp">
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
                className="bb-video-carousel-slide"
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
              className="bb-slider-btn bb-slider-prev"
              onClick={() => swiperRef.current?.slidePrev()}
              aria-label="Video trước"
            >
              <svg viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2 L4 22 L22 42" />
              </svg>
            </button>
            <button
              type="button"
              className="bb-slider-btn bb-slider-next"
              onClick={() => swiperRef.current?.slideNext()}
              aria-label="Video tiếp"
            >
              <svg viewBox="0 0 27 44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 2 L23 22 L5 42" />
              </svg>
            </button>
          </>
        )}
      </div>

      {showControls && videos.length > 1 && (
        <div className="bb-video-dots" aria-label="Chuyển slide video">
          {videos.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`bb-video-dot${idx === selectedIndex ? " is-active" : ""}`}
              onClick={() => {
                if (loopEnabled) swiperRef.current?.slideToLoop(idx);
                else swiperRef.current?.slideTo(idx);
              }}
              aria-label={`Đến slide ${idx + 1}`}
              aria-current={idx === selectedIndex ? "true" : undefined}
            />
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
