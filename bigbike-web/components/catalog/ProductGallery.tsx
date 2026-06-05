"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, FreeMode, Keyboard, Thumbs } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/thumbs";
import { MediaImage } from "@/components/ui/MediaImage";
import type { ImageAsset, VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { useResponsiveValue } from "@/lib/hooks/useResponsiveValue";

// Hover-to-zoom: di chuột vào ảnh chính hiện kính lúp + khung phóng to bên phải.
// Chỉ bật trên thiết bị có chuột thật (hover + pointer mịn) và màn đủ rộng cho
// khung phóng to nằm bên phải (>=1181px) — đúng như behavior cũ trước migration.
const ZOOM_FACTOR = 2.5;
const LENS_SIZE_PCT = 100 / ZOOM_FACTOR;

// Vertical thumbnail rail (≥1025): fixed-size slides that flow and scroll. The
// rail gets a DEFINITE height (= content, capped at the live main-image height)
// so Swiper can detect overflow and scroll — `height:auto` would make it think
// everything fits and never lock/scroll. Slide height + gap mirror the Swiper
// config. The cap is the MEASURED image height (not a per-tier constant), so it
// tracks the fluid range too (e.g. 1025–1140px before the container caps).
// Vertical thumb slide height scales with the main-image tier (470/598/738px) so
// thumbnails don't look tiny on large monitors. MUST mirror the SwiperSlide !h-*
// and the grid rail-column width tiers in the JSX.
function thumbSlideHeightForWidth(width: number): number {
  if (width >= 1920) return 140;
  if (width >= 1536) return 120;
  return 100;
}
const THUMB_SLIDE_GAP = 10;
// Height reserved at ≥1025 for the up/down scroll buttons that sit OUTSIDE the
// thumbnails (above + below the strip): 2×36px button + 2×8px margin. Shrinking
// the scroll area by this keeps arrow + thumbs + arrow === the image height.
const THUMB_ARROW_ZONE = 88;
const readViewportWidth = (width: number) => width;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// --- Video helpers ---

// Hiển thị thumbnail cho video trong strip:
// 1. Nếu có ảnh thumbnail explicit → <img>
// 2. Nếu YouTube → ảnh CDN YouTube
// 3. Nếu video thư viện không có thumbnail → <video preload="metadata"> để
//    browser tự render frame đầu tiên (trick #t=0.001 đảm bảo decode trước seek).
function VideoThumbPreview({ video }: { video: VideoAsset }) {
  const thumb = videoThumbUrl(video);
  if (thumb) {
    return <img src={thumb} alt={video.title ?? "Video"} className="w-full h-full object-cover" />;
  }
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  if (!ytId) {
    const resolved = resolveMediaUrl(url) ?? url;
    const src = resolved ? `${resolved}#t=0.001` : "";
    return (
      <video
        src={src}
        className="w-full h-full object-cover"
        muted
        preload="metadata"
        playsInline
        tabIndex={-1}
      />
    );
  }
  return <div className="w-full h-full bg-neutral-800" />;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function isSupportedVideo(video: VideoAsset): boolean {
  const url = video.url ?? "";
  if (!url) return false;
  if (getYouTubeId(url)) return true;
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(path);
}

function videoThumbUrl(video: VideoAsset): string | null {
  const explicit = resolveMediaUrl(video.thumbnail?.url?.trim());
  if (explicit) return explicit;
  const ytId = getYouTubeId(video.url ?? "");
  return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
}

function VideoSlide({ video }: { video: VideoAsset }) {
  const url = video.url ?? "";
  const ytId = getYouTubeId(url);
  const resolved = resolveMediaUrl(url) ?? url;
  const title = video.title ?? "Video";

  if (ytId) {
    return (
      <iframe
        className="block w-full h-full border-none bg-black"
        src={`https://www.youtube.com/embed/${ytId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      className="block w-full h-full object-contain bg-black"
      src={resolved}
      controls
      playsInline
      poster={video.thumbnail?.url}
    />
  );
}

// --- Gallery item union type ---

type ImageItem = { kind: "image"; asset: ImageAsset };
type VideoItem = { kind: "video"; asset: VideoAsset };
type GalleryItem = ImageItem | VideoItem;

type ProductGalleryProps = {
  mainImage: ImageAsset | null | undefined;
  gallery: ImageAsset[];
  altFallback: string;
  variantImage?: ImageAsset | null;
  variantGallery?: ImageAsset[];
  variantKey?: string | null;
  videos?: VideoAsset[];
};

export function ProductGallery({
  mainImage,
  gallery,
  altFallback,
  variantImage,
  variantGallery,
  variantKey,
  videos,
}: ProductGalleryProps) {
  const hasVariantGallery = Boolean(variantGallery && variantGallery.length > 0);
  const stripBody: ImageAsset[] = hasVariantGallery ? variantGallery! : gallery;
  const coverImage: ImageAsset | null = variantImage ?? mainImage ?? null;
  // Khử trùng TOÀN BỘ danh sách (cover + dải), không chỉ lọc cover. Ảnh đại diện
  // của biến thể thường cũng nằm trong gallery của nó (import WP gộp vào), và dải
  // có thể tự chứa trùng → nếu chỉ lọc theo cover.url sẽ lọt 2 thumbnail giống
  // nhau. So khớp theo cả `id` lẫn `url`: trùng 1 trong 2 là cùng một ảnh. Cover
  // luôn đứng đầu vì được duyệt trước.
  const images: ImageAsset[] = (() => {
    const ordered = coverImage ? [coverImage, ...stripBody] : stripBody;
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const out: ImageAsset[] = [];
    for (const img of ordered) {
      if ((img.id && seenIds.has(img.id)) || (img.url && seenUrls.has(img.url))) {
        continue;
      }
      if (img.id) seenIds.add(img.id);
      if (img.url) seenUrls.add(img.url);
      out.push(img);
    }
    return out;
  })();

  // Videos appear first in the gallery strip, then images.
  const allItems: GalleryItem[] = [
    ...(videos ?? []).filter(isSupportedVideo).map((asset): GalleryItem => ({ kind: "video", asset })),
    ...images.map((asset): GalleryItem => ({ kind: "image", asset })),
  ];

  const currentVariantKey = variantKey ?? "__no_variant__";
  // Main image + thumbnails are two linked Swiper instances (Thumbs module):
  // clicking/scrolling thumbs drives the main carousel, and the main carousel
  // keeps the active thumbnail highlighted and scrolled into view automatically.
  // `activeIndex` mirrors the main carousel only to paint the active thumb border.
  const [activeIndex, setActiveIndex] = useState(0);
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  // Live pixel height of the (square) main image, used to cap the vertical
  // thumbnail rail. Measured so it tracks the fluid range, not assumed per tier.
  const [mainImageH, setMainImageH] = useState(0);
  const mainRef = useRef<SwiperType | null>(null);

  // Hover-to-zoom state.
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [canZoom, setCanZoom] = useState(false);
  const mainBoxRef = useRef<HTMLDivElement | null>(null);

  const count = allItems.length;

  // Thumbnail rail sizing/arrows. Below 1025 the rail is horizontal (CSS-sized);
  // at ≥1025 it's vertical with a computed definite height so Swiper scrolls
  // correctly. Arrows render only when the thumbnails actually overflow.
  const viewportWidth = useResponsiveValue(readViewportWidth, 0);
  const thumbSlideH = thumbSlideHeightForWidth(viewportWidth);
  const thumbContentH =
    count * thumbSlideH + Math.max(0, count - 1) * THUMB_SLIDE_GAP;
  const verticalRail =
    viewportWidth >= 1025 && mainImageH > 0
      ? (() => {
          const overflow = thumbContentH > mainImageH;
          // When overflowing, the up/down buttons sit OUTSIDE the thumbs (above &
          // below) in a flex column, so shrink the scroll area by their reserved
          // zone — keeps arrow + thumbs + arrow === the measured image height.
          return {
            height: overflow
              ? Math.max(0, mainImageH - THUMB_ARROW_ZONE)
              : thumbContentH,
            overflow,
          };
        })()
      : null;
  const showThumbArrows =
    viewportWidth >= 1025
      ? Boolean(verticalRail?.overflow)
      : viewportWidth === 0
        ? false
        : count > 4;

  // Zoom only applies to image slides.
  const activeItem = allItems[activeIndex] ?? allItems[0] ?? null;
  const zoomImageUrl =
    activeItem?.kind === "image" ? resolveMediaUrl(activeItem.asset.url) ?? null : null;
  const zoomEnabled = canZoom && Boolean(zoomImageUrl);

  // Variant switch swaps the whole image set; both carousels are keyed by
  // variant so they remount to the first slide — just resync the highlight.
  useEffect(() => {
    setActiveIndex(0);
  }, [currentVariantKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 1181px)",
    );
    const update = () => setCanZoom(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Track the main image's rendered height so the vertical thumbnail rail can be
  // capped exactly to it (no overhang) at any width, including the fluid range.
  useEffect(() => {
    const node = mainBoxRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setMainImageH(Math.round(h));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  function updateZoomPos(e: MouseEvent<HTMLDivElement>) {
    const node = mainBoxRef.current;
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

  function itemKey(item: GalleryItem, index: number): string {
    if (item.kind === "image") return item.asset.id ?? item.asset.url ?? `img-${index}`;
    return `vid-${item.asset.id ?? item.asset.url ?? index}`;
  }

  return (
    <div className="grid grid-cols-[minmax(0,25%)_minmax(0,75%)] gap-[30px] min-w-0 min-[1025px]:grid-cols-[130px_minmax(0,1fr)] min-[1536px]:grid-cols-[150px_minmax(0,1fr)] min-[1920px]:grid-cols-[170px_minmax(0,1fr)] max-[1024px]:grid-cols-[1fr] max-[1024px]:gap-[10px] max-[1024px]:w-full max-md:gap-2">
      {count > 1 && (
        // Thumbnail rail. ≥1025 it's vertical with a computed definite height
        // (`verticalRail.height` = content capped at the main image) so Swiper
        // can scroll on overflow; `self-start` stops the grid row from
        // stretching it. <1025 it's a horizontal CSS-sized strip. Arrows render
        // only when the thumbnails actually overflow (`showThumbArrows`).
        <div className="relative min-w-0 max-[1024px]:px-9 max-md:px-10 min-[1025px]:self-start">
          {showThumbArrows && (
            <button
              type="button"
              className="absolute left-0 top-1/2 z-[2] [transform:translateY(-50%)] min-[1025px]:static min-[1025px]:[transform:none] min-[1025px]:mx-auto min-[1025px]:mb-2 flex items-center justify-center w-9 h-9 max-md:w-10 max-md:h-10 cursor-pointer text-black transition-colors hover:text-[var(--bb-text-brand)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]"
              aria-label="Cuộn thumbnail lên"
              onClick={() => thumbsSwiper?.slidePrev()}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="max-[1024px]:[transform:rotate(-90deg)]">
                <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <Swiper
            key={currentVariantKey}
            onSwiper={setThumbsSwiper}
            modules={[Thumbs, FreeMode]}
            watchSlidesProgress
            freeMode={{ enabled: true, momentumBounce: false }}
            direction="horizontal"
            slidesPerView={4}
            spaceBetween={8}
            breakpoints={{
              768: { direction: "horizontal", slidesPerView: "auto", spaceBetween: 12 },
              // Per-tier-size thumbs (100/120/140px); how many show comes from the
              // container's definite height (inline via verticalRail), not slidesPerView.
              1025: { direction: "vertical", slidesPerView: "auto", spaceBetween: 10 },
            }}
            style={verticalRail ? { height: `${verticalRail.height}px` } : undefined}
            // max-h tiers are a pre-hydration guard (before the inline definite
            // height is set) so a many-image rail doesn't flash full-content-tall.
            // Post-hydration the inline height (≤ these caps) governs.
            className="max-[1024px]:!h-[120px] md:max-[1024px]:!h-[112px] min-[1025px]:max-h-[470px] min-[1536px]:max-h-[598px] min-[1920px]:max-h-[738px]"
          >
            {allItems.map((item, index) => {
              const active = index === activeIndex;
              const slideClass =
                "cursor-pointer md:max-[1024px]:!w-[112px] min-[1025px]:!h-[100px] min-[1536px]:!h-[120px] min-[1920px]:!h-[140px]";

              if (item.kind === "video") {
                return (
                  <SwiperSlide
                    key={itemKey(item, index)}
                    className={cn(slideClass, "bg-black")}
                    onClick={() => mainRef.current?.slideTo(index)}
                  >
                    <div
                      className={cn(
                        "relative w-full h-full border",
                        active ? "border-[var(--bb-border-control)]" : "border-transparent",
                      )}
                    >
                      <VideoThumbPreview video={item.asset} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="white" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </SwiperSlide>
                );
              }

              return (
                <SwiperSlide
                  key={itemKey(item, index)}
                  className={cn(slideClass, "bg-white")}
                  onClick={() => mainRef.current?.slideTo(index)}
                >
                  <MediaImage
                    image={item.asset}
                    altFallback={altFallback}
                    width={220}
                    height={220}
                    className={cn(
                      "w-full h-full object-contain border",
                      active ? "border-[var(--bb-border-control)]" : "border-transparent",
                    )}
                  />
                </SwiperSlide>
              );
            })}
          </Swiper>

          {showThumbArrows && (
            <button
              type="button"
              className="absolute right-0 top-1/2 z-[2] [transform:translateY(-50%)] min-[1025px]:static min-[1025px]:[transform:none] min-[1025px]:mx-auto min-[1025px]:mt-2 flex items-center justify-center w-9 h-9 max-md:w-10 max-md:h-10 cursor-pointer text-black transition-colors hover:text-[var(--bb-text-brand)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]"
              aria-label="Cuộn thumbnail xuống"
              onClick={() => thumbsSwiper?.slideNext()}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="max-[1024px]:[transform:rotate(-90deg)]">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className={cn("relative min-w-0", count <= 1 && "col-span-full")}>
        <div
          ref={mainBoxRef}
          className="relative w-full aspect-square overflow-hidden bg-white max-[1024px]:max-h-[380px] max-md:max-h-none max-md:border max-md:border-border max-md:bg-[var(--bb-bg-surface-raised)]"
          onMouseEnter={handleMainMouseEnter}
          onMouseMove={handleMainMouseMove}
          onMouseLeave={() => setZoomActive(false)}
        >
          <Swiper
            key={currentVariantKey}
            modules={[Thumbs, A11y, Keyboard]}
            slidesPerView={1}
            speed={350}
            rewind
            keyboard={{ enabled: true }}
            thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
            className="w-full h-full"
            onSwiper={(s) => {
              mainRef.current = s;
              setActiveIndex(s.activeIndex);
            }}
            onSlideChange={(s) => setActiveIndex(s.activeIndex)}
          >
            {allItems.map((item, index) => (
              <SwiperSlide
                key={itemKey(item, index)}
                className="flex items-center justify-center bg-white"
              >
                {item.kind === "video" ? (
                  <VideoSlide video={item.asset} />
                ) : (
                  <MediaImage
                    image={item.asset}
                    altFallback={altFallback}
                    priority={index === 0}
                    width={1200}
                    height={1200}
                    className="w-full h-full object-contain"
                  />
                )}
              </SwiperSlide>
            ))}
          </Swiper>

          {zoomActive && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-[2] box-border border border-[rgba(255,12,9,0.7)] bg-[rgba(255,12,9,0.1)]"
              style={{
                width: `${LENS_SIZE_PCT}%`,
                height: `${LENS_SIZE_PCT}%`,
                left: `${zoomPos.x * (100 - LENS_SIZE_PCT)}%`,
                top: `${zoomPos.y * (100 - LENS_SIZE_PCT)}%`,
              }}
            />
          )}
        </div>

        {zoomActive && zoomImageUrl && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-[calc(100%+12px)] z-30 w-[min(520px,42vw)] aspect-square border border-border-default bg-white bg-no-repeat shadow-[0_18px_36px_rgba(0,0,0,0.25)]"
            style={{
              backgroundImage: `url("${zoomImageUrl.replaceAll('"', "%22")}")`,
              backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
              backgroundSize: `${ZOOM_FACTOR * 100}% ${ZOOM_FACTOR * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
