import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PurchaseSectionClient } from "@/components/catalog/PurchaseSectionClient";
import { ProductTabs } from "@/components/catalog/ProductTabs";
import { ProductSpecTable } from "@/components/catalog/ProductSpecTable";
import { ProductFaqSection } from "@/components/catalog/ProductFaqSection";
import { ProductContactCta } from "@/components/catalog/ProductContactCta";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { ProductCard } from "@/components/catalog/ProductCard";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  getProductBySlug,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
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

/** True when rich-HTML carries real content (text or media), not just empty tags. */
function richHasContent(html: string): boolean {
  if (!html) return false;
  if (/<(img|iframe|video)[^>]*>/i.test(html)) return true;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

/** First non-empty setting value across the given candidate keys. */
function getSetting(
  settings: { settingKey: string; settingValue: string }[],
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const found = settings.find(
      (s) => s.settingKey === key && s.settingValue.trim().length > 0,
    );
    if (found) return found.settingValue.trim();
  }
  return fallback;
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

  const [tProduct, tBreadcrumb] = await Promise.all([
    getTranslations("Product"),
    getTranslations("Breadcrumb"),
  ]);

  const result = await getProductBySlug(slug, await getLocale());
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
  const productName = safeText(product.name, tProduct("fallbackShortName"));
  const gallery = safeArray(product.gallery);
  const videos = safeArray(product.videos);
  const specs = safeArray(product.specifications);
  const faqs = safeArray(product.faqs);

  // "Chưa phân loại" is an admin placeholder for un-classified imports.
  // Treat it as no category in all public-facing surfaces (breadcrumb, info
  // line, related products, JSON-LD, recently-viewed storage).
  const effectiveCategory =
    product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  // ── Rich-text content (sanitized once, reused for presence checks + render) ──

  const sanitizedDescription = product.description ? sanitizeRichHtml(product.description) : "";
  const sanitizedPromotion = product.promotionContent ? sanitizeRichHtml(product.promotionContent) : "";
  const sanitizedInstallation = product.installationGuide
    ? sanitizeRichHtml(product.installationGuide)
    : "";

  // ── JSON-LD ────────────────────────────────────────────────────────────────

  // Pass an empty category name so JSON-LD builders skip the placeholder.
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

  // ── Related products + shop settings (ISR-cached) ─────────────────────────

  // Related products are curated per-product in the admin and returned on the
  // detail payload. No category fallback — an empty list hides the section.
  const settingsResult = await listPublicSettings();
  const relatedProducts = safeArray(product.relatedProducts)
    .filter((p) => p.id !== product.id)
    .slice(0, 8);

  const settings = settingsResult.data ?? [];
  const siteName = getSetting(settings, ["site_name", "site_title", "site.name"], "BigBike");
  const shopAddress = getSetting(settings, ["contact_address", "address", "site_address"]);
  const shopHotline = getSetting(settings, ["hotline", "contact_phone", "support_phone"]);
  const shopZalo = getSetting(settings, ["zalo_url"]);

  // ── Scrollable content sections ───────────────────────────────────────────
  // Each section that has content becomes an anchor-nav entry; reviews are
  // always shown (the section owns its own empty state).

  const reviewCount = product.ratingCount ?? 0;

  const sections: {
    id: string;
    label: string;
    content: ReactNode;
  }[] = [];

  if (richHasContent(sanitizedDescription)) {
    sections.push({
      id: "mo-ta",
      label: tProduct("tabs.description"),
      content: (
        <article
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
        />
      ),
    });
  }
  if (richHasContent(sanitizedPromotion)) {
    sections.push({
      id: "uu-dai",
      label: tProduct("tabs.promotion"),
      content: (
        <article
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizedPromotion }}
        />
      ),
    });
  }
  if (specs.length > 0) {
    sections.push({
      id: "thong-so",
      label: tProduct("tabs.specs"),
      content: <ProductSpecTable specifications={specs} />,
    });
  }
  if (richHasContent(sanitizedInstallation)) {
    sections.push({
      id: "lap-dat",
      label: tProduct("tabs.installation"),
      content: (
        <article
          className="bb-richtext"
          dangerouslySetInnerHTML={{ __html: sanitizedInstallation }}
        />
      ),
    });
  }
  sections.push({
    id: "danh-gia",
    label:
      reviewCount > 0
        ? tProduct("tabs.reviewsWithCount", { count: reviewCount })
        : tProduct("tabs.reviewsEmpty"),
    content: <ReviewsSection productId={product.id} />,
  });
  if (faqs.length > 0) {
    sections.push({
      id: "faq",
      label: tProduct("tabs.faqs"),
      content: <ProductFaqSection faqs={faqs} />,
    });
  }

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
      <Breadcrumb
        variant="onLight"
        items={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: tBreadcrumb("products"), href: toProductListPath() },
          ...(effectiveCategory?.name && effectiveCategory.slug
            ? [{ label: effectiveCategory.name, href: toCategoryPath(effectiveCategory.slug) }]
            : []),
          { label: productName },
        ]}
      />

      {/*
       * Hero — two-column buy-box.
       * PurchaseSectionClient owns the gallery (+ optional featured video) on
       * the left and the dynamic purchase controls on the right.
       */}
      <div className="mx-auto mt-5 grid max-w-[1440px] grid-cols-1 items-start gap-6 px-4 sm:gap-8 sm:px-6 lg:grid-cols-[7fr_5fr] lg:gap-12 [&>*]:min-w-0">
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
          zaloUrl={shopZalo || undefined}
          hotline={shopHotline || undefined}
          fallbackPrice={product.price}
          fallbackStockState={product.stockState}
          fallbackVariants={product.variants ?? []}
          canonicalUrl={toCanonicalUrl(toProductPath(product.slug))}
        />
      </div>

      {/* Tabbed product content — Mô tả / Thông số / Đánh giá … */}
      <ProductTabs sections={sections} />

      {/* Local-SEO shop contact band */}
      <div className="mx-auto mt-12 max-w-[1440px] px-4 sm:px-6">
        <ProductContactCta
          productName={productName}
          siteName={siteName}
          address={shopAddress || undefined}
          hotline={shopHotline || undefined}
          zaloUrl={shopZalo || undefined}
        />
      </div>

      {/* Below-fold: related products + recently viewed + long-form SEO copy */}
      <div className="bb-pdp-below">
        {relatedProducts.length > 0 && (
          <section className="bb-pdp-related">
            <div className="bb-pdp-related-header">
              <div>
                <p className="bb-kicker">{tProduct("related.kicker")}</p>
                <h2 className="bb-pdp-related-title">
                  {tProduct("related.heading")}
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} variant="compact" />
              ))}
            </div>
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
            categoryName: effectiveCategory?.name ?? null,
          }}
        />

        {/* Long-form SEO copy (parity with WP ACF `content_bottom`). Only rendered
            when admin has filled it in — most products leave it empty. */}
        {product.contentBottom && product.contentBottom.trim() && (
          <section
            className="bb-pdp-content-bottom"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.contentBottom) }}
          />
        )}
      </div>

      {/* Spacer so the mobile sticky purchase bar never covers page content. */}
      <div className="md:hidden h-24" aria-hidden="true" />
    </>
  );
}
