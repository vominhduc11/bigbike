"use client";
import { useState, useEffect, useCallback } from "react";
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
  const [current, setCurrent] = useState(0);
  const count = slides.length;

  const next = useCallback(() => setCurrent((c) => (c + 1) % count), [count]);
  const prev = () => setCurrent((c) => (c - 1 + count) % count);

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [count, next]);

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
            unoptimized
          />
        </div>
      </section>
    );
  }

  return (
    <div className="wp-slider" aria-roledescription="carousel">
      <div
        className="wp-slider-track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={slide.id} className="wp-slide" aria-hidden={i !== current}>
            <Link href={slide.href} tabIndex={i !== current ? -1 : 0}>
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

      {count > 1 && (
        <>
          <button
            className="wp-slider-btn wp-slider-prev"
            onClick={prev}
            aria-label="Slide trước"
          >
            ‹
          </button>
          <button
            className="wp-slider-btn wp-slider-next"
            onClick={next}
            aria-label="Slide tiếp"
          >
            ›
          </button>
          <span className="wp-slider-counter" aria-live="polite">
            {current + 1} / {count}
          </span>
        </>
      )}
    </div>
  );
}
