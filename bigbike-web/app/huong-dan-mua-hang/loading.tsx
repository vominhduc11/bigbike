import { StaticPageSkeleton } from "@/components/ui/Skeletons";
import { getTranslations } from "next-intl/server";

export default async function HowToBuyLoading() {
  const t = await getTranslations("Loading");
  return <StaticPageSkeleton title={t("howToBuy")} />;
}
