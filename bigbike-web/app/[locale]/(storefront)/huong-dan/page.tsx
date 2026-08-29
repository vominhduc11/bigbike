import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GuidePage } from "./GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

type GuideLandingProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: GuideLandingProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Guide");
  return buildPublicMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: translatePath("/huong-dan/", locale),
    locale,
    languageAlternates: { vi: translatePath("/huong-dan/", "vi"), en: translatePath("/huong-dan/", "en") },
  });
}

export default async function GuideLandingPage({ params }: GuideLandingProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return await GuidePage({ locale });
}
