import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale";
import { toProductListPath } from "@/lib/utils/routes";

export default async function ProductCategoryIndexPage() {
  const locale = resolveLocale(await getLocale());
  redirect(toProductListPath(locale));
}
