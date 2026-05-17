"use client";
import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import Image from "next/image";
import Link from "next/link";
import "swiper/css";
import { cn } from "@/lib/utils";

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
      <section
        aria-label="BigBike"
        className="relative grid min-h-[min(620px,calc(100vh-106px))] grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] items-center gap-[var(--bb-space-12)] overflow-hidden border-0 px-[max(var(--bb-page-padding-desktop),calc((100vw-var(--bb-container-xl))/2))] py-[var(--bb-space-16)] text-white shadow-none max-[900px]:min-h-auto max-[900px]:grid-cols-1 max-[900px]:gap-[var(--bb-space-8)] max-[900px]:px-[var(--bb-page-padding-tablet)] max-[900px]:py-[var(--bb-space-12)] max-[639px]:px-4 max-[639px]:py-8 before:absolute before:inset-x-0 before:bottom-0 before:h-1 before:bg-brand before:content-['']"
        style={{
          background:
            "radial-gradient(circle at 88% 22%, rgba(255, 12, 9, 0.22), transparent 28%), radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.12), transparent 42%), linear-gradient(145deg, #0d0d0d 0%, #171717 48%, #1f1f1f 100%)",
        }}
      >
        <div className="relative z-[2] max-w-[620px] text-inherit">
          <span className="mb-[var(--bb-space-5)] inline-block bg-brand px-[0.8rem] py-[0.35rem] text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)]">
            BIGBIKE · SINCE 2013
          </span>
          <p className="mb-[var(--bb-space-4)] mt-0 font-display text-[var(--bb-text-hero)] font-bold uppercase leading-[45px] tracking-normal text-white max-[639px]:text-lg max-[639px]:leading-[27px] min-[640px]:max-[1023px]:text-2xl min-[640px]:max-[1023px]:leading-9">
            Gear moto chính hãng
            <br />
            <em className="not-italic text-brand">cho rider đi đường dài</em>
          </p>
          <p className="mb-[var(--bb-space-6)] mt-0 max-w-[520px] text-base leading-6 text-[#cecece]">
            Mũ bảo hiểm, áo giáp, găng tay, intercom và phụ kiện touring được
            chọn lọc theo tinh thần garage cao cấp: rõ ràng, đáng tin, tư vấn kỹ.
          </p>
          <Link
            href="/san-pham/"
            className="inline-flex min-h-12 items-center gap-2 bg-brand px-[var(--bb-space-6)] text-base font-semibold uppercase leading-6 text-white no-underline transition-[background-color,transform] duration-150 hover:scale-[1.02] hover:bg-[var(--bb-brand-primary-hover)]"
          >
            Xem sản phẩm <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div
          aria-hidden="true"
          className="relative z-[1] h-[min(460px,45vw)] min-h-[300px] opacity-95 [filter:drop-shadow(0_32px_54px_rgba(0,0,0,0.62))] max-[900px]:h-[300px] max-[900px]:min-h-[240px] max-[768px]:hidden"
        >
          <Image
            src="/wp/logo.png"
            alt=""
            fill
            sizes="(max-width: 900px) 70vw, 42vw"
            className="object-cover object-[center_bottom]"
          />
        </div>
      </section>
    );
  }

  return (
    <div
      aria-roledescription="carousel"
      className="relative w-full select-none bg-black [aspect-ratio:16/5.5] max-[600px]:aspect-[4/5]"
    >
      <div className="absolute inset-0 z-10 pointer-events-none flex items-end pb-12 md:items-center md:pb-0">
        <div className="pl-8 md:pl-16 max-w-[520px]">
          <span className="block text-[11px] font-bold tracking-[0.22em] uppercase text-brand mb-3">
            Bigbike · Gear moto chính hãng
          </span>
          <p className="font-display font-semibold text-white uppercase tracking-[0.02em] leading-[1.1] text-[clamp(1.6rem,3.5vw,3rem)] m-0 mb-5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            Đồ bảo hộ<br />cho rider đi đường dài
          </p>
          <Link
            href="/san-pham/"
            className="pointer-events-auto inline-flex items-center gap-2 bg-brand text-white font-bold text-sm tracking-[0.08em] uppercase px-6 py-3 no-underline transition-opacity hover:opacity-90"
          >
            Xem sản phẩm <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
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
          <SwiperSlide key={slide.id} style={{ width: "100%", height: "100%" }} suppressHydrationWarning>
            <Link
              href={slide.href}
              tabIndex={i !== activeIndex ? -1 : 0}
              className="block w-full h-full"
            >
              <picture className="block h-full w-full bg-black">
                {slide.mobileSrc && (
                  <source media="(max-width: 768px)" srcSet={slide.mobileSrc} />
                )}
                <img
                  src={slide.desktopSrc || ""}
                  alt={slide.alt}
                  className="block h-full w-full object-cover"
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
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-black/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-[background,color] duration-150 hover:bg-white hover:text-brand"
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="Slide trước"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11.5 3.5L6 9l5.5 5.5" />
            </svg>
          </button>
          <button
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-black/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-[background,color] duration-150 hover:bg-white hover:text-brand"
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6.5 3.5L12 9l-5.5 5.5" />
            </svg>
          </button>
          <div
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5"
            role="tablist"
            aria-label="Điều hướng slide"
          >
            {slides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  "h-[3px] w-8 cursor-pointer rounded-full border-0 bg-black/20 p-0 transition-[width,background-color] duration-150",
                  i === activeIndex && "w-12 bg-brand",
                )}
                onClick={() => swiperRef.current?.slideToLoop(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
