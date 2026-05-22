"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset, VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type ProductGalleryProps = {
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  altFallback: string;
  variantImage?: ImageAsset | null;
  variantGallery?: ImageAsset[];
  variantKey?: string | null;
  discountBadge?: number;
  videos?: VideoAsset[];
};

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
  const hasVariantGallery = Boolean(variantGallery && variantGallery.length > 0);
  const stripBody: ImageAsset[] = hasVariantGallery ? variantGallery! : gallery;
  const coverImage: ImageAsset | null = variantImage ?? mainImage ?? null;
  const images: ImageAsset[] = coverImage
    ? [coverImage, ...stripBody.filter((img) => img.url !== coverImage.url)]
    : stripBody;

  const currentVariantKey = variantKey ?? "__no_variant__";
  const [selection, setSelection] = useState({ index: 0, variantKey: currentVariantKey });
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [canHover, setCanHover] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  const count = images.length;
  const selectedIndex =
    selection.variantKey === currentVariantKey
      ? Math.min(selection.index, Math.max(0, count - 1))
      : 0;
  const selectedImage = images[selectedIndex] ?? null;
  const zoomImageUrl = selectedImage ? resolveMediaUrl(selectedImage.url) ?? null : null;
  const zoomEnabled = canHover && Boolean(zoomImageUrl);

  const setSelectedIndex = useCallback(
    (next: number | ((current: number) => number)) => {
      setSelection((current) => {
        const base = current.variantKey === currentVariantKey ? current.index : 0;
        const nextIndex = typeof next === "function" ? next(base) : next;
        return { index: nextIndex, variantKey: currentVariantKey };
      });
    },
    [currentVariantKey],
  );

  useEffect(() => {
    const container = thumbsRef.current;
    if (!container) return;
    const thumb = container.children[selectedIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const prev = useCallback(() => {
    if (count < 2) return;
    setSelectedIndex((i) => (i - 1 + count) % count);
  }, [count, setSelectedIndex]);

  const next = useCallback(() => {
    if (count < 2) return;
    setSelectedIndex((i) => (i + 1) % count);
  }, [count, setSelectedIndex]);

  function scrollThumbsBy(direction: "prev" | "next") {
    const el = thumbsRef.current;
    if (!el) return;
    const firstChild = el.children[0] as HTMLElement | undefined;
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 767px)").matches;
    const rect = firstChild?.getBoundingClientRect();
    const amount = isMobile
      ? (rect?.width ?? el.clientWidth / 3)
      : (rect?.height ?? el.clientHeight / 3);
    el.scrollBy({
      left: isMobile ? (direction === "next" ? amount : -amount) : 0,
      top: isMobile ? 0 : direction === "next" ? amount : -amount,
      behavior: "smooth",
    });
  }

  function updateZoomPos(e: MouseEvent<HTMLDivElement>) {
    const node = mainRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setZoomPos({
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    });
  }

  function handleMainMouseEnter(e: MouseEvent<HTMLDivElement>) {
    if (!zoomEnabled) return;
    updateZoomPos(e);
    setZoomActive(true);
  }

  function handleMainMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!zoomEnabled || !zoomActive) return;
    updateZoomPos(e);
  }

  return (
    <div className="bb-wp-gallery">
      {count > 1 && (
        <div className="bb-wp-gallery-thumbs-wrap">
          <button
            type="button"
            className="bb-wp-gallery-thumb-nav bb-wp-gallery-thumb-prev"
            aria-label="Ảnh trước"
            onClick={() => scrollThumbsBy("prev")}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div ref={thumbsRef} className="bb-wp-gallery-thumbs">
            {images.map((image, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={image.id ?? image.url ?? index}
                  type="button"
                  className={cn("bb-wp-gallery-thumb", active && "is-active")}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Xem ảnh ${index + 1}`}
                  aria-pressed={active}
                >
                  <MediaImage
                    image={image}
                    altFallback={altFallback}
                    width={220}
                    height={220}
                    className="bb-wp-gallery-thumb-img"
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="bb-wp-gallery-thumb-nav bb-wp-gallery-thumb-next"
            aria-label="Ảnh tiếp"
            onClick={() => scrollThumbsBy("next")}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="bb-wp-gallery-main-wrap">
        <div
          ref={mainRef}
          className="bb-wp-gallery-main"
          onMouseEnter={handleMainMouseEnter}
          onMouseMove={handleMainMouseMove}
          onMouseLeave={() => setZoomActive(false)}
        >
          <MediaImage
            image={selectedImage}
            altFallback={altFallback}
            priority
            width={1200}
            height={1200}
            className="bb-wp-gallery-main-img"
          />
          {zoomActive && (
            <span
              className="bb-wp-gallery-zoom-lens"
              style={{
                width: `${LENS_SIZE_PCT}%`,
                height: `${LENS_SIZE_PCT}%`,
                left: `${zoomPos.x * (100 - LENS_SIZE_PCT)}%`,
                top: `${zoomPos.y * (100 - LENS_SIZE_PCT)}%`,
              }}
              aria-hidden="true"
            />
          )}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="bb-wp-gallery-main-nav bb-wp-gallery-main-prev"
              aria-label="Ảnh trước"
              onClick={prev}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="bb-wp-gallery-main-nav bb-wp-gallery-main-next"
              aria-label="Ảnh tiếp"
              onClick={next}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {zoomActive && zoomImageUrl && (
          <div
            className="bb-wp-gallery-zoom-pane"
            style={{
              backgroundImage: `url("${zoomImageUrl.replaceAll('"', "%22")}")`,
              backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
              backgroundSize: `${ZOOM_FACTOR * 100}% ${ZOOM_FACTOR * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
