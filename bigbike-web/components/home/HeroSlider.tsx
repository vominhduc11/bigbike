"use client";
import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import Image from "next/image";
import Link from "next/link";
import "swiper/css";

export type HeroSlide = {
  id: string;
  desktopSrc: string;
  mobileSrc?: string;
  alt: string;
  href: string;
};

type HeroSliderProps = {
  slides: HeroSlide[];
};

export function HeroSlider({ slides }: HeroSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const swiperRef = useRef<SwiperType | null>(null);

  const count = slides.length;

  if (count === 0) {
    return (
      <section className="wp-hero-fallback" aria-label="BigBike">
        <div className="wp-hero-fallback-content">
          <span className="wp-hero-kicker">BIGBIKE · SINCE 2013</span>
          <p className="wp-hero-title">
            Gear moto chính hãng
            <br />
            <em>cho rider đi đường dài</em>
          </p>
          <p className="wp-hero-sub">
            Mũ bảo hiểm, áo giáp, găng tay, intercom và phụ kiện touring được
            chọn lọc theo tinh thần garage cao cấp: rõ ràng, đáng tin, tư vấn kỹ.
          </p>
          <Link href="/san-pham/" className="wp-hero-cta">
            Xem sản phẩm <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="wp-hero-fallback-mark" aria-hidden="true">
          <Image
            src="/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png"
            alt=""
            fill
            sizes="(max-width: 900px) 70vw, 42vw"
          />
        </div>
      </section>
    );
  }

  return (
    <div className="wp-slider" aria-roledescription="carousel">
      <Swiper
        modules={[Autoplay]}
        loop={true}
        speed={600}
        autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
        style={{ width: "100%", height: "100%" }}
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={slide.id} style={{ width: "100%", height: "100%" }}>
            <Link
              href={slide.href}
              tabIndex={i !== activeIndex ? -1 : 0}
              style={{ display: "block", width: "100%", height: "100%" }}
            >
              <picture className="wp-slide-picture">
                {slide.mobileSrc && (
                  <source media="(max-width: 768px)" srcSet={slide.mobileSrc} />
                )}
                <img
                  src={slide.desktopSrc || ""}
                  alt={slide.alt}
                  className="wp-slide-img"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                />
              </picture>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>

      {count > 1 && (
        <>
          <button
            className="wp-slider-btn wp-slider-prev"
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="Slide trước"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11.5 3.5L6 9l5.5 5.5" />
            </svg>
          </button>
          <button
            className="wp-slider-btn wp-slider-next"
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6.5 3.5L12 9l-5.5 5.5" />
            </svg>
          </button>
          <div className="wp-slider-dots" role="tablist" aria-label="Điều hướng slide">
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Slide ${i + 1}`}
                className={`wp-slider-dot${i === activeIndex ? " is-active" : ""}`}
                onClick={() => swiperRef.current?.slideToLoop(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
