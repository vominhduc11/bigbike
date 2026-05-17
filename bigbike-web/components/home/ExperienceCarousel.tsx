"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/contracts/public";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toArticlePath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

type Props = { articles: Article[] };
type LegacyExperienceKey = "ls2" | "scoyco" | "agv";

const LOOP_REPEATS = 7;
const LOOP_CENTER_REPEAT = Math.floor(LOOP_REPEATS / 2);
const LOOP_EDGE_BUFFER_REPEATS = 2;
const DESKTOP_SLIDES_PER_VIEW = 2.43;
const MOBILE_SLIDES_PER_VIEW = 1.2;
const DESKTOP_GAP = 40;
const MOBILE_GAP = 13;

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
  const agvIndex = articles.findIndex((article) => getLegacyExperienceKey(article) === "agv");
  if (agvIndex >= 0) return agvIndex;
  return articles.length > 1 ? Math.floor(articles.length / 2) : 0;
}

function buildLoopArticles(articles: Article[]): Article[] {
  if (articles.length <= 1) return articles;
  return Array.from({ length: LOOP_REPEATS }, () => articles).flat();
}

function getLoopArticleIndex(displayIndex: number, articleCount: number): number {
  return ((displayIndex % articleCount) + articleCount) % articleCount;
}

function getCenteredDisplayIndex(displayIndex: number, articleCount: number): number {
  return LOOP_CENTER_REPEAT * articleCount + getLoopArticleIndex(displayIndex, articleCount);
}

function shouldRecenterDisplayIndex(displayIndex: number, articleCount: number): boolean {
  if (articleCount <= 1) return false;
  return (
    displayIndex < articleCount * LOOP_EDGE_BUFFER_REPEATS ||
    displayIndex >= articleCount * (LOOP_REPEATS - LOOP_EDGE_BUFFER_REPEATS)
  );
}

export function ExperienceCarousel({ articles }: Props) {
  const orderedArticles = useMemo(() => orderLikeLegacyWp(articles), [articles]);
  const n = orderedArticles.length;
  const loopArticles = useMemo(() => buildLoopArticles(orderedArticles), [orderedArticles]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    viewportWidth: number;
    slideWidth: number;
    gap: number;
  } | null>(null);
  const initialDisplayIndex = useMemo(() => {
    return n > 1
      ? LOOP_CENTER_REPEAT * n + getInitialArticleIndex(orderedArticles)
      : 0;
  }, [n, orderedArticles]);
  const [activeDisplayIndex, setActiveDisplayIndex] = useState(initialDisplayIndex);
  const [isRecenterJumping, setIsRecenterJumping] = useState(false);

  useEffect(() => {
    if (!isRecenterJumping) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setIsRecenterJumping(false);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [isRecenterJumping]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measuredViewport = viewport;

    function updateLayout() {
      const viewportWidth = measuredViewport.clientWidth;
      const mobile = viewportWidth < BB_BREAKPOINTS.md;
      const slidesPerView = mobile ? MOBILE_SLIDES_PER_VIEW : DESKTOP_SLIDES_PER_VIEW;
      const gap = mobile ? MOBILE_GAP : DESKTOP_GAP;
      const slideWidth = (viewportWidth - gap * (slidesPerView - 1)) / slidesPerView;

      setLayout((previous) => {
        if (
          previous &&
          Math.abs(previous.viewportWidth - viewportWidth) < 0.5 &&
          Math.abs(previous.slideWidth - slideWidth) < 0.5 &&
          previous.gap === gap
        ) {
          return previous;
        }
        return { viewportWidth, slideWidth, gap };
      });
    }

    updateLayout();
    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(measuredViewport);
    return () => resizeObserver.disconnect();
  }, []);

  if (n === 0) return null;

  const activeOffset = layout
    ? (layout.viewportWidth - layout.slideWidth) / 2 -
      activeDisplayIndex * (layout.slideWidth + layout.gap)
    : 0;
  const trackStyle = {
    "--bb-exp-gap": layout ? `${layout.gap}px` : `${DESKTOP_GAP}px`,
    "--bb-exp-slide-w": layout ? `${layout.slideWidth}px` : "42vw",
    opacity: layout ? 1 : 0,
    transform: `translate3d(${activeOffset}px, 0, 0)`,
    transition: isRecenterJumping ? "none" : "transform 0.7s ease, opacity 0.16s ease",
  } as CSSProperties;

  function recenterIfNeeded(displayIndex: number) {
    if (!shouldRecenterDisplayIndex(displayIndex, n)) return;
    setIsRecenterJumping(true);
    setActiveDisplayIndex(getCenteredDisplayIndex(displayIndex, n));
  }

  function handleSlideKeyDown(event: KeyboardEvent<HTMLDivElement>, displayIndex: number) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setActiveDisplayIndex(displayIndex);
  }

  return (
    <div className="w-full pb-[42px]">
      <div className="w-full overflow-hidden" ref={viewportRef}>
        <div
          className={cn(
            "flex w-max gap-[var(--bb-exp-gap,40px)] will-change-transform",
            isRecenterJumping && "pointer-events-none",
          )}
          style={trackStyle}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "transform") {
              recenterIfNeeded(activeDisplayIndex);
            }
          }}
        >
          {loopArticles.map((article, i) => {
            const legacyKey = getLegacyExperienceKey(article);
            const legacyMedia = legacyKey ? LEGACY_EXPERIENCE_MEDIA[legacyKey] : null;
            const title = legacyMedia?.title ?? safeText(article.title, "Bài viết");
            const bgSrc =
              legacyMedia?.coverImage ?? resolveMediaUrl(article.coverImage?.url?.trim());
            const productSrc =
              legacyMedia?.productImage ||
              normalizeLegacyUploadUrl(article.productImage?.url?.trim()) ||
              normalizeLegacyUploadUrl(extractFirstImageUrl(article.body));
            const active = i === activeDisplayIndex;

            return (
              <div
                key={`${article.id}-${i}`}
                className={cn(
                  "flex min-w-0 flex-[0_0_var(--bb-exp-slide-w,42vw)] cursor-pointer select-none flex-col gap-0 transition-[opacity,transform] duration-500",
                  active && "group cursor-default",
                )}
                onClick={!active ? () => setActiveDisplayIndex(i) : undefined}
                onKeyDown={!active ? (event) => handleSlideKeyDown(event, i) : undefined}
                role={!active ? "button" : undefined}
                tabIndex={!active ? 0 : undefined}
                aria-label={!active ? `Chuyển đến: ${title}` : undefined}
              >
                <div
                  className="relative overflow-hidden [aspect-ratio:16/9]"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 35%, rgba(255, 12, 9, 0.18), transparent 38%), linear-gradient(135deg, #1a1a1a, #2a0606)",
                  }}
                >
                  {bgSrc ? (
                    <Image
                      src={bgSrc}
                      alt={safeText(article.coverImage?.alt, title)}
                      fill
                      className="h-full w-full object-cover transition-transform duration-300"
                      sizes="(max-width: 767px) 84vw, 42vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--bb-brand-primary-active),var(--bb-bg-surface-dark-2))]" />
                  )}
                </div>
                <div
                  className={cn(
                    "mt-[-32%] block translate-y-10 p-0 text-center opacity-0 invisible transition-[opacity,transform,visibility] duration-700 will-change-[opacity,transform]",
                    active && "visible translate-y-0 opacity-100",
                  )}
                >
                  {productSrc && (
                    <div
                      className={cn(
                        "pointer-events-none relative mx-auto w-1/2 max-w-[375px] [aspect-ratio:1/1] [filter:drop-shadow(0_4px_16px_rgba(0,0,0,0.55))] transition-[transform,opacity] duration-300 ease",
                        active && "group-hover:-translate-y-1.5",
                      )}
                      aria-hidden="true"
                    >
                      <Image
                        src={productSrc}
                        alt={safeText(article.productImage?.alt, title)}
                        fill
                        className="object-contain"
                        sizes="(max-width: 767px) 42vw, 22vw"
                      />
                    </div>
                  )}
                  <div className="grid justify-items-center gap-10 pt-3">
                    <p className="m-0 overflow-hidden text-center text-2xl font-bold uppercase leading-[1.25] text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                      {title}
                    </p>
                    {active && (
                      <Link
                        href={toArticlePath(article.slug)}
                        className="inline-flex items-center justify-center border border-brand bg-brand px-[0.95rem] py-2 text-xs font-bold uppercase tracking-[0.08em] text-white no-underline transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[var(--bb-brand-primary-hover)] hover:bg-[var(--bb-brand-primary-hover)]"
                      >
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
