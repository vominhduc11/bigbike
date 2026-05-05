import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchaseSectionClient } from "@/components/catalog/PurchaseSectionClient";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProductBySlug, listProducts } from "@/lib/api/public-api";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import {
  toCanonicalUrl,
  toCategoryPath,
  toHomePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

// Static content is ISR-cached for 1 hour.
// Dynamic content (pricing, stock, variants, reviews) is always fetched fresh
// client-side via /api/products/[id]/snapshot route.
export const revalidate = 3600;

export async function generateStaticParams() {
  const result = await listProducts({ page: 1, size: 100, sort: "createdAt:desc" });
  return (result.data ?? []).map((p) => ({ slug: p.slug }));
}

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Sản phẩm không hợp lệ",
      description: "Slug sản phẩm không hợp lệ.",
      canonicalPath: toProductPath("invalid"),
      noIndex: true,
    });
  }

  const result = await getProductBySlug(slug);
  const product = result.data;
  if (!product) {
    return buildPublicMetadata({
      title: "Không tìm thấy sản phẩm",
      description: "Không tìm thấy thông tin sản phẩm yêu cầu.",
      canonicalPath: toProductPath(slug),
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description:
      product.seo?.description ??
      product.shortDescription ??
      "Chi tiết sản phẩm bảo hộ biker BigBike.",
    canonicalPath: product.seo?.canonicalUrl ?? toProductPath(product.slug),
    noIndex: product.seo?.noIndex ?? false,
    ogImage: product.image?.url ?? undefined,
  });
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const result = await getProductBySlug(slug);
  if (!result.data && result.error?.status === 404) notFound();

  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState
            message={result.error?.message ?? "Không tải được chi tiết sản phẩm."}
          />
        </div>
      </section>
    );
  }

  const product = result.data;
  const productName = safeText(product.name, "Sản phẩm");
  const gallery = safeArray(product.gallery);
  const videos = safeArray(product.videos);
  const specs = safeArray(product.specifications);

  // ── JSON-LD ────────────────────────────────────────────────────────────────

  const productJsonLd = serializeJsonLd(buildProductJsonLd(product));
  const breadcrumbJsonLd = serializeJsonLd(buildBreadcrumbJsonLd(product));
  const faqJsonLd =
    specs.length > 0
      ? serializeJsonLd(
          buildFaqPageJsonLd(
            specs.map((s) => ({ question: s.name, answer: s.value })),
          ),
        )
      : null;

  // ── Related products (ISR-cached) ─────────────────────────────────────────

  const relatedResult = product.category?.slug
    ? await listProducts({
        page: 1,
        size: 8,
        sort: "createdAt:desc",
        category: product.category.slug,
      })
    : null;
  const relatedProducts = (relatedResult?.data ?? [])
    .filter((p) => p.id !== product.id)
    .slice(0, 8);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: productJsonLd }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd }}
        />
      )}

      {/* Analytics (CSR) */}
      <AnalyticsView product={product} />

      {/* Breadcrumb */}
      <nav className="wp-breadcrumb" aria-label="Điều hướng">
        <Link href={toHomePath()}>Trang chủ</Link>
        {product.category?.name && product.category.slug ? (
          <>
            <span className="sep" aria-hidden="true">/</span>
            <Link href={toCategoryPath(product.category.slug)}>
              {product.category.name}
            </Link>
          </>
        ) : (
          <>
            <span className="sep" aria-hidden="true">/</span>
            <Link href={toProductListPath()}>Sản phẩm</Link>
          </>
        )}
        <span className="sep" aria-hidden="true">/</span>
        <span aria-current="page">{productName}</span>
      </nav>

      {/*
       * Two-column PDP layout.
       * PurchaseSectionClient is a single client component that owns:
       *   - ProductGallery (left) — shows variant image on selection
       *   - Static info header (brand, name, short description)
       *   - Dynamic purchase controls (pricing, stock, variants, cart, quick buy)
       *
       * Static content is passed as props from the ISR-rendered server component.
       * Dynamic content is fetched fresh via /api/products/[id]/* routes.
       */}
      <div className="wp-pdp">
        <PurchaseSectionClient
          productId={product.id}
          productSlug={product.slug}
          productName={productName}
          brandName={safeText(product.brand?.name, "BigBike")}
          categoryName={safeText(product.category?.name, "")}
          shortDescription={product.shortDescription}
          initialRating={product.rating ?? null}
          initialRatingCount={product.ratingCount ?? null}
          mainImage={product.image}
          gallery={gallery}
          fallbackPrice={product.price}
          fallbackStockState={product.stockState}
          fallbackVariants={product.variants ?? []}
          canonicalUrl={toCanonicalUrl(
            product.seo?.canonicalUrl ?? toProductPath(product.slug),
          )}
        />
      </div>

      {/* Below-fold: tabs, reviews, related products */}
      <div className="wp-pdp-below">
        {/* Tabbed static content — ISR-cached */}
        <ProductTabs
          specifications={specs}
          description={product.description}
          videos={videos}
          productName={productName}
        />

        {/* Reviews — always fresh (CSR) */}
        <ReviewsSection
          productId={product.id}
          initialRating={product.rating ?? null}
        />

        {/* Related products — ISR-cached */}
        {relatedProducts.length > 0 && (
          <section className="wp-pdp-related">
            <div className="wp-pdp-related-header">
              <div>
                <p className="wp-kicker">
                  DANH MỤC{" "}
                  {product.category?.name?.toUpperCase() ?? "SẢN PHẨM"}
                </p>
                <h2 className="wp-pdp-related-title">Sản phẩm liên quan</h2>
              </div>
              {product.category?.slug && (
                <Link
                  href={toCategoryPath(product.category.slug)}
                  className="wp-view-all-link"
                >
                  Xem tất cả →
                </Link>
              )}
            </div>
            <FeaturedProductsCarousel products={relatedProducts} />
          </section>
        )}

        {/* Recently viewed — client-only localStorage */}
        <RecentlyViewedSection
          currentProductId={product.id}
          currentProduct={{
            id: product.id,
            slug: product.slug,
            name: productName,
            price: product.price?.salePrice ?? product.price?.retailPrice ?? null,
            imageUrl: product.image?.url ?? null,
            categoryName: product.category?.name ?? null,
          }}
        />

        {/* Long-form SEO copy (parity with WP ACF `content_bottom`). Only rendered
            when admin has filled it in — most products leave it empty. */}
        {product.contentBottom && product.contentBottom.trim() && (
          <section
            className="wp-pdp-content-bottom wp-content"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.contentBottom) }}
          />
        )}
      </div>
    </>
  );
}
