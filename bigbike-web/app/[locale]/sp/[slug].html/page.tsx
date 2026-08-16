import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { LegacyDiscontinuedProductView } from "@/components/catalog/LegacyDiscontinuedProductView";
import { getLegacyDiscontinuedProduct, getProductBySlug } from "@/lib/api/public-api";
import type { LegacyDiscontinuedProduct, Product } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import {
  toCanonicalUrl,
  toLegacyProductPath,
  toProductPath,
} from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
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

function historyEntryFromProduct(product: Product): LegacyDiscontinuedProduct | null {
  const primaryCategory = product.categories?.find((category) => category?.slug)
    ?? product.category;
  if (!primaryCategory?.slug) return null;
  return {
    slug: product.slug,
    name: product.name,
    brandName: product.brand?.name ?? null,
    categorySlug: primaryCategory.slug,
    imageUrl: product.image?.url ?? null,
    enabled: true,
  };
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
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: legacyJsonLd(entry, locale) }} />
        <LegacyDiscontinuedProductView entry={entry} locale={locale} />
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

  const historyEntry = historyEntryFromProduct(product);
  if (!historyEntry) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: legacyJsonLd(historyEntry, locale) }} />
      <LegacyDiscontinuedProductView entry={historyEntry} locale={locale} />
    </>
  );
}
