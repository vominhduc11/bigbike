"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, FreeMode, Keyboard, Thumbs } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/thumbs";
import { MediaImage } from "@/components/ui/MediaImage";
import type { GalleryMedia, ImageAsset, VideoAsset } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { useResponsiveValue } from "@/lib/hooks/useResponsiveValue";

// Hover-to-zoom: di chuột vào ảnh chính hiện kính lúp + khung phóng to bên phải.
// Chỉ bật trên thiết bị có chuột thật (hover + pointer mịn) và màn đủ rộng cho
// khung phóng to nằm bên phải (>=1181px) — đúng như behavior cũ trước migration.
const ZOOM_FACTOR = 2.5;
const LENS_SIZE_PCT = 100 / ZOOM_FACTOR;

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

// V248: dải media (gallery) giờ chứa cả ảnh lẫn video. Tách 1 danh sách GalleryMedia
// thành { images, videos } để phần render bên dưới (vốn dùng ImageAsset[]/VideoAsset[]) chạy nguyên.
function splitGalleryMedia(items: GalleryMedia[] | undefined): { images: ImageAsset[]; videos: VideoAsset[] } {
  const images: ImageAsset[] = [];
  const videos: VideoAsset[] = [];
  for (const m of items ?? []) {
    if (m?.mediaType === "video") {
      const v: VideoAsset = {
        url: m.videoUrl ?? undefined,
        provider: m.provider ?? undefined,
        thumbnail: m.image ?? null,
        title: m.image?.alt ?? undefined,
      };
      if (isSupportedVideo(v)) videos.push(v);
    } else if (m?.image) {
      images.push(m.image);
    }
  }
  return { images, videos };
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
  gallery: GalleryMedia[];
  altFallback: string;
  variantImage?: ImageAsset | null;
  variantGallery?: GalleryMedia[];
  variantKey?: string | null;
};

export function ProductGallery({
  mainImage,
  gallery,
  altFallback,
  variantImage,
  variantGallery,
  variantKey,
}: ProductGalleryProps) {
  const tA = useTranslations("A11y");
  // V248: tách ảnh/video từ chính dải gallery (sản phẩm hoặc biến thể) — không còn nhận prop `videos`.
  // Video giờ thuộc về gallery của màu đang xem (chưa chọn màu → gallery sản phẩm).
  const variantSplit = splitGalleryMedia(variantGallery);
  const productSplit = splitGalleryMedia(gallery);
  const hasVariantGallery = variantSplit.images.length > 0;
  const stripBody: ImageAsset[] = hasVariantGallery ? variantSplit.images : productSplit.images;
  const galleryVideos: VideoAsset[] = hasVariantGallery ? variantSplit.videos : productSplit.videos;
  // Khi đã chọn màu (có variantGallery): ảnh chính = ẢNH ĐẦU của gallery màu đó
  // (variantGallery[0]), KHÔNG dùng variant.image làm cover. Sau khử trùng bên dưới,
  // dải ảnh chính là gallery của màu theo đúng thứ tự. Khi chưa chọn màu thì giữ
  // nguyên: ảnh đại diện sản phẩm (variantImage null → mainImage) đứng đầu.
  const coverImage: ImageAsset | null = hasVariantGallery
    ? (variantSplit.images[0] ?? variantImage ?? mainImage ?? null)
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

  // Video lấy TỪ chính dải gallery đang xem (V248): chưa chọn màu → video của gallery sản phẩm;
  // chọn màu → video của gallery màu đó. Chưa chọn màu: video đứng đầu (như cũ); đã chọn màu:
  // ảnh của màu lên trước rồi dồn video xuống cuối.
  const videoItems: GalleryItem[] = galleryVideos
    .map((asset): GalleryItem => ({ kind: "video", asset }));
  const imageItems: GalleryItem[] = images.map((asset): GalleryItem => ({ kind: "image", asset }));
  const allItems: GalleryItem[] =
    variantKey == null ? [...videoItems, ...imageItems] : [...imageItems, ...videoItems];

  const currentVariantKey = variantKey ?? "__no_variant__";
  // Main image + thumbnails are two linked Swiper instances (Thumbs module):
  // clicking/scrolling thumbs drives the main carousel, and the main carousel
  // keeps the active thumbnail highlighted and scrolled into view automatically.
  // `activeIndex` mirrors the main carousel only to paint the active thumb border.
  const [activeIndex, setActiveIndex] = useState(0);
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
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

  // Dải thumbnail luôn NẰM NGANG bên dưới ảnh chính ở mọi kích thước màn hình,
  // hiển thị TỐI ĐA 5 ô cùng lúc: điện thoại nhỏ 3 → tablet 4 → ≥768px là 5. Ô
  // ảnh tự co theo bề rộng để vừa đúng số đó (không cố định px → không tràn quá 5).
  // SSR mặc định 3 (mức nhỏ nhất), sau hydrate sẽ tự chỉnh đúng theo bề rộng thật.
  const thumbsPerView = useResponsiveValue(
    (width: number) => (width < 540 ? 3 : width < 768 ? 4 : 5),
    3,
  );
  // Mũi tên trái/phải chỉ hiện khi số ảnh vượt số ô đang hiển thị (cần cuộn).
  const showThumbArrows = count > thumbsPerView;

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
    <div className="flex flex-col gap-[10px] min-w-0 w-full max-md:gap-2">
      {/* Ảnh chính (carousel) nằm trên cùng. */}
      <div className="relative min-w-0">
        <div
          ref={mainBoxRef}
          // Ảnh chính LUÔN lấp đầy chiều ngang khu vực của nó (square theo bề rộng) ở
          // mọi kích thước — không giới hạn px/canh giữa, nên khi responsive không còn
          // khoảng trắng hai bên.
          className="relative w-full aspect-square overflow-hidden bg-white max-md:border max-md:border-border max-md:bg-[var(--bb-bg-surface-raised)]"
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

      {count > 1 && (
        // Dải thumbnail nằm ngang ngay dưới ảnh chính. Mũi tên trái/phải chỉ render
        // khi thumbnail thực sự cần cuộn (`showThumbArrows`). `px-9` chừa chỗ cho 2
        // mũi tên đặt absolute hai bên.
        <div className="relative min-w-0 px-9 max-md:px-10">
          {showThumbArrows && (
            <button
              type="button"
              className="absolute left-0 top-1/2 z-[2] [transform:translateY(-50%)] flex items-center justify-center w-9 h-9 max-md:w-10 max-md:h-10 cursor-pointer text-black transition-colors hover:text-[var(--bb-text-brand)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]"
              aria-label={tA("thumbScrollUp")}
              onClick={() => thumbsSwiper?.slidePrev()}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="[transform:rotate(-90deg)]">
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
              // Hiển thị TỐI ĐA 5 ô cùng lúc, scale theo bề rộng: <540 là 3 ô,
              // 540–767 là 4 ô, ≥768 là 5 ô. Mỗi ô tự co bằng (bề rộng − khoảng
              // cách)/N nên không bao giờ hiện quá 5 ô — ảnh thứ 6 trở đi phải cuộn.
              540: { slidesPerView: 4, spaceBetween: 10 },
              768: { slidesPerView: 5, spaceBetween: 12 },
            }}
            // PRE-INIT GUARD: slide widths are set by Swiper in JS — before hydration
            // each `.swiper-slide{width:100%}` so the active thumb balloons to full
            // width and the strip stacks (the reload flash). Lock each slide to the
            // per-breakpoint fraction (1/3 → 1/4 → 1/5) UNTIL Swiper adds
            // `.swiper-initialized`, so the first server paint already shows the
            // correct N-up row. Once initialized the `:not(...)` no longer matches and
            // Swiper's computed inline width takes over — no effect on runtime layout.
            //
            // SAFARI iOS FIX: each square slide is sized via `aspect-square !h-auto` —
            // height derived from the Swiper-set width. The wrapper is a flex row whose
            // default `align-items: stretch` makes WebKit stretch the slide to the
            // row's content height INSTEAD of honoring aspect-ratio, so the active
            // (red-bordered) thumbnail balloons into a tall rectangle on iOS Safari
            // (Chrome resolves it correctly). Force `items-start` on the wrapper so
            // slides are not stretched and aspect-ratio governs the height → true
            // squares cross-browser.
            className={cn(
              "[&_.swiper-wrapper]:items-start",
              "[&:not(.swiper-initialized)_.swiper-slide]:!w-1/3",
              "min-[540px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/4",
              "min-[768px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/5",
            )}
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
              // overflow:hidden edge and the right border gets clipped. Forcing
              // border-box keeps the whole frame, borders included, inside the slide
              // box. Constant 2px border (color toggles) → no layout shift; p-1 gives
              // a clean white gutter.
              const tileClass = cn(
                // Border stays a constant 2px (only the COLOR toggles) so switching
                // the active thumb never shifts layout. Inactive = transparent (no
                // visible frame); active = brand red.
                "w-full h-full !box-border border-2 p-1 transition-colors",
                active ? "border-brand" : "border-transparent",
              );
              // Slide forced to border-box (inherited-content-box trap). Swiper sets
              // the slide WIDTH from slidesPerView (3/4/5 theo breakpoint); aspect-square
              // + !h-auto làm chiều cao bám theo bề rộng đó → ô vuông thật, tự co theo
              // số ô hiển thị, không cố định px.
              const slideClass = "cursor-pointer !box-border aspect-square !h-auto";

              if (item.kind === "video") {
                return (
                  <SwiperSlide
                    key={itemKey(item, index)}
                    className={slideClass}
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
              className="absolute right-0 top-1/2 z-[2] [transform:translateY(-50%)] flex items-center justify-center w-9 h-9 max-md:w-10 max-md:h-10 cursor-pointer text-black transition-colors hover:text-[var(--bb-text-brand)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]"
              aria-label={tA("thumbScrollDown")}
              onClick={() => thumbsSwiper?.slideNext()}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="[transform:rotate(-90deg)]">
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
