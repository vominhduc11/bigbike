import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readDefaultHeroAssets } from "@/lib/utils/page-hero";
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
  const [t, tBreadcrumb, settingsResult] = await Promise.all([
    getTranslations("Warranty"),
    getTranslations("Breadcrumb"),
    listPublicSettings(),
  ]);
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);

  return (
    <>
      <PageHero
        title={t("heading")}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("heading") },
        ]}
        defaultBgUrl={defaultHero.defaultBgUrl}
        defaultIllustrationUrl={defaultHero.defaultIllustrationUrl}
      />
      <WarrantyContent />
    </>
  );
}
