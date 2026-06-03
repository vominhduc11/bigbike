/**
 * Layout-matched skeleton components.
 *
 * Each skeleton mirrors the structural composition of its target page so the
 * shell users see while data loads matches what eventually renders. Avoid
 * generic boxes — they cause layout shift and feel cheap.
 *
 * Shimmer primitives come from lib/ui-classes (skelBase/skelCol/skelRow/skelStack);
 * the `skeleton-shimmer` keyframe stays in globals.css. Shapes are the atoms below
 * (SkelText/SkelTitle/SkelBlock/SkelCircle/SkelChip/SkelButton).
 *
 * NOTE: page-layout classes SHARED with a real page (bb-product-grid, bb-breadcrumb,
 * bb-page-head, …) are intentionally NOT migrated here — this file MIRRORS those
 * pages, so it keeps their classes until each page itself moves to Tailwind.
 * Skeleton-OWNED layout (no real page uses it) is migrated independently: the PDP
 * grid (formerly bb-pdp / bb-pdp-below, with the real .bb-wp-pdp shell) and the
 * catalog grid rail (formerly bb-cat-layout, see bbCatLayout below) are inline.
 */

import type { CSSProperties, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { accountHeaderShell, accountSidebar, bbCard, bbSection, skelBase, skelCol, skelRow, skelStack } from "@/lib/ui-classes";

/**
 * Skeleton-only catalog grid rail (the real archive page uses the bootstrap
 * col-md grid, not this). Ported from the former `.bb-cat-layout` rules:
 * mobile 1-col / md 2-col with a 220→240→260px sidebar at md/lg/xl, on the
 * fluid rail that tracks the archive container width at each breakpoint.
 */
const bbCatLayout =
  "mx-auto mt-6 grid grid-cols-1 gap-0 bg-background pb-10 " +
  "w-[min(100%_-_calc(var(--bb-page-padding-mobile)_*_2),var(--bb-container-xl))] " +
  "md:mt-8 md:grid-cols-[220px_1fr] md:gap-7 md:pb-12 " +
  "md:w-[min(100%_-_calc(var(--bb-page-padding-tablet)_*_2),var(--bb-container-xl))] " +
  "lg:grid-cols-[240px_1fr] lg:w-[min(100%_-_calc(var(--bb-page-padding-desktop)_*_2),var(--bb-container-xl))] " +
  "xl:grid-cols-[260px_1fr] xl:gap-9";

/**
 * Skeleton-only card grid (the real archive uses the bootstrap col-md flex grid,
 * not this — see ProductArchiveResults). Ported from the former base
 * `.bb-product-grid` rule: 1 col / 2 cols ≥576 / 3 cols ≥992, 24px gap.
 */
const bbProductGridSkel =
  "grid grid-cols-1 gap-6 min-[576px]:grid-cols-2 min-[992px]:grid-cols-3";

/** Skeleton catalog-head row (former `.bb-catalog-head`). */
const bbCatalogHead = "mb-[18px] flex items-center justify-between";

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

function SkeletonRoot({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span style={sr}>{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/* ── Atoms ──────────────────────────────────────────────────── */

function SkelText({ w = "100%", h = "0.85em" }: { w?: string | number; h?: string | number }) {
  return <span className={skelBase} style={{ width: w, height: h, display: "block" }} />;
}

function SkelTitle({ w = "60%", h = "1.4em" }: { w?: string | number; h?: string | number }) {
  return <span className={skelBase} style={{ width: w, height: h, display: "block" }} />;
}

// `rounded` is accepted for call-site compatibility but is a no-op: the global
// `.bb-theme :is(span…)` rule squares every skeleton shape regardless.
function SkelBlock({
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

function SkelCircle({ size = 40 }: { size?: number }) {
  return (
    <span
      className={cn(skelBase, "!rounded-full")}
      style={{ display: "inline-block", width: size, height: size, flexShrink: 0 }}
    />
  );
}

function SkelChip({ w = 70 }: { w?: number }) {
  return <span className={cn(skelBase, "h-[1.6rem]")} style={{ display: "inline-block", width: w }} />;
}

function SkelButton({ w = 140 }: { w?: number | string }) {
  return <span className={cn(skelBase, "h-10")} style={{ display: "inline-block", width: w }} />;
}

/* ── Atomic card skeletons ──────────────────────────────────── */

function ProductCardSkel() {
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

function ArticleCardSkel() {
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

function CategoryTileSkel() {
  return (
    <div className="bb-cat-img-cell" aria-hidden="true">
      <SkelBlock w="100%" h="100%" rounded={false} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

/* ── Page-level skeletons ───────────────────────────────────── */

/** Homepage — hero + trust rail + 3-tile + 5 carousel + cat-grid + about + experience + news + brands. */
export function HomeSkeleton() {
  return (
    <SkeletonRoot label="Đang tải trang chủ" className="bb-home">
      {/* Hero slider */}
      <div className="relative w-full select-none bg-black [aspect-ratio:16/6] max-[600px]:aspect-[4/5]">
        <SkelBlock w="100%" h="100%" rounded={false} style={{ position: "absolute", inset: 0 }} />
      </div>

      {/* Trust rail */}
      <Container>
        <div className="bb-feature-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bb-feature-tile">
              <SkelCircle size={52} />
              <div className={skelCol} style={{ flex: 1 }}>
                <SkelTitle w="60%" />
                <SkelText w="100%" />
              </div>
            </div>
          ))}
        </div>

        {/* Featured 3-tile — nhãn danh mục + tên + nút "Mua ngay" */}
        <div className={bbSection}>
          <div className="grid grid-cols-1 gap-4 py-[var(--bb-space-12)] sm:grid-cols-2 lg:grid-cols-3 xl:gap-6 2xl:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex min-h-[200px] flex-col justify-center gap-3 bg-muted p-6">
                <SkelText w="35%" />
                <SkelTitle w="72%" />
                <SkelButton w={110} />
              </div>
            ))}
          </div>
        </div>

        {/* Product carousel */}
        <div className={bbSection}>
          <div className="bb-section-head">
            <div className={skelCol} style={{ flex: 1 }}>
              <SkelText w="18%" />
              <SkelTitle w="36%" h="1.6em" />
            </div>
            <SkelButton w={120} />
          </div>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <ProductCardSkel key={i} />
            ))}
          </div>
        </div>

        {/* Category grid (image tiles) */}
        <div className={bbSection}>
          <div className="bb-section-head">
            <div className={skelCol} style={{ flex: 1 }}>
              <SkelText w="22%" />
              <SkelTitle w="42%" h="1.6em" />
            </div>
          </div>
          <div className="bb-cat-grid-img">
            {Array.from({ length: 4 }).map((_, i) => (
              <CategoryTileSkel key={i} />
            ))}
          </div>
        </div>

        {/* News strip */}
        <div className={bbSection}>
          <div className="bb-section-head">
            <div className={skelCol} style={{ flex: 1 }}>
              <SkelText w="14%" />
              <SkelTitle w="34%" h="1.6em" />
            </div>
            <SkelButton w={120} />
          </div>
          <div className="grid grid-cols-3 gap-6 4xl:grid-cols-4 max-[901px]:grid-cols-2 max-[601px]:grid-cols-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <ArticleCardSkel key={i} />
            ))}
          </div>
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/** Product Detail — breadcrumb + 2-col gallery+info + tabs + related */
export function PdpSkeleton() {
  return (
    <SkeletonRoot label="Đang tải chi tiết sản phẩm">
      {/* Breadcrumb */}
      <div className="bb-breadcrumb">
        <SkelText w={220} />
      </div>

      {/* Two-col PDP */}
      <div className="grid grid-cols-[1.1fr_1fr] max-[769px]:grid-cols-1 gap-12 max-[601px]:gap-6 max-w-[var(--bb-container-wide)] 2xl:max-w-[1480px] min-[1920px]:max-w-[1760px] min-[2560px]:max-w-[2400px] mx-auto mt-5 px-6 max-[601px]:px-4 [align-items:start] min-w-0 [&>*]:min-w-0 bg-background">
        {/* Gallery — cover image with a thumbnail row below */}
        <div>
          <div style={{ aspectRatio: "1", minWidth: 0 }}>
            <SkelBlock w="100%" h="100%" />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 10,
              marginTop: 12,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ aspectRatio: "1" }}>
                <SkelBlock w="100%" h="100%" />
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className={skelCol}>
          <SkelText w="25%" />
          <SkelTitle w="80%" h="2em" />
          <SkelText w="35%" />
          <div style={{ borderTop: "1px solid var(--bb-border-subtle)", borderBottom: "1px solid var(--bb-border-subtle)", padding: "16px 0", margin: "16px 0" }}>
            <SkelTitle w="40%" h="1.8em" />
          </div>
          <SkelText w="20%" />
          <div className={skelRow} style={{ flexWrap: "wrap" }}>
            {Array.from({ length: 4 }).map((_, i) => <SkelChip key={i} w={60} />)}
          </div>
          <div className={skelRow} style={{ marginTop: 16 }}>
            <SkelButton w={140} />
            <SkelButton w={140} />
          </div>
        </div>
      </div>

      {/* Below-fold: tabs + related */}
      <div className="max-w-[var(--bb-container-wide)] 2xl:max-w-[1480px] min-[1920px]:max-w-[1760px] min-[2560px]:max-w-[2400px] mx-auto mt-12 max-[601px]:mt-7 px-6 pt-10 pb-0 max-[601px]:px-4 max-[601px]:pt-6 border-t border-t-[var(--bb-border-default)] bg-background">
        <div className={skelRow} style={{ borderBottom: "1px solid var(--bb-border-subtle)", marginBottom: 28 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: "14px 22px" }}>
              <SkelText w={100} />
            </div>
          ))}
        </div>
        <div className={skelStack}>
          <SkelText w="100%" />
          <SkelText w="92%" />
          <SkelText w="98%" />
          <SkelText w="60%" />
        </div>

        {/* Related products carousel */}
        <div style={{ marginTop: 48 }}>
          <SkelTitle w="30%" h="1.4em" />
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              marginTop: 16,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkel key={i} />
            ))}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Catalog (san-pham, danh-muc-san-pham) — page-head + sidebar + product-grid */
export function CatalogSkeleton({ withHero = false }: { withHero?: boolean }) {
  return (
    <SkeletonRoot label="Đang tải danh mục sản phẩm">
      {withHero && (
        <div className="relative h-[300px] md:h-[430px]">
          <SkelBlock w="100%" h="100%" rounded={false} style={{ position: "absolute", inset: 0 }} />
        </div>
      )}
      {!withHero && (
        <>
          <div className="bb-breadcrumb"><SkelText w={180} /></div>
          <div className="bb-page-head">
            <SkelText w="15%" />
            <SkelTitle w="40%" h="2em" />
          </div>
        </>
      )}

      <div className={bbCatLayout}>
        {/* Sidebar filters */}
        <aside className="bb-filters-v2">
          <div className={skelStack}>
            <SkelTitle w="50%" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={skelStack} style={{ paddingBlock: 12, borderBottom: "1px solid var(--bb-border-subtle)" }}>
                <SkelText w="60%" />
                <SkelText w="80%" />
                <SkelText w="70%" />
              </div>
            ))}
            <SkelButton w="100%" />
          </div>
        </aside>

        {/* Grid */}
        <div>
          <div className={bbCatalogHead}>
            <SkelText w={140} />
            <SkelButton w={160} />
          </div>
          <div className={bbProductGridSkel}>
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkel key={i} />)}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Category list — breadcrumb + page-head + grid of category cards */
export function CategoryListSkeleton() {
  return (
    <SkeletonRoot label="Đang tải danh sách danh mục">
      <div className="bb-breadcrumb"><SkelText w={160} /></div>
      <div className="bb-page-head">
        <SkelText w="15%" />
        <SkelTitle w="40%" h="2em" />
      </div>
      <Container className="pb-16">
        <div className="bb-grid-categories">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={bbCard}>
              <SkelBlock w="100%" style={{ aspectRatio: "16/9" }} />
              <div style={{ padding: 16, display: "grid", gap: 8 }}>
                <SkelTitle w="60%" />
                <SkelText w="80%" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/** Brand list — page-head + grid of brand tiles */
export function BrandListSkeleton() {
  return (
    <SkeletonRoot label="Đang tải danh sách thương hiệu">
      <div className="bb-breadcrumb"><SkelText w={150} /></div>
      <div className="bb-page-head">
        <SkelText w="15%" />
        <SkelTitle w="35%" h="2em" />
      </div>
      <Container>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <SkelBlock key={i} w="100%" h={120} />
          ))}
        </div>
      </Container>
    </SkeletonRoot>
  );
}

/** Brand detail — breadcrumb + page-head + brand-logo + sidebar + grid */
export function BrandDetailSkeleton() {
  return (
    <SkeletonRoot label="Đang tải trang thương hiệu">
      <div className="bb-breadcrumb"><SkelText w={220} /></div>
      <div className="bb-page-head">
        <SkelText w="12%" />
        <SkelTitle w="35%" h="2em" />
        <SkelText w="60%" />
      </div>
      <Container className="mb-6">
        <SkelBlock w="100%" h={180} />
      </Container>
      <div className={bbCatLayout}>
        <aside className="bb-filters-v2">
          <div className={skelStack}>
            <SkelTitle w="50%" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={skelStack} style={{ paddingBlock: 12, borderBottom: "1px solid var(--bb-border-subtle)" }}>
                <SkelText w="60%" />
                <SkelText w="80%" />
              </div>
            ))}
          </div>
        </aside>
        <div>
          <div className={bbCatalogHead}>
            <SkelText w={140} />
            <SkelButton w={160} />
          </div>
          <div className={bbProductGridSkel}>
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkel key={i} />)}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Article detail (tin-tuc/[slug]) — breadcrumb + meta + h1 + cover + body */
export function ArticleDetailSkeleton({ label = "Loading article" }: { label?: string }) {
  return (
    <SkeletonRoot label={label}>
      <section
        className="relative mb-[90px] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/wp/page-title-bg.png')" }}
      >
        <div className="mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px]">
          <div className="-mx-[15px] flex min-h-[450px] flex-wrap items-center">
            <div className="relative w-full px-[15px] md:w-1/2">
              <SkelTitle w="82%" h="1.8em" />
              <div className="mt-3 flex gap-2">
                <SkelText w={90} />
                <SkelText w={180} />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="pb-10">
        <div className="mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px]">
          <div className="-mx-[15px] flex flex-wrap">
            <div className="relative w-full px-[15px]">
              <div className={skelStack}>
                <SkelTitle w="50%" h="2em" />
                <SkelText w="98%" />
                <SkelText w="100%" />
                <SkelText w="92%" />
                <SkelText w="96%" />
                <SkelText w="60%" />
                <SkelBlock w="100%" h={280} />
                <SkelText w="100%" />
                <SkelText w="78%" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Checkout — breadcrumb + page-head + stepper + 2-col form+summary */
export function CheckoutSkeleton() {
  return (
    <SkeletonRoot label="Đang tải trang thanh toán">
      <div className="bb-breadcrumb"><SkelText w={180} /></div>
      <div className="bb-page-head">
        <SkelText w="10%" />
        <SkelTitle w="25%" h="2em" />
      </div>
      <div className="grid grid-cols-[1fr_420px] max-[1025px]:grid-cols-1 gap-8 max-md:gap-[14px] max-w-[var(--bb-container-wide)] min-[1536px]:max-w-[1480px] min-[1920px]:max-w-[1760px] min-[2560px]:max-w-[2400px] mx-auto mb-10 max-md:mb-7 px-6 max-md:px-[var(--bb-mobile-page-x)]">
        <div>
          {/* Stepper */}
          <div className="flex gap-0 mb-6 max-md:mb-[14px] border-b border-b-border max-[601px]:overflow-x-auto max-[601px]:flex-nowrap max-[601px]:[scrollbar-width:none] max-[601px]:[&::-webkit-scrollbar]:hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-1 items-center gap-3 py-[14px] px-4 max-md:py-2.5 max-md:px-3 border-b-[3px] border-b-transparent text-muted-foreground cursor-pointer [transition:all_140ms] max-md:min-w-[132px] max-md:min-h-[var(--bb-touch-target)]"
              >
                <SkelCircle size={28} />
                <div className={skelCol} style={{ flex: 1 }}>
                  <SkelText w="60%" />
                  <SkelText w="80%" />
                </div>
              </div>
            ))}
          </div>
          {/* Form section 1 */}
          <div className="bg-card border border-border rounded-none py-[22px] px-6 max-md:py-4 max-md:px-[14px] mb-[18px] max-md:mb-3">
            <SkelTitle w="40%" />
            <div
              style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", marginTop: 18 }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={skelStack}>
                  <SkelText w="40%" />
                  <SkelBlock w="100%" h={42} />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-none py-[22px] px-6 max-md:py-4 max-md:px-[14px] mb-[18px] max-md:mb-3">
            <SkelTitle w="35%" />
            <div className={skelStack} style={{ marginTop: 18 }}>
              <SkelBlock w="100%" h={56} />
              <SkelBlock w="100%" h={56} />
            </div>
          </div>
        </div>
        <aside className="bg-card border border-border rounded-none p-[22px] max-md:py-4 max-md:px-[14px] sticky max-[769px]:static top-[calc(var(--bb-header-height)+34px+16px)] [align-self:start] max-md:mb-3">
          <div className={skelStack}>
            <SkelTitle w="60%" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={skelRow}>
                <SkelBlock w={56} h={56} />
                <div className={skelCol} style={{ flex: 1 }}>
                  <SkelText w="40%" />
                  <SkelText w="85%" />
                </div>
                <SkelText w={60} />
              </div>
            ))}
            <SkelText w="100%" />
            <SkelText w="100%" />
            <SkelTitle w="60%" h="1.4em" />
          </div>
        </aside>
      </div>
    </SkeletonRoot>
  );
}

/** Account inner content — fits inside AccountShell main column */
export function AccountInnerSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonRoot label="Đang tải nội dung tài khoản">
      <div className={accountHeaderShell}>
        <div className={skelCol} style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="50%" />
        </div>
      </div>
      <div className={skelStack}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkelBlock key={i} w="100%" h={120} />
        ))}
      </div>
    </SkeletonRoot>
  );
}

/** Full Account layout (sidebar + main) — used when AccountShell hasn't loaded yet */
export function AccountLayoutSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonRoot label="Đang tải trang tài khoản" className="bb-account-layout">
      <aside className={accountSidebar}>
        <div style={{ padding: "24px 22px", borderBottom: "1px solid var(--bb-border-subtle)" }}>
          <SkelCircle size={56} />
          <div className={skelStack} style={{ marginTop: 12 }}>
            <SkelText w="60%" />
            <SkelText w="80%" />
          </div>
        </div>
        <div className={skelStack} style={{ padding: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelBlock key={i} w="100%" h={36} />
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <div className={accountHeaderShell}>
          <div className={skelCol} style={{ flex: 1 }}>
            <SkelTitle w="30%" h="1.6em" />
            <SkelText w="50%" />
          </div>
        </div>
        <div className={skelStack}>
          {Array.from({ length: rows }).map((_, i) => (
            <SkelBlock key={i} w="100%" h={120} />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Order list — header + tabs + N order cards */
export function OrderListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonRoot label="Đang tải danh sách đơn hàng">
      <div className={accountHeaderShell}>
        <div className={skelCol} style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="40%" />
        </div>
      </div>
      <div className={skelRow} style={{ borderBottom: "1px solid var(--bb-border-subtle)", marginBottom: 20 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ padding: "12px 20px" }}><SkelText w={80} /></div>
        ))}
      </div>
      <div className={skelStack}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bb-order-card">
            <div className="bb-order-head">
              <div className={skelRow} style={{ flex: 1, gap: 22 }}>
                <div className={skelCol}><SkelText w={50} /><SkelText w={80} /></div>
                <div className={skelCol}><SkelText w={50} /><SkelText w={90} /></div>
                <div className={skelCol}><SkelText w={50} /><SkelText w={70} /></div>
              </div>
              <SkelChip w={90} />
            </div>
            <div className="bb-order-body">
              <div className={skelRow}>
                {Array.from({ length: 3 }).map((_, j) => <SkelBlock key={j} w={56} h={56} />)}
              </div>
              <div className={skelCol} style={{ flex: 1 }}>
                <SkelText w="60%" />
                <SkelText w="40%" />
              </div>
              <div className={skelCol} style={{ alignItems: "flex-end" }}>
                <SkelTitle w={120} h="1.2em" />
                <SkelText w={80} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonRoot>
  );
}

/** Order detail — header + summary card + items + totals + addresses */
export function OrderDetailSkeleton() {
  return (
    <SkeletonRoot label="Đang tải chi tiết đơn hàng">
      <div className={accountHeaderShell}>
        <div className={skelCol} style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="20%" />
        </div>
      </div>
      <div className={skelStack}>
        <SkelBlock w="100%" h={200} />
        <SkelBlock w="100%" h={160} />
        <SkelBlock w="100%" h={140} />
      </div>
    </SkeletonRoot>
  );
}

/** Form skeleton — page header + label/input rows + button */
export function FormSkeleton({
  fields = 6,
  twoCol = true,
}: { fields?: number; twoCol?: boolean }) {
  return (
    <SkeletonRoot label="Đang tải biểu mẫu">
      <div className={accountHeaderShell}>
        <div className={skelCol} style={{ flex: 1 }}>
          <SkelTitle w="25%" h="1.6em" />
          <SkelText w="40%" />
        </div>
      </div>
      <div
        style={{
          padding: "22px 24px",
          background: "var(--bb-bg-surface)",
          border: "1px solid var(--bb-border-subtle)",
          borderRadius: "var(--bb-radius-card)",
        }}
      >
        <SkelText w="20%" />
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
            marginTop: 18,
          }}
        >
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className={skelStack}>
              <SkelText w="40%" />
              <SkelBlock w="100%" h={42} />
            </div>
          ))}
        </div>
        <SkelButton w={160} />
      </div>
    </SkeletonRoot>
  );
}

/** Auth (login/register/forgot-password) — small centered card */
export function AuthSkeleton() {
  return (
    <SkeletonRoot label="Đang tải biểu mẫu xác thực">
      <section className="bb-page bb-page--auth">
        <Container>
          <div className="bb-auth-wrap">
            <Card className="p-6 border-t-[3px] border-t-primary">
              <div className={skelStack}>
                <SkelTitle w="60%" h="1.8em" />
                <div style={{ height: 8 }} />
                <SkelText w="40%" />
                <SkelBlock w="100%" h={42} />
                <SkelText w="40%" />
                <SkelBlock w="100%" h={42} />
                <SkelButton w="100%" />
                <SkelText w="55%" />
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/** Static / CMS page — h1 + body paragraphs */
export function StaticPageSkeleton({ title = "Loading content" }: { title?: string }) {
  return (
    <SkeletonRoot label={title}>
      <section className="bb-page">
        <Container>
          <header style={{ marginBottom: 24 }}>
            <SkelTitle w="55%" h="2.2em" />
          </header>
          <div className={skelStack}>
            <SkelText w="100%" />
            <SkelText w="92%" />
            <SkelText w="98%" />
            <SkelText w="60%" />
            <SkelText w="100%" />
            <SkelText w="78%" />
            <SkelText w="92%" />
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/** Search page — header + query form + result skeleton (mixed grid) */
export function SearchSkeleton({ label = "Loading search results" }: { label?: string }) {
  return (
    <SkeletonRoot label={label}>
      <section className="bb-page">
        <Container>
          <header>
            <SkelTitle w="20%" h="2em" />
          </header>
          <div className={cn("bb-query-form", skelStack)} style={{ marginTop: 16 }}>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
              <SkelBlock w="100%" h={42} />
              <SkelBlock w="100%" h={42} />
            </div>
            <SkelButton w={160} />
          </div>
          <div style={{ marginTop: 24 }}>
            <SkelTitle w="20%" />
            <div className="bb-grid-products" style={{ marginTop: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => <ProductCardSkel key={i} />)}
            </div>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/** Order confirmation / success screen */
export function OrderConfirmSkeleton() {
  return (
    <SkeletonRoot label="Đang xác nhận đơn hàng">
      <div className="bb-success">
        <SkelCircle size={88} />
        <div className={skelStack} style={{ marginTop: 22, alignItems: "center" }}>
          <SkelText w={120} />
          <SkelTitle w="60%" h="2.2em" />
          <SkelText w="80%" />
        </div>
        <div className="order-card" style={{ marginTop: 22 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={skelStack}>
              <SkelText w="50%" />
              <SkelTitle w="80%" h="1.2em" />
            </div>
          ))}
        </div>
        <div className="cta-row" style={{ marginTop: 22 }}>
          <SkelButton w={180} />
          <SkelButton w={200} />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Contact page — hero + 2-col (info blocks / map) */
export function ContactSkeleton() {
  return (
    <SkeletonRoot label="Đang tải trang liên hệ">
      <section className="bb-page">
        <SkelBlock w="100%" h={300} />
        <Container>
          <div
            style={{
              display: "grid",
              gap: 60,
              gridTemplateColumns: "1fr 1fr",
              paddingTop: 50,
              paddingBottom: 60,
            }}
          >
            <div className={skelStack}>
              <SkelTitle w="55%" h="1.6em" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: 16, paddingTop: 16, paddingBottom: 16 }}>
                  <SkelBlock w={28} h={28} />
                  <div style={{ flex: 1 }}>
                    <SkelText w="40%" />
                    <SkelText w="80%" />
                  </div>
                </div>
              ))}
            </div>
            <div className={skelStack}>
              <SkelTitle w="55%" h="1.6em" />
              <SkelBlock w="100%" h={420} />
              <SkelBlock w="100%" h={48} />
            </div>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}

/** Guide landing — sidebar nav + content */
export function GuideSkeleton({ label = "Loading guide" }: { label?: string }) {
  return (
    <SkeletonRoot label={label}>
      <section className="bb-page">
        <Container>
          <div style={{ display: "grid", gap: 28, gridTemplateColumns: "260px 1fr" }}>
            <aside className={skelStack}>
              <SkelTitle w="60%" />
              {Array.from({ length: 6 }).map((_, i) => (
                <SkelBlock key={i} w="100%" h={36} />
              ))}
            </aside>
            <div>
              <SkelTitle w="50%" h="2em" />
              <div className={skelStack} style={{ marginTop: 20 }}>
                <SkelText w="100%" />
                <SkelText w="92%" />
                <SkelText w="98%" />
                <SkelText w="80%" />
                <SkelText w="60%" />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </SkeletonRoot>
  );
}
