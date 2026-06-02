"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/ui/MediaImage";
import { CarouselArrow } from "@/components/ui/icons";
import type { ImageAsset, VideoAsset } from "@/lib/contracts/public";
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
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  const count = images.length;
  const selectedIndex =
    selection.variantKey === currentVariantKey
      ? Math.min(selection.index, Math.max(0, count - 1))
      : 0;
  const selectedImage = images[selectedIndex] ?? null;

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

  return (
    <div className="grid grid-cols-[minmax(0,25%)_minmax(0,75%)] gap-[30px] min-w-0 max-[1024px]:grid-cols-[1fr] max-[1024px]:gap-[10px] max-[1024px]:w-full max-md:gap-2">
      {count > 1 && (
        <div className="relative h-[500px] py-8 min-w-0 max-[1024px]:h-[120px] max-[1024px]:px-8 max-[1024px]:py-0 max-md:h-[82px] max-md:px-7">
          <button
            type="button"
            className="absolute left-1/2 top-0 z-[2] w-7 h-7 [transform:translateX(-50%)] border-none bg-transparent text-black cursor-pointer max-[1024px]:left-0 max-[1024px]:top-1/2 max-[1024px]:[transform:translateY(-50%)]"
            aria-label="Ảnh trước"
            onClick={() => scrollThumbsBy("prev")}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" className="max-[1024px]:[transform:rotate(-90deg)]">
              <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            ref={thumbsRef}
            className="h-full flex flex-col gap-2.5 overflow-hidden scroll-smooth max-[1024px]:flex-row max-[1024px]:gap-[30px] max-md:gap-2 max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={image.id ?? image.url ?? index}
                  type="button"
                  className="flex-[0_0_calc((100%_-_20px)_/_3)] h-[calc((100%_-_20px)_/_3)] min-h-0 py-[5px] border-none bg-white cursor-pointer max-[1024px]:flex-[0_0_calc((100%_-_60px)_/_3)] max-[1024px]:w-[calc((100%_-_60px)_/_3)] max-[1024px]:h-[120px] max-md:flex-[0_0_76px] max-md:w-[76px] max-md:h-[76px] max-md:p-0"
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Xem ảnh ${index + 1}`}
                  aria-pressed={active}
                >
                  <MediaImage
                    image={image}
                    altFallback={altFallback}
                    width={220}
                    height={220}
                    className={cn(
                      "w-full h-full object-contain border",
                      active ? "border-[var(--bb-border-control)]" : "border-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="absolute left-1/2 bottom-0 z-[2] w-7 h-7 [transform:translateX(-50%)] border-none bg-transparent text-black cursor-pointer max-[1024px]:left-auto max-[1024px]:right-0 max-[1024px]:top-1/2 max-[1024px]:bottom-auto max-[1024px]:[transform:translateY(-50%)]"
            aria-label="Ảnh tiếp"
            onClick={() => scrollThumbsBy("next")}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" className="max-[1024px]:[transform:rotate(-90deg)]">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="relative min-w-0">
        <div className="relative w-full aspect-square flex items-center justify-center overflow-hidden bg-white max-[1024px]:max-h-[380px] max-md:max-h-none max-md:border max-md:border-border max-md:bg-[var(--bb-bg-surface-raised)]">
          <div
            key={selectedImage?.url ?? selectedIndex}
            className="w-full h-full [animation:bb-gallery-fade-in_0.22s_ease]"
          >
            <MediaImage
              image={selectedImage}
              altFallback={altFallback}
              priority
              width={1200}
              height={1200}
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="absolute top-1/2 left-2 z-[3] w-9 h-9 [transform:translateY(-50%)] border-none bg-transparent text-black cursor-pointer max-md:w-11 max-md:h-11"
              aria-label="Ảnh trước"
              onClick={prev}
            >
              <CarouselArrow dir="prev" />
            </button>
            <button
              type="button"
              className="absolute top-1/2 right-2 z-[3] w-9 h-9 [transform:translateY(-50%)] border-none bg-transparent text-black cursor-pointer max-md:w-11 max-md:h-11"
              aria-label="Ảnh tiếp"
              onClick={next}
            >
              <CarouselArrow dir="next" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
