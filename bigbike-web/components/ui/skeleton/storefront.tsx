/**
 * Storefront skeletons: home, product detail, catalog/category/brand archives,
 * search. Compose the shared primitives. Re-exported via components/ui/Skeletons.tsx.
 *
 * NOTE: page-layout classes SHARED with a real page (bb-breadcrumb, bb-page-head, …)
 * are intentionally NOT migrated — these MIRROR those pages, so they keep their
 * classes until each page itself moves to Tailwind.
 */

"use client";

import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { bbCard, bbSection, productGrid, skelCol, skelRow, skelStack } from "@/lib/ui-classes";
import {
  ArticleCardSkel,
  bbCatLayout,
  bbCatalogHead,
  CategoryTileSkel,
  ProductCardSkel,
  SkeletonRoot,
  SkelBlock,
  SkelButton,
  SkelChip,
  SkelCircle,
  SkelText,
  SkelTitle,
} from "./primitives";

/** Homepage — hero + trust rail + 3-tile + 5 carousel + cat-grid + about + experience + news + brands. */
export function HomeSkeleton() {
  return (
    <SkeletonRoot labelKey="home" className="bb-home">
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
              <div key={i} className="flex min-h-50 flex-col justify-center gap-3 bg-muted p-6">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    <SkeletonRoot labelKey="product">
      {/* Breadcrumb */}
      <div className="bb-breadcrumb">
        <SkelText w={220} />
      </div>

      {/* Two-col PDP */}
      <div className="grid grid-cols-[1.1fr_1fr] max-[769px]:grid-cols-1 gap-12 max-[601px]:gap-6 max-w-[var(--bb-container-wide)] 2xl:max-w-370 min-[1920px]:max-w-440 min-[2560px]:max-w-600 mx-auto mt-5 px-6 max-[601px]:px-4 [align-items:start] min-w-0 [&>*]:min-w-0 bg-background">
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
      <div className="max-w-[var(--bb-container-wide)] 2xl:max-w-370 min-[1920px]:max-w-440 min-[2560px]:max-w-600 mx-auto mt-12 max-[601px]:mt-7 px-6 pt-10 pb-0 max-[601px]:px-4 max-[601px]:pt-6 border-t border-t-[var(--bb-border-default)] bg-background">
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
    <SkeletonRoot labelKey="category">
      {withHero && (
        <div className="relative h-75 md:h-107.5">
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
        <aside className="self-start border-r border-[var(--bb-border-subtle)] pr-7">
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
          <div className={productGrid}>
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
    <SkeletonRoot labelKey="categoryList">
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
    <SkeletonRoot labelKey="brandList">
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
