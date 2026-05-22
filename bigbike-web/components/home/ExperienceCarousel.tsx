"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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

function modulo(index: number, length: number): number {
  return ((index % length) + length) % length;
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
    <div className="bb-exp-slide">
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
          "bb-exp-slide-content mt-[-32%] transition-all duration-700 ease-in-out",
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
              className="mx-auto w-1/2 max-w-none max-[1260px]:w-4/5"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </div>
        ) : null}

        <div className="text-center max-[767px]:mt-5">
          <h3 className="m-0 font-heading text-[18.72px] font-semibold uppercase leading-[28.08px] text-black max-[767px]:text-24 max-[767px]:leading-[36px]">
            {media.title}
          </h3>
          {isActive ? (
            <div className="pt-[40px] text-center">
              <Link
                href={toArticlePath(article.slug)}
                className="inline-block w-[170px] border border-[var(--bb-border-default)] p-0 font-cta text-base font-semibold uppercase leading-[52px] text-black no-underline hover:text-black hover:no-underline focus-visible:outline-[var(--bb-focus-outline)] focus-visible:outline-offset-4"
              >
                XEM CHI TIẾT
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ExperienceCarousel({ articles }: Props) {
  const orderedArticles = orderLikeLegacyWp(articles);
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  if (orderedArticles.length === 0) return null;

  const normalizedActiveIndex = modulo(activeIndex, orderedArticles.length);
  const activeArticle = orderedArticles[normalizedActiveIndex];
  const previousArticle = orderedArticles[modulo(normalizedActiveIndex - 1, orderedArticles.length)];
  const nextArticle = orderedArticles[modulo(normalizedActiveIndex + 1, orderedArticles.length)];
  const hasSideSlides = orderedArticles.length > 1;

  const goTo = (index: number) => {
    setActiveIndex(modulo(index, orderedArticles.length));
  };

  const handlePointerUp = (clientX: number) => {
    if (pointerStartX.current === null || !hasSideSlides) return;
    const deltaX = clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(deltaX) < 42) return;
    goTo(normalizedActiveIndex + (deltaX < 0 ? 1 : -1));
  };

  return (
    <div
      className="bb-exp-carousel relative w-full touch-pan-y overflow-hidden pb-[40px] [--bb-exp-slide-gap:40px] [--bb-exp-slide-size:calc((100%_-_57.2px)_/_2.43)] max-[766px]:[--bb-exp-slide-gap:13px] max-[766px]:[--bb-exp-slide-size:calc((100%_-_2.6px)_/_1.2)]"
      onPointerDown={(event) => {
        pointerStartX.current = event.clientX;
      }}
      onPointerCancel={() => {
        pointerStartX.current = null;
      }}
      onPointerLeave={(event) => {
        if (event.buttons === 1) handlePointerUp(event.clientX);
      }}
      onPointerUp={(event) => {
        handlePointerUp(event.clientX);
      }}
      aria-roledescription="carousel"
      aria-label="Góc trải nghiệm BigBike"
    >
      {hasSideSlides ? (
        <button
          type="button"
          className="absolute left-1/2 top-0 z-0 block w-[var(--bb-exp-slide-size)] translate-x-[calc(-150%_-_var(--bb-exp-slide-gap))] cursor-pointer border-0 bg-transparent p-0 text-left"
          onClick={() => goTo(normalizedActiveIndex - 1)}
          aria-label={`Xem ${resolveArticleMedia(previousArticle).title}`}
        >
          <ExperienceSlide article={previousArticle} isActive={false} />
        </button>
      ) : null}

      <div className="bb-exp-active-slide relative z-10 mx-auto w-[var(--bb-exp-slide-size)]">
        <ExperienceSlide article={activeArticle} isActive />
      </div>

      {hasSideSlides ? (
        <button
          type="button"
          className="absolute left-1/2 top-0 z-0 block w-[var(--bb-exp-slide-size)] translate-x-[calc(50%_+_var(--bb-exp-slide-gap))] cursor-pointer border-0 bg-transparent p-0 text-left"
          onClick={() => goTo(normalizedActiveIndex + 1)}
          aria-label={`Xem ${resolveArticleMedia(nextArticle).title}`}
        >
          <ExperienceSlide article={nextArticle} isActive={false} />
        </button>
      ) : null}
    </div>
  );
}
