import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GuidePage, resolveGuideRoute } from "../GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";

type Props = {
  params: Promise<{ sub: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ sub }, t] = await Promise.all([params, getTranslations("Guide")]);
  const route = resolveGuideRoute(sub);

  return buildPublicMetadata({
    title: t(route.titleKey),
    description: t(route.descriptionKey),
    canonicalPath: route.path,
    noIndex: false,
  });
}

export default async function GuideSubPage({ params }: Props) {
  const { sub } = await params;
  return await GuidePage({ subSegments: sub });
}
