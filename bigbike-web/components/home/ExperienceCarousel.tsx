"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import type { Article } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

type Props = { articles: Article[] };
type LegacyExperienceKey = "ls2" | "agv" | "scoyco";

const LEGACY_EXPERIENCE_MEDIA: Record<
  LegacyExperienceKey,
  { order: number; title: string; coverImage: string; productImage: string }
> = {
  ls2: {
    order: 0,
    title: "Mũ bảo hiểm fullface LS2 FF352",
    coverImage: "/wp-content/uploads/2020/06/LS2-FF352_background.jpg",
    productImage: "/wp-content/uploads/2020/06/LS2-FF352_thumbnail.png",
  },
  agv: {
    order: 1,
    title: "[Tiêu điểm] Mũ Bảo Hiểm AGV Chính Hãng 2025",
    coverImage: "/wp-content/uploads/2020/06/avg_background.jpg",
    productImage: "/wp-content/uploads/2020/06/avg_thmbnail-1.png",
  },
  scoyco: {
    order: 2,
    title: "[Review] - Áo bảo hộ SCOYCO JK37",
    coverImage: "/wp-content/uploads/2020/06/scoyco-jk37_background.jpg",
    productImage: "/wp-content/uploads/2020/06/scoyco-jk37_thumbnail-1.png",
  },
};

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

function getLegacyExperienceKey(article: Article): LegacyExperienceKey | null {
  const haystack = `${article.slug} ${article.title}`.toLowerCase();
  if (haystack.includes("ls2-ff352") || haystack.includes("ls2 ff352")) return "ls2";
  if (haystack.includes("agv")) return "agv";
  if (haystack.includes("scoyco-jk37") || haystack.includes("scoyco")) return "scoyco";
  return null;
}

function orderLikeLegacyWp(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    const aKey = getLegacyExperienceKey(a);
    const bKey = getLegacyExperienceKey(b);
    const aOrder = aKey ? LEGACY_EXPERIENCE_MEDIA[aKey].order : Number.MAX_SAFE_INTEGER;
    const bOrder = bKey ? LEGACY_EXPERIENCE_MEDIA[bKey].order : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
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
  const legacyKey = getLegacyExperienceKey(article);
  const legacyMedia = legacyKey ? LEGACY_EXPERIENCE_MEDIA[legacyKey] : null;
  const title = legacyMedia?.title ?? safeText(article.title, "Bài viết");

  return {
    title,
    bgSrc: legacyMedia?.coverImage ?? resolveMediaUrl(article.coverImage?.url?.trim()) ?? null,
    bgAlt: safeText(article.coverImage?.alt, title),
    productSrc:
      legacyMedia?.productImage ||
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
      <div className="overflow-hidden bg-[linear-gradient(135deg,var(--bb-brand-primary-active),var(--bb-bg-surface-dark-2))]">
        {media.bgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- WP parity needs native image sizing/max-height behavior.
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
        className={cn(
          "bb-exp-slide-content mt-[-32%] transform-gpu transition-[opacity,transform] duration-[700ms] ease-[ease] will-change-[opacity,transform]",
          isActive
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-10 opacity-0",
        )}
        aria-hidden={!isActive}
      >
        {media.productSrc ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- product art follows the legacy transparent PNG sizing. */}
            <img
              src={media.productSrc}
              alt={media.productAlt}
              className="mx-auto w-1/2 max-w-none max-[991px]:w-4/5"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </div>
        ) : null}

        <div className="text-center max-[767px]:mt-5">
          <h3 className="m-0 font-heading text-[18.72px] font-semibold uppercase leading-[28.08px] text-black max-[767px]:mx-auto max-[767px]:max-w-[240px] max-[767px]:text-24 max-[767px]:leading-[36px]">
            {media.title}
          </h3>
          <div className="pt-[40px] text-center">
            <Link
              href={toArticlePath(article.slug)}
              className="inline-block w-[170px] border border-[var(--bb-border-default)] p-0 font-cta text-base font-semibold uppercase leading-[52px] text-black no-underline transition-[border-color,color] duration-[var(--bb-duration-fast)] ease-[var(--bb-ease-standard)] hover:text-black hover:no-underline focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-4"
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
  const orderedArticles = orderLikeLegacyWp(articles);
  if (orderedArticles.length === 0) return null;

  const hasSideSlides = orderedArticles.length > 1;
  const carouselArticles = expandForSwiperLoop(orderedArticles);

  return (
    <Swiper
      className="bb-exp-carousel w-full touch-pan-y pb-[40px] [&_.swiper-slide]:h-auto [&_.swiper-slide]:cursor-pointer"
      speed={1000}
      slidesPerView={1.2}
      spaceBetween={13}
      centeredSlides
      loop={hasSideSlides}
      initialSlide={hasSideSlides ? orderedArticles.length - 1 : 0}
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
