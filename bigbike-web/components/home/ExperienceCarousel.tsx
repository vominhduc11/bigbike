"use client";

import useEmblaCarousel from "embla-carousel-react";
import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";

type Props = { articles: Article[] };
type LegacyExperienceKey = "ls2" | "scoyco" | "agv";
const SLIDE_COPY_COUNT = 11;
const CENTER_COPY_INDEX = Math.floor(SLIDE_COPY_COUNT / 2);

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

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function ExperienceCarousel({ articles }: Props) {
  const orderedArticles = useMemo(() => orderLikeLegacyWp(articles), [articles]);
  const n = orderedArticles.length;
  const initialArticleIndex = useMemo(
    () => getInitialArticleIndex(orderedArticles),
    [orderedArticles],
  );
  const initialScrollIndex = n > 0 ? CENTER_COPY_INDEX * n + initialArticleIndex : 0;
  const slides = useMemo(
    () =>
      n > 0
        ? Array.from({ length: SLIDE_COPY_COUNT }, () => orderedArticles).flat()
        : orderedArticles,
    [n, orderedArticles],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: false,
    startIndex: initialScrollIndex,
    duration: 16,
  });
  const [selectedIndex, setSelectedIndex] = useState(initialScrollIndex);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const recenterTimersRef = useRef<number[]>([]);
  const unlockTimersRef = useRef<number[]>([]);
  const interactionLockedRef = useRef(false);
  const pendingTargetIndexRef = useRef<number | null>(null);
  const normalizeToMiddleCopy = useCallback(
    (index: number) => CENTER_COPY_INDEX * n + positiveModulo(index, n),
    [n],
  );
  const clearUnlockTimers = useCallback(() => {
    unlockTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    unlockTimersRef.current = [];
  }, []);
  const unlockInteraction = useCallback(() => {
    clearUnlockTimers();
    interactionLockedRef.current = false;
    pendingTargetIndexRef.current = null;
    setInteractionLocked(false);
  }, [clearUnlockTimers]);
  const lockInteraction = useCallback(() => {
    clearUnlockTimers();
    interactionLockedRef.current = true;
    setInteractionLocked(true);

    const timer = window.setTimeout(() => {
      interactionLockedRef.current = false;
      setInteractionLocked(false);
      unlockTimersRef.current = unlockTimersRef.current.filter((item) => item !== timer);
    }, 720);
    unlockTimersRef.current.push(timer);
  }, [clearUnlockTimers]);
  const blockInteractionWhileLocked = useCallback((event: SyntheticEvent) => {
    if (!interactionLockedRef.current) return;

    event.preventDefault();
    event.stopPropagation();
  }, []);
  const getClosestSnapForArticle = useCallback(
    (articleIndex: number) => {
      if (n === 0) return 0;

      const currentIndex = emblaApi?.selectedScrollSnap() ?? selectedIndex;
      const currentArticleIndex = positiveModulo(currentIndex, n);
      let delta = positiveModulo(articleIndex, n) - currentArticleIndex;

      if (delta > n / 2) delta -= n;
      if (delta < -n / 2) delta += n;

      return currentIndex + delta;
    },
    [emblaApi, n, selectedIndex],
  );

  useEffect(() => {
    if (!emblaApi || n === 0) return;
    emblaApi.scrollTo(initialScrollIndex, true);
  }, [emblaApi, initialScrollIndex, n]);

  useEffect(() => {
    if (!emblaApi || n === 0) return;
    const clearTimers = () => {
      recenterTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      recenterTimersRef.current = [];
      clearUnlockTimers();
      interactionLockedRef.current = false;
      setInteractionLocked(false);
    };
    const recenter = () => {
      if (interactionLockedRef.current) return;

      const index = emblaApi.selectedScrollSnap();
      const normalizedIndex = normalizeToMiddleCopy(index);

      if (index !== normalizedIndex) {
        emblaApi.scrollTo(normalizedIndex, true);
        setSelectedIndex(normalizedIndex);
        unlockInteraction();
        return;
      }

      setSelectedIndex(index);
      unlockInteraction();
    };
    const sync = () => {
      if (interactionLockedRef.current) return;

      const index = emblaApi.selectedScrollSnap();
      const normalizedIndex = normalizeToMiddleCopy(index);

      setSelectedIndex(index);

      if (index === normalizedIndex) return;

      const timer = window.setTimeout(() => {
        if (emblaApi.selectedScrollSnap() === index) {
          recenter();
        }
      }, 480);
      recenterTimersRef.current.push(timer);
    };

    emblaApi.on("select", sync);
    emblaApi.on("settle", recenter);
    sync();
    return () => {
      clearTimers();
      emblaApi.off("select", sync);
      emblaApi.off("settle", recenter);
    };
  }, [clearUnlockTimers, emblaApi, n, normalizeToMiddleCopy, unlockInteraction]);

  const scrollToArticle = useCallback(
    (articleIndex: number) => {
      if (!emblaApi || interactionLockedRef.current) return;

      const nextIndex = getClosestSnapForArticle(articleIndex);
      if (nextIndex === emblaApi.selectedScrollSnap()) return;

      recenterTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      recenterTimersRef.current = [];

      lockInteraction();
      pendingTargetIndexRef.current = nextIndex;
      setSelectedIndex(nextIndex);
      emblaApi.scrollTo(nextIndex);

      const normalizedIndex = normalizeToMiddleCopy(nextIndex);
      const timer = window.setTimeout(() => {
        if (pendingTargetIndexRef.current !== nextIndex) return;

        if (nextIndex !== normalizedIndex) {
          emblaApi.scrollTo(normalizedIndex, true);
        }

        setSelectedIndex(normalizedIndex);
        unlockInteraction();
      }, 560);
      recenterTimersRef.current.push(timer);
    },
    [emblaApi, getClosestSnapForArticle, lockInteraction, normalizeToMiddleCopy, unlockInteraction],
  );

  if (n === 0) return null;

  return (
    <div className={`wp-exp-carousel${interactionLocked ? " is-transitioning" : ""}`}>
      <div
        className="wp-exp-carousel-vp"
        ref={emblaRef}
        onClickCapture={blockInteractionWhileLocked}
        onPointerDownCapture={blockInteractionWhileLocked}
      >
        <div className="wp-exp-carousel-track">
          {slides.map((article, i) => {
            const articleIndex = i % n;
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
                key={`${article.id}-${i}`}
                className={`wp-exp-carousel-slide${active ? " is-active" : ""}`}
                onClick={!active ? () => scrollToArticle(articleIndex) : undefined}
                role={!active ? "button" : undefined}
                tabIndex={!active ? 0 : undefined}
                onKeyDown={
                  !active
                    ? (e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        scrollToArticle(articleIndex);
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
