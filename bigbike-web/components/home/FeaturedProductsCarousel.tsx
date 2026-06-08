"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";
import { cn } from "@/lib/utils";
import { useResponsiveValue } from "@/lib/hooks/useResponsiveValue";

type Props = { products: Product[] };

function resolveSlidesPerView(width: number) {
  if (width >= 2560) return 6;
  if (width >= 1536) return 5;
  if (width >= 768)  return 4;  // desktop md+ — matches ProductCard md/2xl/2560 flex tiers (4/5/6) & WP 767 breakpoint.
  if (width >= 380)  return 2;  // 380–767px: paged 2-up (WP main-product-slide / product-related-bigbike breakpoint 380).
  return 1;                     // <380px: paged 1-up (WP breakpoint 320).
}

function resolveGap(slidesPerView: number) {
  if (slidesPerView >= 4) return 30;
  if (slidesPerView === 3) return 24;
  if (slidesPerView === 2) return 20;
  return 0;
}

// Arrows sit OUTSIDE the card rail (in the page gutter) only where there is room
// for them: the .bb-container side-margin reaches the 64px (-left-16) offset at
// viewport ≥ 1328px (margin = (1328-1200)/2 = 64). Below that the margin is too
// small, so the −64px arrows would bleed past the viewport edge and get clipped
// by the global overflow-x guard. Under 1328px we therefore overlay compact
// arrows just inside the carousel edges (CSS-only, SSR-safe — no width JS).
// Arrow color stays foreground (no hover-red) — the legacy `.bb-home-products-parity
// .bb-fp-arrow:hover{color:#000}` override pinned it black, so we drop hover:text-brand.
// Hidden ≤767: mobile is paged via touch-swipe + pagination dots (WP parity — WP hid
// the swiper arrows on mobile and relied on Swiper's touch drag).
const CAR_BTN =
  "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-md:hidden [&>svg]:h-9 [&>svg]:w-9 min-[1328px]:h-24 min-[1328px]:w-24 min-[1328px]:[&>svg]:h-16 min-[1328px]:[&>svg]:w-16";

export function FeaturedProductsCarousel({ products }: Props) {
  const t = useTranslations("Common");
  const slidesPerView = useResponsiveValue(resolveSlidesPerView, 4);
  const [page, setPage] = useState(0);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(products.length / slidesPerView)),
    [products.length, slidesPerView],
  );
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  // Gap drives both the inter-card spacing and the per-page translate offset, so
  // both come from the single resolveGap() source (WP: 0 / 20 / 30 by tier).
  const gap = resolveGap(slidesPerView);
  const offsetGap = currentPage * gap;

  // Touch-swipe paging (WP relied on Swiper's drag). Mouse drag is ignored so the
  // desktop arrows/dots stay the only pointer controls and text selection works.
  const dragStartX = useRef<number | null>(null);

  if (products.length === 0) return null;

  // Paged at every viewport (WP main-product-slide: 1-up <380, 2-up 380–767, 4-up
  // ≥767; Next adds 5-up ≥1536 / 6-up ≥2560). Navigation wraps around (WP loop).
  const hasMultiplePages = pageCount > 1;
  const goPrev = () => setPage((currentPage - 1 + pageCount) % pageCount);
  const goNext = () => setPage((currentPage + 1) % pageCount);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!hasMultiplePages || event.pointerType === "mouse") return;
    dragStartX.current = event.clientX;
  };
  const onPointerEnd = (event: React.PointerEvent) => {
    const start = dragStartX.current;
    dragStartX.current = null;
    if (start == null) return;
    const dx = event.clientX - start;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <div className="relative">
      {hasMultiplePages && (
        <button
          className={cn(CAR_BTN, "left-0 min-[1328px]:-left-16")}
          type="button"
          onClick={goPrev}
          aria-label={t("scrollPrev")}
        >
          <ChevronLeft size={64} />
        </button>
      )}

      <div
        className="relative w-full overflow-hidden"
        style={hasMultiplePages ? { touchAction: "pan-y" } : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerEnd}
        onPointerCancel={() => { dragStartX.current = null; }}
      >
        <div
          className="bb-fp-page-track"
          style={{ gap: `${gap}px`, transform: `translate3d(calc(-${currentPage * 100}% - ${offsetGap}px), 0, 0)` }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} variant="featured" surface="home" />
          ))}
        </div>
      </div>

      {hasMultiplePages && (
        <button
          className={cn(CAR_BTN, "right-0 min-[1328px]:-right-16")}
          type="button"
          onClick={goNext}
          aria-label={t("scrollNext")}
        >
          <ChevronRight size={64} />
        </button>
      )}

      {hasMultiplePages && (
        <div
          className="relative flex justify-center gap-[5px] mt-[60px] max-md:mt-[20px]"
          aria-label={t("carouselPagination")}
        >
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              className={cn(
                "inline-block h-[10px] w-[10px] m-0 mx-[5px] p-0 border-none !rounded-[50%] bg-border-default opacity-100 [transition:all_0.3s_ease] cursor-pointer",
                index === currentPage && "w-[20px] !rounded-[100px] bg-brand",
              )}
              type="button"
              onClick={() => setPage(index)}
              aria-label={t("carouselPage", { page: index + 1 })}
              aria-current={index === currentPage ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
