import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductPurchasePanel } from "@/components/catalog/ProductPurchasePanel";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { getProductBySlug, listProducts } from "@/lib/api/public-api";
import { buildBreadcrumbJsonLd, buildProductJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { toHomePath, toProductListPath, toProductPath, toCategoryPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { sanitizeRichHtml } from "@/lib/utils/html";
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
      <div className="wp-breadcrumb">
        <a href={toHomePath()}>Trang chủ</a>
        {product.category?.name && product.category.slug && (
          <>
            <span className="sep">/</span>
            <a href={toCategoryPath(product.category.slug)}>{product.category.name}</a>
          </>
        )}
        <span className="sep">/</span>
        <span>{productName}</span>
      </div>

      {/* PDP two-column */}
      <div className="wp-pdp">
        {/* Left: gallery */}
        <div className="wp-pdp-gallery">
          <div className="wp-pdp-main">
            <MediaImage
              image={product.image}
              altFallback={productName}
              width={1200}
              height={1200}
              priority
            />
          </div>

          {gallery.length > 0 && (
            <div className="wp-pdp-thumbs">
              {gallery.slice(0, 5).map((image) => (
                <div key={image.id ?? image.url} className="wp-pdp-thumb">
                  <MediaImage
                    image={image}
                    altFallback={productName}
                    width={160}
                    height={160}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: info + purchase */}
        <div className="wp-pdp-info">
          <p className="wp-pdp-info-brand">
            {safeText(product.brand?.name, "BigBike")}
            {product.category?.name ? ` · ${safeText(product.category.name, "")}` : ""}
          </p>
          <h1 className="wp-pdp-info-title">{productName}</h1>

          {product.shortDescription && (
            <p style={{ fontSize: 14, color: "var(--bb-text-muted)", margin: "0 0 16px" }}>
              {product.shortDescription}
            </p>
          )}

          <ProductPurchasePanel product={product} />

          <div className="wp-pdp-features" style={{ marginTop: 24 }}>
            {[
              "Hàng chính hãng 100%",
              "Bảo hành theo chính sách hãng",
              "Thanh toán COD hoặc chuyển khoản",
              "Giao toàn quốc",
            ].map((feat) => (
              <div key={feat} className="wp-pdp-feat">
                <span className="dot" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Below: specs, description, videos, related */}
      <div style={{ maxWidth: 1440, margin: "40px auto 0", padding: "0 24px" }}>
        {product.specifications && product.specifications.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 className="bb-section-title">Thông số kỹ thuật</h2>
            <table className="bb-spec-table">
              <tbody>
                {product.specifications.map((specification) => (
                  <tr key={`${specification.group}-${specification.name}`}>
                    <td>{safeText(specification.name, "Thông tin")}</td>
                    <td>{safeText(specification.value, "Đang cập nhật")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {product.description && (
          <section style={{ marginBottom: 40 }}>
            <h2 className="bb-section-title">Mô tả sản phẩm</h2>
            <article
              className="bb-richtext"
              style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 24 }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description) }}
            />
          </section>
        )}

        {videos.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <h2 className="bb-section-title">Video sản phẩm</h2>
            <div className="bb-grid-articles">
              {videos.map((video, index) => (
                <article
                  key={video.id ?? video.url ?? index}
                  style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 16 }}
                >
                  <MediaImage
                    image={video.thumbnail}
                    altFallback={safeText(video.title, productName)}
                    width={960}
                    height={540}
                  />
                  <h3 style={{ marginTop: 12, fontSize: 14 }}>
                    {safeText(video.title, "Video sản phẩm")}
                  </h3>
                  {video.url && (
                    <a className="bb-link" href={video.url} target="_blank" rel="noreferrer">
                      Xem video
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {relatedProducts.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div className="bb-section-row">
              <h2 className="bb-section-title">Sản phẩm liên quan</h2>
              {product.category?.slug && (
                <a href={toCategoryPath(product.category.slug)} className="bb-link">Xem thêm</a>
              )}
            </div>
            <div className="wp-product-grid">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 16, paddingBottom: 40 }}>
          <a href={toProductListPath()} className="bb-link">← Xem tất cả sản phẩm</a>
        </div>
      </div>
    </>
  );
}
