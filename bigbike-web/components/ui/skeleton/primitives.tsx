/**
 * Shared skeleton primitives — atoms, the a11y root wrapper, and skeleton-owned
 * layout constants. Page-level skeletons live in the sibling files
 * (storefront/account/content) and compose these. Re-exported via
 * components/ui/Skeletons.tsx so call sites stay stable.
 *
 * Shimmer primitives come from lib/ui-classes (skelBase/…); the
 * `skeleton-shimmer` keyframe stays in globals.css.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { skelBase } from "@/lib/ui-classes";

/**
 * Skeleton-only catalog grid rail (the real archive page uses the bootstrap
 * col-md grid, not this). Ported from the former `.bb-cat-layout` rules:
 * mobile 1-col / md 2-col with a 220→240→260px sidebar at md/lg/xl, on the
 * fluid rail that tracks the archive container width at each breakpoint.
 */
export const bbCatLayout =
  "mx-auto mt-6 grid grid-cols-1 gap-0 bg-background pb-10 " +
  "w-[min(100%_-_calc(var(--bb-page-padding-mobile)_*_2),var(--bb-container-xl))] " +
  "md:mt-8 md:grid-cols-[220px_1fr] md:gap-7 md:pb-12 " +
  "md:w-[min(100%_-_calc(var(--bb-page-padding-tablet)_*_2),var(--bb-container-xl))] " +
  "lg:grid-cols-[240px_1fr] lg:w-[min(100%_-_calc(var(--bb-page-padding-desktop)_*_2),var(--bb-container-xl))] " +
  "xl:grid-cols-[260px_1fr] xl:gap-9";

/** Skeleton catalog-head row (former `.bb-catalog-head`). */
export const bbCatalogHead = "mb-[18px] flex items-center justify-between";

const sr: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function SkeletonRoot({
  label,
  labelKey,
  children,
  className,
}: {
  label?: string;
  /** Key trong namespace Loading — ưu tiên hơn `label` để đổi ngôn ngữ ở client. */
  labelKey?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("Loading");
  const text = labelKey ? t(labelKey) : label ?? "";
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span style={sr}>{text}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/* ── Atoms ──────────────────────────────────────────────────── */

export function SkelText({ w = "100%", h = "0.85em" }: { w?: string | number; h?: string | number }) {
  return <span className={skelBase} style={{ width: w, height: h, display: "block" }} />;
}

export function SkelTitle({ w = "60%", h = "1.4em" }: { w?: string | number; h?: string | number }) {
  return <span className={skelBase} style={{ width: w, height: h, display: "block" }} />;
}

// `rounded` is accepted for call-site compatibility but is a no-op: the global
// `.bb-theme :is(span…)` rule squares every skeleton shape regardless.
export function SkelBlock({
  w = "100%",
  h = 200,
  style,
}: {
  w?: string | number;
  h?: string | number;
  rounded?: boolean;
  style?: CSSProperties;
}) {
  return <span className={skelBase} style={{ display: "block", width: w, height: h, ...style }} />;
}

export function SkelCircle({ size = 40 }: { size?: number }) {
  return (
    <span
      className={cn(skelBase, "!rounded-full")}
      style={{ display: "inline-block", width: size, height: size, flexShrink: 0 }}
    />
  );
}

export function SkelChip({ w = 70 }: { w?: number }) {
  return <span className={cn(skelBase, "h-[1.6rem]")} style={{ display: "inline-block", width: w }} />;
}

export function SkelButton({ w = 140 }: { w?: number | string }) {
  return <span className={cn(skelBase, "h-10")} style={{ display: "inline-block", width: w }} />;
}

/* ── Atomic card skeletons ──────────────────────────────────── */

export function ProductCardSkel() {
  return (
    <div className="bb-product-card" aria-hidden="true">
      <div className="bb-product-image">
        <SkelBlock w="80%" h="80%" rounded={false} style={{ borderRadius: 0 }} />
      </div>
      <div className="bb-product-body">
        <SkelText w="40%" />
        <SkelTitle w="80%" h="1.05em" />
        <SkelText w="50%" />
        <SkelText w="35%" />
      </div>
    </div>
  );
}

export function ArticleCardSkel() {
  return (
    <div
      className="flex flex-col bg-card border-none rounded-none [box-shadow:var(--bb-shadow-md)] max-md:border max-md:border-solid max-md:border-border max-md:[box-shadow:none]"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <div className="relative aspect-[16/9] overflow-hidden shrink-0 bg-white">
        <SkelBlock w="100%" h="100%" rounded={false} style={{ position: "absolute", inset: 0 }} />
      </div>
      <div className="relative pt-[41px] px-5 pb-[30px] flex flex-col gap-2 flex-1 bg-card max-md:pt-[34px] max-md:px-[14px] max-md:pb-[18px]">
        <SkelTitle w="85%" h="1em" />
        <SkelText w="100%" />
        <SkelText w="60%" />
      </div>
    </div>
  );
}

export function CategoryTileSkel() {
  return (
    <div className="relative aspect-square" aria-hidden="true">
      <SkelBlock w="100%" h="100%" rounded={false} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
