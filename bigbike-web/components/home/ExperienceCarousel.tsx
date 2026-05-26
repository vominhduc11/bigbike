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

function extractFirstImageUrl(html: string | null | undefined): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

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
  while (expanded.length < 6) expanded.push(...articles);
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
    productSrc:
      normalizeLegacyUploadUrl(article.productImage?.url?.trim()) ||
      normalizeLegacyUploadUrl(extractFirstImageUrl(article.body)),
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
    <div className="bb-exp-slide select-none">
      <div className="bb-exp-slide-cover overflow-hidden bg-[linear-gradient(135deg,var(--bb-brand-primary-active),var(--bb-bg-surface-dark-2))]">
        {media.bgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- native img keeps the legacy cover sizing.
          <img
            src={media.bgSrc}
            alt={media.bgAlt}
            className="block w-full max-h-[378px] object-cover"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        ) : null}
      </div>

      <div
        className="bb-exp-slide-content mt-[-32%]"
        aria-hidden={!isActive}
      >
        {media.productSrc ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- transparent product art follows the legacy PNG sizing. */}
            <img
              src={media.productSrc}
              alt={media.productAlt}
              className="bb-exp-product-image mx-auto w-1/2 max-w-[420px] max-[991px]:w-[64%] max-[767px]:w-[62vw] max-[767px]:max-w-[280px] max-[374px]:max-w-[250px]"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </div>
        ) : null}

        <div className="text-center max-[767px]:mt-5">
          <h3 className="bb-exp-slide-title">
            {media.title}
          </h3>
          <div className="pt-[40px] text-center max-[767px]:pt-4">
            <Link
              href={toArticlePath(article.slug)}
              className="bb-exp-slide-link"
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
      className="bb-exp-carousel w-full touch-pan-y pb-[40px] [&_.swiper-slide]:h-auto [&_.swiper-slide]:cursor-pointer"
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
        767: {
          slidesPerView: 2.43,
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
