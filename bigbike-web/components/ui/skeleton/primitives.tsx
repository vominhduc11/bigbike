/**
 * Shared skeleton primitives — atoms, the a11y root wrapper, and the card /
 * page-shell mirrors. Page-level skeletons live in the sibling files
 * (storefront/account/content) and compose these. Re-exported via
 * components/ui/Skeletons.tsx so call sites stay stable.
 *
 * Shimmer primitives come from lib/ui-classes (skelBase/…); the
 * `skeleton-shimmer` keyframe stays in globals.css. components/ui/skeleton.tsx
 * (`<Skeleton>`) uses the SAME base so the whole site has one loading effect.
 *
 * QUY TẮC: mỗi mảnh dưới đây phải sao lại đúng khung của component thật nó thay
 * thế (cùng class bố cục, cùng chiều cao, cùng số cột) — sửa component thật thì
 * sửa luôn mảnh tương ứng ở đây. Không dựng khối mà trang thật không có.
 */

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { skelBase } from "@/lib/ui-classes";

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
  className,
  style,
}: {
  /** `null` = để className tự lo kích thước (vd cần đổi theo breakpoint). */
  w?: string | number | null;
  h?: string | number | null;
  rounded?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(skelBase, className)}
      style={{
        display: "block",
        ...(w == null ? {} : { width: w }),
        ...(h == null ? {} : { height: h }),
        ...style,
      }}
    />
  );
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

export function SkelButton({ w = 140, h }: { w?: number | string; h?: number | string }) {
  return (
    <span
      className={cn(skelBase, h == null && "h-10")}
      style={{ display: "inline-block", width: w, ...(h == null ? {} : { height: h }) }}
    />
  );
}

/* ── Page shells ────────────────────────────────────────────── */

/**
 * Băng-rôn tiêu đề trang — sao lại components/layout/PageHero.tsx:
 * `mb-22.5 min-h-62.5 md:min-h-112.5` (250px điện thoại / 450px máy tính), nội dung
 * nằm trong Container, nửa trái, tiêu đề + breadcrumb.
 *
 * `className` nhận đúng override mà trang thật truyền (vd "mb-4 md:mb-22.5" ở
 * /sp, /tim-kiem, /danh-muc) để khoảng cách dưới băng-rôn không lệch.
 */
export function PageHeroSkel({ className }: { className?: string }) {
  return (
    <div
      data-page-hero
      data-bb-full-bleed
      className={cn(
        "relative mb-22.5 min-h-62.5 overflow-hidden bg-secondary md:min-h-112.5",
        className,
      )}
    >
      {/* Băng-rôn thật là một tấm ảnh lớn → chỗ giữ chỗ cũng phải "đặc" như ảnh,
          không phải nền trắng gần như vô hình. */}
      <SkelBlock w="100%" h="100%" style={{ position: "absolute", inset: 0 }} />
      <Container className="relative z-10 flex min-h-62.5 items-center md:min-h-112.5">
        {/* Chữ trên băng-rôn thật màu trắng → vệt giữ chỗ cũng sáng để nổi trên nền. */}
        <div className="w-full md:w-1/2 [&_span]:!bg-white/45 [&_span]:!bg-none">
          <SkelTitle w="70%" h="1.9em" />
          <div className="mt-2">
            <SkelText w={190} />
          </div>
        </div>
      </Container>
    </div>
  );
}

/**
 * Tiêu đề + breadcrumb của khung KHÔNG-hero (/gio-hang, /dat-hang) — sao lại
 * components/layout/CheckoutPageHeading.tsx: `mt-6 md:mt-16`, h1 rồi nav `mt-5`.
 */
export function CheckoutHeadingSkel() {
  return (
    <div className="mt-6 md:mt-16">
      <SkelTitle w={190} h="1.6em" />
      <div className="mt-5">
        <SkelText w={170} />
      </div>
    </div>
  );
}

/* ── Atomic card skeletons ──────────────────────────────────── */

/**
 * Thẻ sản phẩm — sao lại components/catalog/ProductCard.tsx: KHÔNG viền, ảnh
 * vuông `mb-5`, tên 2 dòng (`min-h-10`), rồi dòng giá. Bọc ngoài `mt-8` đúng như
 * thẻ thật để hàng đầu tiên không bị lệch.
 */
export function ProductCardSkel() {
  return (
    <div className="mt-8 flex h-full min-w-0 flex-col" aria-hidden="true">
      <div className="relative mb-5 aspect-square overflow-hidden bg-background">
        <SkelBlock w="100%" h="100%" style={{ position: "absolute", inset: 0 }} />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex min-h-10 flex-col gap-1.5">
          <SkelText w="95%" />
          <SkelText w="60%" />
        </div>
        <SkelText w="45%" />
      </div>
    </div>
  );
}

/**
 * Thẻ bài viết trang Tin tức / kết quả tìm kiếm — sao lại
 * components/content/ArticleCard.tsx (biến thể mặc định), kể cả nhãn ngày cắt
 * góc chồng lên mép ảnh và đoạn tóm tắt `min-h-26`.
 */
export function ArticleCardSkel() {
  return (
    <div
      className="flex flex-col bg-card border-none rounded-none [box-shadow:var(--bb-shadow-md)] max-md:border max-md:border-solid max-md:border-border max-md:[box-shadow:none]"
      aria-hidden="true"
    >
      <div className="relative aspect-[16/9] overflow-hidden shrink-0 bg-white">
        <SkelBlock w="100%" h="100%" style={{ position: "absolute", inset: 0 }} />
      </div>
      <div className="relative pt-[41px] px-5 pb-7.5 flex flex-col gap-2 flex-1 bg-card max-md:pt-8.5 max-md:px-3.5 max-md:pb-4.5">
        <span
          className={cn(
            skelBase,
            "absolute -top-[21px] left-0 z-[2] h-10.5 w-42 [clip-path:polygon(0_0,100%_0,calc(100%-18px)_100%,0_100%)]",
          )}
        />
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex flex-col gap-1.5">
            <SkelText w="100%" />
            <SkelText w="70%" />
          </div>
          <div className="flex min-h-26 flex-col gap-1.5 max-md:min-h-0">
            <SkelText w="100%" />
            <SkelText w="96%" />
            <SkelText w="99%" />
            <SkelText w="55%" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Thẻ tin trang chủ — sao lại components/home/HomeNewsList.tsx (khác thẻ trang
 * Tin tức: nền có đổ bóng nhẹ, nhãn ngày vát chéo nhô lên `-top-5`).
 */
export function HomeNewsCardSkel() {
  return (
    <div className="bg-card shadow-sm" aria-hidden="true">
      <div className="aspect-video overflow-hidden">
        <SkelBlock w="100%" h="100%" />
      </div>
      <div className="relative">
        <div className="absolute -top-5 left-0 flex h-10 items-stretch">
          <SkelBlock w={110} h="100%" />
          <span className={cn(skelBase, "-ml-2 block w-6 skew-x-[-20deg]")} />
        </div>
        <div className="px-5 pb-8 pt-10">
          <div className="mb-6 flex flex-col gap-2">
            <SkelText w="95%" h="1.1em" />
            <SkelText w="65%" h="1.1em" />
          </div>
          <div className="flex flex-col gap-1.5">
            <SkelText w="100%" />
            <SkelText w="88%" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Ô danh mục trang chủ — sao lại components/home/HomeCategoryGrid.tsx: ô viền,
 * cao `h-72.5`, icon tròn giữa ô rồi tên danh mục.
 */
export function CategoryTileSkel() {
  return (
    <div className="border border-border text-center" aria-hidden="true">
      <div className="relative flex h-72.5 items-center justify-center overflow-hidden bg-card">
        <div className="block w-full px-4">
          <div className="mx-auto size-16 md:size-20 lg:size-24">
            <SkelBlock w="100%" h="100%" />
          </div>
          <div className="mt-7.5 flex flex-col items-center gap-1.5">
            <SkelText w="70%" />
            <SkelText w="45%" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Ô "sản phẩm nổi bật" trang chủ — sao lại khối `data-home-highlight-grid` trong
 * app/[locale]/(storefront)/(home)/page.tsx: thẻ viền cao `h-75`, ảnh 180px nằm
 * góc dưới phải, tên 2 dòng, rồi liên kết "Mua ngay" (là CHỮ, không phải nút).
 */
export function HomeHighlightCardSkel() {
  return (
    <div className="relative h-75 overflow-hidden border border-border bg-card p-8" aria-hidden="true">
      <div className="absolute bottom-0 right-8">
        <div className="relative size-45">
          <SkelBlock w="100%" h="100%" />
        </div>
      </div>
      <div className="relative z-[1] mb-10 flex flex-col gap-2">
        <SkelText w="80%" h="1.1em" />
        <SkelText w="50%" h="1.1em" />
      </div>
      <SkelText w={90} />
    </div>
  );
}

/**
 * Thẻ thương hiệu — sao lại lưới trong app/[locale]/(storefront)/brands/BrandListClient.tsx.
 */
export function BrandCardSkel() {
  return (
    <div
      className="flex h-full flex-col items-center justify-between gap-4 border border-border bg-white p-5"
      aria-hidden="true"
    >
      <SkelBlock w="80%" h={64} />
      <SkelBlock w="60%" h={16} />
    </div>
  );
}

/** Tiêu đề khối trang chủ (kicker + tiêu đề) — luôn CĂN GIỮA như trang thật. */
export function HomeBlockHeadingSkel({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="mb-2">
        <SkelText w={140} />
      </div>
      <SkelTitle w={280} h="1.6em" />
    </div>
  );
}
