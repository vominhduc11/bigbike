import type { Metadata } from "next";
import { toCanonicalUrl } from "@/lib/utils/routes";
import { normalizeMetaDescription } from "@/lib/utils/text";

const DEFAULT_SITE_NAME = "BigBike";

type PublicMetadataInput = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article";
  siteName?: string;
  /** Open Graph locale of the page being rendered. Defaults to "vi". */
  locale?: "vi" | "en";
  /**
   * Per-language URL paths for `hreflang` alternates (PRODUCT/CATEGORY/ARTICLE_RULE_003).
   * Canonical stays the vi URL; emit this when an entity has a distinct English slug
   * so Google links the vi/en URLs instead of treating them as duplicates.
   */
  languageAlternates?: { vi: string; en: string };
};

export function buildPublicMetadata(input: PublicMetadataInput): Metadata {
  const canonicalUrl = toCanonicalUrl(input.canonicalPath);
  const title = normalizePageTitle(input.title, input.siteName ?? DEFAULT_SITE_NAME);
  const description = normalizeMetaDescription(input.description) || undefined;
  const ogImageUrl = input.ogImage?.trim() ? toCanonicalUrl(input.ogImage.trim()) : undefined;

  const metadata: Metadata = {
    // Route-level titles must be absolute so the root layout template cannot
    // append the shop name a second time (SEO_RULE_006).
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalUrl,
      ...(input.languageAlternates
        ? {
            languages: {
              vi: toCanonicalUrl(input.languageAlternates.vi),
              en: toCanonicalUrl(input.languageAlternates.en),
              "x-default": toCanonicalUrl(input.languageAlternates.vi),
            },
          }
        : {}),
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      ...(input.siteName ? { siteName: input.siteName } : {}),
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
      locale: input.locale === "en" ? "en_US" : "vi_VN",
      alternateLocale: input.locale === "en" ? ["vi_VN"] : ["en_US"],
      type: input.ogType ?? "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };

  if (input.noIndex) {
    metadata.robots = {
      index: false,
      follow: true,
    };
  }

  return metadata;
}

function normalizePageTitle(value: string, siteName: string): string {
  const rawTitle = value.trim();
  const normalizedSiteName = siteName.trim() || DEFAULT_SITE_NAME;
  if (!rawTitle) return normalizedSiteName;

  // Remove only repeated pipe-separated shop-name segments. The rest of an
  // editor-provided title stays unchanged, including its language and SEO
  // wording.
  const shopNamePattern = new RegExp(
    `^${escapeRegExp(normalizedSiteName)}$|^BigBike(?:\\.vn)?$`,
    "i",
  );
  const parts = rawTitle.split("|").map((part) => part.trim()).filter(Boolean);
  let sawShopSegment = false;
  const deduplicatedParts = parts.filter((part) => {
    if (!shopNamePattern.test(part)) return true;
    if (sawShopSegment) return false;
    sawShopSegment = true;
    return true;
  });
  const normalizedTitle = deduplicatedParts.join(" | ") || rawTitle;

  if (sawShopSegment || normalizedTitle.toLocaleLowerCase().includes(normalizedSiteName.toLocaleLowerCase())) {
    return normalizedTitle;
  }
  return `${normalizedTitle} | ${normalizedSiteName}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
