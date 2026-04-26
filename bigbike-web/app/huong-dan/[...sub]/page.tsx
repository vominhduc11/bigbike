import type { Metadata } from "next";
import { GuidePage, resolveGuideRoute } from "../GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";

type Props = {
  params: Promise<{ sub: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub } = await params;
  const route = resolveGuideRoute(sub);

  return buildPublicMetadata({
    title: route.title,
    description: route.description,
    canonicalPath: route.path,
    noIndex: false,
  });
}

export default async function GuideSubPage({ params }: Props) {
  const { sub } = await params;
  return await GuidePage({ subSegments: sub });
}
