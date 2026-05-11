"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";

type Props = { articles: Article[] };
type LegacyExperienceKey = "ls2" | "scoyco" | "agv";

const LEGACY_EXPERIENCE_MEDIA: Record<
  LegacyExperienceKey,
  { order: number; title: string; coverImage: string; productImage: string }
> = {
  ls2: {
    order: 2,
    title: "Mũ bảo hiểm fullface LS2 FF352",
    coverImage: "/wp-content/uploads/2020/06/LS2-FF352_background.jpg",
    productImage: "/wp-content/uploads/2020/06/LS2-FF352_thumbnail.png",
  },
  scoyco: {
    order: 1,
    title: "[Review] - Áo bảo hộ SCOYCO JK37",
    coverImage: "/wp-content/uploads/2020/06/scoyco-jk37_background.jpg",
    productImage: "/wp-content/uploads/2020/06/scoyco-jk37_thumbnail-1.png",
  },
  agv: {
    order: 0,
    title: "[Tiêu điểm] Mũ Bảo Hiểm AGV Chính Hãng 2025",
    coverImage: "/wp-content/uploads/2020/06/avg_background.jpg",
    productImage: "/wp-content/uploads/2020/06/avg_thmbnail-1.png",
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
  if (haystack.includes("scoyco-jk37") || haystack.includes("scoyco")) {
    return "scoyco";
  }
  if (haystack.includes("ls2-ff352") || haystack.includes("ls2 ff352")) {
    return "ls2";
  }
  if (haystack.includes("agv")) {
    return "agv";
  }
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

function getInitialArticleIndex(articles: Article[]): number {
  const scoycoIndex = articles.findIndex((article) => getLegacyExperienceKey(article) === "scoyco");
  return scoycoIndex >= 0 ? scoycoIndex : 0;
}

export function ExperienceCarousel({ articles }: Props) {
  const orderedArticles = useMemo(() => orderLikeLegacyWp(articles), [articles]);
  const n = orderedArticles.length;
  const initialArticleIndex = useMemo(
    () => getInitialArticleIndex(orderedArticles),
    [orderedArticles],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: n > 1, // Embla needs ≥ 2 slides to create valid loop clones
    align: "center",
    containScroll: false,
    startIndex: initialArticleIndex,
    duration: 16,
  });
  const [selectedIndex, setSelectedIndex] = useState(initialArticleIndex);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const scrollToArticle = useCallback(
    (articleIndex: number) => emblaApi?.scrollTo(articleIndex),
    [emblaApi],
  );

  if (n === 0) return null;

  return (
    <div className="wp-exp-carousel">
      <div className="wp-exp-carousel-vp" ref={emblaRef}>
        <div className="wp-exp-carousel-track">
          {orderedArticles.map((article, i) => {
            const active = i === selectedIndex;
            const legacyKey = getLegacyExperienceKey(article);
            const legacyMedia = legacyKey ? LEGACY_EXPERIENCE_MEDIA[legacyKey] : null;
            const title = legacyMedia?.title ?? safeText(article.title, "Bài viết");
            const bgSrc =
              legacyMedia?.coverImage ?? resolveMediaUrl(article.coverImage?.url?.trim());
            const productSrc =
              legacyMedia?.productImage ||
              normalizeLegacyUploadUrl(article.productImage?.url?.trim()) ||
              normalizeLegacyUploadUrl(extractFirstImageUrl(article.body));

            return (
              <div
                key={article.id}
                className={`wp-exp-carousel-slide${active ? " is-active" : ""}`}
                onClick={!active ? () => scrollToArticle(i) : undefined}
                role={!active ? "button" : undefined}
                tabIndex={!active ? 0 : undefined}
                onKeyDown={
                  !active
                    ? (e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        scrollToArticle(i);
                      }
                    : undefined
                }
                aria-label={!active ? `Chuyển đến: ${title}` : undefined}
              >
                <div className="wp-experience-img-wrap">
                  {bgSrc ? (
                    <Image
                      src={bgSrc}
                      alt={safeText(article.coverImage?.alt, title)}
                      fill
                      className="wp-exp-bg"
                      sizes="(max-width: 767px) 84vw, 42vw"
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(135deg, #c00, #8b0000)",
                      }}
                    />
                  )}
                  <div className="wp-exp-overlay" />
                </div>
                <div className="wp-exp-content">
                  {productSrc && (
                    <div className="wp-exp-product-wrap" aria-hidden="true">
                      <Image
                        src={productSrc}
                        alt={safeText(article.productImage?.alt, title)}
                        fill
                        className="wp-exp-product-img"
                        sizes="(max-width: 767px) 42vw, 22vw"
                      />
                    </div>
                  )}
                  <div className="wp-exp-content-body">
                    <p className="wp-exp-title">{title}</p>
                    {active && (
                      <Link href={toArticlePath(article.slug)} className="wp-exp-cta">
                        XEM CHI TIẾT
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
