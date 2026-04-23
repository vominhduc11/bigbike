import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaImage } from "@/components/ui/MediaImage";
import { PriceText } from "@/components/ui/PriceText";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProductBySlug } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

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
      "Chi tiết sản phẩm BigBike theo route /product/{slug}.",
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

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Product Detail</p>
          <h1>{productName}</h1>
          <p className="bb-page-subtitle">
            {safeText(product.shortDescription, "Thông tin sản phẩm đang cập nhật.")}
          </p>
        </header>

        {result.fromFallback && process.env.NODE_ENV === "development" ? (
          <p className="bb-status-banner">Đang hiển thị dữ liệu fallback dev cho trang chi tiết.</p>
        ) : null}

        <section className="bb-detail-layout bb-section">
          <div>
            <MediaImage
              image={product.image}
              altFallback={productName}
              className="bb-product-image"
              width={1200}
              height={1200}
              priority
            />

            {gallery.length > 0 ? (
              <div className="bb-gallery" style={{ marginTop: "var(--bb-space-3)" }}>
                {gallery.map((image) => (
                  <MediaImage
                    key={image.id ?? image.url}
                    image={image}
                    altFallback={productName}
                    className="bb-product-image"
                    width={480}
                    height={480}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
              <p className="bb-product-meta">
                {safeText(product.brand?.name, "BigBike")} ·{" "}
                {safeText(product.category?.name, "Danh mục")}
              </p>
              <PriceText price={product.price} />
              <p className="bb-page-subtitle">{safeText(product.description, "Đang cập nhật mô tả.")}</p>

              <div className="bb-metadata">
                <p>
                  <strong>Slug:</strong> {safeText(product.slug, "dang-cap-nhat")}
                </p>
                <p>
                  <strong>Trạng thái kho:</strong> {product.stockState}
                </p>
              </div>
            </div>

            {product.specifications && product.specifications.length > 0 ? (
              <section className="bb-section">
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
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
