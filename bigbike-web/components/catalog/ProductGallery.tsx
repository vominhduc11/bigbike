"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

type ProductGalleryProps = {
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  altFallback: string;
  variantImage?: ImageAsset | null;
  /**
   * Active color gallery. Backend/admin normalize this so every size for the
   * same color exposes the same list. Empty/undefined -> product gallery.
   */
  variantGallery?: ImageAsset[];
  /**
   * Identifier of the active variant — used to detect transitions and reset
   * `selectedIndex` to 0 so the user always lands on the variant's first
   * image, not whatever index they were viewing on the previous variant.
   */
  variantKey?: string | null;
};

const THUMB_VISIBLE = 4;
const ZOOM_FACTOR = 2.5;
const LENS_SIZE_PCT = 100 / ZOOM_FACTOR;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ProductGallery({
  mainImage,
  gallery,
  altFallback,
  variantImage,
  variantGallery,
  variantKey,
}: ProductGalleryProps) {
  // Color isolation rules:
  //   cover  = variantImage (if set)        ELSE product.mainImage
  //   strip  = variantGallery (if non-empty) ELSE product.gallery
  // Cover is always prepended to strip (deduped), so allImages[0] is the hero.
  const hasVariantGallery = Boolean(variantGallery && variantGallery.length > 0);
  const stripBody: ImageAsset[] = hasVariantGallery ? variantGallery! : gallery;
  const coverImage: ImageAsset | null = variantImage ?? mainImage ?? null;
  const allImages: ImageAsset[] = coverImage
    ? [coverImage, ...stripBody.filter((img) => img.url !== coverImage.url)]
    : stripBody;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stripStart, setStripStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [canHover, setCanHover] = useState(false);
  const mainRef = useRef<HTMLButtonElement | null>(null);

  // ── Reset to first thumb when the active variant changes ───────────────
  // Using "adjusting state during render" pattern instead of useEffect.
  // Tracks the variant identity (or "no variant" sentinel) so we reset
  // exactly once per transition.
  const variantToken = variantKey ?? "__no_variant__";
  const [prevVariantToken, setPrevVariantToken] = useState(variantToken);
  if (variantToken !== prevVariantToken) {
    setPrevVariantToken(variantToken);
    setSelectedIndex(0);
    setStripStart(0);
  }

  const count = allImages.length;
  const selectedImage = allImages[selectedIndex] ?? coverImage ?? mainImage;

  const prev = useCallback(() => {
    setSelectedIndex((i) => {
      const next = (i - 1 + count) % count;
      setStripStart((s) => (next < s ? next : next >= s + THUMB_VISIBLE ? next - THUMB_VISIBLE + 1 : s));
      return next;
    });
  }, [count]);

  const next = useCallback(() => {
    setSelectedIndex((i) => {
      const n = (i + 1) % count;
      setStripStart((s) => (n >= s + THUMB_VISIBLE ? s + 1 : n < s ? 0 : s));
      return n;
    });
  }, [count]);

  const selectThumb = (i: number) => {
    setSelectedIndex(i);
  };

  const stripUp = () => setStripStart((s) => Math.max(0, s - 1));
  const stripDown = () => setStripStart((s) => Math.min(count - THUMB_VISIBLE, s + 1));

  const canStripUp = stripStart > 0;
  const canStripDown = stripStart + THUMB_VISIBLE < count;
  const visibleThumbs = allImages.slice(stripStart, stripStart + THUMB_VISIBLE);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setLightboxOpen(false); return; }
      if (count < 2) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, prev, next]);

  // Lock scroll when lightbox open
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxOpen]);

  // Detect hover-capable pointer once on mount so we never show the zoom panel
  // on touch devices (mouseenter still fires there on first tap).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const zoomImageUrl = resolveMediaUrl(selectedImage?.url) ?? null;
  const zoomEnabled = canHover && Boolean(zoomImageUrl) && !lightboxOpen;

  const handleMainMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!zoomEnabled) return;
    updateZoomPos(e);
    setZoomActive(true);
  };
  const handleMainMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!zoomEnabled || !zoomActive) return;
    updateZoomPos(e);
  };
  const handleMainMouseLeave = () => {
    if (zoomActive) setZoomActive(false);
  };

  function updateZoomPos(e: React.MouseEvent<HTMLButtonElement>) {
    const node = mainRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    setZoomPos({ x, y });
  }

  return (
    <>
      <div className="bb-pdp-gallery">
        {/* Left: vertical thumbnail strip */}
        {count > 1 && (
          <div className="bb-pdp-strip">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="bb-pdp-strip-nav"
              onClick={stripUp}
              disabled={!canStripUp}
              aria-label="Cuộn lên"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </Button>

            <div className="bb-pdp-strip-track">
              {visibleThumbs.map((image, vi) => {
                const i = stripStart + vi;
                return (
                  <Button
                    key={image.id ?? image.url ?? i}
                    type="button"
                    variant="ghost"
                    className={`bb-pdp-thumb${i === selectedIndex ? " active" : ""}`}
                    onClick={() => selectThumb(i)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    aria-pressed={i === selectedIndex}
                  >
                    <MediaImage image={image} altFallback={altFallback} width={160} height={160} />
                  </Button>
                );
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="bb-pdp-strip-nav"
              onClick={stripDown}
              disabled={!canStripDown}
              aria-label="Cuộn xuống"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Button>
          </div>
        )}

        {/* Right: main image (with elevateZoom-style hover lens + zoom window) */}
        <div className={`bb-pdp-main-wrap${zoomActive ? " is-zooming" : ""}`}>
          <Button
            ref={mainRef}
            type="button"
            variant="ghost"
            className="bb-pdp-main bb-pdp-main-btn"
            onClick={() => setLightboxOpen(true)}
            onMouseEnter={handleMainMouseEnter}
            onMouseMove={handleMainMouseMove}
            onMouseLeave={handleMainMouseLeave}
            aria-label="Xem ảnh phóng to"
          >
            <MediaImage image={selectedImage} altFallback={altFallback} priority width={1200} height={1200} />
            <span className="bb-pdp-zoom-hint" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
              </svg>
            </span>
            {zoomActive && (
              <span
                className="bb-pdp-zoom-lens"
                style={{
                  width: `${LENS_SIZE_PCT}%`,
                  height: `${LENS_SIZE_PCT}%`,
                  left: `${zoomPos.x * (100 - LENS_SIZE_PCT)}%`,
                  top: `${zoomPos.y * (100 - LENS_SIZE_PCT)}%`,
                }}
                aria-hidden="true"
              />
            )}
          </Button>
          {zoomActive && zoomImageUrl && (
            <div
              className="bb-pdp-zoom-window"
              style={{
                backgroundImage: `url("${zoomImageUrl.replaceAll('"', '%22')}")`,
                backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
                backgroundSize: `${ZOOM_FACTOR * 100}% ${ZOOM_FACTOR * 100}%`,
              }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="bb-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh">
          <div className="bb-lightbox-backdrop" onClick={() => setLightboxOpen(false)} />

          <Button type="button" variant="ghost" size="icon" className="bb-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Đóng">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>

          <div className="bb-lightbox-img">
            <MediaImage image={selectedImage} altFallback={altFallback} width={1600} height={1600} priority />
          </div>

          {count > 1 && (
            <>
              <Button type="button" variant="ghost" size="icon" className="bb-lightbox-nav bb-lightbox-prev" onClick={prev} aria-label="Ảnh trước">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Button>
              <Button type="button" variant="ghost" size="icon" className="bb-lightbox-nav bb-lightbox-next" onClick={next} aria-label="Ảnh tiếp">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Button>
              <div className="bb-lightbox-counter">{selectedIndex + 1} / {count}</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
