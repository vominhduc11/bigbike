import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PurchaseSectionClient } from "@/components/catalog/PurchaseSectionClient";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductSpecTable } from "@/components/catalog/ProductSpecTable";
import { ProductVideosTab } from "@/components/catalog/ProductVideosTab";
import { PdpRelatedProductsCarousel } from "@/components/catalog/PdpRelatedProductsCarousel";
import { MobilePdpAnchorNav } from "@/components/catalog/MobilePdpAnchorNav";
import { MobileStickyPurchaseBar } from "@/components/catalog/MobileStickyPurchaseBar";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { Container } from "@/components/layout/Container";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EmptyState } from "@/components/ui/EmptyState";
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
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? tMeta("defaultDescription"),
    canonicalPath: product.seo?.canonicalUrl ?? toProductPath(product.slug),
    noIndex: product.seo?.noIndex ?? false,
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
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
        <Container>
          <ErrorState
            message={result.error?.message ?? tProduct("loadFailed")}
          />
        </Container>
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
  }[] = [
    {
      id: "tab-description",
      label: tProduct("tabs.description"),
      content: richHasContent(sanitizedDescription) ? (
        <article
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      ) : (
        <EmptyState
          title={tProduct("tabsEmpty.descriptionTitle")}
          description={tProduct("tabsEmpty.descriptionDesc")}
        />
      ),
    },
    {
      id: "tab-videos",
      label: "Videos",
      content:
        videos.length > 0 ? (
          <ProductVideosTab videos={videos} />
        ) : (
          <EmptyState
            title={tProduct("tabsEmpty.videosTitle")}
            description={tProduct("tabsEmpty.videosDesc")}
          />
        ),
    },
    {
      id: "tab-more_infomation",
      label: tProduct("tabs.specs"),
      content:
        specs.length > 0 ? (
          <ProductSpecTable specifications={specs} />
        ) : (
          <EmptyState
            title={tProduct("tabsEmpty.specsTitle")}
            description={tProduct("tabsEmpty.specsDesc")}
          />
        ),
    },
    {
      id: "tab-faq",
      label: tProduct("faqs"),
      content:
        faqs.length > 0 ? (
          <div className="flex flex-col gap-0">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group border-b border-border first:border-t"
              >
                <summary className="flex justify-between items-start gap-3 py-3.5 text-ui-15 font-semibold text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden after:content-['+'] after:shrink-0 after:text-xl after:font-normal after:text-muted-foreground after:leading-none group-[[open]]:after:content-['−']">
                  {faq.question}
                </summary>
                <div className="pb-3.5 text-[length:var(--fs-caption)] text-muted-foreground">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <EmptyState
            title={tProduct("tabsEmpty.faqsTitle")}
            description={tProduct("tabsEmpty.faqsDesc")}
          />
        ),
    },
  ];

  const anchorItems = [
    { id: "pdp-overview", label: "Tổng quan" },
    { id: "tab-description", label: "Mô tả" },
    { id: "tab-videos", label: "Videos" },
    { id: "tab-more_infomation", label: "Thông số" },
    { id: "tab-faq", label: tProduct("faqs") },
  ];

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

      <div className="bb-wp-pdp product-detail product sidebar text-black bg-white max-md:pb-20">
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

        <div
          id="pdp-overview"
          className="bb-wp-pdp-layout mx-auto max-w-[1140px] max-[1025px]:max-w-[960px] min-[1536px]:max-w-[1360px] min-[1920px]:max-w-[1600px] px-[15px] max-md:px-[var(--bb-mobile-page-x)] grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-[30px] [align-items:start] max-[1024px]:flex max-[1024px]:flex-col max-[1024px]:gap-6 max-md:gap-[18px]"
        >
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

        {anchorItems.length > 1 && <MobilePdpAnchorNav items={anchorItems} />}

        <ProductTabs sections={sections} />

        {relatedProducts.length > 0 && (
          <PdpRelatedProductsCarousel products={relatedProducts} />
        )}

        <MobileStickyPurchaseBar
          addToCartLabel={tProduct("buyBox.addToCartShort")}
        />
      </div>
    </>
  );
}
