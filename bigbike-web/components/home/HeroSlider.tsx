"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Inlined leaf styling for the WP #main-banner hero. Leaf CSS was removed from
// globals.css; .bb-main-banner/-img/-link/-copy stay as bare e2e markers and the
// swiper-generated DOM keeps its mechanism rules. The arrow svg size is set here
// directly because the old `.bb-main-banner-arrow svg` rule (unlayered) overrode
// the icon's own utilities.
const LINK_CLASS =
  "-swiper-lazy bb-main-banner-link relative block w-full h-full text-inherit no-underline max-md:overflow-hidden max-md:bg-[var(--bb-mobile-shell-bg)]";
const ARROW_BASE =
  "absolute top-1/2 z-10 inline-flex items-center justify-center p-0 [transform:translateY(-50%)] border-none bg-transparent text-white cursor-pointer [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.6))] [transition:opacity_0.15s_ease] opacity-100 hover:opacity-75 focus-visible:[outline:2px_solid_rgba(255,255,255,0.7)] focus-visible:[outline-offset:2px] w-28 h-40 max-md:w-11 max-md:h-16 2xl:w-32 2xl:h-48 3xl:w-40 3xl:h-60 4xl:w-48 4xl:h-72";
const ARROW_ICON =
  "block shrink-0 w-10 h-20 max-md:w-4 max-md:h-8 2xl:w-12 2xl:h-24 3xl:w-[60px] 3xl:h-[120px] 4xl:w-[72px] 4xl:h-36";

export type HeroSlide = {
  id: string;
  desktopSrc: string;
  mobileSrc?: string;
  alt: string;
  href: string;
  productName: string;
  categoryName: string;
  productCode: string;
};

type HeroSliderProps = {
  slides: HeroSlide[];
};

/**
 * Swiper v8 can reset the wrapper to display:block after hydration, stacking
 * slides vertically. This enforces the horizontal flex track declaratively.
 * img fill is handled by inline Tailwind (min-h-[40vw]) on .bb-main-banner-img.
 */
function enforceHorizontalTrack(swiper: SwiperType | null) {
  if (!swiper?.wrapperEl) return;

  swiper.wrapperEl.style.display = "flex";
  swiper.wrapperEl.style.flexDirection = "row";
  swiper.wrapperEl.style.flexWrap = "nowrap";

  Array.from(swiper.wrapperEl.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    child.style.flexShrink = "0";
  });
}

function HeroSlideView({ slide }: { slide: HeroSlide }) {
  const slideLabel =
    [slide.productName || slide.categoryName || slide.alt || "BigBike", slide.productCode]
      .filter(Boolean)
      .join(" - ");

  const hasMobileImg = Boolean(slide.mobileSrc && slide.mobileSrc !== slide.desktopSrc);

  const picture = (
    <picture className="block w-full h-full">
      {hasMobileImg && (
        <source media="(max-width: 767px)" srcSet={slide.mobileSrc} />
      )}
      <img
        src={slide.desktopSrc}
        alt={slide.alt}
        className="bb-main-banner-img block w-full h-full min-h-[40vw] object-cover object-center 3xl:min-h-[min(40vw,1080px)] 4xl:min-h-[min(40vw,1200px)]"
        loading="eager"
        draggable={false}
      />
    </picture>
  );

  const copy = (
    <div className="bb-main-banner-copy hidden">
      <p>{slide.productCode || slide.categoryName || "BIGBIKE"}</p>
      <h2>{slide.productName || slide.categoryName || "BigBike"}</h2>
      <span>Mua ngay</span>
    </div>
  );

  if (!slide.href) {
    return (
      <div className={LINK_CLASS} aria-label={slideLabel}>
        {picture}
        {copy}
      </div>
    );
  }

  return (
    <Link
      href={slide.href}
      className={LINK_CLASS}
      aria-label={slideLabel}
    >
      {picture}
      {copy}
    </Link>
  );
}

export function HeroSlider({ slides }: HeroSliderProps) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);


  const count = slides.length;

  useEffect(() => {
    if (count === 0) {
      console.warn("[HeroSlider] No active home sliders were returned by the backend.");
    }
  }, [count]);

  if (count === 0) {
    return null;
  }

  return (
    <div
      id="main-banner"
      className="bb-main-banner relative w-full h-[max(40vw,300px)] overflow-hidden bg-black max-md:bg-[var(--bb-mobile-shell-bg)] 3xl:max-h-[1080px] 4xl:max-h-[1200px]"
      aria-roledescription="carousel"
      aria-label="BigBike"
    >
      {mounted ? (
        <Swiper
          className="swiper-container js-home-banner"
          loop={count > 1}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            enforceHorizontalTrack(swiper);
          }}
          onSlideChange={(swiper) => {
            enforceHorizontalTrack(swiper);
            setActiveIndex(swiper.realIndex);
          }}
          style={{ width: "100%" }}
        >
          {slides.map((slide) => (
            <SwiperSlide
              key={slide.id}
              style={{ width: "100%" }}
              product-code={slide.productCode || slide.categoryName || "BIGBIKE"}
            >
              <HeroSlideView slide={slide} />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <HeroSlideView slide={slides[0]} />
      )}

      {count > 1 && mounted ? (
        <>
          <button
            type="button"
            className={`${ARROW_BASE} left-6 max-md:left-1 2xl:left-8 3xl:left-12 4xl:left-16`}
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="Slide trước"
          >
            <ChevronLeft aria-hidden="true" className={ARROW_ICON} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${ARROW_BASE} right-6 max-md:right-1 2xl:right-8 3xl:right-12 4xl:right-16`}
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          >
            <ChevronRight aria-hidden="true" className={ARROW_ICON} strokeWidth={2} />
          </button>
          <div className="absolute left-1/2 bottom-[70px] z-10 flex items-end gap-0 w-[min(370px,calc(100%-48px))] [transform:translateX(-50%)] pb-2.5 border-b border-b-[rgba(255,255,255,0.55)] text-white [font-family:var(--bb-font-display)] text-[1rem] leading-[1.2] text-left max-md:hidden">
            <span>{activeIndex + 1}/{count}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
