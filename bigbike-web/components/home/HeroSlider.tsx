"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
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
  const image = (
    <picture>
      {slide.mobileSrc && <source media="(max-width: 767px)" srcSet={slide.mobileSrc} />}
      {/* Legacy WP uses the banner as the slide surface; keep this as a plain image, not a text hero. */}
      <img
        src={slide.desktopSrc}
        alt={slide.alt}
        className="bb-main-banner-img"
        loading="eager"
        decoding="async"
      />
    </picture>
  );

  if (!slide.href) {
    return <div className="bb-main-banner-link">{image}</div>;
  }

  return (
    <Link href={slide.href} className="bb-main-banner-link">
      {image}
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

  if (count === 0) {
    return (
      <section id="main-banner" className="bb-main-banner bb-main-banner-fallback" aria-label="BigBike">
        <Link href="/san-pham/" className="bb-main-banner-link">
          <img
            src="/wp/banner-ads.jpg"
            alt="BigBike"
            className="bb-main-banner-img"
            loading="eager"
            decoding="async"
          />
        </Link>
      </section>
    );
  }

  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <section
      id="main-banner"
      className="bb-main-banner"
      aria-roledescription="carousel"
      aria-label="BigBike"
    >
      {mounted ? (
        <Swiper
          modules={[Autoplay]}
          loop={count > 1}
          speed={600}
          autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
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
            <SwiperSlide key={slide.id} style={{ width: "100%", height: "100%" }}>
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
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="bb-main-banner-arrow bb-main-banner-arrow-next"
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          >
            <span aria-hidden="true">›</span>
          </button>
          <div className="bb-main-banner-pagination">
            <span>{(activeIndex + 1).toString().padStart(2, "0")}</span>
            {activeSlide.productCode ? <span>{activeSlide.productCode}</span> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
