"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { HomeVideo } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { facebookEmbedUrl, getTikTokId, isFacebookVideoUrl, tiktokEmbedUrl } from "@/components/catalog/product-gallery/media";

export function VideoModal({
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
  const title = safeText(video.title, "");
  const ariaTitle = title || tA("watchVideoFallback");
  // TikTok/Facebook video sản phẩm map sang HomeVideo với embedUrl=null → tự dựng embed từ videoUrl.
  const fallbackUrl = !video.embedUrl && !video.youtubeId ? (video.videoUrl ?? "") : "";
  const tiktokId = fallbackUrl ? getTikTokId(fallbackUrl) : null;
  const isFacebook = fallbackUrl && !tiktokId && isFacebookVideoUrl(fallbackUrl);
  const embedSrc = video.embedUrl ??
    (video.youtubeId
      ? `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`
      : tiktokId
        ? tiktokEmbedUrl(tiktokId)
        : isFacebook
          ? facebookEmbedUrl(fallbackUrl)
          : null);
  // Không phải YouTube/TikTok/Facebook/embed → phát file video tự lưu (MinIO) bằng thẻ <video>.
  const rawVideoSrc = embedSrc ? null : (resolveMediaUrl(video.videoUrl?.trim()) ?? video.videoUrl ?? null);
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
    const prevBodyScrollbarGutter = document.body.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.scrollbarGutter = "auto";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.style.scrollbarGutter = prevBodyScrollbarGutter;
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
        zIndex: "var(--bb-z-modal)",
        isolation: "isolate",
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaTitle}
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
              title={ariaTitle}
            />
          ) : rawVideoSrc ? (
            <video
              src={`${rawVideoSrc}#t=0.001`}
              className="absolute inset-0 h-full w-full bg-black object-contain"
              controls
              autoPlay
              playsInline
            />
          ) : null}
        </div>
        {title && (
          <div className="px-4 py-3">
            <p className="m-0 font-body text-a4-content font-semibold text-white">{title}</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
