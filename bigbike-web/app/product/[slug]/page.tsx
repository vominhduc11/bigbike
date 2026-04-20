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
      title: "San pham khong hop le",
      description: "Slug san pham khong hop le.",
      canonicalPath: toProductPath("invalid"),
      noIndex: true,
    });
  }

  const result = await getProductBySlug(slug);
  const product = result.data;
  if (!product) {
    return buildPublicMetadata({
      title: "Khong tim thay san pham",
      description: "Khong tim thay thong tin san pham yeu cau.",
      canonicalPath: toProductPath(slug),
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description:
      product.seo?.description ??
      product.shortDescription ??
      "Chi tiet san pham BigBike theo route /product/{slug}.",
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
          <ErrorState message={result.error?.message ?? "Khong tai duoc chi tiet san pham."} />
        </div>
      </section>
    );
  }

  const product = result.data;
  const productName = safeText(product.name, "San pham");
  const gallery = safeArray(product.gallery);

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Product Detail</p>
          <h1>{productName}</h1>
          <p className="bb-page-subtitle">
            {safeText(product.shortDescription, "Thong tin san pham dang cap nhat.")}
          </p>
        </header>

        {result.fromFallback ? (
          <p className="bb-status-banner">Dang hien thi du lieu fallback dev cho trang chi tiet.</p>
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
                {safeText(product.category?.name, "Danh muc")}
              </p>
              <PriceText price={product.price} />
              <p className="bb-page-subtitle">{safeText(product.description, "Dang cap nhat mo ta.")}</p>

              <div className="bb-metadata">
                <p>
                  <strong>Slug:</strong> {safeText(product.slug, "dang-cap-nhat")}
                </p>
                <p>
                  <strong>Trang thai kho:</strong> {product.stockState}
                </p>
              </div>
            </div>

            {product.specifications && product.specifications.length > 0 ? (
              <section className="bb-section">
                <h2 className="bb-section-title">Thong so ky thuat</h2>
                <table className="bb-spec-table">
                  <tbody>
                    {product.specifications.map((specification) => (
                      <tr key={`${specification.group}-${specification.name}`}>
                        <td>{safeText(specification.name, "Thong tin")}</td>
                        <td>{safeText(specification.value, "Dang cap nhat")}</td>
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
