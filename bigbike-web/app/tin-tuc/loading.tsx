import { ArticleListSkeleton } from "@/components/ui/Skeletons";
import { getTranslations } from "next-intl/server";

export default async function ArticleListLoading() {
  const t = await getTranslations("Common");
  return <ArticleListSkeleton label={t("loading")} />;
}
