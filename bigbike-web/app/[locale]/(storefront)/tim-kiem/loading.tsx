import { SearchSkeleton } from "@/components/ui/Skeletons";
import { getTranslations } from "next-intl/server";

export default async function SearchLoading() {
  const t = await getTranslations("Loading");
  return <SearchSkeleton label={t("search")} />;
}
