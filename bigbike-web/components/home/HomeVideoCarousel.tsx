"use client";

import useEmblaCarousel from "embla-carousel-react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { HomeVideo } from "@/lib/contracts/public";
import { isSafeHomeVideoUrl, resolveMediaUrl, safeText } from "@/lib/utils/format";

type Props = { videos: HomeVideo[] };

function PlayIcon() {
  return (
    <svg
      className="wp-video-play-icon"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="32" fill="rgba(0,0,0,0.55)" />
      <polygon points="26,20 26,44 48,32" fill="white" />
    </svg>
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
      className="wp-video-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={safeText(video.title, "Video")}
    >
      <div className="wp-video-modal-inner" onClick={(e) => e.stopPropagation()}>
        <button className="wp-video-modal-close" onClick={onClose} aria-label="Đóng video">
          ×
        </button>
        {video.embedUrl ? (
          <iframe
            ref={iframeRef}
            className="wp-video-modal-player"
            src={video.embedUrl}
            title={safeText(video.title, "Video")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : isSafeHomeVideoUrl(video.videoUrl) ? (
          <video
            className="wp-video-modal-player"
            src={video.videoUrl}
            controls
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="wp-video-modal-player wp-video-thumb-fallback" aria-hidden="true">
            <span className="wp-video-thumb-fallback-mark">BIGBIKE</span>
          </div>
        )}
        <p className="wp-video-modal-title">{safeText(video.title, "Video")}</p>
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
  const [imgError, setImgError] = useState(false);
  const title = safeText(video.title, "Video");
  const thumbSrc = imgError
    ? null
    : resolveMediaUrl(video.thumbnail?.url?.trim()) || video.autoThumbnailUrl || null;

  return (
    <button
      ref={btnRef}
      type="button"
      className="wp-video-card"
      onClick={() => { if (btnRef.current) onOpen(btnRef.current); }}
      aria-label={`Xem video: ${title}`}
    >
      <div className="wp-video-thumb-wrap">
        {thumbSrc ? (
          <Image
            src={thumbSrc}
            alt={safeText(video.thumbnail?.alt, title)}
            fill
            className="wp-video-thumb"
            sizes="(max-width: 600px) 80vw, 33vw"
            onError={() => setImgError(true)}
          />
        ) : video.videoUrl ? (
          <video
            src={video.videoUrl}
            preload="metadata"
            muted
            className="wp-video-thumb"
            style={{ objectFit: "cover", pointerEvents: "none" }}
            aria-hidden="true"
          />
        ) : (
          <div className="wp-video-thumb-fallback" aria-hidden="true">
            <span className="wp-video-thumb-fallback-mark">BIGBIKE</span>
          </div>
        )}
        <PlayIcon />
      </div>
      <p className="wp-video-card-title">{title}</p>
    </button>
  );
}

export function HomeVideoCarousel({ videos }: Props) {
  const [activeVideo, setActiveVideo] = useState<HomeVideo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = useCallback((video: HomeVideo, el: HTMLButtonElement) => {
    triggerRef.current = el;
    setActiveVideo(video);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((idx: number) => emblaApi?.scrollTo(idx), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    const onReInit = () => setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    onReInit();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onReInit);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onReInit);
    };
  }, [emblaApi]);

  if (videos.length === 0) return null;

  const showControls = videos.length > 2;
  const isLastSnap = selectedIndex >= scrollSnaps.length - 1;

  return (
    <>
      <div className="wp-video-carousel">
        <div className="wp-video-carousel-vp" ref={emblaRef}>
          <div className="wp-video-carousel-track">
            {videos.map((video) => (
              <div key={video.id} className="wp-video-carousel-slide">
                <VideoCard
                  video={video}
                  onOpen={(el) => handleOpen(video, el)}
                />
              </div>
            ))}
          </div>
        </div>
        {showControls && (
          <>
            <button
              type="button"
              className="wp-slider-btn wp-slider-prev"
              onClick={scrollPrev}
              aria-label="Video trước"
              disabled={selectedIndex === 0}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11.5 3.5L6 9l5.5 5.5" />
              </svg>
            </button>
            <button
              type="button"
              className="wp-slider-btn wp-slider-next"
              onClick={scrollNext}
              aria-label="Video tiếp"
              disabled={isLastSnap}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6.5 3.5L12 9l-5.5 5.5" />
              </svg>
            </button>
          </>
        )}
      </div>

      {showControls && scrollSnaps.length > 1 && (
        <div className="wp-video-dots" aria-label="Chuyển slide video">
          {scrollSnaps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`wp-video-dot${idx === selectedIndex ? " is-active" : ""}`}
              onClick={() => scrollTo(idx)}
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
