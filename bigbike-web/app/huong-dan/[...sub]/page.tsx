import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { GuidePage, resolveGuideMeta } from "../GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { getGuideLayout } from "@/lib/content/static-pages";

type Props = {
  params: Promise<{ sub: string[] }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return getGuideLayout("vi").entries.map((entry) => ({ sub: [entry.pathSegment] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ sub }, locale] = await Promise.all([params, getLocale()]);
  const meta = await resolveGuideMeta(sub, locale);

  return buildPublicMetadata({
    title: meta.title,
    description: meta.description,
    canonicalPath: meta.path,
    noIndex: false,
  });
}

export default async function GuideSubPage({ params }: Props) {
  const { sub } = await params;
  return await GuidePage({ subSegments: sub });
}
