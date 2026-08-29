import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { LegacyDiscontinuedProductView } from "@/components/catalog/LegacyDiscontinuedProductView";
import { ProductView } from "@/components/catalog/ProductView";
import { getDiscontinuedSuggestions } from "@/lib/api/discontinued-suggestions";
import { getLegacyDiscontinuedProduct, getProductBySlug, listBrands, listCategories, listPublicSettings } from "@/lib/api/public-api";
import type { CategorySummary, LegacyDiscontinuedProduct } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import {
  toCanonicalUrl,
  toLegacyProductPath,
  toProductPath,
} from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { buildCategoryBreadcrumbCategories } from "@/lib/utils/product-breadcrumb";
import { pickSetting } from "@/lib/utils/settings";
import type { Locale } from "@/i18n/locale";

type LegacyProductParams = {
  locale?: string;
  slug?: string | string[];
  "slug.html"?: string;
};

type LegacyProductPageProps = { params: Promise<LegacyProductParams> };

function normalizeLegacySlug(rawSlug: string | undefined): string {
  if (!rawSlug) return "";
  return rawSlug.toLowerCase().endsWith(".html")
    ? rawSlug.slice(0, -".html".length)
    : rawSlug;
}

function readLegacySlug(params: LegacyProductParams): string | undefined {
  const rawSlug = params.slug ?? params["slug.html"];
  return Array.isArray(rawSlug) ? rawSlug.join("/") : rawSlug;
}

export async function generateStaticParams() {
  return [];
}

function legacyJsonLd(entry: LegacyDiscontinuedProduct, locale: Locale): string {
  const name = entry.name;
  const url = toCanonicalUrl(toLegacyProductPath(entry.slug, locale));
  const imageUrl = entry.imageUrl ? resolveMediaUrl(entry.imageUrl) : undefined;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(entry.brandName ? { brand: { "@type": "Brand", name: entry.brandName } } : {}),
    image: imageUrl ? [toCanonicalUrl(imageUrl)] : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      availability: "https://schema.org/Discontinued",
      itemCondition: "https://schema.org/NewCondition",
    },
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export async function generateMetadata({ params }: LegacyProductPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const rawLocale = resolvedParams.locale;
  const rawSlug = readLegacySlug(resolvedParams);
  const slug = normalizeLegacySlug(rawSlug);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  if (!isValidSlug(slug)) return {};

  const entryResult = await getLegacyDiscontinuedProduct(slug, locale);
  const entry = entryResult.data;
  if (entry) {
    const name = entry.name;
    const ogImage = entry.imageUrl ? resolveMediaUrl(entry.imageUrl) : undefined;
    return buildPublicMetadata({
      title: name,
      description: locale === "en"
        ? `${name} is no longer available at BigBike.`
        : `${name} đã ngừng kinh doanh tại BigBike.`,
      canonicalPath: toLegacyProductPath(slug, locale),
      locale,
      ogImage: ogImage || undefined,
      noIndex: false,
    });
  }

  const result = await getProductBySlug(slug, locale);
  const product = result.data;
  if (!product) return {};
  if (product.discontinued) {
    return buildPublicMetadata({
      title: product.seo?.title ?? product.name,
      description: product.seo?.description ?? product.name,
      canonicalPath: toLegacyProductPath(product.slug, locale),
      locale,
      ogImage: product.image?.url,
      noIndex: false,
    });
  }
  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.name,
    canonicalPath: toProductPath(product.slug, locale),
    locale,
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
    noIndex: product.seo?.noIndex ?? false,
  });
}

export default async function LegacyProductPage({ params }: LegacyProductPageProps) {
  const resolvedParams = await params;
  const rawLocale = resolvedParams.locale;
  const rawSlug = readLegacySlug(resolvedParams);
  const slug = normalizeLegacySlug(rawSlug);
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const entryResult = await getLegacyDiscontinuedProduct(slug, locale);
  const entry = entryResult.data;
  if (entry) {
    const [categoriesResult, brandsResult, settingsResult] = await Promise.all([
      listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
      listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
      listPublicSettings(locale),
    ]);
    const categories = categoriesResult.data ?? [];
    const category = categories.find((item) => item.slug === entry.categorySlug);
    const categorySummary: CategorySummary | undefined = category
      ? {
          id: category.id,
          slug: category.slug,
          slugEn: category.slugEn,
          name: category.name,
          visible: category.isVisible,
          deleted: false,
        }
      : undefined;
    const breadcrumbCategories = buildCategoryBreadcrumbCategories(categorySummary, categories);
    const brand = (brandsResult.data ?? []).find(
      (item) => item.name.trim().toLocaleLowerCase() === (entry.brandName ?? "").trim().toLocaleLowerCase(),
    );
    const suggestions = await getDiscontinuedSuggestions({
      categorySlug: entry.categorySlug,
      categories,
      source: { name: entry.name, brandName: entry.brandName },
      locale,
    });
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: legacyJsonLd(entry, locale) }} />
        <LegacyDiscontinuedProductView
          entry={entry}
          locale={locale}
          breadcrumbCategories={breadcrumbCategories}
          brand={brand}
          suggestions={suggestions}
          zaloUrl={pickSetting(settingsResult.data ?? [], ["zalo_url"]) || undefined}
        />
      </>
    );
  }

  const productResult = await getProductBySlug(slug, locale);
  const product = productResult.data;
  if (!product) notFound();
  if (!product.discontinued) {
    permanentRedirect(toProductPath(
      locale === "en" ? product.slugEn?.trim() || product.slug : product.slug,
      locale,
    ));
  }

  const [settingsResult, categoriesResult] = await Promise.all([
    listPublicSettings(locale),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
  ]);
  const categories = categoriesResult.data ?? [];
  const breadcrumbCategories = buildCategoryBreadcrumbCategories(
    product.category ?? product.categories?.[0],
    categories,
  );
  const suggestions = await getDiscontinuedSuggestions({
    categorySlug: product.category?.slug ?? product.categories?.[0]?.slug,
    categories,
    source: { name: product.name, brandName: product.brand?.name },
    locale,
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: legacyJsonLd({
        slug: product.slug,
        name: product.name,
        brandName: product.brand?.name ?? null,
        categorySlug: product.category?.slug ?? product.categories?.[0]?.slug ?? "",
        imageUrl: product.image?.url ?? null,
        enabled: true,
      }, locale) }} />
      <ProductView
        product={product}
        settings={settingsResult.data ?? []}
        breadcrumbCategories={breadcrumbCategories}
        discontinuedSuggestions={suggestions}
      />
    </>
  );
}
