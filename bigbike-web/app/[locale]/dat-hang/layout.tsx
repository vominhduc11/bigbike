import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

type CheckoutLayoutProps = { children: React.ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CheckoutLayoutProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Checkout");
  return buildPublicMetadata({ title: t("title"), description: t("metaDescription"), canonicalPath: translatePath("/dat-hang/", locale), locale, noIndex: true });
}

export default async function CheckoutLayout({ children, params }: CheckoutLayoutProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  return <>{children}</>;
}
