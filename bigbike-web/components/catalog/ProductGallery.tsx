"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { useTranslations } from "next-intl";
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

// Vertical thumbnail rail (≥1024): slides flow and scroll. The rail gets a
// DEFINITE height (= content, capped at the live main-image height) so Swiper can
// detect overflow and scroll — `height:auto` would make it think everything fits
// and never lock/scroll. The cap is the MEASURED image height (not a per-tier
// constant), so it tracks the fluid range too (e.g. 1024–1140px before the
// container caps).
//
// Sizing the visible tiles when the rail overflows (FILL mode): the column is
// locked to the main-image height, so the rail (the Swiper element, flex-1) has a
// fixed height. We MEASURE that height directly (ResizeObserver on the rail el) —
// NOT estimate it as image − arrow-chrome, because a few px of chrome error leaves
// a fractional 4th tile peeking at the bottom. We don't show that partial: pick
// how many WHOLE square-ish tiles best fill the measured rail (`round(railH /
// tile)`) and size every tile to exactly `railH / fitCount`, so N tiles fill flush
// with no leftover. The per-tier value below is the SQUARE reference size (=
// rail-column width 130/150/170px); it picks the fit count and still drives the
// slide height when the rail does NOT overflow (short rail hugs its content, slides
// stay square). MUST mirror the grid rail-column widths and the !w-/!h- slide
// classes in the JSX — keep in lockstep.
function thumbSlideHeightForWidth(width: number): number {
  if (width >= 1920) return 170;
  if (width >= 1536) return 150;
  return 130;
}
// Vertical thumbnails are stacked flush (Swiper spaceBetween:0 at ≥1024), so no
// inter-slide gap is added when measuring whether the rail overflows.
const THUMB_SLIDE_GAP = 0;
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
  const tA = useTranslations("A11y");
  const hasVariantGallery = Boolean(variantGallery && variantGallery.length > 0);
  const stripBody: ImageAsset[] = hasVariantGallery ? variantGallery! : gallery;
  // Khi đã chọn màu (có variantGallery): ảnh chính = ẢNH ĐẦU của gallery màu đó
  // (variantGallery[0]), KHÔNG dùng variant.image làm cover. Sau khử trùng bên dưới,
  // dải ảnh chính là gallery của màu theo đúng thứ tự. Khi chưa chọn màu thì giữ
  // nguyên: ảnh đại diện sản phẩm (variantImage null → mainImage) đứng đầu.
  const coverImage: ImageAsset | null = hasVariantGallery
    ? (variantGallery![0] ?? variantImage ?? mainImage ?? null)
    : (variantImage ?? mainImage ?? null);
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

  // Videos only appear when no variant is selected; once a variant is picked
  // the strip shows only that variant's gallery images.
  const showVideos = variantKey == null;
  const allItems: GalleryItem[] = [
    ...(showVideos ? (videos ?? []).filter(isSupportedVideo).map((asset): GalleryItem => ({ kind: "video", asset })) : []),
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
  // Live pixel height of the vertical thumbnail rail (the Swiper element, flex-1).
  // Measured directly so FILL-mode tiles divide the EXACT available space — an
  // estimate (image − arrow chrome) is a few px off and leaves a partial tile.
  const [railH, setRailH] = useState(0);
  const mainRef = useRef<SwiperType | null>(null);

  // Đổi biến thể → cả hai Swiper remount theo `key`. Phải BỎ tham chiếu
  // thumbsSwiper CŨ ngay trong render-pass đổi key (không thể đợi useEffect — chạy
  // sau commit, đã trễ): nếu không, Swiper chính sẽ khởi tạo với instance thumbnail
  // đang bị destroy và đọc `.el.classList` của `undefined` → văng
  // "Cannot read properties of undefined (reading 'classList')" khi bấm chọn màu.
  const prevVariantKeyRef = useRef(currentVariantKey);
  if (prevVariantKeyRef.current !== currentVariantKey) {
    prevVariantKeyRef.current = currentVariantKey;
    if (thumbsSwiper) setThumbsSwiper(null);
  }

  // Hover-to-zoom state.
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [canZoom, setCanZoom] = useState(false);
  const mainBoxRef = useRef<HTMLDivElement | null>(null);

  const count = allItems.length;

  // Thumbnail rail sizing/arrows. Below 1024 the rail is horizontal (CSS-sized);
  // at ≥1024 it's vertical with a computed definite height so Swiper scrolls
  // correctly. Arrows render only when the thumbnails actually overflow.
  const viewportWidth = useResponsiveValue(readViewportWidth, 0);
  const thumbSlideH = thumbSlideHeightForWidth(viewportWidth);
  const thumbContentH =
    count * thumbSlideH + Math.max(0, count - 1) * THUMB_SLIDE_GAP;
  // At ≥1024 the left column is a flex column locked to the MEASURED main-image
  // height. The up/down arrows are fixed-height flex children and the Swiper rail
  // is `flex-1`, so [arrow] + [rail] + [arrow] always sums to EXACTLY the image
  // height — no per-arrow pixel bookkeeping. We only need to know whether the
  // thumbnails overflow (→ show arrows + lock the column height).
  // 1024 mirrors WpPurchaseSection's `max-[1023px]:!flex-[0_0_100%]`: the gallery
  // column is full-width below 1024 and only sits beside the info column at ≥1024,
  // so the vertical-rail/side layout must start exactly there (not at 993, which
  // left a 993–1023 band where a full-width gallery still used the side layout and
  // the square main image ballooned).
  const verticalRail =
    viewportWidth >= 1024 && mainImageH > 0
      ? { overflow: thumbContentH > mainImageH }
      : null;
  const showThumbArrows =
    viewportWidth >= 1024
      ? Boolean(verticalRail?.overflow)
      : viewportWidth === 0
        ? false
        : count > 4;

  // FILL mode: rail overflows at ≥1024, so the column is locked to the image
  // height and the rail (flex-1) has a fixed height — which we MEASURE (railH), not
  // estimate, so the division lands exactly. Pick the whole number of tiles that
  // best fills it (round → nearest to square) and size each tile to railH/fitCount
  // so N tiles fill flush with no fractional 4th peeking.
  //
  // We DON'T do this via Swiper's `slidesPerView`: Swiper's setBreakpoint()
  // early-returns when the active breakpoint key is unchanged (still 1024), so a
  // runtime slidesPerView change inside the same breakpoint never applies. Instead
  // keep slidesPerView:"auto" and drive the tile HEIGHT from a CSS var (set below) —
  // "auto" reads it from the DOM and Swiper's resize observer recomputes on change.
  const verticalFill =
    viewportWidth >= 1024 && Boolean(verticalRail?.overflow) && railH >= thumbSlideH;
  // FLOOR (not round): the visible tile stays a fixed SQUARE (= rail-column width),
  // so we can only show as many WHOLE squares as actually fit — rounding up would
  // make the square taller than its slide and overflow. The leftover becomes even
  // spacing (see below), keeping tiles square while still filling the column.
  const thumbFitCount = verticalFill
    ? Math.min(count, Math.max(1, Math.floor(railH / thumbSlideH)))
    : 0;
  // Each slide is railH/fitCount tall (so N slides fill the measured rail flush);
  // the square tile is centered in it, so the surplus (slide − square) shows as an
  // even gap above/below every tile.
  const thumbFillH = verticalFill ? railH / thumbFitCount : 0;

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

  // Track the rail's own rendered height (the Swiper element). FILL mode divides
  // THIS exact value, so no chrome estimate is needed and no partial tile is left.
  // The el comes from the thumbs Swiper instance; re-observe whenever it remounts
  // (variant switch re-keys the Swiper → new el).
  useEffect(() => {
    const el = thumbsSwiper?.el;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setRailH(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [thumbsSwiper]);

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
    <div className="grid grid-cols-[minmax(0,25%)_minmax(0,75%)] gap-[30px] min-w-0 min-[1024px]:grid-cols-[130px_minmax(0,1fr)] min-[1536px]:grid-cols-[150px_minmax(0,1fr)] min-[1920px]:grid-cols-[170px_minmax(0,1fr)] max-[1023px]:grid-cols-[1fr] max-[1023px]:gap-[10px] max-[1023px]:w-full max-md:gap-2">
      {count > 1 && (
        // Thumbnail rail. ≥1024 it's a vertical flex column locked to the measured
        // main-image height (arrows fixed-height + rail `flex-1`), so Swiper can
        // scroll on overflow and arrow+rail+arrow === the image height exactly;
        // `self-start` stops the grid row from stretching it. <1024 it's a
        // horizontal CSS-sized strip. Arrows render only when the thumbnails
        // actually overflow (`showThumbArrows`).
        <div
          className="relative min-w-0 max-[1023px]:px-9 max-md:px-10 max-[1023px]:order-2 min-[1024px]:flex min-[1024px]:flex-col min-[1024px]:gap-2 min-[1024px]:self-start"
          // Lock the whole column to the main-image height ONLY when the rail
          // overflows (arrows present); otherwise let it hug its content so a
          // short rail doesn't leave a tall empty gap.
          style={
            verticalRail?.overflow ? { height: `${mainImageH}px` } : undefined
          }
        >
          {showThumbArrows && (
            <button
              type="button"
              className="absolute left-0 top-1/2 z-[2] [transform:translateY(-50%)] min-[1024px]:static min-[1024px]:[transform:none] min-[1024px]:w-full min-[1024px]:h-11 min-[1024px]:shrink-0 flex items-center justify-center w-9 h-9 max-md:w-10 max-md:h-10 cursor-pointer text-black transition-colors hover:text-[var(--bb-text-brand)] min-[1024px]:hover:bg-[var(--bb-bg-surface-raised)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]"
              aria-label={tA("thumbScrollUp")}
              onClick={() => thumbsSwiper?.slidePrev()}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="max-[1023px]:[transform:rotate(-90deg)]">
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
            slidesPerView={3}
            spaceBetween={8}
            breakpoints={{
              // <540 (real phones): 3 squares per view. From 540 up the strip
              // switches to fixed-size square thumbnails (auto count) so they never
              // balloon — at e.g. 760px "3 per view" would otherwise be 211px each.
              540: { direction: "horizontal", slidesPerView: "auto", spaceBetween: 10 },
              768: { direction: "horizontal", slidesPerView: "auto", spaceBetween: 12 },
              // Vertical rail: thumbnails stacked flush (no gap), count driven by
              // each slide's own height ("auto"). In FILL mode that height is set
              // inline to railHeight/fitCount so N whole tiles fill the locked
              // column; otherwise it's the square per-tier height class.
              1024: { direction: "vertical", slidesPerView: "auto", spaceBetween: 0 },
            }}
            // ≥1024 the rail is `flex-1` and fills whatever the fixed-height column
            // leaves after the arrows — that's what makes arrow+rail+arrow === the
            // image height exactly. `min-h-0` lets it shrink so Swiper can detect
            // overflow and scroll. The max-h tiers are a pre-hydration guard (before
            // the column's measured height lands) so a many-image rail doesn't flash
            // full-content-tall.
            //
            // <540 PRE-INIT GUARD: phones use slidesPerView:3, but slide widths are
            // set by Swiper in JS — before hydration each `.swiper-slide{width:100%}`
            // so the active thumb balloons to full width and the strip stacks (the
            // reload flash). Lock each slide to 1/3 width UNTIL Swiper adds
            // `.swiper-initialized`, so the first server paint already shows the small
            // 3-up row. Once initialized the `:not(...)` no longer matches and
            // Swiper's computed inline width takes over — no effect on runtime layout.
            // ≥540 doesn't need this (slides carry an explicit `!w-[112px]`/rail width).
            //
            // SAFARI iOS FIX: phones (<540) size each square slide via `aspect-square
            // !h-auto` — height derived from the Swiper-set width. The wrapper is a
            // flex row whose default `align-items: stretch` makes WebKit stretch the
            // slide to the row's content height INSTEAD of honoring aspect-ratio, so
            // the active (red-bordered) thumbnail balloons into a tall rectangle on
            // iOS Safari (Chrome resolves it correctly). Force `items-start` on the
            // wrapper at <540 so slides are not stretched and aspect-ratio governs the
            // height → true squares cross-browser. Scoped to phones; the ≥540 fixed-px
            // tiles and the ≥1024 vertical rail are unaffected.
            className="max-[539px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/3 max-[539px]:[&_.swiper-wrapper]:items-start min-[1024px]:flex-1 min-[1024px]:min-h-0 min-[1024px]:max-h-[470px] min-[1536px]:max-h-[598px] min-[1920px]:max-h-[738px]"
          >
            {allItems.map((item, index) => {
              const active = index === activeIndex;
              // Tile = square thumbnail frame. Border lives on this wrapper <div>
              // (not the <img>), so it sidesteps the global `img{border-style:none}`
              // rule from wp-theme-product.css without needing a !border-solid hack.
              // Border width stays a constant 2px (color toggles) → no layout shift
              // when the active thumb changes; box-border keeps the frame inside the
              // fixed slide box. Inner padding gives a clean white gutter so the red
              // active border never touches the product image.
              // !box-border (important): the WP-era Swiper CSS sets
              // `.swiper-wrapper{box-sizing:content-box}` and the WP reset makes
              // box-sizing INHERIT, so the slide + this tile would otherwise compute
              // as content-box — the 2px border then grows the tile PAST the rail's
              // overflow:hidden edge and the right border gets clipped (measured:
              // tile right 373 vs rail right 360). Forcing border-box keeps the whole
              // frame, borders included, inside the slide box. Constant 2px border
              // (color toggles) → no layout shift; p-1 gives a clean white gutter.
              const tileClass = cn(
                // Border stays a constant 2px (only the COLOR toggles) so switching
                // the active thumb never shifts layout. Inactive = transparent (no
                // visible frame); active = brand red.
                "w-full !box-border border-2 p-1 transition-colors",
                // FILL mode slides are taller than a square (railH/fitCount), so the
                // tile must be a fixed SQUARE (aspect-square, centered by the slide)
                // rather than h-full — otherwise it stretches tall like the slide.
                // Everywhere else the slide IS square, so h-full = square.
                verticalFill ? "aspect-square" : "h-full",
                active ? "border-brand" : "border-transparent",
              );
              // Slide also forced to border-box (same inherited-content-box trap) so
              // its !px-[2px] inset stays INSIDE the rail width instead of widening
              // the slide — guarantees the active red frame's left/right edges show.
              // Phones (<540): 3 squares per view — Swiper sets the slide WIDTH from
              // slidesPerView:3, and aspect-square + !h-auto makes the height follow
              // it (true square). 540–1023: fixed 112×112 squares (auto count) so they
              // stay a sensible size instead of ballooning. ≥1024: square via the
              // per-tier !h-* (width comes from the rail column) — but ONLY when the
              // rail does NOT overflow. In FILL mode the height comes from the
              // --bb-thumb-h CSS var (railHeight/fitCount) instead.
              //
              // Why a CSS var + !important class and NOT an inline height: with
              // slidesPerView "auto" AND a breakpoints config that sets slidesPerView,
              // Swiper's updateSlides RESETS each slide's inline main-axis size
              // (`slide.style.height = ''` in vertical) before measuring — that wipes
              // any inline height we set. A custom property survives the reset, and
              // the height class below re-applies it as height:var() with !important,
              // which Swiper then reads back as the slide size. (The original square
              // rail worked for the same reason: a height class, not inline.)
              const slideClass = cn(
                "cursor-pointer !box-border max-[539px]:aspect-square max-[539px]:!h-auto min-[540px]:max-[1023px]:!w-[112px] min-[540px]:max-[1023px]:!h-[112px] min-[1024px]:!px-[2px]",
                verticalFill
                  // FILL: slide is railH/fitCount tall and centers the square tile, so
                  // the surplus (slide − square) reads as an even gap above/below.
                  ? "min-[1024px]:!h-[var(--bb-thumb-h)] min-[1024px]:flex min-[1024px]:items-center min-[1024px]:justify-center"
                  : "min-[1024px]:!h-[130px] min-[1536px]:!h-[150px] min-[1920px]:!h-[170px]",
              );
              // FILL mode only: feed the per-tile height to the class above via a
              // custom property (Swiper won't clear it, unlike inline `height`).
              const slideStyle = verticalFill
                ? ({ "--bb-thumb-h": `${thumbFillH}px` } as CSSProperties)
                : undefined;

              if (item.kind === "video") {
                return (
                  <SwiperSlide
                    key={itemKey(item, index)}
                    className={slideClass}
                    style={slideStyle}
                    onClick={() => mainRef.current?.slideTo(index)}
                  >
                    <div className={cn(tileClass, "relative bg-black")}>
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
                  className={slideClass}
                  style={slideStyle}
                  onClick={() => mainRef.current?.slideTo(index)}
                >
                  <div className={cn(tileClass, "bg-white")}>
                    <MediaImage
                      image={item.asset}
                      altFallback={altFallback}
                      width={220}
                      height={220}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>

          {showThumbArrows && (
            <button
              type="button"
              className="absolute right-0 top-1/2 z-[2] [transform:translateY(-50%)] min-[1024px]:static min-[1024px]:[transform:none] min-[1024px]:w-full min-[1024px]:h-11 min-[1024px]:shrink-0 flex items-center justify-center w-9 h-9 max-md:w-10 max-md:h-10 cursor-pointer text-black transition-colors hover:text-[var(--bb-text-brand)] min-[1024px]:hover:bg-[var(--bb-bg-surface-raised)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]"
              aria-label={tA("thumbScrollDown")}
              onClick={() => thumbsSwiper?.slideNext()}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="max-[1023px]:[transform:rotate(-90deg)]">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className={cn("relative min-w-0 max-[1023px]:order-1", count <= 1 && "col-span-full")}>
        <div
          ref={mainBoxRef}
          className="relative w-full aspect-square overflow-hidden bg-white max-[1023px]:max-w-[460px] max-[1023px]:mx-auto max-md:border max-md:border-border max-md:bg-[var(--bb-bg-surface-raised)]"
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
