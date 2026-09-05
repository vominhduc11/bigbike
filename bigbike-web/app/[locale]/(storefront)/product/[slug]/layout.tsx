import { notFound, permanentRedirect } from "next/navigation";
import { getProductBySlug } from "@/lib/api/public-api";
import { toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import type { Locale } from "@/i18n/locale";

// THỬ NGHIỆM — guard chuyển lên layout để loading.tsx không nuốt mã trạng thái.
export default async function ProductGuardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = (await params) as { locale: Locale; slug: string };
  if (!isValidSlug(slug)) notFound();
  const result = await getProductBySlug(slug, locale);
  const product = result.data;
  if (!product) notFound();
  if (product.discontinued) notFound();
  const preferredSlug = locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
  if (slug !== preferredSlug) permanentRedirect(toProductPath(preferredSlug, locale));
  return <>{children}</>;
}
