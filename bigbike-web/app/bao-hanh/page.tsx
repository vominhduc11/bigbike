import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toHomePath } from "@/lib/utils/routes";
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

export default async function WarrantyLookupPage() {
  const [t, tBreadcrumb] = await Promise.all([
    getTranslations("Warranty"),
    getTranslations("Breadcrumb"),
  ]);

  return (
    <>
      <PageHero
        title={t("heading")}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("heading") },
        ]}
      />
      <WarrantyContent />
    </>
  );
}
