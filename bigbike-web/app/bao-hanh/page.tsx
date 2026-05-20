import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { WarrantyContent } from "./WarrantyContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Warranty");
  return buildPublicMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    canonicalPath: "/bao-hanh/",
    noIndex: false,
  });
}

export default function WarrantyLookupPage() {
  return <WarrantyContent />;
}
