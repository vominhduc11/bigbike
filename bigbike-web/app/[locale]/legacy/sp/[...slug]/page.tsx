import type { Metadata } from "next";

import LegacyProductPage, {
  generateMetadata as generateLegacyMetadata,
} from "@/app/[locale]/sp/[slug].html/page";

type LegacyProductAliasProps = {
  params: Promise<{ locale?: string; slug?: string[] }>;
};

export async function generateMetadata({ params }: LegacyProductAliasProps): Promise<Metadata> {
  return generateLegacyMetadata({ params });
}

export default function LegacyProductAlias({ params }: LegacyProductAliasProps) {
  return LegacyProductPage({ params });
}
