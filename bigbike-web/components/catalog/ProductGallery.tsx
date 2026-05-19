"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

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
  /** Sale percentage shown as a corner badge over the cover image; 0 hides it. */
  discountBadge?: number;
};

const ZOOM_FACTOR = 2.5;
const LENS_SIZE_PCT = 100 / ZOOM_FACTOR;

// Shared focus ring for the icon buttons in this gallery.
const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

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
  discountBadge = 0,
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [canHover, setCanHover] = useState(false);
  const mainRef = useRef<HTMLButtonElement | null>(null);

  // ── Reset to first thumb when the active variant changes ───────────────
  // Using "adjusting state during render" pattern instead of useEffect.
  const variantToken = variantKey ?? "__no_variant__";
  const [prevVariantToken, setPrevVariantToken] = useState(variantToken);
  if (variantToken !== prevVariantToken) {
    setPrevVariantToken(variantToken);
    setSelectedIndex(0);
  }

  const count = allImages.length;
  const selectedImage = allImages[selectedIndex] ?? coverImage ?? mainImage;

  const prev = useCallback(() => {
    setSelectedIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const next = useCallback(() => {
    setSelectedIndex((i) => (i + 1) % count);
  }, [count]);

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
      <div className="flex min-w-0 flex-col gap-3">
        {/* Cover image — square frame with hover lens + badge overlay */}
        <div className="relative min-w-0">
          <button
            ref={mainRef}
            type="button"
            className={cn(
              "group relative flex aspect-square w-full min-w-0 cursor-zoom-in items-center justify-center overflow-hidden border border-border bg-white p-0",
              FOCUS_RING,
            )}
            onClick={() => setLightboxOpen(true)}
            onMouseEnter={handleMainMouseEnter}
            onMouseMove={handleMainMouseMove}
            onMouseLeave={handleMainMouseLeave}
            aria-label="Xem ảnh phóng to"
          >
            <MediaImage
              image={selectedImage}
              altFallback={altFallback}
              priority
              width={1200}
              height={1200}
              className="h-[88%] w-[88%] object-contain transition-transform group-hover:brightness-[1.02]"
            />
            <span
              className={cn(
                "pointer-events-none absolute bottom-3 right-3 flex items-center border border-border bg-white/90 p-2 text-foreground transition-opacity",
                zoomActive ? "opacity-0" : "opacity-0 group-hover:opacity-100",
              )}
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
              </svg>
            </span>
            {zoomActive && (
              <span
                className="pointer-events-none absolute z-[2] box-border border border-brand/70 bg-brand/10 max-[1180px]:hidden"
                style={{
                  width: `${LENS_SIZE_PCT}%`,
                  height: `${LENS_SIZE_PCT}%`,
                  left: `${zoomPos.x * (100 - LENS_SIZE_PCT)}%`,
                  top: `${zoomPos.y * (100 - LENS_SIZE_PCT)}%`,
                }}
                aria-hidden="true"
              />
            )}
          </button>

          {/* Sale badge — top-left corner over the cover image. */}
          {discountBadge > 0 && (
            <span
              className="pointer-events-none absolute left-3 top-3 z-[2] bg-brand px-2.5 py-1 font-body text-xs font-bold uppercase tracking-wide text-white"
              aria-hidden="true"
            >
              -{discountBadge}%
            </span>
          )}

          {zoomActive && zoomImageUrl && (
            <div
              className="pointer-events-none absolute top-0 left-[calc(100%+12px)] z-30 aspect-square w-[min(520px,90vw)] border border-border bg-white bg-no-repeat shadow-[0_18px_36px_rgba(0,0,0,0.25)] max-[1180px]:hidden"
              style={{
                backgroundImage: `url("${zoomImageUrl.replaceAll('"', '%22')}")`,
                backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
                backgroundSize: `${ZOOM_FACTOR * 100}% ${ZOOM_FACTOR * 100}%`,
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Thumbnail grid — sits below the cover image (5 per row). */}
        {count > 1 && (
          <div className="grid grid-cols-5 gap-2.5">
            {allImages.map((image, i) => {
              const active = i === selectedIndex;
              return (
                <button
                  key={image.id ?? image.url ?? i}
                  type="button"
                  className={cn(
                    "flex aspect-square min-h-0 w-full items-center justify-center overflow-hidden bg-white p-1.5 transition-[border-color]",
                    active
                      ? "border-2 border-brand"
                      : "border border-border hover:border-foreground",
                    FOCUS_RING,
                  )}
                  onClick={() => setSelectedIndex(i)}
                  aria-label={`Xem ảnh ${i + 1}`}
                  aria-pressed={active}
                >
                  <MediaImage
                    image={image}
                    altFallback={altFallback}
                    width={200}
                    height={200}
                    className="h-full w-full object-contain"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Xem ảnh">
          <div className="absolute inset-0 bg-black/[0.96]" onClick={() => setLightboxOpen(false)} />

          <button
            type="button"
            className={cn(
              "absolute top-5 right-5 z-[2] flex h-10 w-10 min-h-0 cursor-pointer items-center justify-center border border-white/15 bg-white/[0.08] text-white transition-all hover:bg-white/[0.16] max-[600px]:right-3 max-[600px]:top-[max(12px,env(safe-area-inset-top))] pointer-coarse:min-h-11 pointer-coarse:min-w-11 max-[769px]:min-h-11 max-[769px]:min-w-11",
              FOCUS_RING,
            )}
            onClick={() => setLightboxOpen(false)}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="relative z-[1] flex max-h-[90vh] max-w-[min(90vw,900px)] items-center justify-center">
            <MediaImage
              image={selectedImage}
              altFallback={altFallback}
              width={1600}
              height={1600}
              priority
              className="max-h-[90vh] max-w-full object-contain"
            />
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                className={cn(
                  "absolute top-1/2 left-5 z-[2] flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white transition-all hover:bg-white/[0.18] max-[600px]:left-2",
                  FOCUS_RING,
                )}
                onClick={prev}
                aria-label="Ảnh trước"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className={cn(
                  "absolute top-1/2 right-5 z-[2] flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white transition-all hover:bg-white/[0.18] max-[600px]:right-2",
                  FOCUS_RING,
                )}
                onClick={next}
                aria-label="Ảnh tiếp"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white/80">
                {selectedIndex + 1} / {count}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
