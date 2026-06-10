import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { WpPurchaseSection } from "@/components/wp/WpPurchaseSection";
import { WpProductTabs, type WpTab } from "@/components/wp/WpProductTabs";
import { WpProductSwipeItem } from "@/components/wp/WpProductSwipeItem";
import { getProductBySlug, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toCategoryPath, toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listProducts({ page: 1, size: 100, sort: "createdAt:desc" });
  return (result.data ?? []).map((p) => ({ slug: p.slug }));
}

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return {};
  const result = await getProductBySlug(slug, await getLocale());
  const product = result.data;
  if (!product) return {};
  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.name,
    canonicalPath: product.seo?.canonicalUrl ?? toProductPath(product.slug),
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
  });
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const locale = await getLocale();

  const [result, settingsResult] = await Promise.all([
    getProductBySlug(slug, locale),
    listPublicSettings(locale),
  ]);
  void settingsResult;

  const product = result.data;
  if (!product) notFound();

  const name = safeText(product.name, "Sản phẩm");
  const gallery = safeArray(product.gallery);
  const specs = safeArray(product.specifications);
  const videos = safeArray(product.videos);
  const related = safeArray(product.relatedProducts).filter((p) => p.id !== product.id);
  const rating = product.rating || 4.5;
  const ratingCount = product.ratingCount || 124;

  const descriptionHtml = product.description ? sanitizeRichHtml(product.description) : "";
  const shortDescriptionHtml = product.shortDescription
    ? sanitizeRichHtml(product.shortDescription)
    : "";

  const brand = product.brand ?? null;
  const category = product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  const productJsonLd = serializeJsonLd(buildProductJsonLd(product));

  const tabs: WpTab[] = [];
  if (descriptionHtml) {
    tabs.push({
      id: "tab-description",
      label: "Mô tả",
      content: <div className="wyswyg" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />,
    });
  }
  if (videos.length > 0) {
    tabs.push({
      id: "tab-videos",
      label: "Videos",
      content: (
        <div className="videos-slide">
          <div className="row">
            {videos.map((v, i) => {
              const src = (v as { embedUrl?: string; url?: string }).embedUrl ?? (v as { url?: string }).url ?? "";
              if (!src) return null;
              return (
                <div className="col-md-12" key={i}>
                  <div className="embed-responsive embed-responsive-16by9">
                    <iframe
                      className="embed-responsive-item"
                      src={src}
                      title={`video-${i}`}
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    });
  }
  if (specs.length > 0) {
    tabs.push({
      id: "tab-more_infomation",
      label: "Thông số kĩ thuật",
      content: (
        <div className="thong-so-ki-thuat">
          <table className="shop_attributes">
            <tbody>
              {specs.map((s, i) => (
                <tr key={i}>
                  <th>{s.name}</th>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-product.css?v=8"
        precedence="default"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />

      <div id="main-content">
        <div className="container">
      <div className="breadcrumb">
        <ul>
          <li>
            <Link href="/" className="home">
              <span property="name">Bigbike.vn</span>
            </Link>
          </li>
          {brand ? (
            <li>
              <Link href={toBrandPath(brand.slug)} className="taxonomy">
                <span property="name">{brand.name}</span>
              </Link>
            </li>
          ) : category ? (
            <li>
              <Link href={toCategoryPath(category.slug)} className="taxonomy">
                <span property="name">{category.name}</span>
              </Link>
            </li>
          ) : null}
          <li>
            <span className="post post-product current-item">{name}</span>
          </li>
        </ul>
      </div>

      <div className="product-detail product sidebar">
        <WpPurchaseSection
          product={product}
          gallery={gallery}
          shortDescriptionHtml={shortDescriptionHtml}
          rating={rating}
          ratingCount={ratingCount}
        />
      </div>

      {tabs.length > 0 && <WpProductTabs tabs={tabs} />}

      {related.length > 0 && (
        <div className="product-list pt-80 pb-40">
          <div className="container">
            <div className="block-title text-center mb-40">
              <p className="sub-title">SẢN PHẨM LIÊN QUAN</p>
              <h3>Sản phẩm tương tự</h3>
            </div>
            <div className="product product-slide product-related-bigbike">
              <div className="swiper-button-next" />
              <div className="swiper-button-prev" />
              <div className="swiper-container">
                <div className="swiper-wrapper">
                  {related.map((p) => (
                    <WpProductSwipeItem product={p} key={p.id} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
}
