import type { Metadata } from "next";
import { toCanonicalUrl } from "@/lib/utils/routes";

type PublicMetadataInput = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
};

export function buildPublicMetadata(input: PublicMetadataInput): Metadata {
  const metadata: Metadata = {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: toCanonicalUrl(input.canonicalPath),
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

