"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";

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
 * img fill is handled by CSS min-height: 56.25vw on .bb-main-banner-img.
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
    <picture className="bb-main-banner-picture">
      {hasMobileImg && (
        <source media="(max-width: 767px)" srcSet={slide.mobileSrc} />
      )}
      <img
        src={slide.desktopSrc}
        alt={slide.alt}
        className="bb-main-banner-img"
        loading="eager"
        draggable={false}
      />
    </picture>
  );

  const copy = (
    <div className="bb-main-banner-copy">
      <p className="bb-main-banner-kicker">{slide.productCode || slide.categoryName || "BIGBIKE"}</p>
      <p className="bb-main-banner-title">{slide.productName || slide.categoryName || "BigBike"}</p>
      <span>Mua ngay</span>
    </div>
  );

  if (!slide.href) {
    return (
      <div className="-swiper-lazy bb-main-banner-link" aria-label={slideLabel}>
        {picture}
        {copy}
      </div>
    );
  }

  return (
    <Link
      href={slide.href}
      className="-swiper-lazy bb-main-banner-link"
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
      className="bb-main-banner"
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
            className="bb-main-banner-arrow bb-main-banner-arrow-prev"
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="Slide trước"
          >
            <svg width="20" height="40" viewBox="0 0 20 40" fill="none" aria-hidden="true">
              <polyline points="16,4 4,20 16,36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="bb-main-banner-arrow bb-main-banner-arrow-next"
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          >
            <svg width="20" height="40" viewBox="0 0 20 40" fill="none" aria-hidden="true">
              <polyline points="4,4 16,20 4,36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="bb-main-banner-pagination">
            <span>{activeIndex + 1}/{count}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
