/**
 * Layout-matched skeleton components.
 *
 * Each skeleton mirrors the structural composition of its target page so the
 * shell users see while data loads matches what eventually renders. Avoid
 * generic boxes — they cause layout shift and feel cheap.
 *
 * Compose with primitives from globals.css:
 *   .bb-skel              shimmer base
 *   .bb-skel--text/title  text-line shapes
 *   .bb-skel--block       larger image/card block
 *   .bb-skel--circle      avatar/icon
 *   .bb-skel--btn/chip    button/chip shapes
 *   .bb-skel-w-{40,60,…}  width helpers
 */

import type { CSSProperties, ReactNode } from "react";
import { Card } from "@/components/ui/card";

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
  return <span className="bb-skel bb-skel--text" style={{ width: w, height: h, display: "block" }} />;
}

function SkelTitle({ w = "60%", h = "1.4em" }: { w?: string | number; h?: string | number }) {
  return <span className="bb-skel bb-skel--title" style={{ width: w, height: h, display: "block" }} />;
}

function SkelBlock({
  w = "100%",
  h = 200,
  rounded = true,
  style,
}: {
  w?: string | number;
  h?: string | number;
  rounded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`bb-skel${rounded ? " bb-skel--block" : ""}`}
      style={{ display: "block", width: w, height: h, ...style }}
    />
  );
}

function SkelCircle({ size = 40 }: { size?: number }) {
  return (
    <span
      className="bb-skel bb-skel--circle"
      style={{ display: "inline-block", width: size, height: size, flexShrink: 0 }}
    />
  );
}

function SkelChip({ w = 70 }: { w?: number }) {
  return <span className="bb-skel bb-skel--chip" style={{ display: "inline-block", width: w }} />;
}

function SkelButton({ w = 140 }: { w?: number | string }) {
  return <span className="bb-skel bb-skel--btn" style={{ display: "inline-block", width: w }} />;
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
    <div className="bb-news-card" aria-hidden="true" style={{ pointerEvents: "none" }}>
      <div className="bb-news-img-wrap">
        <SkelBlock w="100%" h="100%" rounded={false} style={{ position: "absolute", inset: 0 }} />
      </div>
      <div className="bb-news-body">
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
      <div className="bb-container">
        <div className="bb-feature-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bb-feature-tile">
              <SkelCircle size={52} />
              <div className="bb-skel-col" style={{ flex: 1 }}>
                <SkelTitle w="60%" />
                <SkelText w="100%" />
              </div>
            </div>
          ))}
        </div>

        {/* Featured 3-tile — nhãn danh mục + tên + nút "Mua ngay" */}
        <div className="bb-section">
          <div className="grid grid-cols-3 gap-4 py-[var(--bb-space-12)] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
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
        <div className="bb-section">
          <div className="bb-section-head">
            <div className="bb-skel-col" style={{ flex: 1 }}>
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
        <div className="bb-section">
          <div className="bb-section-head">
            <div className="bb-skel-col" style={{ flex: 1 }}>
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
        <div className="bb-section">
          <div className="bb-section-head">
            <div className="bb-skel-col" style={{ flex: 1 }}>
              <SkelText w="14%" />
              <SkelTitle w="34%" h="1.6em" />
            </div>
            <SkelButton w={120} />
          </div>
          <div className="bb-articles-grid-v2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ArticleCardSkel key={i} />
            ))}
          </div>
        </div>
      </div>
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
      <div className="bb-pdp">
        {/* Gallery */}
        <div>
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                width: 82,
                flexShrink: 0,
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <SkelBlock key={i} w={82} h={82} />
              ))}
            </div>
            <div style={{ flex: 1, aspectRatio: "1", minWidth: 0 }}>
              <SkelBlock w="100%" h="100%" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bb-skel-col">
          <SkelText w="25%" />
          <SkelTitle w="80%" h="2em" />
          <SkelText w="35%" />
          <div style={{ borderTop: "1px solid var(--bb-border-subtle)", borderBottom: "1px solid var(--bb-border-subtle)", padding: "16px 0", margin: "16px 0" }}>
            <SkelTitle w="40%" h="1.8em" />
          </div>
          <SkelText w="20%" />
          <div className="bb-skel-row" style={{ flexWrap: "wrap" }}>
            {Array.from({ length: 4 }).map((_, i) => <SkelChip key={i} w={60} />)}
          </div>
          <div className="bb-skel-row" style={{ marginTop: 16 }}>
            <SkelButton w={140} />
            <SkelButton w={140} />
          </div>
        </div>
      </div>

      {/* Below-fold: tabs + related */}
      <div className="bb-pdp-below">
        <div className="bb-skel-row" style={{ borderBottom: "1px solid var(--bb-border-subtle)", marginBottom: 28 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: "14px 22px" }}>
              <SkelText w={100} />
            </div>
          ))}
        </div>
        <div className="bb-skel-stack">
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
        <div className="bb-cat-hero" style={{ position: "relative" }}>
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

      <div className="bb-cat-layout">
        {/* Sidebar filters */}
        <aside className="bb-filters-v2">
          <div className="bb-skel-stack">
            <SkelTitle w="50%" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bb-skel-stack" style={{ paddingBlock: 12, borderBottom: "1px solid var(--bb-border-subtle)" }}>
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
          <div className="bb-catalog-head">
            <SkelText w={140} />
            <SkelButton w={160} />
          </div>
          <div className="bb-product-grid">
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
      <div className="bb-container pb-16">
        <div className="bb-grid-categories">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bb-card">
              <SkelBlock w="100%" style={{ aspectRatio: "16/9" }} />
              <div style={{ padding: 16, display: "grid", gap: 8 }}>
                <SkelTitle w="60%" />
                <SkelText w="80%" />
              </div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="bb-container">
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
      </div>
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
      <div className="bb-container mb-6">
        <SkelBlock w="100%" h={180} />
      </div>
      <div className="bb-cat-layout">
        <aside className="bb-filters-v2">
          <div className="bb-skel-stack">
            <SkelTitle w="50%" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bb-skel-stack" style={{ paddingBlock: 12, borderBottom: "1px solid var(--bb-border-subtle)" }}>
                <SkelText w="60%" />
                <SkelText w="80%" />
              </div>
            ))}
          </div>
        </aside>
        <div>
          <div className="bb-catalog-head">
            <SkelText w={140} />
            <SkelButton w={160} />
          </div>
          <div className="bb-product-grid">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkel key={i} />)}
          </div>
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Article list (tin-tuc) — hero + filter + 3-col article grid */
export function ArticleListSkeleton() {
  return (
    <SkeletonRoot label="Đang tải danh sách bài viết" className="bb-news-page">
      <div className="bb-container mt-6">
        <div className="bb-news-hero">
          <div className="bb-news-hero-copy bb-skel-stack">
            <SkelText w="20%" />
            <SkelTitle w="80%" h="2em" />
            <SkelText w="100%" />
            <SkelText w="80%" />
          </div>
          <div>
            <SkelBlock w="100%" h={160} />
          </div>
        </div>
      </div>
      <div className="bb-news-section">
        <div className="bb-skel-row" style={{ marginBottom: 28 }}>
          <SkelButton w={120} />
          <SkelButton w={140} />
          <SkelButton w={120} />
        </div>
        <div className="bb-articles-grid-v2">
          {Array.from({ length: 6 }).map((_, i) => <ArticleCardSkel key={i} />)}
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Article detail (tin-tuc/[slug]) — breadcrumb + meta + h1 + cover + body */
export function ArticleDetailSkeleton() {
  return (
    <SkeletonRoot label="Đang tải bài viết">
      <div className="bb-breadcrumb"><SkelText w={280} /></div>
      <div className="bb-article-wrap">
        <header className="bb-skel-stack" style={{ marginBottom: 24 }}>
          <div className="bb-skel-row">
            <SkelChip w={80} />
            <SkelText w={100} />
            <SkelText w={80} />
          </div>
          <SkelTitle w="92%" h="2.4em" />
          <SkelText w="80%" />
        </header>
        <SkelBlock w="100%" h={420} />
        <div className="bb-skel-stack" style={{ marginTop: 28 }}>
          <SkelText w="98%" />
          <SkelText w="100%" />
          <SkelText w="92%" />
          <SkelText w="96%" />
          <SkelText w="60%" />
          <SkelText w="100%" />
          <SkelText w="78%" />
        </div>
      </div>
    </SkeletonRoot>
  );
}

/** Cart — breadcrumb + page-head + 2-col cart-list+summary */
export function CartSkeleton() {
  return (
    <SkeletonRoot label="Đang tải giỏ hàng">
      <div className="bb-breadcrumb"><SkelText w={140} /></div>
      <div className="bb-page-head">
        <SkelText w="10%" />
        <SkelTitle w="22%" h="2em" />
      </div>
      <div className="bb-cart-layout">
        <div>
          <div className="bb-cart-list">
            <div className="bb-cart-header-row">
              <SkelText w="30%" />
              <SkelText w="50%" />
              <SkelText w="50%" />
              <SkelText w="50%" />
              <span />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bb-cart-item">
                <div className="bb-cart-item-prod">
                  <SkelBlock w={72} h={72} />
                  <div className="bb-skel-col" style={{ flex: 1 }}>
                    <SkelText w="40%" />
                    <SkelText w="80%" />
                    <SkelText w="50%" />
                  </div>
                </div>
                <SkelBlock w={106} h={36} />
                <SkelText w="80%" />
                <SkelText w="80%" />
                <SkelCircle size={32} />
              </div>
            ))}
          </div>
        </div>
        <aside className="bb-summary-card">
          <div className="bb-skel-stack">
            <SkelTitle w="50%" />
            <SkelText w="100%" />
            <SkelText w="100%" />
            <SkelText w="100%" />
            <SkelTitle w="60%" h="1.4em" />
            <SkelButton w="100%" />
          </div>
        </aside>
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
      <div className="bb-checkout-layout">
        <div>
          {/* Stepper */}
          <div className="bb-stepper">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bb-step" style={{ flex: 1 }}>
                <SkelCircle size={28} />
                <div className="bb-skel-col" style={{ flex: 1 }}>
                  <SkelText w="60%" />
                  <SkelText w="80%" />
                </div>
              </div>
            ))}
          </div>
          {/* Form section 1 */}
          <div className="bb-checkout-section">
            <SkelTitle w="40%" />
            <div
              style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", marginTop: 18 }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bb-skel-stack">
                  <SkelText w="40%" />
                  <SkelBlock w="100%" h={42} />
                </div>
              ))}
            </div>
          </div>
          <div className="bb-checkout-section">
            <SkelTitle w="35%" />
            <div className="bb-skel-stack" style={{ marginTop: 18 }}>
              <SkelBlock w="100%" h={56} />
              <SkelBlock w="100%" h={56} />
            </div>
          </div>
        </div>
        <aside className="bb-order-summary">
          <div className="bb-skel-stack">
            <SkelTitle w="60%" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bb-skel-row">
                <SkelBlock w={56} h={56} />
                <div className="bb-skel-col" style={{ flex: 1 }}>
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
      <div className="bb-account-header">
        <div className="bb-skel-col" style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="50%" />
        </div>
      </div>
      <div className="bb-skel-stack">
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
      <aside className="bb-account-sidebar">
        <div style={{ padding: "24px 22px", borderBottom: "1px solid var(--bb-border-subtle)" }}>
          <SkelCircle size={56} />
          <div className="bb-skel-stack" style={{ marginTop: 12 }}>
            <SkelText w="60%" />
            <SkelText w="80%" />
          </div>
        </div>
        <div className="bb-skel-stack" style={{ padding: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkelBlock key={i} w="100%" h={36} />
          ))}
        </div>
      </aside>
      <div className="bb-account-main">
        <div className="bb-account-header">
          <div className="bb-skel-col" style={{ flex: 1 }}>
            <SkelTitle w="30%" h="1.6em" />
            <SkelText w="50%" />
          </div>
        </div>
        <div className="bb-skel-stack">
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
      <div className="bb-account-header">
        <div className="bb-skel-col" style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="40%" />
        </div>
      </div>
      <div className="bb-skel-row" style={{ borderBottom: "1px solid var(--bb-border-subtle)", marginBottom: 20 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ padding: "12px 20px" }}><SkelText w={80} /></div>
        ))}
      </div>
      <div className="bb-skel-stack">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bb-order-card">
            <div className="bb-order-head">
              <div className="bb-skel-row" style={{ flex: 1, gap: 22 }}>
                <div className="bb-skel-col"><SkelText w={50} /><SkelText w={80} /></div>
                <div className="bb-skel-col"><SkelText w={50} /><SkelText w={90} /></div>
                <div className="bb-skel-col"><SkelText w={50} /><SkelText w={70} /></div>
              </div>
              <SkelChip w={90} />
            </div>
            <div className="bb-order-body">
              <div className="bb-skel-row">
                {Array.from({ length: 3 }).map((_, j) => <SkelBlock key={j} w={56} h={56} />)}
              </div>
              <div className="bb-skel-col" style={{ flex: 1 }}>
                <SkelText w="60%" />
                <SkelText w="40%" />
              </div>
              <div className="bb-skel-col" style={{ alignItems: "flex-end" }}>
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
      <div className="bb-account-header">
        <div className="bb-skel-col" style={{ flex: 1 }}>
          <SkelTitle w="30%" h="1.6em" />
          <SkelText w="20%" />
        </div>
      </div>
      <div className="bb-skel-stack">
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
      <div className="bb-account-header">
        <div className="bb-skel-col" style={{ flex: 1 }}>
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
            <div key={i} className="bb-skel-stack">
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
        <div className="bb-container">
          <div className="bb-auth-wrap">
            <Card className="p-6 border-t-[3px] border-t-primary">
              <div className="bb-skel-stack">
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
        </div>
      </section>
    </SkeletonRoot>
  );
}

/** Static / CMS page — h1 + body paragraphs */
export function StaticPageSkeleton({ title = "Đang tải nội dung" }: { title?: string }) {
  return (
    <SkeletonRoot label={title}>
      <section className="bb-page">
        <div className="bb-container">
          <header style={{ marginBottom: 24 }}>
            <SkelTitle w="55%" h="2.2em" />
          </header>
          <div className="bb-skel-stack">
            <SkelText w="100%" />
            <SkelText w="92%" />
            <SkelText w="98%" />
            <SkelText w="60%" />
            <SkelText w="100%" />
            <SkelText w="78%" />
            <SkelText w="92%" />
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}

/** Search page — header + query form + result skeleton (mixed grid) */
export function SearchSkeleton() {
  return (
    <SkeletonRoot label="Đang tải kết quả tìm kiếm">
      <section className="bb-page">
        <div className="bb-container">
          <header>
            <SkelTitle w="20%" h="2em" />
          </header>
          <div className="bb-query-form bb-skel-stack" style={{ marginTop: 16 }}>
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
        </div>
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
        <div className="bb-skel-stack" style={{ marginTop: 22, alignItems: "center" }}>
          <SkelText w={120} />
          <SkelTitle w="60%" h="2.2em" />
          <SkelText w="80%" />
        </div>
        <div className="order-card" style={{ marginTop: 22 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bb-skel-stack">
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
        <div className="bb-container">
          <div
            style={{
              display: "grid",
              gap: 60,
              gridTemplateColumns: "1fr 1fr",
              paddingTop: 50,
              paddingBottom: 60,
            }}
          >
            <div className="bb-skel-stack">
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
            <div className="bb-skel-stack">
              <SkelTitle w="55%" h="1.6em" />
              <SkelBlock w="100%" h={420} />
              <SkelBlock w="100%" h={48} />
            </div>
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}

/** Guide landing — sidebar nav + content */
export function GuideSkeleton() {
  return (
    <SkeletonRoot label="Đang tải hướng dẫn">
      <section className="bb-page">
        <div className="bb-container">
          <div style={{ display: "grid", gap: 28, gridTemplateColumns: "260px 1fr" }}>
            <aside className="bb-skel-stack">
              <SkelTitle w="60%" />
              {Array.from({ length: 6 }).map((_, i) => (
                <SkelBlock key={i} w="100%" h={36} />
              ))}
            </aside>
            <div>
              <SkelTitle w="50%" h="2em" />
              <div className="bb-skel-stack" style={{ marginTop: 20 }}>
                <SkelText w="100%" />
                <SkelText w="92%" />
                <SkelText w="98%" />
                <SkelText w="80%" />
                <SkelText w="60%" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}
