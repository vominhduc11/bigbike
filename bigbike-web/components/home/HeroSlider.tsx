"use client";
import { useEffect, useRef, useState } from "react";
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
  /** Tên sản phẩm gắn với banner — rỗng nếu banner không gắn sản phẩm. */
  productName: string;
  /** Tên danh mục của sản phẩm gắn với banner. */
  categoryName: string;
  /** Mã sản phẩm (SKU) — dùng cho chữ mờ nền + số hiệu slide. */
  productCode: string;
};

type HeroSliderProps = {
  slides: HeroSlide[];
};

/** Một slide: ảnh nền + lớp phủ tối + (nếu có sản phẩm) chữ mờ + danh mục + tên + nút "Mua ngay". */
function HeroSlideView({ slide }: { slide: HeroSlide }) {
  const hasProduct = Boolean(slide.productName);
  const watermark = slide.productCode || slide.productName;

  return (
    <Link href={slide.href} className="relative block h-full w-full overflow-hidden bg-black">
      <picture>
        {slide.mobileSrc && <source media="(max-width: 768px)" srcSet={slide.mobileSrc} />}
        <img
          src={slide.desktopSrc}
          alt={slide.alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      </picture>

      <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.46)_42%,rgba(0,0,0,0.05)_72%)]" />

      {hasProduct && (
        <>
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[20vw] font-bold uppercase leading-none text-white/[0.055]"
          >
            {watermark}
          </span>

          <div className="absolute inset-0 flex items-center">
            <div className="bb-container">
              <div className="max-w-[640px]">
                {slide.categoryName && (
                  <p className="m-0 mb-3 font-display text-sm font-semibold uppercase tracking-[0.22em] text-white/70 max-[600px]:mb-2 max-[600px]:text-xs">
                    {slide.categoryName}
                  </p>
                )}
                <h2 className="m-0 font-display text-[clamp(1.9rem,4.6vw,3.85rem)] font-bold uppercase leading-[1.06] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.65)]">
                  {slide.productName}
                </h2>
                <span className="mt-7 inline-flex items-center gap-2 bg-brand px-7 py-3 font-display text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors max-[600px]:mt-5 max-[600px]:px-5 max-[600px]:py-2.5">
                  Mua ngay
                  <span aria-hidden="true" className="text-base leading-none">›</span>
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </Link>
  );
}

const ARROW_BTN =
  "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent text-white/70 transition-colors hover:text-white max-[600px]:h-10 max-[600px]:w-10";

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
      <section
        aria-label="BigBike"
        className="relative grid min-h-[min(620px,calc(100vh-106px))] grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] items-center gap-[var(--bb-space-12)] overflow-hidden border-0 px-[max(var(--bb-page-padding-desktop),calc((100vw-var(--bb-container-xl))/2))] py-[var(--bb-space-16)] text-white shadow-none max-[900px]:min-h-auto max-[900px]:grid-cols-1 max-[900px]:gap-[var(--bb-space-8)] max-[900px]:px-[var(--bb-page-padding-tablet)] max-[900px]:py-[var(--bb-space-12)] max-[639px]:px-4 max-[639px]:py-8 before:absolute before:inset-x-0 before:bottom-0 before:h-1 before:bg-brand before:content-['']"
        style={{
          background:
            "radial-gradient(circle at 88% 22%, rgba(255, 12, 9, 0.22), transparent 28%), radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.12), transparent 42%), linear-gradient(145deg, #0d0d0d 0%, #171717 48%, #1f1f1f 100%)",
        }}
      >
        <div className="relative z-[2] max-w-[620px] text-inherit">
          <span className="mb-[var(--bb-space-5)] inline-block bg-brand px-[0.8rem] py-[0.35rem] text-11 font-bold uppercase tracking-[0.14em] text-white [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)]">
            BIGBIKE · SINCE 2013
          </span>
          <p className="mb-[var(--bb-space-4)] mt-0 font-display text-[var(--bb-text-hero)] font-bold uppercase leading-[45px] tracking-normal text-white max-[639px]:text-lg max-[639px]:leading-[27px] min-[640px]:max-[1023px]:text-2xl min-[640px]:max-[1023px]:leading-9">
            Gear moto chính hãng
            <br />
            <em className="not-italic text-brand">cho rider đi đường dài</em>
          </p>
          <p className="mb-[var(--bb-space-6)] mt-0 max-w-[520px] text-base leading-6 text-[var(--bb-text-inverse-secondary)]">
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

  const nextSlide = slides[(activeIndex + 1) % count];
  const activeSlide = slides[activeIndex];

  return (
    <div
      aria-roledescription="carousel"
      className="relative w-full select-none overflow-hidden bg-black [aspect-ratio:16/6] max-[600px]:aspect-[4/5]"
    >
      {mounted ? (
        <Swiper
          modules={[Autoplay]}
          loop={count > 1}
          speed={600}
          autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
          style={{ width: "100%", height: "100%" }}
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id} style={{ width: "100%", height: "100%" }}>
              <HeroSlideView slide={slide} />
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className="h-full w-full">
          <HeroSlideView slide={slides[0]} />
        </div>
      )}

      {count > 1 && mounted && (
        <>
          <button
            className={`${ARROW_BTN} left-2`}
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="Slide trước"
          >
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11.5 3.5L6 9l5.5 5.5" />
            </svg>
          </button>
          <button
            className={`${ARROW_BTN} right-2`}
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Slide tiếp"
          >
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6.5 3.5L12 9l-5.5 5.5" />
            </svg>
          </button>

          <button
            className="absolute right-[3%] top-1/2 z-10 -translate-y-1/2 cursor-pointer border-2 border-white/70 bg-black/30 p-0 transition-colors hover:border-white max-[900px]:hidden"
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="Xem slide kế tiếp"
          >
            <span className="relative block h-[78px] w-[124px] overflow-hidden">
              <Image
                src={nextSlide.desktopSrc}
                alt=""
                fill
                sizes="124px"
                className="object-cover"
                aria-hidden="true"
              />
            </span>
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
            <div className="bb-container flex items-center gap-4 pb-5 max-[600px]:pb-3">
              <span className="font-display text-sm font-semibold tracking-[0.06em] text-white">
                {(activeIndex + 1).toString().padStart(2, "0")} / {count.toString().padStart(2, "0")}
              </span>
              <span className="h-px flex-1 bg-white/25" />
              {activeSlide.productCode && (
                <span className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-white/60">
                  {activeSlide.productCode}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
