import type { Metadata } from "next";
import { toCanonicalUrl } from "@/lib/utils/routes";

const DEFAULT_OG_IMAGE = "/wp/logo.png";

type PublicMetadataInput = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article";
  siteName?: string;
  /**
   * Per-language URL paths for `hreflang` alternates (PRODUCT/CATEGORY/BRAND_RULE_003).
   * Canonical stays the vi URL; emit this when an entity has a distinct English slug
   * so Google links the vi/en URLs instead of treating them as duplicates.
   */
  languageAlternates?: { vi: string; en: string };
};

export function buildPublicMetadata(input: PublicMetadataInput): Metadata {
  const canonicalUrl = toCanonicalUrl(input.canonicalPath);
  const ogImageUrl = input.ogImage ?? DEFAULT_OG_IMAGE;

  const metadata: Metadata = {
    title: input.title,
    description: input.description,
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
      title: input.title,
      description: input.description,
      url: canonicalUrl,
      ...(input.siteName ? { siteName: input.siteName } : {}),
      images: [{ url: ogImageUrl }],
      locale: "vi_VN",
      type: input.ogType ?? "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [ogImageUrl],
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
