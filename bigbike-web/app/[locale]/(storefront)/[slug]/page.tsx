import { notFound, permanentRedirect } from "next/navigation";

import type { Locale } from "@/i18n/locale";
import { staticPageSlugs } from "@/lib/content/static-pages";
import { translatePath } from "@/lib/utils/routes";

const CANONICAL_STATIC_PATHS: Record<string, string> = {
  "cach-do-size-dau": "/huong-dan/size-mu/",
  "cach-do-size-trang-phuc": "/huong-dan/size-trang-phuc/",
  "chinh-sach-bao-hanh": "/chinh-sach/chinh-sach-bao-hanh/",
  "chinh-sach-doi-tra-hang": "/chinh-sach/chinh-sach-doi-tra-hang/",
  "chinh-sach-bao-mat-thong-tin": "/chinh-sach/chinh-sach-bao-mat-thong-tin/",
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return staticPageSlugs().map((slug) => ({ slug }));
}

export default async function LegacyStaticPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params as Awaited<typeof params> & { locale: Locale };
  const canonical = CANONICAL_STATIC_PATHS[slug];
  if (!canonical) notFound();
  permanentRedirect(translatePath(canonical, locale));
}
