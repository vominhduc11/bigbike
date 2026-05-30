"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";
import { cn } from "@/lib/utils";

type Props = { products: Product[] };

function resolveSlidesPerView(width: number) {
  if (width >= 2560) return 6;
  if (width >= 1536) return 5;
  if (width >= 1024) return 4;  // desktop lg+ (was 767 — too many cards at tablet)
  if (width >= 640)  return 3;  // tablet sm-md: 3 cards fits ~720px comfortably
  if (width >= 380)  return 2;
  return 1;
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
const CAR_BTN =
  "bb-fp-arrow absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&>svg]:h-9 [&>svg]:w-9 min-[1328px]:h-24 min-[1328px]:w-24 min-[1328px]:[&>svg]:h-16 min-[1328px]:[&>svg]:w-16";

export function FeaturedProductsCarousel({ products }: Props) {
  const t = useTranslations("Common");
  const [slidesPerView, setSlidesPerView] = useState(4);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const updateSlidesPerView = () => {
      setSlidesPerView(resolveSlidesPerView(window.innerWidth));
    };

    updateSlidesPerView();
    window.addEventListener("resize", updateSlidesPerView);
    return () => window.removeEventListener("resize", updateSlidesPerView);
  }, []);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(products.length / slidesPerView)),
    [products.length, slidesPerView],
  );
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const offsetGap = currentPage * resolveGap(slidesPerView);

  // On mobile (≤767px) CSS overrides the track to native horizontal scroll
  // (overflow-x: auto, transform: none !important). Skip JS-driven navigation.
  const isMobileScroll = slidesPerView <= 2;

  if (products.length === 0) return null;

  const hasMultiplePages = !isMobileScroll && pageCount > 1;
  const goPrev = () => setPage((currentPage - 1 + pageCount) % pageCount);
  const goNext = () => setPage((currentPage + 1) % pageCount);

  return (
    <div className="bb-fp-carousel relative">
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

      <div className="bb-fp-viewport relative w-full overflow-hidden">
        <div
          className="bb-fp-page-track"
          style={isMobileScroll ? undefined : { transform: `translate3d(calc(-${currentPage * 100}% - ${offsetGap}px), 0, 0)` }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} variant="featured" />
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
        <div className="bb-fp-pagination" aria-label={t("carouselPagination")}>
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              className={cn(
                "swiper-pagination-bullet",
                index === currentPage && "swiper-pagination-bullet-active",
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
