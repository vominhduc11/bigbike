"use client";

import { useCallback, useEffect, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset } from "@/lib/contracts/public";

type ProductGalleryProps = {
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  altFallback: string;
  variantImage?: ImageAsset | null;
};

const THUMB_VISIBLE = 4;

function clampStripStart(idx: number, current: number): number {
  if (idx < current) return idx;
  if (idx >= current + THUMB_VISIBLE) return idx - THUMB_VISIBLE + 1;
  return current;
}

export function ProductGallery({ mainImage, gallery, altFallback, variantImage }: ProductGalleryProps) {
  const allImages: ImageAsset[] = [
    ...(mainImage ? [mainImage] : []),
    ...gallery.filter((img) => img.url !== mainImage?.url),
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stripStart, setStripStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Track previous variantImage URL to detect changes and adjust strip during render.
  // React docs recommend this setState-during-render pattern over useEffect for
  // derived state adjustments: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevVariantUrl, setPrevVariantUrl] = useState(variantImage?.url);
  if (variantImage?.url !== prevVariantUrl) {
    setPrevVariantUrl(variantImage?.url);
    if (variantImage?.url) {
      const idx = allImages.findIndex((img) => img.url === variantImage.url);
      if (idx !== -1) {
        setSelectedIndex(idx);
        setStripStart((s) => clampStripStart(idx, s));
      }
    }
  }

  const count = allImages.length;
  // If variant has an image not in the gallery, display it directly in the main slot
  const variantImageNotInGallery =
    variantImage?.url && !allImages.some((img) => img.url === variantImage.url)
      ? variantImage
      : null;
  const selectedImage = variantImageNotInGallery ?? allImages[selectedIndex] ?? mainImage;

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

  return (
    <>
      <div className="wp-pdp-gallery">
        {/* Left: vertical thumbnail strip */}
        {count > 1 && (
          <div className="wp-pdp-strip">
            <button
              type="button"
              className="wp-pdp-strip-nav"
              onClick={stripUp}
              disabled={!canStripUp}
              aria-label="Cuộn lên"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>

            <div className="wp-pdp-strip-track">
              {visibleThumbs.map((image, vi) => {
                const i = stripStart + vi;
                return (
                  <button
                    key={image.id ?? image.url ?? i}
                    type="button"
                    className={`wp-pdp-thumb${i === selectedIndex ? " active" : ""}`}
                    onClick={() => selectThumb(i)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    aria-pressed={i === selectedIndex}
                  >
                    <MediaImage image={image} altFallback={altFallback} width={160} height={160} />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="wp-pdp-strip-nav"
              onClick={stripDown}
              disabled={!canStripDown}
              aria-label="Cuộn xuống"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* Right: main image */}
        <button
          type="button"
          className="wp-pdp-main wp-pdp-main-btn"
          onClick={() => setLightboxOpen(true)}
          aria-label="Xem ảnh phóng to"
        >
          <MediaImage image={selectedImage} altFallback={altFallback} priority width={1200} height={1200} />
          <span className="wp-pdp-zoom-hint" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
            </svg>
          </span>
        </button>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="wp-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh">
          <div className="wp-lightbox-backdrop" onClick={() => setLightboxOpen(false)} />

          <button type="button" className="wp-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Đóng">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="wp-lightbox-img">
            <MediaImage image={selectedImage} altFallback={altFallback} width={1600} height={1600} priority />
          </div>

          {count > 1 && (
            <>
              <button type="button" className="wp-lightbox-nav wp-lightbox-prev" onClick={prev} aria-label="Ảnh trước">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button type="button" className="wp-lightbox-nav wp-lightbox-next" onClick={next} aria-label="Ảnh tiếp">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <div className="wp-lightbox-counter">{selectedIndex + 1} / {count}</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
