import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GuidePage } from "./GuidePage";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toPagePath } from "@/lib/utils/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Guide");
  return buildPublicMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: toPagePath("huong-dan"),
  });
}

export default async function GuideLandingPage() {
  return await GuidePage({});
}
