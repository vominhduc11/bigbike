import type { Metadata } from "next";
import { toCanonicalUrl } from "@/lib/utils/routes";

const DEFAULT_OG_IMAGE = "/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png";
const SITE_NAME = "BigBike";

type PublicMetadataInput = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  ogImage?: string;
};

export function buildPublicMetadata(input: PublicMetadataInput): Metadata {
  const canonicalUrl = toCanonicalUrl(input.canonicalPath);
  const ogImageUrl = input.ogImage ?? DEFAULT_OG_IMAGE;

  const metadata: Metadata = {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [{ url: ogImageUrl }],
      locale: "vi_VN",
      type: "website",
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

