import { GuideSkeleton } from "@/components/ui/Skeletons";
import { getTranslations } from "next-intl/server";

export default async function GuideLoading() {
  const t = await getTranslations("Loading");
  return <GuideSkeleton label={t("content")} />;
}
