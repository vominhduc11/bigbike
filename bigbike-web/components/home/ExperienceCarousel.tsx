"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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

const TRACK_DURATION_MS = 620;
// Symmetric ease-in-out for the horizontal track travel.
const TRACK_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
// Expo-out for elements that appear: fast burst in, long gentle settle.
const ENTER_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const DRAG_SNAP_DURATION_MS = 420;
const DRAG_ACTIVATE_PX = 8;
const DRAG_RESISTANCE = 0.55;
const FLICK_VELOCITY = 0.45;
// Horizontal travel of the overlay content during a swap. The swap
// duration itself is not a constant — it mirrors the track's travel
// time for each move (TRACK_DURATION_MS / DRAG_SNAP_DURATION_MS).
const OVERLAY_SHIFT_PX = 56;

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Resolves the cover + product imagery for one article, legacy overrides first. */
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

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

// Where an overlay layer sits. "centered" is the resting on-screen
// state; the two "off" placements are off-centre + transparent, used as
// the start of an incoming layer and the end of an outgoing one.
type OverlayPlacement = "centered" | "off-before" | "off-after";

/**
 * The product imagery + copy that stays pinned to the viewport centre.
 * Purely presentational: the parent stacks an incoming and an outgoing
 * instance and drives their `placement` to cross-fade between articles.
 */
function ExperienceOverlay({
  article,
  placement,
  interactive,
  animate,
  durationMs,
  suppressClickRef,
}: {
  article: Article;
  placement: OverlayPlacement;
  interactive: boolean;
  animate: boolean;
  durationMs: number;
  suppressClickRef: React.RefObject<boolean>;
}) {
  const media = resolveArticleMedia(article);

  const offsetPx =
    placement === "off-before"
      ? -OVERLAY_SHIFT_PX
      : placement === "off-after"
        ? OVERLAY_SHIFT_PX
        : 0;
  const opacity = placement === "centered" ? 1 : 0;

  const layerStyle: CSSProperties = {
    opacity,
    transform: `translate3d(${offsetPx}px, 0, 0)`,
    transition: animate
      ? `opacity ${durationMs}ms ${ENTER_EASING}, transform ${durationMs}ms ${ENTER_EASING}`
      : "none",
  };

  return (
    <div
      className={cn(
        // All layers occupy the same grid cell so they stack while the
        // wrapper still derives a real height from the tallest one.
        "group col-start-1 row-start-1 flex flex-col items-center text-center",
        !interactive && "pointer-events-none",
      )}
      style={layerStyle}
      aria-hidden={!interactive}
    >
      {media.productSrc && (
        <div
          className="pointer-events-none relative w-1/2 max-w-[375px] [aspect-ratio:1/1] [filter:drop-shadow(0_4px_16px_rgba(0,0,0,0.55))] transition-transform duration-300 ease-out group-hover:-translate-y-1.5"
          aria-hidden="true"
        >
          <Image
            src={media.productSrc}
            alt={media.productAlt}
            fill
            className="object-contain"
            sizes="(max-width: 767px) 42vw, 22vw"
            draggable={false}
          />
        </div>
      )}
      <div className="grid justify-items-center gap-10 pt-3">
        <p className="m-0 overflow-hidden text-center text-2xl font-bold uppercase leading-[1.25] text-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {media.title}
        </p>
        <Link
          href={toArticlePath(article.slug)}
          tabIndex={interactive ? 0 : -1}
          aria-hidden={!interactive}
          draggable={false}
          className={cn(
            "inline-flex items-center justify-center border border-brand bg-brand px-[0.95rem] py-2 text-sm font-bold uppercase tracking-[0.08em] text-white no-underline",
            "transition-[background-color,border-color,transform] duration-150 ease-out",
            "hover:-translate-y-px hover:border-[var(--bb-brand-primary-hover)] hover:bg-[var(--bb-brand-primary-hover)]",
            interactive ? "pointer-events-auto" : "pointer-events-none",
          )}
          onClick={(event) => {
            if (suppressClickRef.current) event.preventDefault();
          }}
        >
          Xem tiếp
        </Link>
      </div>
    </div>
  );
}

export function ExperienceCarousel({ articles }: Props) {
  const orderedArticles = useMemo(() => orderLikeLegacyWp(articles), [articles]);
  const n = orderedArticles.length;
  const loopArticles = useMemo(() => buildLoopArticles(orderedArticles), [orderedArticles]);
  const reducedMotion = usePrefersReducedMotion();

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
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
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Drives the centred overlay cross-fade. `article` is the one leaving,
  // `direction` is which way both layers slide, `committed` flips to true
  // one frame in so the incoming layer animates from off-state to centre,
  // and `durationMs` mirrors the track's travel time for this same move
  // so product and slider finish together.
  const [overlaySwap, setOverlaySwap] = useState<{
    article: Article;
    direction: 1 | -1;
    committed: boolean;
    durationMs: number;
  } | null>(null);

  // Transient pointer-drag bookkeeping. Kept in a ref, not state, so a
  // moving finger does not re-render every slide on each pointermove —
  // only dragDelta (throttled to one rAF) drives the visible transform.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    moved: boolean;
    rafId: number;
    pendingDelta: number;
    lastX: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  // Whether the last index change came from a drag release or a
  // click/keyboard — drives the track's transition speed, so it must be
  // render state rather than a ref.
  const [lastMoveSource, setLastMoveSource] = useState<"drag" | "select">("select");
  // Set true the instant a drag ends so the synthetic click the browser
  // fires right after pointerup does not also trigger slide selection.
  const suppressClickRef = useRef(false);
  // The display index the overlay last reflected, so a change can be
  // detected and its direction derived from the delta sign.
  const prevDisplayIndexRef = useRef<number>(initialDisplayIndex);
  const swapTimerRef = useRef<number>(0);
  const swapCommitRafRef = useRef<number>(0);

  const step = layout ? layout.slideWidth + layout.gap : 0;

  const restingOffset = layout
    ? (layout.viewportWidth - layout.slideWidth) / 2 - activeDisplayIndex * step
    : 0;

  const currentOffset = isDragging ? restingOffset + dragDelta : restingOffset;

  const activeArticle =
    n > 0 ? loopArticles[getLoopArticleIndex(activeDisplayIndex, n)] : null;

  // When the centred slide changes, capture the article leaving so both
  // layers can render together for the cross-fade. A recenter jump is
  // skipped: it lands on the same article and must not animate. The swap
  // duration is locked to whatever the track uses for this same move.
  useEffect(() => {
    const prevIndex = prevDisplayIndexRef.current;
    prevDisplayIndexRef.current = activeDisplayIndex;

    const delta = activeDisplayIndex - prevIndex;
    if (delta === 0 || isRecenterJumping || reducedMotion) return;

    const leavingArticle = loopArticles[getLoopArticleIndex(prevIndex, n)];
    const nextArticle = loopArticles[getLoopArticleIndex(activeDisplayIndex, n)];
    if (!leavingArticle || leavingArticle === nextArticle) return;

    setOverlaySwap({
      article: leavingArticle,
      direction: delta > 0 ? 1 : -1,
      committed: false,
      durationMs:
        lastMoveSource === "drag" ? DRAG_SNAP_DURATION_MS : TRACK_DURATION_MS,
    });
  }, [activeDisplayIndex, isRecenterJumping, lastMoveSource, loopArticles, n, reducedMotion]);

  // Two-step swap: render the incoming layer in its off-state, then on
  // the next frame flip `committed` so it transitions into the centre.
  // After the full duration, drop the outgoing layer.
  useEffect(() => {
    if (!overlaySwap || overlaySwap.committed) return;

    swapCommitRafRef.current = window.requestAnimationFrame(() => {
      swapCommitRafRef.current = window.requestAnimationFrame(() => {
        setOverlaySwap((current) =>
          current && !current.committed ? { ...current, committed: true } : current,
        );
      });
    });
    swapTimerRef.current = window.setTimeout(() => {
      setOverlaySwap(null);
    }, overlaySwap.durationMs + 32);

    return () => {
      window.cancelAnimationFrame(swapCommitRafRef.current);
      window.clearTimeout(swapTimerRef.current);
    };
  }, [overlaySwap]);

  // After a no-transition recenter jump, re-enable transitions only
  // once the browser has painted the jumped position. Reading layout
  // forces the style flush; the rAF defers the state flip out of the
  // effect body so no cascading synchronous render occurs.
  useEffect(() => {
    if (!isRecenterJumping) return;
    const track = trackRef.current;
    if (track) void getComputedStyle(track).transform;
    const rafId = window.requestAnimationFrame(() => {
      setIsRecenterJumping(false);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isRecenterJumping]);

  useEffect(() => {
    return () => {
      if (dragRef.current?.rafId) {
        window.cancelAnimationFrame(dragRef.current.rafId);
      }
    };
  }, []);

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

  const goToDisplayIndex = useCallback(
    (displayIndex: number, source: "drag" | "select" = "select") => {
      setLastMoveSource(source);
      const clamped = n > 1 ? clamp(displayIndex, 0, loopArticles.length - 1) : 0;
      setActiveDisplayIndex(clamped);
    },
    [loopArticles.length, n],
  );

  const recenterIfNeeded = useCallback(
    (displayIndex: number) => {
      if (!shouldRecenterDisplayIndex(displayIndex, n)) return;
      setIsRecenterJumping(true);
      setActiveDisplayIndex(getCenteredDisplayIndex(displayIndex, n));
    },
    [n],
  );

  const handleSlideKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, displayIndex: number) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      goToDisplayIndex(displayIndex);
    },
    [goToDisplayIndex],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (n <= 1 || !layout || dragRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        moved: false,
        rafId: 0,
        pendingDelta: 0,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
      };
    },
    [layout, n],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const rawDelta = event.clientX - drag.startX;

    // Promote to an active drag only once the finger clears the
    // threshold — below it, the gesture is still a candidate click.
    if (!drag.moved && Math.abs(rawDelta) > DRAG_ACTIVATE_PX) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }
    if (!drag.moved) return;

    // Track recent velocity (px per ms) so a quick flick can advance
    // a slide even when the travelled distance is short.
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) {
      drag.velocity = (event.clientX - drag.lastX) / elapsed;
      drag.lastX = event.clientX;
      drag.lastTime = event.timeStamp;
    }

    // Soften the pull for a subtle rubber-band feel, and coalesce
    // updates to one state write per frame.
    drag.pendingDelta = rawDelta * DRAG_RESISTANCE;
    if (!drag.rafId) {
      drag.rafId = window.requestAnimationFrame(() => {
        if (!dragRef.current) return;
        dragRef.current.rafId = 0;
        setDragDelta(dragRef.current.pendingDelta);
      });
    }
  }, []);

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.rafId) window.cancelAnimationFrame(drag.rafId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;

      if (drag.moved) {
        // Swallow the synthetic click the browser fires right after
        // pointerup. Clear on the next tick so a genuine later click
        // is never lost if no click follows this drag.
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (step > 0) {
          const slidesMoved = -drag.pendingDelta / step;
          let target = Math.round(activeDisplayIndex + slidesMoved);
          // A fast flick advances one slide in the flick direction even
          // if the finger barely travelled — matches native carousels.
          if (target === activeDisplayIndex && Math.abs(drag.velocity) > FLICK_VELOCITY) {
            target += drag.velocity < 0 ? 1 : -1;
          }
          goToDisplayIndex(target, "drag");
        }
      }
      setIsDragging(false);
      setDragDelta(0);
    },
    [activeDisplayIndex, goToDisplayIndex, step],
  );

  if (n === 0) return null;

  // Track transition resolves to one of three modes:
  // - "none": no animation (reduced motion, mid-drag, or recenter jump)
  // - snap: shorter curve after releasing a drag, so it feels reactive
  // - settle: longer curve for click / keyboard navigation
  const trackTransition = (() => {
    if (reducedMotion || isRecenterJumping || isDragging) return "none";
    const durationMs =
      lastMoveSource === "drag" ? DRAG_SNAP_DURATION_MS : TRACK_DURATION_MS;
    return `transform ${durationMs}ms ${TRACK_EASING}, opacity 0.18s ease`;
  })();

  const trackStyle = {
    "--bb-exp-gap": layout ? `${layout.gap}px` : `${DESKTOP_GAP}px`,
    "--bb-exp-slide-w": layout ? `${layout.slideWidth}px` : "42vw",
    opacity: layout ? 1 : 0,
    transform: `translate3d(${currentOffset}px, 0, 0)`,
    transition: trackTransition,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "w-full pb-[42px]",
        n > 1 && (isDragging ? "cursor-grabbing" : "cursor-grab"),
      )}
    >
      {/* Clips the horizontally overflowing cover slides. The overlay
          lives OUTSIDE this box so its product art is never cropped. */}
      <div className="w-full overflow-hidden" ref={viewportRef}>
        <div
          ref={trackRef}
          className={cn(
            "flex w-max gap-[var(--bb-exp-gap,40px)] touch-pan-y",
            (isDragging || isRecenterJumping) && "will-change-transform",
            isRecenterJumping && "pointer-events-none",
          )}
          style={trackStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget && event.propertyName === "transform") {
              recenterIfNeeded(activeDisplayIndex);
            }
          }}
        >
          {loopArticles.map((article, i) => {
            const media = resolveArticleMedia(article);
            const active = i === activeDisplayIndex;

            return (
              <div
                key={`${article.id}-${i}`}
                className={cn(
                  "flex min-w-0 flex-[0_0_var(--bb-exp-slide-w,42vw)] select-none flex-col",
                  "[transition:opacity_var(--bb-exp-side-ms)_var(--bb-exp-ease),transform_var(--bb-exp-side-ms)_var(--bb-exp-ease)]",
                  active
                    ? "z-[1] scale-100 opacity-100"
                    : "z-0 scale-[0.93] cursor-pointer opacity-[0.55] hover:opacity-80",
                )}
                style={
                  {
                    "--bb-exp-side-ms": reducedMotion ? "0ms" : `${TRACK_DURATION_MS}ms`,
                    "--bb-exp-ease": TRACK_EASING,
                  } as CSSProperties
                }
                onClick={
                  active
                    ? undefined
                    : () => {
                        if (suppressClickRef.current) return;
                        goToDisplayIndex(i);
                      }
                }
                onKeyDown={!active ? (event) => handleSlideKeyDown(event, i) : undefined}
                role={!active ? "button" : undefined}
                tabIndex={!active ? 0 : undefined}
                aria-label={!active ? `Chuyển đến: ${media.title}` : undefined}
              >
                <div
                  className="relative overflow-hidden [aspect-ratio:16/9]"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 35%, rgba(255, 12, 9, 0.18), transparent 38%), linear-gradient(135deg, #1a1a1a, #2a0606)",
                  }}
                >
                  {media.bgSrc ? (
                    <Image
                      src={media.bgSrc}
                      alt={media.bgAlt}
                      fill
                      className="h-full w-full object-cover"
                      sizes="(max-width: 767px) 84vw, 42vw"
                      draggable={false}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--bb-brand-primary-active),var(--bb-bg-surface-dark-2))]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Centred overlay — a sibling of the clipping box, pulled up over
          the track. Stays pinned to the centre while the track scrolls. */}
      {activeArticle &&
        (() => {
          // direction 1 (advancing): old content exits left, new
          // content enters from the right; -1 mirrors it.
          const outPlacement: OverlayPlacement =
            !overlaySwap || !overlaySwap.committed
              ? "centered"
              : overlaySwap.direction === 1
                ? "off-before"
                : "off-after";
          const inPlacement: OverlayPlacement =
            !overlaySwap || overlaySwap.committed
              ? "centered"
              : overlaySwap.direction === 1
                ? "off-after"
                : "off-before";

          return (
            <div
              // A single-cell grid: both the incoming and outgoing
              // layers occupy that cell so they stack, yet the wrapper
              // still takes the height of the taller layer. The negative
              // margin is computed from the slide width (a raw % margin
              // would resolve against the parent width instead) so the
              // product art overlaps the cover exactly as before.
              className="pointer-events-none relative z-[2] mx-auto grid w-[var(--bb-exp-slide-w,42vw)] grid-cols-1 [margin-top:calc(var(--bb-exp-slide-w,42vw)*-0.32)]"
              style={
                {
                  "--bb-exp-slide-w": layout ? `${layout.slideWidth}px` : "42vw",
                } as CSSProperties
              }
            >
              {/* Outgoing layer — only present mid-swap. */}
              {overlaySwap && (
                <ExperienceOverlay
                  key={`out-${overlaySwap.article.id}`}
                  article={overlaySwap.article}
                  placement={outPlacement}
                  interactive={false}
                  animate={overlaySwap.committed && !reducedMotion}
                  durationMs={overlaySwap.durationMs}
                  suppressClickRef={suppressClickRef}
                />
              )}

              {/* Active layer — incoming during a swap, otherwise the
                  settled, interactive overlay. */}
              <ExperienceOverlay
                key={`in-${activeArticle.id}`}
                article={activeArticle}
                placement={inPlacement}
                interactive={!overlaySwap || overlaySwap.committed}
                animate={Boolean(overlaySwap?.committed) && !reducedMotion}
                durationMs={overlaySwap?.durationMs ?? TRACK_DURATION_MS}
                suppressClickRef={suppressClickRef}
              />
            </div>
          );
        })()}
    </div>
  );
}
