import { notFound } from "next/navigation";

import { getBrandBySlug } from "@/lib/api/public-api";
import { isValidSlug } from "@/lib/utils/slug";
import type { Locale } from "@/i18n/locale";

/** Chốt chặn 404 của trang thương hiệu — xem ghi chú ở danh-muc/[slug]/layout.tsx. */
export default async function BrandGuardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = (await params) as { locale: Locale; slug: string };
  if (!isValidSlug(slug)) notFound();

  const brandResult = await getBrandBySlug(slug, locale);
  if (!brandResult.data) notFound();

  return <>{children}</>;
}
