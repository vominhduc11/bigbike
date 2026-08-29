import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { GuidePage, resolveGuideMeta } from "../GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { getGuideLayout } from "@/lib/content/static-pages";
import type { Locale } from "@/i18n/locale";
import { buildEntryPath } from "../GuidePage";

type Props = {
  params: Promise<{ locale: string; sub: string[] }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return getGuideLayout("vi").entries.map((entry) => ({ sub: [entry.pathSegment] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub, locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const meta = await resolveGuideMeta(sub, locale);

  return buildPublicMetadata({
    title: meta.title,
    description: meta.description,
    canonicalPath: meta.path,
    locale,
    languageAlternates: {
      vi: buildEntryPath(sub[0], "vi"),
      en: buildEntryPath(sub[0], "en"),
    },
    noIndex: false,
  });
}

export default async function GuideSubPage({ params }: Props) {
  const { sub, locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return await GuidePage({ subSegments: sub, locale });
}
