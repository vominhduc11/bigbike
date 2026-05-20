"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset, VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

// ── Video helpers ─────────────────────────────────────────────────────────────

type GalleryItem =
  | { kind: "image"; asset: ImageAsset }
  | { kind: "video"; asset: VideoAsset };

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

function isValidVideo(v: VideoAsset): boolean {
  const url = v.url ?? "";
  if (!url) return false;
  if (getYouTubeId(url)) return true;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

function VideoPlayer({
  video,
  altFallback,
}: {
  video: VideoAsset;
  altFallback: string;
}) {
  const [playing, setPlaying] = useState(false);
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const path = url.split(/[?#]/, 1)[0];
  const isUpload = !ytId && /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
  const title = video.title || altFallback;

  if (playing && ytId) {
    return (
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden border border-border bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  if (playing && isUpload) {
    return (
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden border border-border bg-black">
        <video
          src={url}
          controls
          autoPlay
          playsInline
          poster={video.thumbnail?.url}
          className="max-h-full max-w-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Phát ${title}`}
      className="group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-border bg-[var(--bb-bg-surface-dark)]"
    >
      {video.thumbnail ? (
        <MediaImage
          image={video.thumbnail}
          altFallback={title}
          width={800}
          height={800}
          className="h-[88%] w-[88%] object-contain transition-opacity group-hover:opacity-90"
        />
      ) : (
        <div className="h-full w-full" />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/90 text-white transition-transform group-hover:scale-110">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      {video.title && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-3 py-2 text-left text-xs text-white">
          {video.title}
        </span>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
const THUMBNAIL_VISIBLE_COUNT = 5;
const THUMBNAIL_GAP_PX = 8;
// each item fills exactly 1/5.5 of the strip so the 6th item peeks
const THUMBNAIL_ITEM_BASIS = `calc((100% - ${4.5 * THUMBNAIL_GAP_PX}px) / 5.5)`;

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
  videos,
}: ProductGalleryProps) {
  const hasVariantGallery = Boolean(variantGallery && variantGallery.length > 0);
  const stripBody: ImageAsset[] = hasVariantGallery ? variantGallery! : gallery;
  const coverImage: ImageAsset | null = variantImage ?? mainImage ?? null;
  const allImages: ImageAsset[] = coverImage
    ? [coverImage, ...stripBody.filter((img) => img.url !== coverImage.url)]
    : stripBody;

  const validVideos = (videos ?? []).filter(isValidVideo);
  const allItems: GalleryItem[] = [
    ...validVideos.map((asset) => ({ kind: "video" as const, asset })),
    ...allImages.map((asset) => ({ kind: "image" as const, asset })),
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [canHover, setCanHover] = useState(false);
  const mainRef = useRef<HTMLButtonElement | null>(null);
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  // Reset to first item when the active variant changes.
  const variantToken = variantKey ?? "__no_variant__";
  const [prevVariantToken, setPrevVariantToken] = useState(variantToken);
  if (variantToken !== prevVariantToken) {
    setPrevVariantToken(variantToken);
    setSelectedIndex(0);
  }

  const count = allItems.length;
  const selectedItem = allItems[selectedIndex] ?? null;
  const selectedImage = selectedItem?.kind === "image" ? selectedItem.asset : null;
  const imageLightboxOpen = lightboxOpen && Boolean(selectedImage);

  const prev = useCallback(
    () => setSelectedIndex((i) => (i - 1 + count) % count),
    [count, setSelectedIndex],
  );
  const next = useCallback(
    () => setSelectedIndex((i) => (i + 1) % count),
    [count, setSelectedIndex],
  );

  // Scroll the active thumbnail into view whenever selectedIndex changes.
  useEffect(() => {
    const container = thumbsRef.current;
    if (!container) return;
    const thumb = container.children[selectedIndex] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selectedIndex]);

  function scrollThumbsBy(direction: "prev" | "next") {
    const el = thumbsRef.current;
    if (!el) return;
    const firstChild = el.children[0] as HTMLElement | undefined;
    const itemWidth = firstChild
      ? firstChild.getBoundingClientRect().width + THUMBNAIL_GAP_PX
      : el.clientWidth / 5.5 + THUMBNAIL_GAP_PX;
    el.scrollBy({
      left: direction === "next" ? itemWidth : -itemWidth,
      behavior: "smooth",
    });
  }

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

  useEffect(() => {
    document.body.style.overflow = imageLightboxOpen ? "hidden" : "";
    document.documentElement.style.overflowY = imageLightboxOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflowY = "";
    };
  }, [imageLightboxOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  const zoomImageUrl = selectedImage ? resolveMediaUrl(selectedImage.url) ?? null : null;
  const zoomEnabled = canHover && Boolean(zoomImageUrl) && !lightboxOpen;
  const showThumbnailControls = count > THUMBNAIL_VISIBLE_COUNT;

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
        {/* Main viewer — image (zoom + lightbox) or video player */}
        <div className="group/gallery relative min-w-0">
          {selectedItem?.kind === "video" ? (
            <VideoPlayer key={selectedIndex} video={selectedItem.asset} altFallback={altFallback} />
          ) : (
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
          )}

          {discountBadge > 0 && (
            <span
              className="pointer-events-none absolute left-3 top-3 z-[2] bg-brand px-2.5 py-1 font-body text-xs font-bold uppercase tracking-wide text-white"
              aria-hidden="true"
            >
              -{discountBadge}%
            </span>
          )}

          {/* Carousel arrows — visible when there are multiple items */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Ảnh trước"
                className={cn(
                  "absolute left-2 top-1/2 z-[3] -translate-y-1/2 flex h-8 w-8 items-center justify-center border border-border bg-white/90 text-foreground opacity-0 transition-opacity hover:bg-white group-hover/gallery:opacity-100 focus-visible:opacity-100",
                  FOCUS_RING,
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Ảnh tiếp"
                className={cn(
                  "absolute right-2 top-1/2 z-[3] -translate-y-1/2 flex h-8 w-8 items-center justify-center border border-border bg-white/90 text-foreground opacity-0 transition-opacity hover:bg-white group-hover/gallery:opacity-100 focus-visible:opacity-100",
                  FOCUS_RING,
                )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
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

        {/* Thumbnail carousel — single row with prev/next arrows */}
        {count > 1 && (
          <div className="flex items-center gap-1.5">
            {showThumbnailControls && (
              <button
                type="button"
                onClick={() => scrollThumbsBy("prev")}
                aria-label="Cuộn thumbnail về trước"
                className={cn(
                  "flex w-9 shrink-0 self-stretch items-center justify-center border border-border bg-white text-foreground transition-colors hover:border-foreground",
                  FOCUS_RING,
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}

            <div
              ref={thumbsRef}
              className="flex min-w-0 flex-1 gap-2 overflow-x-hidden scroll-smooth"
            >
              {allItems.map((item, i) => {
                const active = i === selectedIndex;
                const baseClass = cn(
                  "relative flex h-16 sm:h-20 md:h-24 shrink-0 items-center justify-center overflow-hidden p-1.5 transition-[border-color]",
                  active ? "border-2 border-brand" : "border border-border hover:border-foreground",
                  FOCUS_RING,
                );
                const itemStyle = { flexBasis: THUMBNAIL_ITEM_BASIS };

                if (item.kind === "image") {
                  return (
                    <button
                      key={item.asset.id ?? item.asset.url ?? i}
                      type="button"
                      className={cn(baseClass, "bg-white")}
                      style={itemStyle}
                      onClick={() => setSelectedIndex(i)}
                      aria-label={`Xem ảnh ${i + 1}`}
                      aria-pressed={active}
                    >
                      <MediaImage
                        image={item.asset}
                        altFallback={altFallback}
                        width={200}
                        height={200}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  );
                }

                // Video thumbnail
                return (
                  <button
                    key={`video-${i}`}
                    type="button"
                    className={cn(baseClass, "bg-[var(--bb-bg-surface-dark)]")}
                    style={itemStyle}
                    onClick={() => setSelectedIndex(i)}
                    aria-label={item.asset.title ? `Xem video: ${item.asset.title}` : "Xem video"}
                    aria-pressed={active}
                  >
                    {item.asset.thumbnail ? (
                      <MediaImage
                        image={item.asset.thumbnail}
                        altFallback="Video"
                        width={200}
                        height={200}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/90 text-white">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {showThumbnailControls && (
              <button
                type="button"
                onClick={() => scrollThumbsBy("next")}
                aria-label="Cuộn thumbnail tiếp"
                className={cn(
                  "flex w-9 shrink-0 self-stretch items-center justify-center border border-border bg-white text-foreground transition-colors hover:border-foreground",
                  FOCUS_RING,
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox — images only */}
      {imageLightboxOpen && selectedImage && createPortal(
        <div className="fixed inset-0 z-[var(--bb-z-modal)] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Xem ảnh">
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
        </div>,
        document.body,
      )}
    </>
  );
}
