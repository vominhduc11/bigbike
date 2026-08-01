import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

type CartLayoutProps = { children: React.ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CartLayoutProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Cart");
  return buildPublicMetadata({ title: t("title"), description: t("metaDescription"), canonicalPath: translatePath("/gio-hang/", locale), locale, noIndex: true });
}

export default async function CartLayout({ children, params }: CartLayoutProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return <>{children}</>;
}
