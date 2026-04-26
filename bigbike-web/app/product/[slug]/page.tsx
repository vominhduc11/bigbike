import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/catalog/ProductDetailClient";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProductBySlug, listProducts } from "@/lib/api/public-api";
import { buildBreadcrumbJsonLd, buildProductJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { toCategoryPath, toHomePath, toProductListPath, toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
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
  });
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const result = await getProductBySlug(slug);
  if (!result.data && result.error?.status === 404) {
    notFound();
  }

  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={result.error?.message ?? "Không tải được chi tiết sản phẩm."} />
        </div>
      </section>
    );
  }

  const product = result.data;
  const productName = safeText(product.name, "Sản phẩm");
  const gallery = safeArray(product.gallery);
  const videos = safeArray(product.videos);
  const productJsonLd = serializeJsonLd(buildProductJsonLd(product));
  const breadcrumbJsonLd = serializeJsonLd(buildBreadcrumbJsonLd(product));
  const relatedProductsResult = product.category?.slug
    ? await listProducts({
        page: 1,
        size: 8,
        sort: "createdAt:desc",
        category: product.category.slug,
      })
    : null;
  const relatedProducts = (relatedProductsResult?.data ?? [])
    .filter((item) => item.id !== product.id)
    .slice(0, 8);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <AnalyticsView product={product} />

      {/* Breadcrumb */}
      <nav className="wp-breadcrumb" aria-label="Điều hướng">
        <Link href={toHomePath()}>Trang chủ</Link>
        {product.category?.name && product.category.slug ? (
          <>
            <span className="sep" aria-hidden="true">/</span>
            <Link href={toCategoryPath(product.category.slug)}>{product.category.name}</Link>
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

      {/* PDP two-column */}
      <div className="wp-pdp">
        <ProductDetailClient
          product={product}
          gallery={gallery}
          altFallback={productName}
          infoSlot={
            <>
              <p className="wp-pdp-info-brand">
                {safeText(product.brand?.name, "BigBike")}
                {product.category?.name ? ` · ${safeText(product.category.name, "")}` : ""}
              </p>
              <h1 className="wp-pdp-info-title">{productName}</h1>

              {product.rating && product.rating > 0 ? (
                <div className="wp-pdp-rating">
                  <span className="stars" aria-label={`${product.rating} sao`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg key={i} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
                        fill={i < Math.round(product.rating!) ? "#f99d1c" : "none"}
                        stroke="#f99d1c" strokeWidth="1.8">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </span>
                  <span>{product.rating.toFixed(1)}/5</span>
                </div>
              ) : null}

              {product.shortDescription && (
                <p className="wp-pdp-short-desc">{product.shortDescription}</p>
              )}
            </>
          }
        />
      </div>

      {/* Below: tabbed content + related */}
      <div className="wp-pdp-below">
        <ProductTabs
          specifications={product.specifications ?? []}
          description={product.description}
          videos={videos}
          productName={productName}
        />

        {relatedProducts.length > 0 && (
          <section className="wp-pdp-related">
            <div className="wp-pdp-related-header">
              <div>
                <p className="wp-kicker">DANH MỤC {product.category?.name?.toUpperCase() ?? "SẢN PHẨM"}</p>
                <h2 className="wp-pdp-related-title">Sản phẩm liên quan</h2>
              </div>
              {product.category?.slug && (
                <Link href={toCategoryPath(product.category.slug)} className="wp-view-all-link">
                  Xem tất cả →
                </Link>
              )}
            </div>
            <FeaturedProductsCarousel products={relatedProducts} />
          </section>
        )}

        <div className="wp-pdp-back">
          <Link
            href={product.category?.slug ? toCategoryPath(product.category.slug) : toProductListPath()}
            className="bb-link"
          >
            ← Quay lại {product.category?.name ?? "tất cả sản phẩm"}
          </Link>
        </div>
      </div>
    </>
  );
}
