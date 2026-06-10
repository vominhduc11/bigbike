"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import type { Article } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";

type Props = { articles: Article[] };

const LEGACY_BODY_UPLOAD_PREFIXES = [
  "https://bigbike.vn/wp-content/uploads/",
  "https://www.bigbike.vn/wp-content/uploads/",
  "http://bigbike.vn/wp-content/uploads/",
  "http://www.bigbike.vn/wp-content/uploads/",
];

function normalizeLegacyUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const prefix of LEGACY_BODY_UPLOAD_PREFIXES) {
    if (url.startsWith(prefix)) {
      return `/wp-content/uploads/${url.slice(prefix.length)}`;
    }
  }
  return resolveMediaUrl(url) ?? null;
}

function expandForSwiperLoop(articles: Article[]): Article[] {
  if (articles.length <= 1) return articles;
  const expanded = [...articles];
  // Loop + centeredSlides needs ~2x the largest slidesPerView worth of real
  // slides to clone from without leaving gaps. Largest is 4.43 at 4xl -> >=10.
  while (expanded.length < 10) expanded.push(...articles);
  return expanded;
}

function resolveArticleMedia(article: Article): {
  title: string;
  bgSrc: string | null;
  bgAlt: string;
  productSrc: string | null;
  productAlt: string;
} {
  const title = safeText(article.title, "Bài viết");

  return {
    title,
    bgSrc: resolveMediaUrl(article.coverImage?.url?.trim()) ?? null,
    bgAlt: safeText(article.coverImage?.alt, title),
    productSrc: normalizeLegacyUploadUrl(article.productImage?.url?.trim()),
    productAlt: safeText(article.productImage?.alt, title),
  };
}

function ExperienceSlide({
  article,
  isActive,
}: {
  article: Article;
  isActive: boolean;
}) {
  const media = resolveArticleMedia(article);

  return (
    <div className="select-none">
      <div className="bb-exp-slide-cover overflow-hidden bg-[linear-gradient(135deg,var(--bb-brand-primary-active),var(--bb-bg-surface-dark-2))]">
        {media.bgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- native img keeps the legacy cover sizing.
          <img
            src={media.bgSrc}
            alt={media.bgAlt}
            className="block w-full max-h-[378px] max-[767px]:max-h-[220px] object-cover"
            loading={isActive ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        ) : null}
      </div>

      <div
        className="bb-exp-slide-content mt-[-32%] max-[768px]:mt-[-18%] max-[375px]:mt-[-14%] md:pb-14"
        aria-hidden={!isActive}
      >
        {media.productSrc ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- transparent product art follows the legacy PNG sizing. */}
            <img
              src={media.productSrc}
              alt={media.productAlt}
              className="mx-auto w-1/2 max-w-[420px] max-[991px]:w-[64%] max-[767px]:w-[52vw] max-[767px]:max-w-[230px] max-[374px]:max-w-[210px]"
              loading={isActive ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
            />
          </div>
        ) : null}

        <div className="text-center max-[767px]:mt-3">
          <h3 className="m-0 font-body text-ui-24 font-semibold uppercase leading-[30px] max-md:leading-[1.3] text-black">
            {media.title}
          </h3>
          <div className="pt-[40px] text-center max-[767px]:pt-6">
            <Link
              href={toArticlePath(article.slug)}
              className="bb-exp-slide-link inline-block w-[170px] max-md:w-[150px] p-0 border border-[var(--bb-border-default)] text-black font-[family-name:var(--bb-font-cta)] text-ui-16 font-semibold leading-[52px] max-md:leading-[44px] no-underline uppercase [transition:border-color_var(--bb-duration-fast)_var(--bb-ease-standard),color_var(--bb-duration-fast)_var(--bb-ease-standard)] focus-visible:[outline:var(--bb-focus-outline)] focus-visible:outline-offset-4"
              tabIndex={isActive ? 0 : -1}
            >
              XEM CHI TIẾT
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExperienceCarousel({ articles }: Props) {
  if (articles.length === 0) return null;

  const hasSideSlides = articles.length > 1;
  const carouselArticles = expandForSwiperLoop(articles);

  return (
    <Swiper
      className="bb-exp-carousel w-full touch-pan-y !pb-16 max-md:!pb-7 [&_.swiper-slide]:h-auto [&_.swiper-slide]:cursor-pointer"
      speed={1000}
      slidesPerView={1.2}
      spaceBetween={13}
      centeredSlides
      loop={hasSideSlides}
      initialSlide={hasSideSlides ? articles.length - 1 : 0}
      slideToClickedSlide={hasSideSlides}
      autoHeight
      watchOverflow
      breakpoints={{
        // 768 aligns with the CSS @media (min-width: 768px) / (max-width: 767px)
        // boundary used throughout globals.css. Using 767 caused a 1px window
        // where Swiper entered desktop mode (2.43 slides, autoHeight:false) but
        // the CSS still applied mobile overrides (margin-top:-18%, no
        // height:auto !important on wrapper), which could clip slide content.
        768: {
          slidesPerView: 2.43,
          spaceBetween: 40,
          autoHeight: false,
        },
        // 3xl — keep each card near its 2xl size instead of letting it grow.
        // autoHeight must be re-stated: Swiper breakpoints override base params,
        // they do NOT inherit from the 768 tier.
        1920: {
          slidesPerView: 3.43,
          spaceBetween: 40,
          autoHeight: false,
        },
        // 4xl — same .43 peek ratio as 2xl. Without this each slide ballooned to
        // ~1050px wide, which over-pulled the mt-[-32%] product overlay.
        2560: {
          slidesPerView: 4.43,
          spaceBetween: 40,
          autoHeight: false,
        },
      }}
      aria-roledescription="carousel"
      aria-label="Góc trải nghiệm BigBike"
    >
      {carouselArticles.map((article, index) => (
        <SwiperSlide key={`${article.id}-${index}`}>
          {({ isActive }) => (
            <ExperienceSlide article={article} isActive={isActive} />
          )}
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
