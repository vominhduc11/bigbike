"use client";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: 30 },
    [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => void emblaApi.off("select", onSelect);
  }, [emblaApi]);

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
          <Link href="/san-pham" className="wp-hero-cta">
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
      <div className="wp-slider-viewport" ref={emblaRef}>
        <div className="wp-slider-track">
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="wp-slide"
              aria-hidden={i !== selectedIndex}
            >
              <Link href={slide.href} tabIndex={i !== selectedIndex ? -1 : 0}>
                <picture className="wp-slide-picture">
                  {slide.mobileSrc && (
                    <source media="(max-width: 768px)" srcSet={slide.mobileSrc} />
                  )}
                  <img
                    src={slide.desktopSrc}
                    alt={slide.alt}
                    className="wp-slide-img"
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                </picture>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            className="wp-slider-btn wp-slider-prev"
            onClick={scrollPrev}
            aria-label="Slide trước"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11.5 3.5L6 9l5.5 5.5" />
            </svg>
          </button>
          <button
            className="wp-slider-btn wp-slider-next"
            onClick={scrollNext}
            aria-label="Slide tiếp"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6.5 3.5L12 9l-5.5 5.5" />
            </svg>
          </button>
          <div
            className="wp-slider-dots"
            role="tablist"
            aria-label="Điều hướng slide"
          >
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === selectedIndex}
                aria-label={`Slide ${i + 1}`}
                className={`wp-slider-dot${i === selectedIndex ? " is-active" : ""}`}
                onClick={() => scrollTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
