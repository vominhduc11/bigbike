"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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

function enforceHorizontalTrack(swiper: SwiperType | null) {
  if (!swiper?.wrapperEl) return;

  swiper.wrapperEl.style.display = "flex";
  swiper.wrapperEl.style.flexDirection = "row";
  swiper.wrapperEl.style.flexWrap = "nowrap";
  swiper.wrapperEl.style.height = "100%";

  Array.from(swiper.wrapperEl.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    child.style.height = "100%";
    child.style.flexShrink = "0";
  });
}

function HeroSlideView({ slide }: { slide: HeroSlide }) {
  const style = {
    backgroundImage: `url("${slide.desktopSrc}")`,
    backgroundSize: "cover",
    backgroundPosition: "top center",
    "--bb-mobile-banner-bg": `url("${slide.mobileSrc ?? slide.desktopSrc}")`,
  } as CSSProperties & Record<"--bb-mobile-banner-bg", string>;

  if (!slide.href) {
    return (
      <div className="-swiper-lazy bb-main-banner-link" style={style}>
        <span style={{ backgroundImage: `url("${slide.desktopSrc}")`, backgroundPosition: "top center" }} />
      </div>
    );
  }

  return (
    <Link href={slide.href} className="-swiper-lazy bb-main-banner-link" style={style}>
      <span style={{ backgroundImage: `url("${slide.desktopSrc}")`, backgroundPosition: "top center" }} />
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

  const activeSlide = slides[activeIndex] ?? slides[0];

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
          style={{ width: "100%", height: "100%" }}
        >
          {slides.map((slide) => (
            <SwiperSlide
              key={slide.id}
              style={{ width: "100%", height: "100%" }}
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
            className="swiper-button-prev"
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="Slide trước"
          />
          <button
            type="button"
            className="swiper-button-next"
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          />
          <div
            className="swiper-pagination"
            product-code={activeSlide.productCode || activeSlide.categoryName || "BIGBIKE"}
          >
            {activeIndex + 1} / {count}
          </div>
        </>
      ) : null}
    </div>
  );
}
