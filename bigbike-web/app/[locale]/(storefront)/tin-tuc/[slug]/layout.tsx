import { notFound, permanentRedirect } from "next/navigation";

import { getArticleBySlug } from "@/lib/api/public-api";
import { toArticlePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import type { Locale } from "@/i18n/locale";

/** Chốt chặn 404 / chuyển hướng của bài viết — xem ghi chú ở danh-muc/[slug]/layout.tsx. */
export default async function ArticleGuardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug?: string }>;
}) {
  const { slug = "", locale } = (await params) as { locale: Locale; slug?: string };
  if (!isValidSlug(slug)) notFound();

  const result = await getArticleBySlug(slug, locale);
  if (!result.data && result.error?.status === 404) notFound();

  if (result.data) {
    const preferredSlug =
      locale === "en" ? result.data.slugEn?.trim() || result.data.slug : result.data.slug;
    if (slug !== preferredSlug) permanentRedirect(toArticlePath(preferredSlug, locale));
  }

  return <>{children}</>;
}
