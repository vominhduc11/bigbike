import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PurchaseSectionClient } from "@/components/catalog/PurchaseSectionClient";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductSpecTable } from "@/components/catalog/ProductSpecTable";
import { ProductVideosTab } from "@/components/catalog/ProductVideosTab";
import { PdpRelatedProductsCarousel } from "@/components/catalog/PdpRelatedProductsCarousel";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProductBySlug, listProducts, listPublicSettings } from "@/lib/api/public-api";
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
  toBrandPath,
  toHomePath,
  toProductPath,
} from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";
import { isValidSlug } from "@/lib/utils/slug";

// Locale is read from a cookie (next-intl), which opts the page into
// dynamic rendering. Underlying API fetches are still cached at the
// data-cache level (3600 s TTL set in loadDataWithQuery).
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listProducts({ page: 1, size: 100, sort: "createdAt:desc" });
  return (result.data ?? []).map((p) => ({ slug: p.slug }));
}

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function richHasContent(html: string): boolean {
  if (!html) return false;
  if (/<(img|iframe|video)[^>]*>/i.test(html)) return true;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tMeta = await getTranslations("Product.metadata");
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: tMeta("invalidTitle"),
      description: tMeta("invalidDescription"),
      canonicalPath: toProductPath("invalid"),
      noIndex: true,
    });
  }

  const result = await getProductBySlug(slug, await getLocale());
  const product = result.data;
  if (!product) {
    return buildPublicMetadata({
      title: tMeta("notFoundTitle"),
      description: tMeta("notFoundDescription"),
      canonicalPath: toProductPath(slug),
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: product.name,
    description: product.shortDescription ?? tMeta("defaultDescription"),
    canonicalPath: toProductPath(product.slug),
    noIndex: false,
    ogImage: product.image?.url ?? undefined,
    ogType: "website",
  });
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const [tProduct, locale] = await Promise.all([
    getTranslations("Product"),
    getLocale(),
  ]);

  const [result, settingsResult] = await Promise.all([
    getProductBySlug(slug, locale),
    listPublicSettings(),
  ]);
  if (!result.data && (result.error?.status === 404 || result.error?.status === 410)) notFound();

  if (!result.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState
            message={result.error?.message ?? tProduct("loadFailed")}
          />
        </div>
      </section>
    );
  }

  const product = result.data;
  const settings = settingsResult.data ?? [];
  const productName = safeText(product.name, tProduct("fallbackShortName"));
  const gallery = safeArray(product.gallery);
  const videos = safeArray(product.videos);
  const specs = safeArray(product.specifications);
  const faqs = safeArray(product.faqs);
  const instagramUrl = pickSetting(settings, ["instagram_url"]);

  const effectiveCategory =
    product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  const sanitizedDescription = product.description ? sanitizeRichHtml(product.description) : "";
  const sanitizedShortDescription = product.shortDescription
    ? sanitizeRichHtml(product.shortDescription)
    : "";

  const productForJsonLd = effectiveCategory
    ? product
    : { ...product, category: { ...product.category, name: "" } };

  const productJsonLd = serializeJsonLd(buildProductJsonLd(productForJsonLd));
  const breadcrumbJsonLd = serializeJsonLd(buildBreadcrumbJsonLd(productForJsonLd));
  const faqJsonLd =
    faqs.length > 0
      ? serializeJsonLd(
          buildFaqPageJsonLd(
            faqs.map((f) => ({ question: f.question, answer: f.answer })),
          ),
        )
      : null;

  const relatedProducts = safeArray(product.relatedProducts)
    .filter((p) => p.id !== product.id)
    .slice(0, 8);

  const sections: {
    id: string;
    label: string;
    content: ReactNode;
  }[] = [];

  if (richHasContent(sanitizedDescription)) {
    sections.push({
      id: "tab-description",
      label: "Mô tả",
      content: (
        <article
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      ),
    });
  }

  sections.push({
    id: "tab-videos",
    label: "Videos",
    content: <ProductVideosTab videos={videos} />,
  });

  sections.push({
    id: "tab-more_infomation",
    label: "Thông số kĩ thuật",
    content: <ProductSpecTable specifications={specs} />,
  });

  return (
    <>
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

      <AnalyticsView product={product} />

      <div className="bb-wp-pdp product-detail product sidebar">
        <Breadcrumb
          variant="onLight"
          items={[
            { label: "Bigbike.vn", href: toHomePath() },
            ...(product.brand?.name && product.brand.slug
              ? [{ label: product.brand.name, href: toBrandPath(product.brand.slug) }]
              : []),
            { label: productName },
          ]}
        />

        <div className="bb-wp-pdp-layout">
          <PurchaseSectionClient
            productId={product.id}
            productSlug={product.slug}
            productName={productName}
            brandName={safeText(product.brand?.name, "BigBike")}
            categoryName={safeText(effectiveCategory?.name, "")}
            categoryId={product.category?.id ?? ""}
            sku={product.sku}
            shortDescription={product.shortDescription}
            initialRating={product.rating ?? null}
            initialRatingCount={product.ratingCount ?? null}
            mainImage={product.image}
            gallery={gallery}
            videos={videos}
            fallbackPrice={product.price}
            fallbackStockState={product.stockState}
            fallbackVariants={product.variants ?? []}
            shortDescriptionHtml={sanitizedShortDescription}
            canonicalUrl={toCanonicalUrl(toProductPath(product.slug))}
            instagramUrl={instagramUrl || undefined}
          />
        </div>

        <ProductTabs sections={sections} />

        {relatedProducts.length > 0 && (
          <PdpRelatedProductsCarousel products={relatedProducts} />
        )}
      </div>
    </>
  );
}
