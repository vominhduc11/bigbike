import { ArticleDetailSkeleton } from "@/components/ui/Skeletons";
import { getTranslations } from "next-intl/server";

export default async function ArticleDetailLoading() {
  const t = await getTranslations("Common");
  return <ArticleDetailSkeleton label={t("loading")} />;
}
